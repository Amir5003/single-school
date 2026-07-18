# Implementation Plan: Subscription, Trial, Grace & Usage-Based Billing

**Feature**: 006-subscription-billing
**Plan version**: 1.0

This plan translates `spec.md` into concrete architecture, file layout and code shape. It assumes the existing stack — Express 5, Mongoose 9, Node 20+, React 19 + Vite + Tailwind, Redux Toolkit, `node-cron`. No new runtime dependencies are introduced on the backend (`crypto` is in the standard library; Razorpay HTTP calls go through `https`/`fetch`). The frontend remains dependency-free at the runtime level — payments use Razorpay's hosted JS via a `<script>` tag injected at modal-open time.

---

## 1. Architectural Principles

1. **Subscription state is centralised, not scattered.** All read/write rules live in a single matrix in `services/subscription/policy.js`. Controllers never check status by hand.
2. **Embedded subdocument, not separate collection.** The hot path (every authenticated request) needs the school's subscription state. Embedding `subscription` on `School` keeps it a single document fetch — already happening inside `schoolScope`. A separate `SubscriptionEvent` collection captures the audit trail without bloating `School`.
3. **Payments behind an interface.** No controller imports `razorpay` directly. The `paymentProvider` service decides; controllers depend on the contract. A test stub satisfies the contract.
4. **Idempotency everywhere.** Cron transitions, webhook handlers and student-count recalcs all check current state before writing. Replays are safe.
5. **Read-only fallback is structural.** Express GET handlers don't go through write-blocking middleware. The middleware only attaches to mutating verbs and to `student_onboarding` specifically.

---

## 2. Backend Folder Structure

```
backend/src/
├── controllers/
│   ├── subscription.controller.js          ← admin-only subscription CRUD
│   ├── webhook.controller.js               ← /webhooks/payment
│   └── platform.controller.js              ← +subscription analytics endpoints
├── jobs/
│   ├── subscriptionLifecycleJob.js         ← daily 02:00 — transitions
│   ├── trialReminderJob.js                 ← daily 09:00 — emails (optional)
│   └── index.js                            ← register new jobs
├── middleware/
│   └── checkSubscriptionAccess.js          ← matrix-driven guard
├── models/
│   ├── School.model.js                     ← +subscription subdoc
│   └── SubscriptionEvent.model.js          ← new audit collection
├── routes/
│   ├── subscription.routes.js              ← /api/v1/subscription/*
│   └── webhook.routes.js                   ← /api/v1/webhooks/*
├── services/
│   └── subscription/
│       ├── index.js                        ← public re-exports
│       ├── lifecycle.service.js            ← state transitions
│       ├── studentCount.service.js         ← recount + cache update
│       ├── policy.js                       ← restriction matrix
│       ├── pricing.service.js              ← plan catalogue + total calc
│       ├── event.service.js                ← SubscriptionEvent writer
│       └── paymentProvider.service.js      ← provider abstraction
│           └── providers/
│               ├── razorpay.provider.js
│               └── stub.provider.js
└── validators/
    └── subscription.validator.js
```

---

## 3. Frontend Folder Structure

```
frontend/src/
├── api/
│   └── subscription.api.js
├── components/admin/billing/
│   ├── SubscriptionBanner.jsx
│   ├── UpgradeModal.jsx                    ← the centrepiece
│   ├── GracePeriodModal.jsx
│   ├── ExpiredModal.jsx
│   ├── PlanCard.jsx
│   ├── PricingSummary.jsx
│   └── PaymentHistory.jsx
├── components/common/
│   ├── SubscriptionGate.jsx                ← renders banner/modal globally
│   └── Countdown.jsx                       ← reusable d:h:m:s countdown
├── hooks/
│   └── useSubscription.js                  ← fetch + poll + status helpers
├── pages/admin/
│   └── BillingPage.jsx
├── pages/platform/
│   └── SubscriptionsAnalytics.jsx
└── redux/slices/
    └── subscriptionSlice.js
```

---

## 4. Data Model Changes

### 4.1 `School.subscription` (embedded)

