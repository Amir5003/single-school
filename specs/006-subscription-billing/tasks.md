# Tasks: Subscription, Trial, Grace & Usage-Based Billing

Numbered, ordered list of tasks needed to ship feature 006. Each task carries enough context to be executed independently. `[P]` marks tasks that can be parallelised once their prerequisites are met.

---

## Phase 0 — Spec freeze

- [x] **T000** Author `spec.md`, `plan.md`, `data-model.md`. *(Done)*

## Phase 1 — Backend foundations

- [ ] **T001** Add `SubscriptionEvent` Mongoose model at `backend/src/models/SubscriptionEvent.model.js` per `data-model.md §2`.
- [ ] **T002** Extend `School.model.js` with the embedded `subscription` subdoc + the four indexes in `data-model.md §1`. Provide sane defaults so freshly-created school documents auto-populate the trial state.
- [ ] **T003** `[P]` Add `backend/src/services/subscription/pricing.service.js` with the `PLANS` catalogue + `calculateMonthlyAmount` helper.
- [ ] **T004** `[P]` Add `backend/src/services/subscription/event.service.js` with a `logEvent(schoolId, type, metadata)` writer.
- [ ] **T005** `[P]` Add `backend/src/services/subscription/policy.js` exporting the restriction matrix and an `evaluate({ status, role, op, subscription })` pure function.
- [ ] **T006** Add `backend/src/services/subscription/lifecycle.service.js` with:
    - `initializeForNewSchool(schoolId, session?)` — creates trial state + `trial_started` event.
    - `transitionTo(school, nextStatus, metadata)` — guarded transition + event log.
    - `migrateLegacyIfNeeded(school)` — handles existing schools at boot.
- [ ] **T007** Add `backend/src/services/subscription/studentCount.service.js`:
    - `recount(schoolId)` — returns the canonical count from `Student + User`.
    - `updateCachedCount(schoolId, opts)` — re-counts and updates `subscription.activeStudentCount`; auto-transitions `trial ↔ trial_limit_reached` when crossing `maxTrialStudents`.

## Phase 2 — Middleware

- [ ] **T008** Add `backend/src/middleware/checkSubscriptionAccess.js` that consumes `policy.evaluate`. Super-admin bypass; missing school context throws 403; HTTP 402 with `code` field on denial.

## Phase 3 — Payment provider abstraction

- [ ] **T009** Add `backend/src/services/subscription/paymentProvider.service.js` with the provider-selection switch (`PAYMENTS_ENABLED` + `RAZORPAY_KEY_ID`).
- [ ] **T010** `[P]` Add `backend/src/services/subscription/providers/stub.provider.js` returning deterministic mock IDs and accepting any signature.
- [ ] **T011** `[P]` Add `backend/src/services/subscription/providers/razorpay.provider.js`:
    - `createOrder` → POST `https://api.razorpay.com/v1/orders` with Basic auth.
    - `verifyPayment` → HMAC-SHA256(orderId + "|" + paymentId) === providerSignature.
    - `parseWebhook` → HMAC-SHA256(rawBody) === `X-Razorpay-Signature`; returns `{ event, schoolId, providerPaymentId, providerOrderId, amount, status }`.

## Phase 4 — Controllers & routes

- [ ] **T012** Add `backend/src/validators/subscription.validator.js` with `upgradeValidator` and `verifyPaymentValidator`.
- [ ] **T013** Add `backend/src/controllers/subscription.controller.js`:
    - `getSubscription` — returns the school's subscription + pricing snapshot + derived `daysRemaining`.
    - `getPricing` — returns `PLANS` + computed totals at current `activeStudentCount`.
    - `createUpgradeOrder` — calls `paymentProvider.createOrder`.
    - `verifyPayment` — verifies + activates subscription.
    - `getHistory` — last 50 events.
    - `cancelSubscription` — admin self-cancel.
- [ ] **T014** Add `backend/src/routes/subscription.routes.js` mounted at `/api/v1/subscription`, all gated by `authenticate → schoolScope → authorize('school-admin')`.
- [ ] **T015** Add `backend/src/controllers/webhook.controller.js` with the Razorpay webhook handler. Uses `paymentProvider.parseWebhook`, idempotency on `metadata.providerPaymentId`, calls `lifecycle.transitionTo`.
- [ ] **T016** Add `backend/src/routes/webhook.routes.js` mounted at `/api/v1/webhooks` — *no auth*, raw-body signature check inside the controller.
- [ ] **T017** Extend `backend/src/controllers/platform.controller.js` + `routes/platform.routes.js` with:
    - `GET /platform/subscriptions` — paginated list.
    - `GET /platform/subscriptions/analytics` — totals + near-conversion + estimated MRR.
    - `GET /platform/subscriptions/:schoolId/events` — audit trail.
- [ ] **T018** Wire `subscriptionRoutes` and `webhookRoutes` into `backend/src/app.js`. The webhook must be mounted on a router that uses `express.json({ verify })` so the raw body is captured for signature verification.

## Phase 5 — Wire enforcement into existing routes

- [ ] **T019** Update `backend/src/routes/admin.routes.js`:
    - `POST /students` → `checkSubscriptionAccess('student_onboarding')`.
    - Every other admin mutating verb → `checkSubscriptionAccess('admin_write')`.
- [ ] **T020** Update `backend/src/routes/teacher.routes.js`:
    - Every teacher mutating verb (attendance, marks, announcements, homework, submission writes) → `checkSubscriptionAccess('teacher_write')`.
- [ ] **T021** Update `backend/src/services/student.service.js`:
    - After successful create — call `studentCount.updateCachedCount`.
    - After soft-delete — call `studentCount.updateCachedCount`.
