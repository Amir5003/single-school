# Feature Specification: Multi-School Membership (One Identity, Many Schools)

**Feature Branch**: `007-multi-school-membership`
**Created**: 2026-08-30
**Status**: ⛔ **PARKED — NOT APPROVED FOR IMPLEMENTATION**

> **Implementation gate:** Only implement once this is confirmed by the customer.
> No task in `tasks.md` may be started before that confirmation is recorded here.
> Nothing in the current product is blocked by this feature — see §Motivation.

---

## Overview

Today one person can hold an account in exactly one school. `User.email` is globally
unique and `User.schoolId` is a single reference, so a teacher who works at two schools,
a parent with children at two schools, or an admin who runs two schools cannot be
represented at all. The second registration is rejected outright.

This feature separates **identity** (who you are: email, password, name) from
**membership** (where you work and in what role). One `User` gains many `Membership`
records. Login gains a school-selection step when — and only when — a person holds more
than one membership.

**This is not a change to the tenancy model.** Every tenant-scoped collection keeps its
own `schoolId`, `schoolScope` still reads `schoolId` from the JWT, and the access token
still carries exactly one school. What changes is *how that one school gets chosen*.

---

## Motivation & Priority

No current user is blocked by this. The conflict it resolves is already prevented — by a
unique index that returns a 409 — so the system is correct today, just narrow. Feature
006 shipped billing; the platform's near-term revenue does not depend on this.

It is specced now because the constraint was discovered during a tenancy audit
(2026-08-30) and the analysis is cheap to capture while fresh. It should be built when a
real customer asks for it, not before.

---

## User Scenarios & Testing

### User Story 1 — A Teacher Works at Two Schools (Priority: P1)

Priya teaches at Khushal Public School on weekday mornings and at Sunrise Academy in the
afternoons. Sunrise's admin adds her with the email she already uses at Khushal. Today
this fails with "An account with this email already exists". After this feature, Sunrise's
admin creates a *membership* for her; Priya receives an invitation, accepts it, and from
then on her single login offers a choice of school.

**Why this priority**: This is the feature. Without it there is nothing to build.

**Independent Test**: Add a teacher to school B using an email already registered at
school A. The request succeeds, creates a pending membership, and sends an invitation.
School A's data is untouched and Priya's existing password still works.

**Acceptance Scenarios**:
1. **Given** an identity exists at school A, **When** school B's admin adds that email as a teacher, **Then** a `Membership { schoolId: B, role: 'teacher', approvalStatus: 'pending' }` is created, a `Teacher` profile is created for school B, and **no password is generated or changed**.
2. **Given** a pending invitation, **When** the person accepts it, **Then** the membership becomes `approved` and appears in their school list at next login.
3. **Given** a pending invitation, **When** the person declines it, **Then** the membership is deleted along with the orphaned `Teacher` profile.
4. **Given** Priya holds approved memberships at A and B, **When** she signs in, **Then** she is shown a school picker rather than being sent to a dashboard.
5. **Given** Priya picks school B, **Then** her access token carries `schoolId = B` and `role = teacher`, and every subsequent request is scoped to B exactly as a single-school teacher's would be.

---

### User Story 2 — Existing Single-School Users Notice Nothing (Priority: P1)

The overwhelming majority of users belong to one school. Their login must be byte-for-byte
the experience it is today: enter credentials, land on the dashboard. No picker, no extra
click, no extra round-trip.

**Why this priority**: A migration that degrades the common path to serve a rare one is a
net loss. This constraint is what makes the feature shippable at all.

**Independent Test**: Sign in as any existing user before and after the migration. The
network trace shows one `POST /auth/login` and the same redirect. No selection screen.

**Acceptance Scenarios**:
1. **Given** a user with exactly one approved membership, **When** they log in, **Then** `POST /auth/login` returns a full access + refresh token pair directly, with no selection token.
2. **Given** the migration has run, **When** any pre-existing user logs in, **Then** their role, school and entitlements are identical to before.
3. **Given** an access token issued before the migration, **When** it is presented after deploy, **Then** it still authenticates — the token shape is unchanged.

---

### User Story 3 — A Parent with Children at Two Schools (Priority: P2)

Ravi has one child at each of two schools. He signs in once, picks a school, and sees that
school's child. A switcher in the navbar moves him to the other school without re-entering
his password.

**Why this priority**: The same machinery as US1, but it exercises `ParentStudentLink`,
which is already school-scoped and therefore needs no model change — good validation that
the design is right.

**Acceptance Scenarios**:
1. **Given** Ravi holds parent memberships at A and B, **When** he selects A, **Then** `GET /parent/children` returns only A's child.
2. **Given** Ravi is viewing school A, **When** he uses the school switcher, **Then** a new token is issued for B, all cached school and subscription state is cleared, and he lands on B's dashboard.
3. **Given** Ravi is scoped to A, **When** he requests B's child by id, **Then** the response is 403/404 — never data.

---

### User Story 4 — A Super-Admin Deactivates One School (Priority: P2)

A platform super-admin deactivates school B. Everyone loses access to B. Nobody loses
access to school A, including people who belong to both.

**Why this priority**: This is the highest-risk regression in the feature. Today
deactivation disables the *user*; under memberships it must disable only the membership.
Getting it wrong locks innocent people out of an unrelated school, silently.