| field | type | default | notes |
| --- | --- | --- | --- |
| `status` | `enum` | `"trial"` | states from `FR-1` |
| `planType` | `enum` | `"starter"` | states from `FR-2` |
| `trialStartedAt` | `Date` | `Date.now` | set on creation |
| `trialEndsAt` | `Date` | `Date.now + 30d` | set on creation |
| `graceStartedAt` | `Date` | `null` | set when entering grace |
| `graceEndsAt` | `Date` | `null` | set when entering grace |
| `subscriptionStartedAt` | `Date` | `null` | set on first payment |
| `subscriptionEndsAt` | `Date` | `null` | set on first payment |
| `activeStudentCount` | `Number` | `0` | cached counter |
| `maxTrialStudents` | `Number` | `50` | per-school override possible |
| `basePrice` | `Number` | from pricing.service | cached snapshot, rupees |
| `perStudentPrice` | `Number` | from pricing.service | cached snapshot, rupees |
| `lastPaymentAt` | `Date` | `null` | |
| `lastPaymentId` | `String` | `null` | provider payment id |
| `nextBillingDate` | `Date` | `null` | `subscriptionEndsAt` mirror |
| `paymentProvider` | `String` | `null` | `"razorpay"` once activated |

### 4.2 `SubscriptionEvent` (separate collection)

| field | type | notes |
| --- | --- | --- |
| `schoolId` | `ObjectId` ref `School` | indexed |
| `type` | `enum` | `trial_started`, `trial_warning`, `trial_limit_reached`, `grace_started`, `subscription_activated`, `payment_success`, `payment_failed`, `subscription_expired`, `subscription_cancelled`, `student_count_recalculated`, `migrated` |
| `metadata` | `Object` | provider IDs, amounts, etc. |
| `createdAt` | `Date` | indexed desc |

Indexes:
- `{ schoolId: 1, createdAt: -1 }` — list view.
- `{ "metadata.providerPaymentId": 1 }` sparse — idempotency.

### 4.3 Indexes added on `School`
- `{ "subscription.status": 1 }` — for super-admin analytics.
- `{ "subscription.trialEndsAt": 1 }` — for daily cron scan.
- `{ "subscription.graceEndsAt": 1 }` — for daily cron scan.
- `{ "subscription.subscriptionEndsAt": 1 }` — for daily cron scan.

---

## 5. Subscription State Machine

```
                ┌─────────────────┐
register ─────▶ │      trial       │
                └────┬──────┬──────┘
                     │      │ activeStudentCount ≥ maxTrialStudents
                     │      ▼
                     │  ┌──────────────────────┐
                     │  │ trial_limit_reached  │
                     │  └────┬─────────────────┘
                     │       │ student deleted, count < limit
                     │       ▼ (auto-rollback)
                     │  ┌─────────┐
                     │  │  trial  │
                     │  └─────────┘
                     │
        trialEndsAt < now │ (cron)
                     ▼
              ┌────────────────┐
              │  grace_period  │
              └────┬───────────┘
                   │ graceEndsAt < now (cron)
                   ▼
              ┌──────────┐
              │ expired  │
              └────┬─────┘
                   │ payment success
                   ▼
              ┌─────────┐
              │ active  │ ◀──── payment success from any state
              └────┬────┘
                   │ subscriptionEndsAt < now (cron)
                   ▼
              ┌──────────┐
              │ expired  │
              └──────────┘

           any state ─── admin cancel ──▶ cancelled
```

All transitions go through `lifecycle.service.transitionTo(school, nextStatus, metadata)` which:
1. Validates the transition is in the allow-set.
2. Mutates the embedded subscription with a single `$set`.
3. Writes a `SubscriptionEvent`.
4. Returns the fresh subscription summary.

---

## 6. Middleware: `checkSubscriptionAccess(op)`

Pseudocode:
```js
const checkSubscriptionAccess = (op) => (req, res, next) => {
  // Super-admin bypass — they manage the platform.
  if (req.user.role === 'super-admin') return next();

  // No school context → cannot evaluate; rely on schoolScope to have failed earlier.
  if (!req.school) return next(new ApiError(403, 'No school context'));

  const sub = req.school.subscription;
  const decision = policy.evaluate({ status: sub.status, role: req.user.role, op, subscription: sub });
  if (decision.allow) return next();

  return next(new ApiError(402, decision.message, decision.code));
};
```

