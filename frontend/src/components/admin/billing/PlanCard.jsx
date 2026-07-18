/**
 * Plan tile.
 *
 * Props:
 *  - plan                   { id, label, blurb, studentCapDisplay, pricing: { monthly, annual, annualEffectiveMonthly, annualSavings, annualDiscountPct }, recommended, highlights }
 *  - billingCycle           'monthly' | 'annual'
 *  - selected               bool
 *  - disabled               bool — locks card (e.g. cap conflict)
 *  - disabledReason         string — tooltip text when disabled
 *  - currentPlan            string — id of the plan the school is currently on
 *  - onSelect               () => void
 */
export default function PlanCard({
  plan,
  billingCycle = 'monthly',
  selected = false,
  disabled = false,
  disabledReason = '',
  currentPlan = null,
  onSelect,
}) {
  const isCurrent = currentPlan === plan.id;
  const isComingSoon = Boolean(plan.comingSoon);
  const cycleAmount =
    billingCycle === 'annual' ? plan.pricing.annual : plan.pricing.monthly;
  const cycleListAmount =
    billingCycle === 'annual'
      ? plan.pricing.listAnnual ?? plan.pricing.annual
      : plan.pricing.listMonthly ?? plan.pricing.monthly;
  const hasDiscount = Boolean(plan.pricing.hasDiscount) && cycleListAmount > cycleAmount;
  const discountLabel = plan.pricing.discountPct
    ? `${Math.round(plan.pricing.discountPct * 100)}% off`
    : null;
  const subLabel =
    billingCycle === 'annual'
      ? `₹${plan.pricing.annualEffectiveMonthly.toLocaleString('en-IN')} / month, billed annually`
      : 'per month, billed monthly';

  // Coming-soon plans behave like disabled cards — the underlying handler is
  // suppressed and an explanatory pill replaces the price.
  const effectivelyDisabled = disabled || isComingSoon;
  const effectiveDisabledReason =
    isComingSoon && !disabledReason
      ? `${plan.label} is coming soon. We'll enable it as soon as it's ready.`
      : disabledReason;

  const borderClass = effectivelyDisabled
    ? 'border-gray-200 opacity-60 cursor-not-allowed'
    : selected
      ? 'border-indigo-600 ring-2 ring-indigo-200'
      : 'border-gray-200 hover:border-indigo-300';

  return (
    <button
      type="button"
      onClick={effectivelyDisabled ? undefined : onSelect}
      disabled={effectivelyDisabled}
      title={effectivelyDisabled ? effectiveDisabledReason : undefined}
      className={[
        'relative w-full text-left rounded-2xl bg-white p-5 border transition-all duration-150',
        borderClass,
        effectivelyDisabled ? '' : 'shadow-sm hover:shadow-md',
      ].join(' ')}
      aria-pressed={selected}
    >
      {plan.recommended && !isComingSoon && (
        <span className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-indigo-600 text-white shadow-sm">
          Recommended
        </span>
      )}
      {isComingSoon && (
        <span className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
          Coming Soon
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-600 text-white shadow-sm">
          Current
        </span>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{plan.label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{plan.blurb}</p>
        </div>
        {selected && !effectivelyDisabled && (
          <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      <div className="mt-4 flex items-baseline flex-wrap gap-x-2 gap-y-1">
        <span className="text-3xl font-bold text-gray-900">
          ₹{cycleAmount.toLocaleString('en-IN')}
        </span>
        <span className="text-sm text-gray-500">
          {billingCycle === 'annual' ? '/ year' : '/ month'}
        </span>
        {hasDiscount && (
          <span className="text-sm text-gray-400 line-through">
            ₹{cycleListAmount.toLocaleString('en-IN')}
          </span>
        )}
        {hasDiscount && discountLabel && (
          <span className="text-[11px] font-semibold uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
            {discountLabel}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">{subLabel}</p>

      {billingCycle === 'annual' && plan.pricing.annualSavings > 0 && (
        <p className="mt-1 text-xs font-semibold text-emerald-700">
          Save ₹{plan.pricing.annualSavings.toLocaleString('en-IN')} per year
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-700 mb-2">
          {plan.studentCapDisplay} students
        </p>
        {plan.highlights?.length > 0 && (
          <ul className="space-y-1.5">
            {plan.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-xs text-gray-600">
                <svg className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
                </svg>
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      {effectivelyDisabled && effectiveDisabledReason && (
        <p
          className={`mt-3 text-[11px] ${isComingSoon ? 'text-amber-700' : 'text-rose-600'}`}
        >
          {effectiveDisabledReason}
        </p>
      )}
    </button>
  );
}
