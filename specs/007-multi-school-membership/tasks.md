# Tasks: Multi-School Membership

**Feature**: 007-multi-school-membership
**Status**: ⛔ **PARKED**

> **Implementation gate:** Only implement once this is confirmed by the customer.
> Do not start T001 until the confirmation is recorded in `spec.md`.
> T000 (the spec itself) is the only task complete.

Numbered, ordered list of tasks needed to ship feature 007. Each task carries enough
context to be executed independently. `[P]` marks tasks that can be parallelised once
their prerequisites are met.

---

## Phase 0 — Spec freeze

- [x] **T000** Author `spec.md`, `plan.md`, `data-model.md`, `tasks.md`. *(Done 2026-08-30)*
- [ ] **T00A** ⛔ **GATE** — record customer confirmation in `spec.md` §Status. No task below may start first.
- [ ] **T00B** Resolve the four open decisions in `plan.md` §8. Decisions 1 and 2 change the schema and MUST be settled before T001.

## Phase 1 — Red baseline cleanup (prerequisite)

These fail on `main` today and sit in the code this feature rewrites. Fixing them first
means a regression in Phase 4 is unambiguous.

- [ ] **T001** `[P]` Fix `frontend/src/components/common/ProtectedRoute.test.jsx` — the worker OOMs, its 3 tests silently do not run, and `npm test` still exits 0.
- [ ] **T002** `[P]` Fix the 4 failures in `backend/tests/integration/auth.approval.test.js`.
- [ ] **T003** `[P]` Fix `backend/tests/integration/onboarding.test.js` — public config `isActive` assertion.
- [ ] **T004** `[P]` Reconcile `admin.teachers.test.js` "422 missing employeeId": the validator does not require it and `teacher.service.js` auto-generates one. Decide which is correct, then fix the other.

## Phase 2 — Model foundations

- [ ] **T005** Add `backend/src/models/Membership.model.js` per `data-model.md §1`, with all four indexes.
- [ ] **T006** Add `isPlatformAdmin: Boolean` to `User.model.js`. Do **not** remove `role`/`schoolId`/`approvalStatus` yet — dual-write phase.
- [ ] **T007** `[P]` Relax `Teacher.model.js:10-15` — drop `userId: unique`, add compound unique `{ schoolId, userId }`.
- [ ] **T008** `[P]` Relax `Student.model.js:11-16` — same change.
- [ ] **T009** Add `backend/src/services/membership.service.js`: `createForUser`, `invite`, `accept`, `decline`, `approve`, `reject`, `listForUser(userId)`, `listForSchool(schoolId, filter)`, `assertActiveMembership(userId, schoolId)`.

## Phase 3 — Migration

- [ ] **T010** Add `backend/scripts/backfillMemberships.js` per `data-model.md §6`. Idempotent, upsert keyed on `{ userId, schoolId }`.
- [ ] **T011** Add a reconciliation mode to the script: assert `count(users with schoolId) == count(memberships)` and that every approved user has exactly one approved membership. Exit non-zero on mismatch.
- [ ] **T012** Enable dual writes — every path that sets `User.role`/`schoolId`/`approvalStatus` also writes the membership. Nothing reads `Membership` yet.

## Phase 4 — Auth flow

- [ ] **T013** Split `authService.login` per `plan.md §4`: verify password → load memberships → 0 / 1 / 2+ branches.
- [ ] **T014** Add `signSelectionToken` — `typ: 'select'`, no `schoolId`, ~5 min TTL.
- [ ] **T015** Harden `middleware/authenticate.js` — reject `typ: 'select'` on every route except `/auth/select-school`.
- [ ] **T016** Add `authService.selectSchool(userId, schoolId)` — re-verify membership, `buildEntitlements`, sign the real pair.
- [ ] **T017** Add `POST /auth/select-school` to controller + routes, accepting only a selection token.
- [ ] **T018** Update `authService.getMe` — resolve school from the token; return the membership list.
- [ ] **T019** Add `POST /auth/invitations/:membershipId/accept` and `.../decline`.

## Phase 5 — Read switch (services)

