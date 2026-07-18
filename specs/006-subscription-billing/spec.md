# Feature Specification: Subscription, Trial, Grace Period & Usage-Based Billing

**Feature Branch**: `006-subscription-billing`
**Created**: 2026-05-25
**Status**: Draft

## Overview

This feature introduces a production-grade subscription, trial, grace-period and usage-based-billing layer on top of the existing multi-tenant School Management SaaS. Every newly onboarded school gets a 30-day free trial. If the school exceeds 50 active students before the trial ends, an upgrade requirement is triggered and new student onboarding is blocked until the admin pays. When the trial finishes naturally, the school enters a 7-day grace period. After grace expires, write operations are blocked across all roles, but read access remains so the school never loses visibility of its historical data.

All work follows the same multi-tenant guarantees as the rest of the platform: every record carries `schoolId`, every authenticated route runs `authenticate → schoolScope → authorize`, and `schoolId` is always read from `req.school._id` — never from the body.

---

## User Scenarios & Testing

### User Story 1 — A New School Starts a 30-Day Trial Automatically (Priority: P1)

A school admin completes onboarding through the existing flow. The platform automatically initialises the school's subscription record with `status = "trial"`, `trialStartedAt = now`, `trialEndsAt = now + 30 days`, `planType = "starter"`, `maxTrialStudents = 50`. No payment is collected. The admin can log in and use every module normally.

**Why this priority**: This is the entry-point of the whole subscription system. Without it, no school has billing state and every other rule (grace, expiry, limits) has nothing to operate on.

**Independent Test**: Register a fresh school. Inspect the school document — `subscription.status == "trial"` and `trialEndsAt` is 30 days from now. The admin logs in and can add students, teachers, classes without any blocking modal.

**Acceptance Scenarios**:
1. **Given** a brand-new school is being created, **When** the onboarding transaction commits, **Then** the school document contains a fully-formed `subscription` sub-document with `status = "trial"`, dates set, counters zeroed, and a `SubscriptionEvent { type: "trial_started" }` is logged.
2. **Given** a school is in `trial`, **When** any `school-admin`, `teacher`, `student`, or `parent` performs a read or write, **Then** middleware allows the request.
3. **Given** a school is in `trial` and has fewer than 50 active students, **When** the admin adds a new student, **Then** the request succeeds and `subscription.activeStudentCount` is incremented atomically.

---

### User Story 2 — Trial Student Limit Reached Triggers an Upgrade Modal Without Breaking Existing Data (Priority: P1)

A school in trial has 49 students. The admin adds the 50th — the count reaches the limit. The admin sees a banner: "You've hit the trial student limit. Upgrade to keep adding students." The admin tries to add the 51st student and the request is rejected with a clear 402 "trial student limit reached, upgrade required" error. Every existing student, teacher, attendance record, exam, fee — everything keeps working. Teachers can still mark attendance. Students can still view results.

**Why this priority**: This is the primary usage-based conversion lever. Done wrong, it can break a customer mid-class or hide real data — both unacceptable.

**Independent Test**: Seed a trial school with 49 students. Add one — succeeds. Add another — fails with HTTP 402. Existing teacher login still works, attendance can still be marked, students can still log in.

**Acceptance Scenarios**:
1. **Given** a trial school has 50 active students, **When** the admin posts `POST /admin/students`, **Then** the response is HTTP 402 with code `TRIAL_STUDENT_LIMIT_REACHED`, the student is not created, and `subscription.status` transitions to `trial_limit_reached`.
2. **Given** a trial school has hit the limit, **When** the admin opens the dashboard, **Then** the frontend receives `subscription.status = "trial_limit_reached"` and renders an upgrade banner + persistent modal CTA.
3. **Given** a trial school has hit the limit, **When** a teacher submits attendance, **Then** the request succeeds — existing operational data is unaffected.
4. **Given** a trial school has hit the limit, **When** the admin completes a successful payment, **Then** the trial ends *immediately*, the subscription becomes `active`, `subscriptionStartedAt = paymentDate`, and the admin can immediately add new students.
5. **Given** the admin attempts payment but it fails, **When** the webhook reports failure, **Then** the school stays in `trial_limit_reached` and an event `payment_failed` is logged.

