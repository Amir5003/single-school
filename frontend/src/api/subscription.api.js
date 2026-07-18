import axiosInstance from './axiosInstance';

// ── School-admin endpoints ───────────────────────────────────────────────────

export const getSubscription = () =>
  axiosInstance.get('/subscription').then((r) => r.data);

export const getPricing = () =>
  axiosInstance.get('/subscription/pricing').then((r) => r.data);

export const getSubscriptionHistory = () =>
  axiosInstance.get('/subscription/history').then((r) => r.data);

export const createUpgradeOrder = ({ planType, billingCycle = 'monthly' }) =>
  axiosInstance
    .post('/subscription/upgrade', { planType, billingCycle })
    .then((r) => r.data);

export const verifySubscriptionPayment = ({
  orderId,
  providerPaymentId,
  providerSignature,
  planType,
  billingCycle,
}) =>
  axiosInstance
    .post('/subscription/verify-payment', {
      orderId,
      providerPaymentId,
      providerSignature,
      planType,
      billingCycle,
    })
    .then((r) => r.data);

export const scheduleDowngrade = ({ planType, billingCycle = 'monthly', reason }) =>
  axiosInstance
    .post('/subscription/schedule-downgrade', { planType, billingCycle, reason })
    .then((r) => r.data);

export const cancelScheduledChange = () =>
  axiosInstance.delete('/subscription/scheduled-change').then((r) => r.data);

export const cancelSubscription = (reason) =>
  axiosInstance.post('/subscription/cancel', { reason }).then((r) => r.data);

// ── Super-admin (platform) endpoints ─────────────────────────────────────────

export const listPlatformSubscriptions = (params = {}) =>
  axiosInstance.get('/platform/subscriptions', { params }).then((r) => r.data);

export const getPlatformSubscriptionAnalytics = () =>
  axiosInstance.get('/platform/subscriptions/analytics').then((r) => r.data);

export const getPlatformSubscriptionEvents = (schoolId) =>
  axiosInstance
    .get(`/platform/subscriptions/${schoolId}/events`)
    .then((r) => r.data);
