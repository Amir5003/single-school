/**
 * Regression tests for the paid active→active refresh in
 * lifecycle.service.transitionTo.
 *
 * Bug: the idempotency guard returned early on same-status transitions, so a
 * paid upgrade (starter→standard while `active`) logged payment_success but
 * never applied the new plan/cycle/window.
 */

const School = require('../../src/models/School.model');
const SubscriptionEvent = require('../../src/models/SubscriptionEvent.model');
const lifecycle = require('../../src/services/subscription/lifecycle.service');
const pricing = require('../../src/services/subscription/pricing.service');

const DAY_MS = 24 * 60 * 60 * 1000;

const createActiveSchool = async ({ planType = 'starter', billingCycle = 'monthly' } = {}) => {
  const now = new Date();
  return School.create({
    name: 'Lifecycle Test School',
    slug: `lifecycle-${Math.random().toString(36).slice(2, 8)}`,
    isActive: true,
    subscription: {
      status: 'active',
      planType,
      billingCycle,
      subscriptionStartedAt: new Date(now.getTime() - 10 * DAY_MS),
      subscriptionEndsAt: new Date(now.getTime() + 20 * DAY_MS),
      nextBillingDate: new Date(now.getTime() + 20 * DAY_MS),
      basePrice: pricing.calculateAmount({ planType, billingCycle }),
      scheduledChange: {
        planType: 'starter',
        billingCycle: 'monthly',
        applyAt: new Date(now.getTime() + 20 * DAY_MS),
      },
    },
  });
};

describe('lifecycle.transitionTo — paid active→active refresh', () => {
  test('applies an upgrade (starter/monthly → standard/annual) while active', async () => {
    const school = await createActiveSchool();

    const updated = await lifecycle.transitionTo(school.toObject(), 'active', {
      planType: 'standard',
      billingCycle: 'annual',
      providerPaymentId: 'pay_upgrade_1',
      paymentProvider: 'stub',
    });

    expect(updated.subscription.status).toBe('active');
    expect(updated.subscription.planType).toBe('standard');
    expect(updated.subscription.billingCycle).toBe('annual');
    expect(updated.subscription.basePrice).toBe(
      pricing.calculateAmount({ planType: 'standard', billingCycle: 'annual' })
    );
    // Fresh ~365-day window
    const windowDays =
      (new Date(updated.subscription.subscriptionEndsAt) - Date.now()) / DAY_MS;
    expect(windowDays).toBeGreaterThan(360);
    // Paid refresh clears any scheduled change and records the payment
    expect(updated.subscription.scheduledChange).toBeNull();
    expect(updated.subscription.lastPaymentId).toBe('pay_upgrade_1');

    // Audit trail: logged as plan_changed with previous plan/cycle
    const event = await SubscriptionEvent.findOne({
      schoolId: school._id,
      type: 'plan_changed',
    }).lean();
    expect(event).toBeTruthy();
    expect(event.metadata.previousPlan).toBe('starter');
    expect(event.metadata.previousCycle).toBe('monthly');
    expect(event.metadata.planType).toBe('standard');
  });

  test('metadata-less active→active stays an idempotent no-op', async () => {
    const school = await createActiveSchool();
    const before = school.toObject();

    const result = await lifecycle.transitionTo(before, 'active', {});

    // Unchanged document returned; nothing persisted, no event logged
    expect(result.subscription.planType).toBe('starter');
    const fresh = await School.findById(school._id).lean();
    expect(fresh.subscription.planType).toBe('starter');
    expect(fresh.subscription.scheduledChange).toBeTruthy();
    const events = await SubscriptionEvent.find({ schoolId: school._id }).lean();
    expect(events).toHaveLength(0);
  });

  test('illegal transitions still throw', async () => {
    const school = await createActiveSchool();
    await expect(
      lifecycle.transitionTo(school.toObject(), 'trial', {})
    ).rejects.toThrow(/Illegal subscription transition/);
  });
});
