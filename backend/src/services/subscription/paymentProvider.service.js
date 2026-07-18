/**
 * Payment provider selection facade.
 *
 * Selects the live Razorpay provider when `PAYMENTS_ENABLED=true` and credentials
 * are present in the environment. Otherwise falls back to the deterministic
 * stub — used in dev, CI, and tests.
 *
 * Controllers must depend only on this facade; never import a provider file
 * directly.
 */

const stub = require('./providers/stub.provider');
const razorpay = require('./providers/razorpay.provider');

const isProductionPaymentsEnabled = () =>
  process.env.PAYMENTS_ENABLED === 'true' &&
  Boolean(process.env.RAZORPAY_KEY_ID) &&
  Boolean(process.env.RAZORPAY_KEY_SECRET);

const select = () => (isProductionPaymentsEnabled() ? razorpay : stub);

module.exports = {
  get name() {
    return select().name;
  },
  createOrder: (...args) => select().createOrder(...args),
  verifyPayment: (...args) => select().verifyPayment(...args),
  parseWebhook: (...args) => select().parseWebhook(...args),
  isLive: isProductionPaymentsEnabled,
};