---

### User Story 3 — Trial Expires Naturally and the School Enters a 7-Day Grace Period (Priority: P1)

A trial completes its 30 days without an upgrade. A scheduled job transitions the school from `trial` (or `trial_limit_reached`) to `grace_period`, sets `graceStartedAt = trialEndsAt`, `graceEndsAt = trialEndsAt + 7 days`, and logs a `grace_started` event. The admin sees a strong warning modal with a countdown timer ("3 days, 4 hours remaining"). The admin can dismiss the modal for the current session but the warning banner stays pinned. Teachers, students and parents continue working as in trial — operational reads and writes still allowed during grace.

**Why this priority**: Grace is the soft-landing buffer that lets a school renew without losing service. Without it, every missed payment causes outage and customer churn.

**Independent Test**: Set a school's `trialEndsAt` to a past date and run the cron tick. The school's status moves to `grace_period`. Admin login shows the grace banner with a countdown. Teacher login shows no warning. Adding students still works.

**Acceptance Scenarios**:
1. **Given** a school's `trialEndsAt < now` and `status in ("trial", "trial_limit_reached")`, **When** the daily subscription cron runs, **Then** the school transitions to `grace_period` with `graceEndsAt = trialEndsAt + 7 days`.
2. **Given** a school is in `grace_period`, **When** any user role logs in, **Then** `GET /auth/me` returns the subscription summary so the frontend can render the appropriate banner per role.
3. **Given** a school is in `grace_period`, **When** the admin pays before grace ends, **Then** the school moves to `active`, `subscriptionStartedAt = paymentDate`, `subscriptionEndsAt = paymentDate + 30 days`.
4. **Given** a school is in `grace_period`, **When** the admin dismisses the modal, **Then** the modal is hidden for the session only — the banner persists.

---

### User Story 4 — After Grace Period Ends, Write Actions Are Blocked but Read Access Remains (Priority: P1)

Seven grace days pass without payment. The daily cron transitions `grace_period → expired`. On the next admin login, the admin sees a hard blocking modal with two options: "Upgrade Now" or "View Read-only Dashboard". Teachers logging in see a warning message: "Your school subscription has expired. Please contact your school administration." They cannot submit attendance, marks, homework, or announcements. Students and parents still log in and see their dashboards, results, attendance, homework — all read-only views remain available because they shouldn't be punished for the admin's billing issue.

**Why this priority**: This is the platform's contractual stance — protect revenue without destroying user trust. Read-only fallback is what makes the grace policy defensible.

**Independent Test**: Force a school into `expired`. Admin POST `/admin/students` → HTTP 402. Admin GET `/admin/students` → 200. Teacher POST `/teacher/attendance` → HTTP 402. Teacher GET `/teacher/classes` → 200. Student GET everything → 200. Student POST anything → there is nothing to POST as student, so N/A.

**Acceptance Scenarios**:
1. **Given** a school is `expired`, **When** the admin submits any write operation (`POST/PUT/PATCH/DELETE`), **Then** the response is HTTP 402 with code `SUBSCRIPTION_EXPIRED`.
2. **Given** a school is `expired`, **When** the admin issues a `GET` on any admin route, **Then** the response is 200 with the data — read access is preserved.
3. **Given** a school is `expired`, **When** a teacher posts attendance, marks, homework or announcement, **Then** the response is HTTP 402 with a teacher-friendly message: "School subscription has expired. Please contact your school administration."
4. **Given** a school is `expired`, **When** a student or parent issues any `GET`, **Then** the response is 200 — they always retain read-only access.
5. **Given** a school is `expired`, **When** the admin pays, **Then** the school transitions to `active` and *all* roles regain full access on their next request.

