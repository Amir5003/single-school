# Data Model: Subscription & Billing

This document is the authoritative reference for the new and changed collections introduced by feature 006.

---

## 1. `School` (changed — embedded `subscription` subdocument added)

```js
{
  _id: ObjectId,
  name: String,
  slug: String (unique, lowercase),
  slugLockedAt: Date,
  plan: 'free' | 'standard' | 'premium',   // legacy — kept; mirrors subscription.planType
  isActive: Boolean,
  branding: { … unchanged … },

  // ── NEW ────────────────────────────────────────────────────────────────────
  subscription: {
    status: 'trial' | 'trial_limit_reached' | 'grace_period' | 'active' | 'expired' | 'cancelled',
    planType: 'starter' | 'standard' | 'premium',

    trialStartedAt: Date,
    trialEndsAt: Date,

    graceStartedAt: Date | null,
    graceEndsAt: Date | null,

    subscriptionStartedAt: Date | null,
    subscriptionEndsAt: Date | null,

    activeStudentCount: Number,            // cached; recomputed by hooks
    maxTrialStudents: Number,              // default 50

    basePrice: Number,                     // snapshot at activation, INR
    perStudentPrice: Number,               // snapshot at activation, INR

    lastPaymentAt: Date | null,
    lastPaymentId: String | null,          // provider payment id

    nextBillingDate: Date | null,
    paymentProvider: 'razorpay' | null,
  },

  createdAt, updatedAt
}
```

### Indexes
- `slug` unique (existing)
- `isActive`, `plan` (existing)
- `'subscription.status'`
- `'subscription.trialEndsAt'`
- `'subscription.graceEndsAt'`
- `'subscription.subscriptionEndsAt'`

### Default on creation (during onboarding)
```js
subscription: {
  status: 'trial',
  planType: 'starter',
  trialStartedAt: now,
  trialEndsAt: now + 30 days,
  graceStartedAt: null,
  graceEndsAt: null,
  subscriptionStartedAt: null,
  subscriptionEndsAt: null,
  activeStudentCount: 0,
  maxTrialStudents: 50,
  basePrice: 0,
  perStudentPrice: 0,
  lastPaymentAt: null,
  lastPaymentId: null,
  nextBillingDate: null,
  paymentProvider: null,
}
```

### Migration (existing schools)
Existing schools without a `subscription` are treated as legacy paying customers and migrated to:
```js
{
  status: 'active',
  planType: 'standard',
  trialStartedAt: school.createdAt,
  trialEndsAt: school.createdAt + 30 days,
  subscriptionStartedAt: now,
  subscriptionEndsAt: now + 365 days,
  activeStudentCount: <recounted live>,
  maxTrialStudents: 50,
  basePrice: <standard plan base>,
  perStudentPrice: <standard plan per-student>,
}
```

---

## 2. `SubscriptionEvent` (new collection)

Append-only audit log.

```js
{
  _id: ObjectId,
  schoolId: ObjectId (ref School, required, indexed),
  type:
    | 'trial_started'
    | 'trial_warning'
    | 'trial_limit_reached'
    | 'grace_started'
    | 'subscription_activated'
    | 'payment_success'
    | 'payment_failed'
    | 'subscription_expired'
    | 'subscription_cancelled'
    | 'student_count_recalculated'
    | 'migrated',
  metadata: Mixed,
  // common metadata keys:
  //   - previousStatus, newStatus
  //   - providerOrderId, providerPaymentId
  //   - amount, currency
  //   - reason
  //   - actorUserId           (for cancellations)
  createdAt: Date (default Date.now),
}
```

### Indexes
- `{ schoolId: 1, createdAt: -1 }` — fast school-history queries.
- `{ 'metadata.providerPaymentId': 1 }` sparse — webhook idempotency.

### Retention
None. Append-only. Retain forever — financial/legal audit value.

---

## 3. Derived state — `activeStudentCount`

Definition: a student is **active** when
- `Student.isDeleted == false`, AND
- linked `User.isActive == true`, AND
- linked `User.approvalStatus == 'approved'`.

The count is stored on `school.subscription.activeStudentCount` as a cached integer, kept in sync by `subscription/studentCount.service.js` after:
- student create
- student soft-delete
- student user-approval flip
- student user-deactivation

A nightly self-heal inside `subscriptionLifecycleJob` recounts and corrects drift, emitting a `student_count_recalculated` event when the cached value differed.

---

## 4. Pricing (in-code, not in DB)

```js
const PLANS = {
  starter:  { basePrice: 999,  perStudentPrice: 15, label: 'Starter',  blurb: 'For new and small schools' },
  standard: { basePrice: 2499, perStudentPrice: 12, label: 'Standard', blurb: 'For growing schools', recommended: true },
  premium:  { basePrice: 4999, perStudentPrice: 10, label: 'Premium',  blurb: 'For multi-campus institutions' },
};
```

All amounts in INR rupees. Razorpay receives paise (`amount * 100`).

The monthly amount is computed as:
```
monthlyAmount = PLANS[planType].basePrice + PLANS[planType].perStudentPrice * activeStudentCount
```

---

## 5. Sample documents

### School in trial
```json
{
  "_id": "65a...",
  "name": "Greenwood High",
  "slug": "greenwood-high",
  "subscription": {
    "status": "trial",
    "planType": "starter",
    "trialStartedAt": "2026-05-25T00:00:00Z",
    "trialEndsAt":   "2026-06-24T00:00:00Z",
    "activeStudentCount": 22,
    "maxTrialStudents": 50,
    "basePrice": 0,
    "perStudentPrice": 0
  }
}
```

### School in expired
```json
{
  "_id": "65b...",
  "name": "Sunrise Academy",
  "slug": "sunrise",
  "subscription": {
    "status": "expired",
    "planType": "starter",
    "trialStartedAt": "2026-04-01T00:00:00Z",
    "trialEndsAt":   "2026-05-01T00:00:00Z",
    "graceStartedAt": "2026-05-01T00:00:00Z",
    "graceEndsAt":   "2026-05-08T00:00:00Z",
    "activeStudentCount": 60,
    "maxTrialStudents": 50,
    "basePrice": 0,
    "perStudentPrice": 0
  }
}
```

### Sample event — payment success
```json
{
  "schoolId": "65a...",
  "type": "payment_success",
  "metadata": {
    "providerOrderId":  "order_NfPq...",
    "providerPaymentId": "pay_NfPq...",
    "amount": 3219,
    "currency": "INR",
    "planType": "standard",
    "activeStudentCount": 60,
    "previousStatus": "grace_period",
    "newStatus": "active"
  },
  "createdAt": "2026-05-25T11:42:00Z"
}
```
