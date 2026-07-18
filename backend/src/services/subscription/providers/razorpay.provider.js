/**
 * Razorpay payment provider.
 *
 * Talks to https://api.razorpay.com/v1/orders using HTTP Basic auth and
 * verifies inbound webhook signatures + checkout-success signatures using
 * HMAC-SHA256. Does NOT depend on the `razorpay` npm package — uses Node's
 * built-in `https` to keep the dependency footprint flat.
 */

const crypto = require('crypto');
const https = require('https');
const ApiError = require('../../../utils/ApiError');

const RAZORPAY_API_HOST = 'api.razorpay.com';

const env = () => ({
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
});

const requireConfigured = () => {
  const { keyId, keySecret } = env();
  if (!keyId || !keySecret) {
    throw new ApiError(503, 'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
};

const httpsRequest = ({ method, path, body, auth }) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        host: RAZORPAY_API_HOST,
        path,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(auth).toString('base64')}`,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new ApiError(res.statusCode || 500, parsed?.error?.description || 'Razorpay API error'));
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

/**
 * @param {{ schoolId: string, amount: number, currency?: string, notes?: object }} args
 */
const createOrder = async ({ schoolId, amount, currency = 'INR', notes = {} }) => {
  requireConfigured();
  const { keyId, keySecret } = env();

  // Razorpay expects paise — convert rupees to paise.
  const amountInPaise = Math.round(Number(amount) * 100);

  // Razorpay caps `receipt` at 40 chars. Use a short schoolId tail + a
  // base36 timestamp so we stay under the limit but the receipt stays
  // human-traceable in the Razorpay dashboard.
  const shortSchool = String(schoolId).slice(-10);
  const shortTs = Date.now().toString(36);
  const receipt = `sch_${shortSchool}_${shortTs}`.slice(0, 40);

  const order = await httpsRequest({
    method: 'POST',
    path: '/v1/orders',
    body: {
      amount: amountInPaise,
      currency,
      receipt,
      notes: { ...notes, schoolId: String(schoolId) },
    },
    auth: `${keyId}:${keySecret}`,
  });

  return {
    orderId: order.id,
    providerOrderId: order.id,
    amount: amountInPaise / 100,
    currency,
    keyId,
    provider: 'razorpay',
    schoolId,
    notes: order.notes || {},
  };
};

const verifyPayment = async ({ orderId, providerPaymentId, providerSignature }) => {
  const { keySecret } = env();
  if (!keySecret) {
    throw new ApiError(503, 'Razorpay key secret not configured');
  }
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${providerPaymentId}`)
    .digest('hex');
  return {
    verified: expected === providerSignature,
    paymentId: providerPaymentId,
    orderId,
  };
};

const parseWebhook = (req) => {
  const { webhookSecret } = env();
  if (!webhookSecret) {
    throw new ApiError(503, 'Razorpay webhook secret not configured');
  }

  // Express must give us the raw body for signature verification. We expose
  // `req.rawBody` from a verify callback in app.js.
  const rawBody =
    req.rawBody instanceof Buffer
      ? req.rawBody.toString('utf8')
      : typeof req.rawBody === 'string'
        ? req.rawBody
        : JSON.stringify(req.body);

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  const received = req.headers['x-razorpay-signature'];
  const signatureVerified = expected === received;

  const body = req.body || {};
  const entity = body.payload?.payment?.entity || {};
  return {
    event: body.event || null,
    schoolId: entity.notes?.schoolId || null,
    providerOrderId: entity.order_id || null,
    providerPaymentId: entity.id || null,
    amount: entity.amount ? entity.amount / 100 : 0,
    status: entity.status || null,
    signatureVerified,
  };
};

module.exports = {
  name: 'razorpay',
  createOrder,
  verifyPayment,
  parseWebhook,
};
