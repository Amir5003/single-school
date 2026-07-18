# Subscription API contracts

All `/subscription/*` endpoints are gated by `authenticate → schoolScope → authorize('school-admin')` and return wrapped responses of the form:

```json
{ "statusCode": 200, "success": true, "message": "…", "data": { … } }
```

Errors share the standard shape; `code` is set on 402 responses so the frontend can branch.

```json
{ "statusCode": 402, "success": false, "message": "…", "code": "TRIAL_STUDENT_LIMIT_REACHED", "subscription": { "status": "trial_limit_reached", "activeStudentCount": 50, "maxTrialStudents": 50 } }
```

---

## GET /api/v1/subscription

```json
{
  "subscription": {
    "schoolId": "...",
    "status": "trial",
    "planType": "starter",
    "trialStartedAt": "2026-05-25T00:00:00Z",
    "trialEndsAt": "2026-06-24T00:00:00Z",
    "graceStartedAt": null,
    "graceEndsAt": null,
    "subscriptionStartedAt": null,
    "subscriptionEndsAt": null,
    "activeStudentCount": 22,
    "maxTrialStudents": 50,
    "basePrice": 0,
    "perStudentPrice": 0,
    "lastPaymentAt": null,
    "nextBillingDate": null,
    "monthlyAmount": 0,
    "daysUntilTrialEnd": 30,
    "daysUntilGraceEnd": null,
    "daysUntilSubscriptionEnd": null,
    "paymentProvider": null
  },
  "plans": [
    {
      "id": "starter",
      "label": "Starter",
      "blurb": "For new and small schools",
      "basePrice": 999,
      "perStudentPrice": 15,
      "highlights": [ "Up to 200 students", "Core modules", "Email support" ],
      "monthlyAmount": 1329
    }
    /* … standard, premium */
  ]
}
```

## GET /api/v1/subscription/pricing

```json
{ "plans": [ … ], "activeStudentCount": 22 }
```

## POST /api/v1/subscription/upgrade

Body:
```json
{ "planType": "standard" }
```

Response:
```json
{
  "order": {
    "orderId": "order_test_…",
    "providerOrderId": "order_test_…",
    "amount": 2763,
    "currency": "INR",
    "keyId": "rzp_test_xxx",
    "provider": "razorpay",
    "planType": "standard",
    "isLive": true
  }
}
```

In stub mode `isLive` is `false`; the frontend should skip Razorpay's
checkout and post a stub verification immediately.

## POST /api/v1/subscription/verify-payment

Body:
```json
{ "orderId": "order_test", "providerPaymentId": "pay_test", "providerSignature": "...", "planType": "standard" }
```

Response: `{ "subscription": <summary> }` after activation.

## GET /api/v1/subscription/history

```json
{ "events": [ { "_id": "…", "type": "trial_started", "metadata": { … }, "createdAt": "…" } ] }
```

## POST /api/v1/subscription/cancel

Body: `{ "reason": "optional string" }`. Response: updated subscription summary.

---

## POST /api/v1/webhooks/payment

- Unauthenticated.
- Signature-verified via `X-Razorpay-Signature` (HMAC-SHA256 of raw body with `RAZORPAY_WEBHOOK_SECRET`).
- Idempotent — duplicate `providerPaymentId` is a 200 no-op.
- Activates the school on `payment.captured` / `payment.authorized`.

---

## Super-admin

`GET /api/v1/platform/subscriptions?page=&limit=&status=`

`GET /api/v1/platform/subscriptions/analytics` →
```json
{ "analytics": { "totals": { "trial": 4, "active": 10, … }, "totalSchools": 24, "nearConversion": [ … ], "estimatedMRR": 51890, "currency": "INR", "generatedAt": "…" } }
```

`GET /api/v1/platform/subscriptions/:schoolId/events`
