# Quickstart — Subscription, Trial & Billing

This guide walks through validating feature 006 end-to-end on a local machine.

---

## 1. Environment variables

Add (or leave unset for stub-mode) the following to `backend/.env`:

```
# Payments — leave PAYMENTS_ENABLED unset or set to "false" to use the stub provider.
PAYMENTS_ENABLED=false
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Plan availability gate — when true, the Premium tier renders as
# "Coming Soon" and any upgrade/schedule targeting Premium is rejected
# with `code: PLAN_UNAVAILABLE`. Leave unset or "false" for normal behaviour.
PREMIUM_COMING_SOON=false
```

When `PAYMENTS_ENABLED=true`, all three Razorpay vars are required. The
backend selects the stub provider otherwise and the frontend skips opening
the Razorpay checkout script.

Add the following to `frontend/.env` to enable the in-app chat widget
(Tawk.to). The widget is only injected for school-admin users whose plan
includes the `chat_support` feature (Standard + Premium); if these vars
are missing the component is a silent no-op.

```
VITE_TAWK_PROPERTY_ID=your-tawk-property-id
VITE_TAWK_WIDGET_ID=your-tawk-widget-id
```

Sign up at [tawk.to](https://tawk.to) → Dashboard → Administration →
Property Settings → Channels → Chat Widget. Copy the `propertyId` and
`widgetId` from the embed snippet.

---

## 2. Smoke test the trial bootstrap

1. Start the backend (`npm run dev` inside `backend/`).
2. Start the frontend (`npm run dev` inside `frontend/`).
3. Register a fresh school via `/onboarding`.
4. As a super-admin, approve the new school.
5. As the school-admin, log in. Expected:
   - The `SubscriptionBanner` shows "Free trial" with the days-remaining countdown.
   - The Billing menu item appears in the sidebar.
   - `GET /api/v1/subscription` returns `status: "trial"`.

---

## 3. Trigger the student-limit cap

1. As the school-admin, add students up to the trial cap (default 50).
2. Add the 51st — the request returns HTTP 402 with code `TRIAL_STUDENT_LIMIT_REACHED`.
3. The `subscription.status` flips to `trial_limit_reached`. The
   `UpgradeModal` opens automatically.
4. Soft-delete one student. `subscription.status` flips back to `trial`
   automatically (verified via `GET /subscription`).

---

## 4. Force a state transition for testing

```js
// In a mongo shell or a maintenance script:
db.schools.updateOne(
  { slug: 'your-school' },
  { $set: {
      'subscription.trialEndsAt': new Date(Date.now() - 24*60*60*1000),
  }}
);
```

Then trigger the cron once:

```js
// Inside a node REPL with the backend bootstrapped:
require('./src/jobs/subscriptionLifecycleJob').runOnce();
```

After it runs, the school is in `grace_period`. Repeat with `graceEndsAt`
in the past → school becomes `expired`.

---

## 5. Validate role-based enforcement

- Admin POST `/admin/students` while expired → 402 `SUBSCRIPTION_EXPIRED`.
- Admin GET `/admin/students` while expired → 200 (read-only fallback).
- Teacher POST `/teacher/attendance` while expired → 402 with a teacher-friendly message.
- Teacher GET `/teacher/classes` while expired → 200.
- Student/parent GETs → 200 in every state.

---

## 6. Simulate a successful payment (stub mode)

Hit the upgrade modal as a school-admin. With `PAYMENTS_ENABLED=false`, the
modal skips Razorpay and posts straight to `/subscription/verify-payment`
with stub IDs. The subscription should transition to `active` and the
modal should show the success state in under a second.

To simulate the webhook path directly:

```bash
curl -X POST http://localhost:5000/api/v1/webhooks/payment \
  -H 'Content-Type: application/json' \
  -H 'x-razorpay-signature: stub_signature' \
  -d '{
    "event": "payment.captured",
    "schoolId": "<MONGO_SCHOOL_ID>",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test_123",
          "order_id": "order_test_123",
          "amount": 299900,
          "status": "captured",
          "notes": { "schoolId": "<MONGO_SCHOOL_ID>" }
        }
      }
    }
  }'
```

In stub mode the signature check is permissive. In live mode you must sign
the raw body with `RAZORPAY_WEBHOOK_SECRET`.

---

## 7. Super-admin dashboards

Log in as super-admin and open `/platform/subscriptions`:

- Status cards show per-state counts.
- Near-conversion table lists trial schools approaching limits.
- Estimated MRR is derived from active subscriptions.
- Per-school row links into the audit trail.

---

## 8. Troubleshooting

| symptom | likely cause |
| --- | --- |
| Banner never appears | The user isn't a `school-admin`, or `/subscription` returned a non-200. |
| Modal reopens on every page | `subscriptionDismissed` failed to persist — check `sessionStorage`. |
| 402 on a GET request | Misuse — GETs are never wrapped in `checkSubscriptionAccess`. Check the route. |
| Webhook returns 400 "Invalid signature" | `RAZORPAY_WEBHOOK_SECRET` mismatch with the dashboard. |
| `pollUntilActive` never resolves | Webhook hasn't processed yet — verify it landed in `SubscriptionEvent`. |
