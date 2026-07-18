const SubscriptionEvent = require('../../models/SubscriptionEvent.model');
const logger = require('../../utils/logger');

/**
 * Append-only writer for `SubscriptionEvent`. Never throws upward — event
 * writes are best-effort and must never break the primary flow that triggered
 * them.
 *
 * @param {string|ObjectId} schoolId
 * @param {string} type             One of SubscriptionEvent.TYPES
 * @param {object} [metadata]
 * @param {object} [opts]
 * @param {ClientSession} [opts.session]  Mongoose transaction session
 * @returns {Promise<SubscriptionEvent|null>}
 */
const logEvent = async (schoolId, type, metadata = {}, { session } = {}) => {
  try {
    if (session) {
      const [doc] = await SubscriptionEvent.create([{ schoolId, type, metadata }], { session });
      return doc;
    }
    return await SubscriptionEvent.create({ schoolId, type, metadata });
  } catch (err) {
    logger.error(
      `[subscription.event] Failed to log ${type} for school ${schoolId}: ${err.message}`
    );
    return null;
  }
};

/**
 * Has a webhook event for this payment id already been processed?
 *
 * @param {string} providerPaymentId
 * @returns {Promise<boolean>}
 */
const hasPaymentBeenProcessed = async (providerPaymentId) => {
  if (!providerPaymentId) return false;
  const existing = await SubscriptionEvent.exists({
    type: 'payment_success',
    'metadata.providerPaymentId': providerPaymentId,
  });
  return Boolean(existing);
};

/**
 * Return the latest N events for a school, newest first.
 */
const listForSchool = async (schoolId, limit = 50) =>
  SubscriptionEvent.find({ schoolId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
    .lean();

module.exports = { logEvent, hasPaymentBeenProcessed, listForSchool };