---

### User Story 5 — Only School Admins See or Touch Billing (Priority: P1)

Teachers, students and parents must never see the upgrade modal, the billing menu item, or any pricing UI. The `/subscription` REST endpoints must reject any role that is not `school-admin`. Even if a teacher directly POSTs `/subscription/upgrade`, the request is rejected with 403. The Razorpay order-create call requires `school-admin` + valid `schoolScope`.

**Why this priority**: Billing data is a regulated surface. Leakage to other roles is a hard security failure.

**Independent Test**: Log in as a teacher, student, parent — none can see a Billing nav link. Direct `GET /api/v1/subscription` from any non-admin role returns 403. Direct `POST /api/v1/subscription/upgrade` from a teacher returns 403.

**Acceptance Scenarios**:
1. **Given** a teacher is logged in, **When** the sidebar renders, **Then** no Billing/Subscription item appears.
2. **Given** a teacher token is used to call `GET /api/v1/subscription`, **When** the request hits the API, **Then** authorize middleware returns 403.
3. **Given** a super-admin is logged in, **When** they open `/platform/subscriptions`, **Then** they see aggregated metrics across all schools but never the payment instruments of any school.
4. **Given** a school-admin from School A is logged in, **When** they query a subscription resource scoped to School B, **Then** the response is 404 (school isolation — never reveal cross-tenant existence).

---

### User Story 6 — Super-Admin Sees Platform-Wide Subscription Analytics (Priority: P2)

A super-admin opens `/platform/subscriptions`. They see: total schools, schools in trial, schools in `trial_limit_reached`, schools in grace, schools active, schools expired, schools near conversion (trial schools with `activeStudentCount >= 40` or `trialEndsAt < now + 3 days`), and a rough MRR estimate from active subscriptions.

**Why this priority**: Required to operate the SaaS — without this view, the operator can't act on at-risk accounts or report financials.

**Independent Test**: Seed schools across states. Hit `GET /api/v1/platform/subscriptions/analytics`. Verify counts match seed.

**Acceptance Scenarios**:
1. **Given** any super-admin is authenticated, **When** they call `GET /platform/subscriptions/analytics`, **Then** the response contains `{ totals: { trial, trialLimitReached, gracePeriod, active, expired, cancelled }, nearConversion[], estimatedMRR }`.
2. **Given** a school-admin token, **When** the same URL is hit, **Then** the response is 403.

---

## Functional Requirements

### FR-1 Subscription States
A school's `subscription.status` is one of:
- `trial` — within the 30-day free trial.
- `trial_limit_reached` — still inside the 30-day trial but `activeStudentCount >= maxTrialStudents`.
- `grace_period` — trial finished without payment; inside the 7-day soft-landing window.
- `active` — paid; `subscriptionEndsAt > now`.
- `expired` — grace ended without payment, or paid plan lapsed.
- `cancelled` — admin or super-admin explicitly cancelled.

### FR-2 Plan Types
Three plan tiers, each priced as `basePrice + perStudentPrice * activeStudentCount`:
- `starter` — small schools, lowest base.
- `standard` — default paid tier after trial.
- `premium` — high-touch tier.

Pricing is read from a centralised pricing table in code (not the DB initially) so the source of truth is reviewed in version control. Future migration to a Pricing collection is supported by isolating reads behind `pricing.service`.

### FR-3 Active Student Count
"Active" = `Student.isDeleted == false` AND linked `User.isActive == true` AND `User.approvalStatus == "approved"`. The count is **derived** in real time via a service helper, and **cached** on `school.subscription.activeStudentCount`. Hooks must keep the cache fresh on:
- student create
- student soft-delete
- student user-approval flip
- student user-deactivation

### FR-4 Centralised Enforcement Middleware
A factory `checkSubscriptionAccess(operation)` returns Express middleware that:
1. Reads `req.school.subscription` and `req.user.role`.
2. Picks a policy from a single RESTRICTION_MATRIX constant.
3. Either calls `next()` or rejects with `ApiError(402, ...)` and a machine-readable code.