`policy.evaluate` is a pure function backed by the matrix in `FR-5`. The decision object is `{ allow: boolean, code?: string, message?: string }`.

### Where it attaches

| Route | op |
| --- | --- |
| `POST /admin/students` | `student_onboarding` |
| `PUT /admin/students/:id`, `DELETE /admin/students/:id` | `admin_write` |
| all other admin `POST/PUT/PATCH/DELETE` outside `/admin/school/*` and `/admin/notifications` | `admin_write` |
| `POST /teacher/attendance`, `POST /teacher/marks`, `POST /teacher/announcements`, `POST /teacher/homework`, all teacher submission writes | `teacher_write` |
| every authenticated GET | not required — read is always allowed; we don't attach the middleware on GETs to keep the hot path fast |
| `/subscription/*` | `billing` (always allowed when authorized) |

GETs deliberately skip the middleware: reads are unconditionally allowed in every state (including expired). The middleware is *only* attached to mutating verbs.

---

## 7. Pricing

`pricing.service.js` exposes:
```js
const PLANS = {
  starter:  { basePrice: 999,  perStudentPrice: 15, label: 'Starter',  blurb: 'For new and small schools' },
  standard: { basePrice: 2499, perStudentPrice: 12, label: 'Standard', blurb: 'For growing schools', recommended: true },
  premium:  { basePrice: 4999, perStudentPrice: 10, label: 'Premium',  blurb: 'For multi-campus institutions' },
};

const calculateMonthlyAmount = ({ planType, activeStudentCount }) =>
  PLANS[planType].basePrice + PLANS[planType].perStudentPrice * activeStudentCount;
```

All amounts are in INR rupees. The Razorpay order layer multiplies by 100 before sending (Razorpay expects paise).

---

## 8. Payment Provider Abstraction

Interface (in `paymentProvider.service.js`):
```js
module.exports = {
  createOrder({ schoolId, amount, currency = 'INR', notes }),
  verifyPayment({ orderId, providerPaymentId, providerSignature }),
  parseWebhook(req),
};
```

Selection logic:
```js
const provider =
  process.env.PAYMENTS_ENABLED === 'true' && process.env.RAZORPAY_KEY_ID
    ? require('./providers/razorpay.provider')
    : require('./providers/stub.provider');
```

Razorpay implementation calls Razorpay's Orders API with HTTP Basic auth (`RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET`). Signature verification uses `crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(orderId + "|" + paymentId).digest('hex')`. Webhook signature uses `X-Razorpay-Signature`.

Stub provider returns deterministic IDs (`order_test_<schoolId>_<timestamp>`) and accepts any signature. Used only when `PAYMENTS_ENABLED=false` or test env.

---

## 9. Cron Jobs

### 9.1 `subscriptionLifecycleJob` — daily 02:00
Scans for transitions, in this order so each tick advances the school by at most one step:
1. `active` + `subscriptionEndsAt < now` → `expired`.
2. `grace_period` + `graceEndsAt < now` → `expired`.
3. `trial` | `trial_limit_reached` + `trialEndsAt < now` → `grace_period`.

Each branch runs its own `find` with a `$lt` filter and processes results in a `for…of` loop. Errors per-school are logged but don't kill the whole batch.

### 9.2 `trialReminderJob` — daily 09:00 (optional, can be activated later)
Finds trial schools whose `trialEndsAt` is `<= now + 3 days` and have not been reminded yet (track via `SubscriptionEvent` with `type: trial_warning`). Sends a reminder email. Writes a `trial_warning` event so subsequent runs don't double-send.

---

## 10. API Surface

