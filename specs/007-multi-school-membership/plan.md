# Implementation Plan: Multi-School Membership

**Feature**: 007-multi-school-membership
**Plan version**: 1.0
**Status**: ⛔ **PARKED — only implement once this is confirmed by the customer.**

Translates `spec.md` into architecture, file layout and rollout sequence. Assumes the
existing stack — Express 5, Mongoose 9, Node 20+, React 19 + Vite + Tailwind, Redux
Toolkit. **No new runtime dependencies** on either side.

---

## 1. Architectural Principles

1. **The token shape does not change.** `signAccessToken` (`auth.service.js:34-38`) still
   emits exactly one `{ id, role, schoolId }`. This is the single most important
   constraint in the plan: it is why `schoolScope`, `authorize`, and every controller
   reading `req.user.schoolId` need no changes at all, and why tokens issued before the
   migration keep working after it.
2. **Selection is a separate, weaker credential.** A token that has passed a password
   check but not chosen a school is not a session. It carries `typ: 'select'`, no
   `schoolId`, a ~5 minute TTL, and is accepted by exactly one route.
3. **Identity and membership have different lifetimes.** Anything true of the human
   (email, password) stays on `User`. Anything true of the posting (role, approval,
   active) lives on `Membership`. Every ambiguous field is resolved by asking which
   lifetime it follows.
4. **Admins create memberships, never credentials.** The security constraint in
   spec §Security Constraints is structural, not a check to remember. Password generation
   lives on the new-identity branch only, so the existing-identity branch cannot reach it.
5. **The common path stays fastest.** One membership means one round-trip, exactly as
   today. The picker is the exception, never the default.
6. **Every phase is revertible except the last.** The old `User` fields are retained and
   dual-written until the read switch has soaked. Only dropping them is one-way.

---

## 2. Backend Structure

```
backend/src/
├── models/
│   ├── Membership.model.js              ← NEW
│   ├── User.model.js                    ← narrowed to identity
│   ├── Teacher.model.js                 ← unique index relaxed
│   └── Student.model.js                 ← unique index relaxed
├── services/
│   ├── membership.service.js            ← NEW: create, invite, accept, decline,
│   │                                       approve, reject, listForUser, listForSchool
│   ├── auth.service.js                  ← login split, select-school, getMe
│   ├── user.service.js                  ← approval queue → memberships
│   ├── teacher.service.js               ← existing-identity branch
│   ├── student.service.js               ← existing-identity branch
│   ├── onboarding.service.js            ← existing identity may found a school
│   ├── platform.service.js              ← deactivation targets memberships
│   └── subscription/
│       └── studentCount.service.js      ← aggregation joins Membership
├── controllers/
│   └── auth.controller.js               ← +selectSchool, +acceptInvitation
├── routes/
│   └── auth.routes.js                   ← +/select-school, +/invitations/:id/accept
├── middleware/
│   └── authenticate.js                  ← reject typ:'select' outside the one route
└── scripts/
    └── backfillMemberships.js           ← NEW, idempotent
```

**Untouched:** `schoolScope.js`, `authorize.js`, `slugToSchool.js`,
`checkSubscriptionAccess.js`, `checkFeatureAccess.js`, and every domain controller.

---

## 3. Frontend Structure

```
frontend/src/
├── pages/
│   └── SelectSchool.jsx                 ← NEW: the picker
├── components/common/
│   ├── LoginForm.jsx                    ← branch on response shape
│   ├── Navbar.jsx                       ← +school switcher when memberships > 1
│   └── SchoolSwitcher.jsx               ← NEW
├── redux/slices/
│   └── authSlice.js                     ← +memberships[], +selectionToken (memory only)
├── api/
│   └── auth.api.js                      ← +selectSchool, +acceptInvitation
└── pages/admin/
    └── PendingUsersPage.jsx             ← lists memberships
```

The slug work completed on 2026-08-30 is a prerequisite that is already in place:
`auth.schoolSlug` is the single authority for "my school", `utils/sessionReset.js` clears
the school and subscription slices together, and `ProtectedRoute` rejects a URL naming a
school the user does not belong to. The switcher reuses all three.

---

## 4. The Auth Flow

