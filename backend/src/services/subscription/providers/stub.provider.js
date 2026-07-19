/**
 * Stub payment provider — used when PAYMENTS_ENABLED is not "true" or when
 * RAZORPAY_KEY_ID is unset. Returns deterministic IDs and accepts any
 * signature. Suitable for local dev, CI, and integration tests.
 *
 * NEVER use this in production: the live razorpay.provider must be selected.
 */

const crypto = require('crypto');

const id = (prefix) =>
  `${prefix}_stub_${crypto.randomBytes(6).toString('hex')}`;

/**
 * @param {{ schoolId: string, amount: number, currency?: string, notes?: object }} args
 */
const createOrder = async ({ schoolId, amount, currency = 'INR', notes = {} }) => {
  const orderId = id('order');
  return {
    orderId,
    providerOrderId: orderId,
    amount,
    currency,
    keyId: 'stub_key',
    provider: 'stub',
    schoolId,
    notes: { ...notes, schoolId },
  };
};

const verifyPayment = async ({ orderId, providerPaymentId }) => ({
  verified: true,
  paymentId: providerPaymentId || id('pay'),
  orderId,
});

const parseWebhook = (req) => {
  const body = req.body || {};
  const notes = body.payload?.payment?.entity?.notes || {};
  return {
    event: body.event || 'payment.captured',
    schoolId: body.schoolId || notes.schoolId || null,
    // Mirror razorpay.provider: surface the plan/cycle the order was for.
    planType: body.planType || notes.planType || null,
    billingCycle: body.billingCycle || notes.billingCycle || null,
    providerOrderId: body.payload?.payment?.entity?.order_id || null,
    providerPaymentId: body.payload?.payment?.entity?.id || id('pay'),
    amount: body.payload?.payment?.entity?.amount
      ? body.payload.payment.entity.amount / 100
      : 0,
    status: body.payload?.payment?.entity?.status || 'captured',
    signatureVerified: true,
  };
};

module.exports = {
  name: 'stub',
  createOrder,
  verifyPayment,
  parseWebhook,
};