### School-admin (mounted at `/api/v1/subscription`)
| method | path | purpose |
| --- | --- | --- |
| GET | `/` | Current subscription summary + pricing snapshot + days-remaining |
| GET | `/pricing` | Plan catalogue |
| POST | `/upgrade` | Create order — body: `{ planType }` |
| POST | `/verify-payment` | Client-side fallback for signature verification |
| GET | `/history` | Last 50 `SubscriptionEvent` rows for this school |
| POST | `/cancel` | Admin cancels subscription (immediate `cancelled`) |

### Webhook (mounted at `/api/v1/webhooks`)
| method | path | purpose |
| --- | --- | --- |
| POST | `/payment` | Razorpay webhook receiver. Signature-verified. |

### Super-admin (mounted at `/api/v1/platform/subscriptions`)
| method | path | purpose |
| --- | --- | --- |
| GET | `/` | List of all schools w/ subscription summary, paginated |
| GET | `/analytics` | Totals, near-conversion, estimated MRR |
| GET | `/:schoolId/events` | Audit trail for one school |

---

## 11. Frontend Flow

1. After login, `useSubscription` runs once and stores `subscriptionSlice.summary`.
2. `SubscriptionGate` reads `summary` + `role`:
   - For `school-admin`: render `SubscriptionBanner`. If status ∈ `{trial_limit_reached, grace_period, expired}` and user has not dismissed in this session, open the appropriate modal.
   - For `teacher`: if status == `expired`, render a single warning banner under the navbar.
   - For `student`/`parent`: render nothing.
3. `UpgradeModal` flow:
   - Step 1: Plan picker with three `PlanCard`s + `PricingSummary` showing computed total.
   - Step 2: "Pay ₹X" button calls `POST /subscription/upgrade` → loads Razorpay checkout via `script.src = "https://checkout.razorpay.com/v1/checkout.js"`.
   - Step 3: On Razorpay success callback, call `POST /subscription/verify-payment`.
   - Step 4: Poll `GET /subscription` every 1.5s for up to 12s until status flips to `active` (also handles webhook race).
   - Step 5: Show success state with a green checkmark + auto-close after 2s.
4. After activation, the modal closes and the page refreshes the subscription summary so banners disappear.

---

## 12. Backwards Compatibility / Migration

On boot, `subscriptionLifecycleJob.bootstrap()` runs once and any school missing `subscription.status` gets:
- `status = "active"`
- `subscriptionStartedAt = createdAt`
- `subscriptionEndsAt = now + 365d`
- `planType = "standard"`
- A `migrated` event in `SubscriptionEvent`.

This preserves the experience for any existing schools when the feature ships.

---

## 13. Testing Strategy

- **Unit tests** for `policy.evaluate` covering every cell of the restriction matrix × every role.
- **Service tests** for `lifecycle.transitionTo` with valid and invalid transitions.
- **Integration tests** that drive an HTTP server with the stub payment provider:
  - Register fresh school → assert trial subscription created.
  - Add 50 students → succeed; 51st → 402.
  - Force `trialEndsAt` into the past → run cron → assert `grace_period`.
  - Force `graceEndsAt` into the past → run cron → assert `expired`.
  - Create order → call webhook → assert `active`.
- **Frontend tests** for `SubscriptionGate` rendering branches per role × status.

---

## 14. Risks & Mitigations

| risk | mitigation |
| --- | --- |
| Webhook arrives twice | Idempotency on `metadata.providerPaymentId` |
| Razorpay outage during checkout | Frontend shows retry + a "contact support" CTA |
| Cron killed mid-batch | Per-school updates are independent; next tick resumes |
| Misconfigured pricing rolled to prod | Pricing lives in code, reviewed in PR — no runtime mutation |
| Tenant cross-leak via payment metadata | Order creation always sets `notes.schoolId` and webhook verifies it matches the URL |
| Existing schools dropped into trial | Bootstrap migration treats them as `active` for 1 year |

---

## 15. Rollout

1. Ship migration that backfills existing schools to `active`.
2. Deploy backend with `PAYMENTS_ENABLED=false` — stub provider, no live Razorpay.
3. Verify trial / grace / expired transitions in staging.
4. Flip `PAYMENTS_ENABLED=true` once Razorpay creds are in the prod secret store.
5. Frontend rolls separately; missing UI just means status is invisible to admins (gracefully degrades).
