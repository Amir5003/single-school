# API Contract Delta: Legal Acceptance & Acknowledgement

**Branch**: `011-legal-terms-privacy` | **Date**: 2026-09-05

Two touches on the API surface: one **modified** endpoint (breaking, deliberately) and one **new** endpoint. No public API is added — the legal documents are static frontend routes with no backend involvement.

---

## 1. MODIFIED — `POST /api/v1/onboarding/register`

Public. Registers a school and its admin. **Now requires explicit acceptance.**

### Request body — added field

| Field | Type | Required | Rule |
|---|---|---|---|
| `acceptedTerms` | boolean | **yes** | Must be exactly `true`. `"true"`, `1`, and `"on"` are rejected — `express-validator`'s `.isBoolean()` alone is too permissive here; use `.equals('true')`-style strict checking or `.custom(v => v === true)`. |

`termsVersion` **is not accepted.** If present in the body it is ignored, never echoed, and never stored (FR-006c).

```jsonc
{
  "name": "Springfield High School",
  "slug": "springfield-high",
  "adminEmail": "admin@springfield.edu",
  "adminPassword": "Passw0rd123",
  "phone": "+91…",            // already supported by the validator
  "acceptedTerms": true       // NEW — required
}
```

### Responses

| Status | When | Body |
|---|---|---|
| `201` | Created | Unchanged shape. **Do not add `legal` to the response** — the client has no use for it and it is evidential data. |
| `400` | `acceptedTerms` absent, `false`, or not a boolean | `{ "success": false, "message": "You must accept the Terms of Service and Privacy Notice to register a school" }` via the existing `validate` middleware |
| `409` | Slug or email taken | Unchanged |

### Side effect

Inside the **existing** `session.withTransaction` in `onboarding.service.js`, the created `School` carries:

```js
legal: {
  termsVersion:    TERMS_VERSION,      // from backend constants — NOT the request
  privacyVersion:  PRIVACY_VERSION,
  termsAcceptedAt: new Date(),
  termsAcceptedBy: admin._id,
  termsAcceptedIp: <request IP>,
}
```

> ⚠️ **Ordering.** `School.create` runs before `User.create` in the current transaction, so `admin._id` does not exist when the school is first written. Either set `legal` on the school after the admin is created (a second write inside the same transaction, which is fine and atomic) or pre-generate the admin `_id` with `new mongoose.Types.ObjectId()`. Do not move the acceptance write outside the transaction to dodge this — a school without an acceptance record is the one state this feature exists to prevent.

### Breaking change

This breaks any existing caller that does not send `acceptedTerms`, which is the intent. Both frontend callers (`Onboarding.jsx` step 3 and the `Register.jsx` school-admin branch) go through `registerSchool()` in `frontend/src/api/onboarding.api.js` and must be updated together. `backend/tests/integration/onboarding.test.js` will fail until its fixtures are updated — that failure is the contract working (T-030).

---

## 2. NEW — `POST /api/v1/admin/legal/ack`

Records the one-time administrator acknowledgement (FR-011).

```
POST /api/v1/admin/legal/ack
```

| Property | Value |
|---|---|
| Middleware | `authenticate` → `schoolScope` → `authorize('school-admin')` |
| Request body | none |
| Idempotent | Yes — a repeat call is a no-op that returns the existing timestamp. Do **not** overwrite the original; the first acknowledgement is the evidentially meaningful one. |

### Responses

| Status | When | Body |
|---|---|---|
| `200` | Recorded, or already recorded | `{ "success": true, "data": { "adminDataAckAt": "2026-09-05T…" }, "message": "Acknowledgement recorded" }` |
| `401` / `403` | Unauthenticated, or not a `school-admin` | Standard error shape |

### Why no gate on student/teacher creation

`POST /admin/students` and `POST /admin/teachers` are **not** gated on `adminDataAckAt`. What matters evidentially is that the acknowledgement was made and recorded, not that the server refused to act without it. A middleware gate would add a failure mode on a hot path, break existing integration tests, and buy nothing legally. Deliberate asymmetry with §1, where server-side enforcement *is* required because that acceptance forms a contract. See `plan.md` → Design decisions.

---

## 3. MODIFIED (side effect only) — `PUT /api/v1/auth/change-password`

No change to the request or response contract. `changePassword` in `passwordReset.service.js:70` adds `noticeAckedAt: new Date()` to the **same** `$set` that already clears `mustChangePassword`.

Rationale in `data-model.md`: splitting these into two writes creates a user who changed their password but is recorded as never having seen the notice — precisely the state you would be asked to explain.

> Note: this sets `noticeAckedAt` on *every* change-password call, including voluntary ones by users who were never shown the panel. That is acceptable — the field means "has been through a flow where the notice was presented", and the panel renders whenever `mustChangePassword` is true. If a stricter reading is wanted later, gate the write on the flag being true at entry.

---

## 4. Frontend routes (no backend involvement)

| Route | Renders | Auth |
|---|---|---|
| `/terms` | Current Terms of Service | none |
| `/privacy` | Current Privacy Notice | none |
| `/refunds` | Current Refund & Cancellation Policy | none |
| `/terms/v/:version` | A superseded version (FR-003) | none |
| `/privacy/v/:version` | A superseded version | none |

Placed alongside the existing top-level public routes in `App.jsx:136-142`, **outside** the `/schools/:slug` subtree. An unknown `:version` falls through to `NotFound`.