- [ ] **T020** `user.service.js:11,33,50` — approval queue and approve/reject operate on memberships, not users.
- [ ] **T021** `auth.service.js:55-58` — register rejects a duplicate *membership*, not a duplicate email; an existing identity gains a new membership.
- [ ] **T022** `onboarding.service.js:45` — an existing identity may found a new school; create the membership inside the existing transaction.
- [ ] **T023** ⚠️ `teacher.service.js:38-64` — existing-identity branch creates a membership + `Teacher` profile and **generates no password**. See spec §Security Constraints.
- [ ] **T024** ⚠️ `student.service.js:38-62` — same change, same constraint.
- [ ] **T025** `student.service.js:130` — drop the `{ role, schoolId }` filters from the name search; the outer `Student` query is already scoped.
- [ ] **T026** `platform.service.js:61-67,89` — activate/deactivate school targets **memberships only**. Never `User.isActive`. See spec US4.
- [ ] **T027** `platform.service.js:145-190` — pending registrations query school-admin memberships.
- [ ] **T028** ⚠️ `subscription/studentCount.service.js:25-45` — `$lookup` Membership instead of User. Billing correctness depends on this.
- [ ] **T029** Replace `role === 'super-admin'` checks with `isPlatformAdmin`, including `schoolScope.js:18-21`.

## Phase 6 — Frontend

- [ ] **T030** Extend `authSlice` with `memberships[]` and an in-memory-only `selectionToken`. It MUST NOT reach `sessionStorage`.
- [ ] **T031** `[P]` Add `frontend/src/api/auth.api.js` → `selectSchool`, `acceptInvitation`, `declineInvitation`.
- [ ] **T032** Branch `LoginForm.jsx:36-41` on the response shape. The single-membership path must stay byte-for-byte as it is (spec US2).
- [ ] **T033** Add `frontend/src/pages/SelectSchool.jsx` and route it.
- [ ] **T034** `[P]` Add `SchoolSwitcher.jsx`; render in `Navbar` only when `memberships.length > 1`.
- [ ] **T035** Wire the switcher: `selectSchool` → `resetSession(dispatch)` → `setCredentials` → navigate. Clear the slices **before** dispatching new credentials, never after.
- [ ] **T036** `[P]` Update `PendingUsersPage.jsx` and `platform/PendingRegistrations.jsx` to list memberships.
- [ ] **T037** `[P]` Add an invitations view so an invited person can accept or decline.

## Phase 7 — Tests

- [ ] **T038** Extend `cross-tenant.test.js`: one identity, two schools; a token for A cannot read, write or enumerate anything in B.
- [ ] **T039** ⚠️ Security regression test: admin adds an existing email → that identity's password hash is byte-identical afterwards.
- [ ] **T040** `[P]` Deactivate school B → dual-member's school A access still works; reactivation restores the prior approval state.
- [ ] **T041** `[P]` Trial student count for B excludes a student active at A.
- [ ] **T042** `[P]` A selection token is rejected by every route except `/auth/select-school`.
- [ ] **T043** `[P]` Single-membership login issues a full token pair with no selection step (spec US2).
- [ ] **T044** `[P]` Migration idempotency: run `backfillMemberships.js` twice, membership count unchanged.

## Phase 8 — Cleanup (one-way)

- [ ] **T045** Soak one full release with the read switch live before starting this phase.
- [ ] **T046** Remove `role`, `schoolId`, `approvalStatus`, `rejectionRemark` from `User.model.js`.
- [ ] **T047** Remove the dual writes from T012.
- [ ] **T048** `[P]` Add `specs/007-multi-school-membership/quickstart.md` — seed two schools, one shared identity, exercise the picker.
- [ ] **T049** `[P]` Add `contracts/auth-api.md` with request/response shapes for login, select-school and the invitation routes.

---

## Parallelisation Notes

- T001–T004 are independent and can run concurrently; all must be green before T013.
- T007 and T008 are sibling index changes.
- T020–T029 are independent service rewrites once T009 exists — but T023, T024 and T028 carry the security and billing risk and should be reviewed together, not spread across sessions.
- T038–T044 are independent once Phase 5 is complete.

## Definition of Done

- Login for a single-membership user is unchanged in clicks and in round-trips.
- No code path creates or modifies a credential for an email that already exists.
- Deactivating a school never sets `User.isActive`.
- `activeStudentCount` is computed per membership; a dual-school student counts once per school.
- A selection token cannot reach any route but `/auth/select-school`.
- The full backend suite is green, and `ProtectedRoute.test.jsx` actually runs.
- The backfill is idempotent and reconciles exactly.