- [ ] **T022** Update `backend/src/services/onboarding.service.js`:
    - Inside the transaction, after `School.create`, call `lifecycle.initializeForNewSchool`.
- [ ] **T023** Update admin user approval (`backend/src/controllers/admin/user.controller.js` or the underlying service):
    - On a *student* approval/rejection or `isActive` flip, call `studentCount.updateCachedCount` so the cache stays accurate.

## Phase 6 — Cron jobs

- [ ] **T024** Add `backend/src/jobs/subscriptionLifecycleJob.js`:
    - Daily 02:00. Order: active→expired, grace→expired, trial→grace.
    - Self-heal pass: for every school recompute `activeStudentCount`, transition trial ↔ trial_limit_reached if the cache was wrong.
    - Idempotent.
- [ ] **T025** Register the new job in `backend/src/jobs/index.js`. (Optional `trialReminderJob` stub — not required for ship.)

## Phase 7 — Frontend foundations

- [ ] **T026** `[P]` Add `frontend/src/api/subscription.api.js` covering the 6 admin endpoints + the platform endpoints.
- [ ] **T027** `[P]` Add `frontend/src/redux/slices/subscriptionSlice.js` with `summary`, `loading`, `error`, plus a `dismissed` flag persisted in `sessionStorage`.
- [ ] **T028** Register the slice in `frontend/src/redux/store.js`.
- [ ] **T029** `[P]` Add `frontend/src/hooks/useSubscription.js`:
    - Fetches `GET /subscription` on mount when role is `school-admin`.
    - Returns `{ summary, isLoading, refresh, daysRemaining, computedTotal }`.
    - Exposes a `pollUntilActive(timeoutMs)` helper for the upgrade modal.

## Phase 8 — Frontend UX shell

- [ ] **T030** `[P]` Add `frontend/src/components/common/Countdown.jsx` — reusable `d:h:m:s` countdown driven by `requestAnimationFrame` (1s tick is enough).
- [ ] **T031** Add `frontend/src/components/admin/billing/SubscriptionBanner.jsx` rendering a state-coloured strip with status, countdown, and a CTA button.
- [ ] **T032** Add `frontend/src/components/admin/billing/PlanCard.jsx` and `PricingSummary.jsx`.
- [ ] **T033** **The centrepiece** — `frontend/src/components/admin/billing/UpgradeModal.jsx`:
    - Multi-step (Plan → Review → Pay → Success).
    - Live pricing.
    - Razorpay checkout script lazy-loader.
    - Verify + poll-until-active flow with confetti success state.
    - Keyboard escape, focus trap, body-scroll lock, smooth Framer Motion transitions.
- [ ] **T034** Add `frontend/src/components/admin/billing/GracePeriodModal.jsx` (warning + countdown + "Pay now" CTA + dismissible).
- [ ] **T035** Add `frontend/src/components/admin/billing/ExpiredModal.jsx` (blocking — only "Upgrade" or "Continue read-only" options).
- [ ] **T036** Add `frontend/src/components/common/SubscriptionGate.jsx` — global mount inside `App.jsx` (or `Layout.jsx`) that selects the right banner+modal combo by role × status.

## Phase 9 — Frontend pages

- [ ] **T037** Add `frontend/src/pages/admin/BillingPage.jsx`:
    - Plan summary card.
    - PlanCards w/ "Change plan".
    - Payment history table from `/subscription/history`.
    - "Cancel subscription" action with `ConfirmModal`.
- [ ] **T038** Register `/schools/:slug/admin/billing` in `App.jsx`.
- [ ] **T039** Add a "Billing" entry in the admin sidebar (`frontend/src/components/common/Sidebar.jsx`).
- [ ] **T040** Add `frontend/src/pages/platform/SubscriptionsAnalytics.jsx` and a sidebar link under `super-admin`.

## Phase 10 — Wiring

- [ ] **T041** Mount `<SubscriptionGate />` inside `Layout.jsx` so every authenticated screen evaluates banners/modals.
- [ ] **T042** Update `frontend/src/api/auth.api.js` so the login + `getMe` responses don't need changes — `useSubscription` fetches `/subscription` directly when the user is `school-admin`.

## Phase 11 — Documentation & tests

- [ ] **T043** `[P]` Add `specs/006-subscription-billing/quickstart.md` describing how to test the flow locally (set env, seed school, simulate cron).
- [ ] **T044** `[P]` Add `specs/006-subscription-billing/contracts/subscription-api.md` with the request/response shapes for every endpoint.
- [ ] **T045** `[P]` Unit tests for `policy.evaluate` (matrix × roles).
- [ ] **T046** `[P]` Service tests for `lifecycle.transitionTo` (valid + invalid transitions).
- [ ] **T047** Integration test: trial onboard → exceed 50 → 402 → simulate webhook → active.
- [ ] **T048** Integration test: force trial expiry → cron → grace; force grace expiry → cron → expired; verify teacher writes blocked, student reads allowed.

---

## Parallelisation Notes

- T003–T005 are independent leaves of the subscription service tree.
- T010 and T011 are sibling providers behind the same interface.
- All `[P]` frontend tasks (T026, T027, T029, T030, T032) can be done in parallel.
- T045 and T046 are pure unit tests against pure functions; they don't need the rest of the stack.

## Definition of Done

- Every backend route returning 402 also returns a machine-readable `code` field.
- Every transition writes a `SubscriptionEvent`.
- Cron is idempotent and logs per-school errors without aborting.
- Webhook is signature-verified and idempotent.
- Frontend never renders the modal/banner for teacher, student or parent roles.
- Existing schools migrate to `active` on first cron tick — no manual ops required.
