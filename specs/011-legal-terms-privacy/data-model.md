# Data Model: Legal Terms, Privacy Notice & Notice Delivery

**Branch**: `011-legal-terms-privacy` | **Date**: 2026-09-05
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

All changes are **additive**. No collection is created, no field is renamed or removed, and no migration script is required — existing documents read back `null` on every new path, which is the correct "never accepted / never acknowledged" state.

---

## `School.model.js` — new `legal` subdocument

```js
const legalSchema = new Schema(
  {
    termsVersion:    { type: String, default: null },   // e.g. '1.0'
    termsAcceptedAt: { type: Date,   default: null },
    termsAcceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    termsAcceptedIp: { type: String, default: null },
    privacyVersion:  { type: String, default: null },
  },
  { _id: false }
);
```

Mounted as `legal: { type: legalSchema, default: () => ({}) }` on the school schema, following the existing `branding` and `subscription` subdocument pattern.

| Field | Purpose | Notes |
|---|---|---|
| `termsVersion` | Which published version was accepted | **Written from `backend/src/constants/legalVersions.js`, never from the request body** (FR-006c). A string, not a boolean — a boolean cannot answer "which schools still need to accept 2.0?" |
| `termsAcceptedAt` | When | Server clock. |
| `termsAcceptedBy` | Which user clicked | The admin created in the same transaction. Answers "who bound the school" in a dispute. |
| `termsAcceptedIp` | From where | Evidential weight only. Read from the existing proxy-aware request handling — do not add a new IP-extraction helper. |
| `privacyVersion` | Which Privacy Notice was current at acceptance | Recorded separately because the two documents version independently. |

**No index.** `School` is always loaded by `_id` or by the existing unique `slug` index; nothing queries on `legal.*` on a hot path. A "which schools are on an old version" query is an admin-time scan and does not justify an index.

### Why embedded rather than a separate `LegalAcceptance` collection

A separate collection would be the right call if acceptances were an append-only audit log with many rows per school. They are not: one row per school per document version, written at most a handful of times in a school's lifetime. Embedding keeps it inside the existing registration transaction with no extra write, and keeps it impossible for a `School` to exist without the field being present and inspectable.

If re-acceptance flows land later (Deferred Scope) and the history genuinely matters, promote it then — the shape above migrates cleanly into a collection.

---

## `User.model.js` — two new fields

```js
noticeAckedAt:  { type: Date, default: null },
adminDataAckAt: { type: Date, default: null },
```

| Field | Set when | Set by | Applies to |
|---|---|---|---|
| `noticeAckedAt` | The user completes the forced password change, having been shown the privacy notice panel | `passwordReset.service.js:70` `changePassword`, in the same `$set` that clears `mustChangePassword` | Students and teachers created by an admin |
| `adminDataAckAt` | An administrator makes the one-time acknowledgement that their school has a lawful basis and has informed the people concerned | `POST /api/v1/admin/legal/ack` | `school-admin` only |

`noticeAckedAt` deliberately shares the write with `mustChangePassword: false`. They describe the same event from two sides, and splitting them into two writes creates a state where a user changed their password but is recorded as never having seen the notice — which is exactly the state you would be asked to explain.

`adminDataAckAt` is a timestamp rather than a boolean so that a future document version can be compared against it without another schema change.

**Both are excluded from the `toJSON` transform?** No — leave them in. They are not secrets, and the frontend needs `adminDataAckAt` to decide whether to show the one-time acknowledgement. The existing transform strips only `password` and `refreshTokenHash`; do not widen it.

---

## Version constants

Two modules, one authoritative.

```js
// backend/src/constants/legalVersions.js — AUTHORITATIVE
module.exports = {
  TERMS_VERSION:   '1.0',
  PRIVACY_VERSION: '1.0',
  REFUND_VERSION:  '1.0',
};
```

```js
// frontend/src/constants/legalVersions.js — DISPLAY ONLY
export const TERMS_VERSION   = '1.0';
export const PRIVACY_VERSION = '1.0';
export const REFUND_VERSION  = '1.0';
```

> ⚠️ **The client never sends a version string, and the server never reads one from the body.** The frontend constant exists only to render "Version 1.0 · Effective …" in the page header. If the two drift, the backend value is correct by definition. T-029 asserts this by posting a forged `termsVersion` and checking what was actually stored.

Both files carry a comment pointing at the other and at `specs/011-legal-terms-privacy/`, because the failure mode here is someone bumping one and not the other during an amendment.

---

## State transitions

```
School.legal.termsVersion:  null ──[registration with acceptedTerms:true]──> '1.0'
                                                                              │
                                                    [amendment ships 2.0]     │
                                                    (re-acceptance flow —     ▼
                                                     Deferred Scope)      stale, detectable
                                                                          by comparison

User.noticeAckedAt:   null ──[completes forced password change]──> Date
User.adminDataAckAt:  null ──[POST /admin/legal/ack]────────────> Date
```

Nothing ever transitions back to `null`. There is no "unaccept".

---

## What is NOT in the data model

- **No per-End-User consent record.** Consent is not the instrument here — see spec.md, "consent vs. notice". Adding a consent field would invite someone to build the flow it implies.
- **No acceptance record on the `User` for students, teachers or parents.** They are not parties to the Terms; the school is. `noticeAckedAt` records that they were *informed*, which is a different fact and the one that matters.
- **No `deletedAt`-based purge metadata.** `Student` and `Teacher` already carry `deletedAt`; several other soft-deleted models carry only `isDeleted`. If T-002 decides to build the purge job (T-027), that inconsistency becomes a blocking sub-task — a purge job cannot honour a 30-day promise on a model that never recorded when deletion happened.