Operation kinds (closed set):
- `"read"` — every authenticated GET.
- `"admin_write"` — admin POST/PUT/PATCH/DELETE outside billing.
- `"teacher_write"` — teacher POST/PUT/PATCH/DELETE.
- `"student_onboarding"` — `POST /admin/students` specifically (extra guard for the trial limit).
- `"billing"` — `/subscription/*` admin-only routes (always allowed when authorized).

### FR-5 Restriction Matrix
| status | read | admin_write | teacher_write | student_onboarding |
| --- | --- | --- | --- | --- |
| `trial` | ✅ | ✅ | ✅ | ✅ (if `activeStudentCount < maxTrialStudents`) |
| `trial_limit_reached` | ✅ | ✅ | ✅ | ❌ `TRIAL_STUDENT_LIMIT_REACHED` |
| `grace_period` | ✅ | ✅ | ✅ | ✅ |
| `active` | ✅ | ✅ | ✅ | ✅ |
| `expired` | ✅ | ❌ `SUBSCRIPTION_EXPIRED` | ❌ `SUBSCRIPTION_EXPIRED` | ❌ `SUBSCRIPTION_EXPIRED` |
| `cancelled` | ✅ | ❌ `SUBSCRIPTION_CANCELLED` | ❌ `SUBSCRIPTION_CANCELLED` | ❌ `SUBSCRIPTION_CANCELLED` |

Notes: `student`/`parent` roles are always `read` only by route design — the matrix does not give them any write power.

### FR-6 Payment Provider Abstraction
A `paymentProvider.service.js` exposes:
- `createOrder({ schoolId, amount, currency, notes })` → `{ orderId, providerOrderId, amount, currency, keyId }`
- `verifyPayment({ orderId, providerPaymentId, providerSignature })` → `{ verified: boolean, paymentId }`
- `parseWebhook(req)` → `{ event, schoolId, providerPaymentId, status }`

The default implementation under `providers/razorpay.provider.js` may be a stub when `RAZORPAY_KEY_ID` is unset — returning deterministic mock IDs and a signature `verified: true` only in `NODE_ENV=test`. Production refuses to start if keys are missing and `PAYMENTS_ENABLED=true`.

### FR-7 Subscription Lifecycle Transitions
- `register school` → `trial`
- `trial` + `activeStudentCount >= maxTrialStudents` → `trial_limit_reached`
- `trial_limit_reached` + `activeStudentCount < maxTrialStudents` → `trial` (auto-rollback if a student is deleted)
- `trial` | `trial_limit_reached` + `trialEndsAt < now` (cron) → `grace_period`
- `grace_period` + `graceEndsAt < now` (cron) → `expired`
- `active` + `subscriptionEndsAt < now` (cron) → `expired`
- any state + successful payment → `active`
- any state + admin cancel → `cancelled`

### FR-8 Audit Trail
Every state transition and payment event writes a `SubscriptionEvent` row. The collection is append-only, indexed by `schoolId + createdAt desc`, queryable from `GET /subscription/history` for the school's own admin, and from `/platform/subscriptions/:schoolId/events` for super-admins.

### FR-9 Frontend UX Requirements
School-admin UI must include:
- A `SubscriptionBanner` at the top of every admin page reflecting current status.
- An `UpgradeModal` that opens automatically on `trial_limit_reached`, `grace_period`, and `expired`. The modal:
  - Shows current plan, days remaining, and `activeStudentCount`.
  - Lets the admin pick one of three plans.
  - Shows a live-computed total: `basePrice + perStudentPrice * activeStudentCount`.
  - Triggers Razorpay checkout via the `paymentProvider.service` API.
  - On success, polls `GET /subscription` until status flips, then closes itself with a confetti/check animation.