```
POST /auth/login  { email, password }
  ├─ verify password against User
  ├─ load approved + active memberships
  ├─ 0  → 403 (existing behaviour, existing message)
  ├─ 1  → sign access + refresh with that membership.  ← today's UX, unchanged
  └─ 2+ → 200 { selectionToken, memberships: [{ schoolId, slug, name, role }] }

POST /auth/select-school  { schoolId }        auth: selectionToken only
  ├─ re-verify an approved, active membership exists
  ├─ buildEntitlements(schoolId)              ← reused unchanged
  └─ sign access + refresh { id, role, schoolId }
```

`buildEntitlements` (`auth.service.js:20-29`) already takes a `schoolId` argument, so it
simply moves from before the branch to after it. `getMe` (`auth.service.js:161`) resolves
its school from the token rather than `user.schoolId`, and additionally returns the
membership list so the navbar can decide whether to render a switcher.

**Selection-token containment.** `authenticate` gains a check: if `decoded.typ === 'select'`
and the route is not `/auth/select-school`, reject with 401. `schoolScope`'s existing
"no schoolId" 403 branch is the backstop, not the primary defence.

---

## 5. Rollout Sequence

| Step | Deploy | Revertible |
|---|---|---|
| 1 | `Membership` model + dual writes. Nothing reads it yet. Old `User` fields retained. | yes |
| 2 | Run `backfillMemberships.js`. Reconcile counts before continuing. | yes — drop the collection |
| 3 | Read switch: services query `Membership`. `User` fields still written, ignored. | yes — revert the deploy |
| 4 | Soak one full release. Pre-migration tokens still valid (token shape unchanged). | n/a |
| 5 | Drop the dead `User` fields and the dual writes. | **no** |

Step 5 waits a full release precisely because it is the only irreversible one.

---

## 6. Testing Strategy

The existing suite is the safety net: 26 backend test files, including
`cross-tenant.test.js`, `rbac.test.js` and `auth.approval.test.js` — the isolation
guarantees most at risk here are already asserted. Run the full suite after every phase.

**New coverage required:**
- One identity, two schools: a token for A cannot read, write or enumerate anything in B.
- Admin adds an existing email → that identity's password hash is byte-identical after.
- School B deactivated → dual-member's school A access still works.
- Trial student count for B excludes a student who is active at A.
- A selection token is rejected by every route except `/auth/select-school`.

**Pre-existing failures to fix first** (present on `main` as of 2026-08-30, unrelated to
this feature but in the code this feature touches):
- `admin.teachers.test.js` — "422 missing employeeId" expects 422, gets 201; the service auto-generates the ID.
- `auth.approval.test.js` — 4 failures across the approval flow.
- `onboarding.test.js` — public config `isActive` assertion.
- `frontend .../ProtectedRoute.test.jsx` — OOMs its worker; its 3 tests silently do not run while `npm test` still exits 0.

Do not start Phase 3 with a red baseline in the approval flow — that is the exact area
memberships rewrite.

---

## 7. Constitution Check

| Principle | Compliance |
|---|---|
| I. Code Quality | New logic is confined to `membership.service.js`; controllers stay thin. |
| II. Testing Standards | Five new required assertions above; full suite green before each step. |
| III. UX Consistency | Single-membership login is unchanged, by requirement FR-4. |
| IV. Performance | One extra indexed lookup on `{ userId }` at login only. Domain queries unchanged. |
| V. Security | See spec §Security Constraints — the feature's main risk is a privilege issue it must not introduce. |
| VI. Scalability | Compound indexes on every membership access path. |
| VIII. Multi-Tenancy | Token still carries one `schoolId`; `schoolScope` unchanged; isolation asserted by new cross-tenant tests. |

---

## 8. Open Decisions (resolve before Phase 1)

Two of these change the schema and must be settled before any code is written.

| # | Decision | Recommendation |
|---|---|---|
| 1 | Concurrent sessions in two schools? | **No** for v1. `refreshTokenHash` is already a single field, so one live session per person is the status quo. Supporting it means a sessions collection. |
| 2 | Two roles in the same school? | **No** for v1 — index on `{ userId, schoolId }`. Widening later is non-breaking; narrowing is not. |
| 3 | Invite-and-accept, or direct add? | **Invite.** Falls out of the security constraint and prevents conscription without consent. |
| 4 | Where does `mustChangePassword` live? | **`User`.** The credential is identity-level, and a school can only mint one for a brand-new identity. |
