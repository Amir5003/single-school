/**
 * Right-hand summary card inside the upgrade modal — shows the live total
 * for the selected plan + billing cycle.
 */
export default function PricingSummary({ plan, billingCycle = 'monthly' }) {
  if (!plan) return null;
  const isAnnual = billingCycle === 'annual';
  const amount = isAnnual ? plan.pricing.annual : plan.pricing.monthly;
  const listAmount = isAnnual
    ? plan.pricing.listAnnual ?? amount
    : plan.pricing.listMonthly ?? amount;
  const hasDiscount = Boolean(plan.pricing.hasDiscount) && listAmount > amount;
  const discountLabel = plan.pricing.discountPct
    ? `${Math.round(plan.pricing.discountPct * 100)}% off`
    : null;
  const annualPct = Math.round((plan.pricing.annualDiscountPct ?? 0.15) * 100);
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Order summary</h4>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">Plan</dt>
          <dd className="font-medium text-gray-900">{plan.label}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">Billing cycle</dt>
          <dd className="font-medium text-gray-900">
            {isAnnual ? 'Annual (12 months)' : 'Monthly'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">Includes</dt>
          <dd className="text-gray-900">{plan.studentCapDisplay} students</dd>
        </div>
        {hasDiscount && (
          <div className="flex justify-between">
            <dt className="text-gray-600">Original</dt>
            <dd className="text-gray-400 line-through">
              ₹{listAmount.toLocaleString('en-IN')}
              {discountLabel ? ` · ${discountLabel}` : ''}
            </dd>
          </div>
        )}
        {isAnnual && plan.pricing.annualSavings > 0 && (
          <div className="flex justify-between text-emerald-700">
            <dt>Annual discount</dt>
            <dd className="font-medium">
              − ₹{plan.pricing.annualSavings.toLocaleString('en-IN')} ({annualPct}% off)
            </dd>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-baseline">
          <dt className="font-semibold text-gray-900">
            {isAnnual ? 'Yearly total' : 'Monthly total'}
          </dt>
          <dd className="text-xl font-bold text-indigo-700">
            ₹{amount.toLocaleString('en-IN')}
          </dd>
        </div>
        {isAnnual && (
          <p className="text-[11px] text-gray-500">
            ≈ ₹{plan.pricing.annualEffectiveMonthly.toLocaleString('en-IN')} / month
          </p>
        )}
      </dl>
      <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
        {isAnnual
          ? 'Billed once per year. Cancel anytime — your remaining time stays active until the cycle ends.'
          : `Billed monthly. Switch to annual anytime to save ${annualPct}%.`}
      </p>
    </div>
  );
}
