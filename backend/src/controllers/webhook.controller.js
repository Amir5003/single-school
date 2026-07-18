const School = require('../models/School.model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const subscriptionService = require('../services/subscription');
const logger = require('../utils/logger');

/**
 * POST /api/v1/webhooks/payment
 *
 * Razorpay webhook receiver. Mounted UNAUTHENTICATED — security comes from
 * the HMAC signature verification done inside paymentProvider.parseWebhook.
 *
 * Idempotent: a duplicate event for the same providerPaymentId is logged
 * but does not re-activate the subscription.
 */
const handlePaymentWebhook = async (req, res, next) => {
  try {
    let payload;
    try {
      payload = subscriptionService.paymentProvider.parseWebhook(req);
    } catch (err) {
      logger.error(`[webhook] parse failed: ${err.message}`);
      throw err;
    }

    if (!payload.signatureVerified) {
      logger.warn('[webhook] signature verification failed');
      throw new ApiError(400, 'Invalid webhook signature');
    }

    if (!payload.schoolId) {
      logger.warn('[webhook] missing schoolId in webhook notes');
      throw new ApiError(400, 'Missing schoolId in webhook payload');
    }

    // Idempotency guard.
    if (
      payload.providerPaymentId &&
      (await subscriptionService.event.hasPaymentBeenProcessed(payload.providerPaymentId))
    ) {
      logger.info(`[webhook] duplicate event for ${payload.providerPaymentId} — ignoring`);
      return res.json(new ApiResponse(200, { duplicate: true }, 'Already processed'));
    }

    const school = await School.findById(payload.schoolId).lean();
    if (!school) {
      logger.warn(`[webhook] unknown school ${payload.schoolId}`);
      throw new ApiError(404, 'School not found');
    }

    const event = payload.event || '';
    const isSuccess =
      event.startsWith('payment.captured') ||
      event.startsWith('payment.authorized') ||
      payload.status === 'captured';
    const isFailure = event.startsWith('payment.failed') || payload.status === 'failed';

    if (isSuccess) {
      const planType = school.subscription?.planType || 'standard';

      await subscriptionService.event.logEvent(school._id, 'payment_success', {
        providerOrderId: payload.providerOrderId,
        providerPaymentId: payload.providerPaymentId,
        amount: payload.amount,
        currency: 'INR',
        planType,
        activeStudentCount: school.subscription?.activeStudentCount || 0,
        source: 'webhook',
      });

      await subscriptionService.lifecycle.transitionTo(school, 'active', {
        planType,
        providerPaymentId: payload.providerPaymentId,
        paymentProvider: subscriptionService.paymentProvider.name,
        source: 'webhook',
      });

      return res.json(new ApiResponse(200, { activated: true }, 'Subscription activated'));
    }

    if (isFailure) {
      await subscriptionService.event.logEvent(school._id, 'payment_failed', {
        providerOrderId: payload.providerOrderId,
        providerPaymentId: payload.providerPaymentId,
        amount: payload.amount,
        currency: 'INR',
      });
      return res.json(new ApiResponse(200, { failed: true }, 'Payment failure recorded'));
    }

    // Unknown but signed — record and ack so Razorpay stops retrying.
    await subscriptionService.event.logEvent(school._id, 'payment_failed', {
      providerOrderId: payload.providerOrderId,
      providerPaymentId: payload.providerPaymentId,
      reason: `unhandled event: ${event}`,
    });
    return res.json(new ApiResponse(200, { handled: false }, 'Event acknowledged'));
  } catch (err) {
    return next(err);
  }
};

module.exports = { handlePaymentWebhook };