**Acceptance Scenarios**:
1. **Given** a person holds memberships at A and B, **When** B is deactivated, **Then** their B membership becomes inactive and their A membership is untouched.
2. **Given** that person then logs in, **Then** only school A is offered, and they are signed straight in without a picker.
3. **Given** B is later reactivated, **Then** their B membership is restored to its prior approval state, not blanket-approved.

---

### User Story 5 — Admin Cannot Hijack an Existing Identity (Priority: P1 — Security)

A school admin types a stranger's email into "Add Student". They must not be able to set
that person's password, read their details, or learn which other school they belong to.

**Why this priority**: This is a vulnerability *introduced* by the feature if built
naively — see §Security Constraints. It is P1 despite being a negative requirement.

**Acceptance Scenarios**:
1. **Given** an email belonging to an existing identity, **When** an admin submits it via "Add Student", **Then** the stored password hash for that identity is unchanged.
2. **Given** the same request, **Then** the response contains no name, phone, or school of the existing identity — only "an invitation has been sent".
3. **Given** the invitation is never accepted, **Then** the membership stays `pending` forever and grants no access.

---

## Functional Requirements

- **FR-1** A `Membership` collection MUST hold `{ userId, schoolId, role, approvalStatus, isActive }` with a unique compound index on `{ userId, schoolId }`.
- **FR-2** `User` MUST retain a globally unique `email` — it is the identity key — and MUST NOT retain `role`, `schoolId`, `approvalStatus` or `rejectionRemark`.
- **FR-3** `Teacher` and `Student` MUST replace `userId: unique` with a compound unique on `{ schoolId, userId }`.
- **FR-4** `POST /auth/login` MUST return a full token pair when the caller holds exactly one approved, active membership.
- **FR-5** When the caller holds two or more, it MUST return a short-lived selection token carrying **no** `schoolId`, plus the membership list.
- **FR-6** `POST /auth/select-school` MUST accept only a selection token, MUST verify an approved active membership, and MUST issue the real token pair.
- **FR-7** A selection token MUST be rejected by every other authenticated route.
- **FR-8** Creating a membership for an existing identity MUST NOT create or modify a credential.
- **FR-9** School deactivation MUST affect memberships only, never the identity.
- **FR-10** `subscription.activeStudentCount` MUST count students by *membership* in that school, so a student active at school A never counts against school B.
- **FR-11** `GET /auth/me` MUST return the caller's full membership list so the frontend can render a switcher.
- **FR-12** A super-admin MUST NOT be modelled as a membership; the platform role stays on `User`.

---

## Security Constraints

The global unique-email index is currently the only thing preventing a school admin from
typing a stranger's email into "Add Teacher" and having the system overwrite that person's
password — locking them out of their real school. `teacher.service.js` and
`student.service.js` both generate a temp password and `User.create` it unconditionally.

**Relaxing the index without changing those services introduces the vulnerability.**

Therefore:
- An admin may create a **membership**, never a **credential**, for an email that already exists.
- Password generation happens only when creating a brand-new identity.
- Existing identities are attached via an invitation the person must accept, which also
  prevents a school from conscripting someone into its tenant without consent.
- Admin-facing conflict responses MUST NOT name the other school — that is a privacy leak
  about a third party, and on public routes it is a cross-tenant enumeration oracle.

---

## Out of Scope (this iteration)

- **Two roles in the same school** (teacher who is also a parent there). The `{ userId, schoolId }` index forbids it. Widening to `{ userId, schoolId, role }` later is non-breaking; narrowing is not.
- **Concurrent sessions in two schools.** `User.refreshTokenHash` is a single field, so one live session per person is already the status quo. Switching schools ends the other session.
- **Self-service "join a school" search.** Memberships are created by an admin or by the existing slug-based registration flow only.
- **Per-membership profile data** (a different display name per school).
- **Merging two existing identities** that were created with different emails for the same human.

---

## Edge Cases & Failure Handling

- **Every membership rejected or inactive** → login fails with the existing 403, not an empty picker.
- **Selection token expires mid-pick** → 401 with a code the frontend maps back to the login screen; the password is re-entered, nothing is silently retried.
- **Membership revoked between selection and use** → `schoolScope` already re-validates the school on every request; add the same re-validation for the membership.
- **The last school-admin membership of a school is rejected** → block it, as the school would become unadministrable.
- **A person is invited to a school they already belong to** → the unique index rejects it; surface it as "already a member", not a generic 409.
- **Migration runs twice** → upserts keyed on `{ userId, schoolId }` make it idempotent.
- **A pre-migration token arrives after deploy** → it already carries a valid `schoolId`, so it keeps working; this is why the token shape must not change.

---

## Success Criteria

- A single identity holds approved memberships in two schools, and a token scoped to one cannot read, write, or enumerate anything in the other — asserted in `cross-tenant.test.js`.
- Every pre-existing user logs in with the same number of clicks and requests as before the migration.
- An admin creating a user with an existing email leaves that identity's password hash byte-identical.
- Deactivating one school leaves dual-member users with working access to the other.
- Trial student counts per school are unchanged by the existence of dual-school students.
- The backfill produces exactly one membership per pre-existing user with a `schoolId`, and zero for super-admins.
