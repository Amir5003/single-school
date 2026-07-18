/**
 * Unit tests for subscription pricing — list vs sale price, the derived
 * strike-through discount, and the optional global PRICING_PROMO_PCT lever.
 *
 * pricing.service reads PRICING_PROMO_PCT via config/env.js at load time, so
 * the promo cases set the env var and re-require the module through jest.
 */

const ANNUAL = 0.15; // annual discount kept in sync with pricing.service

const load = () => {
  jest.resetModules();
  return require('../../src/services/subscription/pricing.service');
};

afterEach(() => {
  delete process.env.PRICING_PROMO_PCT;
  jest.resetModules();
});

describe('pricing.service — no promo (default)', () => {
  let pricing;
  beforeEach(() => {
    delete process.env.PRICING_PROMO_PCT;
    pricing = load();
  });

  test('calculateAmount charges the per-plan sale price (monthly)', () => {
    expect(pricing.calculateAmount({ planType: 'starter' })).toBe(99);
    expect(pricing.calculateAmount({ planType: 'standard' })).toBe(299);
    expect(pricing.calculateAmount({ planType: 'premium' })).toBe(599);
  });

  test('annual applies the 15% annual discount on the sale price', () => {
    expect(
      pricing.calculateAmount({ planType: 'starter', billingCycle: 'annual' })
    ).toBe(Math.round(99 * 12 * (1 - ANNUAL))); // 1010
  });

  test('calculateListAmount returns the original list price', () => {
    expect(pricing.calculateListAmount({ planType: 'starter' })).toBe(499);
    expect(
      pricing.calculateListAmount({ planType: 'starter', billingCycle: 'annual' })
    ).toBe(Math.round(499 * 12 * (1 - ANNUAL))); // 5090
  });

  test('previewPricing surfaces list price + discount flags', () => {
    const starter = pricing.previewPricing().find((p) => p.id === 'starter');
    expect(starter.pricing.monthly).toBe(99);
    expect(starter.pricing.listMonthly).toBe(499);
    expect(starter.pricing.hasDiscount).toBe(true);
    expect(starter.pricing.discountPct).toBeCloseTo(1 - 99 / 499, 4);
    expect(starter.pricing.listAnnual).toBe(Math.round(499 * 12 * (1 - ANNUAL)));
    expect(starter.pricing.annualDiscountPct).toBe(ANNUAL);
  });
});

describe('pricing.service — 10% global promo', () => {
  let pricing;
  beforeEach(() => {
    process.env.PRICING_PROMO_PCT = '0.10';
    pricing = load();
  });

  test('effective monthly price drops by the promo, on top of the sale price', () => {
    expect(pricing.calculateAmount({ planType: 'starter' })).toBe(Math.round(99 * 0.9)); // 89
  });

  test('list price is unchanged and the shown discount deepens', () => {
    const starter = pricing.previewPricing().find((p) => p.id === 'starter');
    expect(starter.pricing.listMonthly).toBe(499);
    expect(starter.pricing.monthly).toBe(89);
    expect(starter.pricing.hasDiscount).toBe(true);
    expect(starter.pricing.discountPct).toBeCloseTo(1 - 89 / 499, 4);
  });
});

describe('pricing.service — env validation', () => {
  test('an out-of-range promo throws at load', () => {
    process.env.PRICING_PROMO_PCT = '1.5';
    expect(() => load()).toThrow(/PRICING_PROMO_PCT/);
  });
});