- A `BillingPage` accessible from the admin sidebar with: current plan, status, countdown, payment history, "Change plan", "Cancel subscription".

Teacher UI must show a single-line warning banner only when status is `expired`. Students and parents must show no billing UI at all.

### FR-10 Security
- All `/subscription` routes are `authenticate + schoolScope + authorize("school-admin")`.
- The webhook route is `POST /webhooks/payment` — unauthenticated but signature-verified using a Razorpay shared secret.
- All inbound billing payloads are validated via `express-validator`.
- Payment IDs are stored in the DB; payment instrument PANs are never stored — that is left to Razorpay.

### FR-11 Cron / Background Jobs
- `subscriptionLifecycleJob` runs daily at 02:00 server time, scanning for:
  - `trial` + `trialEndsAt < now` → `grace_period`
  - `grace_period` + `graceEndsAt < now` → `expired`
  - `active` + `subscriptionEndsAt < now` → `expired`
- `trialReminderJob` runs daily at 09:00, emails admins whose trial ends in `<= 3 days` and who are not yet active.
- Cron must be idempotent — a duplicate run on the same day produces no new events and no double charges.

### FR-12 Read-Only Mode (Expired)
Even though writes are blocked, the following remain available to all roles on expired schools:
- Authentication / logout / refresh / password reset.
- Every GET endpoint inside `admin`, `teacher`, `student`, `parent`.
- `GET /subscription` and `POST /subscription/upgrade` (admin-only) so payment is the way out.
- `POST /webhooks/payment` (signed externally).

---

## Non-Functional Requirements

- **Tenant isolation**: every subscription read scopes by `schoolId = req.school._id`; cross-tenant queries are impossible.
- **Idempotent payments**: re-running the webhook for the same `providerPaymentId` is a no-op.
- **Scalability**: subscription documents are embedded on `School` (1:1, hot path), and `SubscriptionEvent` is its own collection so growth doesn't bloat school documents.
- **Observability**: every transition logs at `info`; every payment failure logs at `error` with the providerPaymentId.
- **Backwards compatibility**: existing schools created before this feature ships are migrated to `subscription.status = "active"` with `subscriptionEndsAt = now + 365 days` and a `migrated` event — they aren't dropped into trial.
- **Testability**: middleware, services and the payment provider must be unit-testable without a live Razorpay account (the stub provider satisfies this).

---

## Out of Scope (this iteration)

- Yearly billing (architecture supports it; not exposed in UI yet).
- Coupons / discount codes.
- Multi-currency.
- Pro-rated upgrades mid-cycle.
- Invoice PDF generation.
- Tax / GST handling.
- Self-service plan downgrade.

These are deliberately deferred — the data model leaves room for them, but they are not built in this release.

---

## Edge Cases & Failure Handling

- **Webhook arrives before order completion is acked locally**: the webhook is the source of truth — it activates the subscription regardless of the local order state.
- **Payment succeeds twice for the same order**: idempotency check on `providerPaymentId` — second event is logged but doesn't extend the subscription.
- **Cron runs twice in a day**: every transition checks the current status before transitioning. If already in target state, it logs nothing and returns 0.
- **Admin deletes a student that brings count below limit**: status auto-rolls from `trial_limit_reached` back to `trial`.
- **Admin tries to add a student during `expired`**: blocked by both `admin_write` and `student_onboarding` matrix rows — order doesn't matter; `expired` always wins.
- **Existing school during migration**: see backwards-compatibility note above; idempotent.

---

## Success Criteria

- Onboarding 100 fresh schools auto-creates 100 trial subscriptions; no manual intervention.
- A test that adds 51 students to a trial school produces exactly 50 students and an HTTP 402 on the 51st.
- A simulated Razorpay webhook for a trial-limit-reached school activates the school in `< 2 seconds`.
- After artificially expiring a school, no teacher write request succeeds and every student read request succeeds.
- Super-admin analytics returns deterministic counts that match seed data.
