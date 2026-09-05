# Implementation Plan: Legal Terms, Privacy Notice & Data-Subject Notice Delivery

**Branch**: `011-legal-terms-privacy` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-legal-terms-privacy/spec.md`

## Summary

Publish three legal documents on unauthenticated routes, enforce and record the school's acceptance of them at registration, and deliver privacy notice to students and teachers at the four points where they actually encounter the system. The schema change is small — one subdocument on `School`, two dated fields on `User`. The risk is not technical: it is that a published policy is a representation about the product, and two of the drafted clauses describe capabilities the codebase does not have.

Approach in one line: **static content in the frontend, server-side enforcement in the backend, and a forced decision about the two clauses the code cannot honour before anything goes live.**

## Technical Context

**Language/Version**: Node.js 20 LTS · React 19
**Primary Dependencies**: Express 5, Mongoose 9, React Router 7, Redux Toolkit, Framer Motion, Tailwind. **No new dependency is introduced by this feature, and none should be.**
**Storage**: MongoDB Atlas — additive only; one embedded subdocument and two scalar fields. No new collection, no migration required.
**Testing**: Jest + Supertest + `mongodb-memory-server` (backend) · Vitest + Testing Library (frontend)
**Target Platform**: Web SPA on Vercel + REST API on Render
**Project Type**: Web application (`backend/` + `frontend/`)
**Performance Goals**: Legal pages are static text with no API call — they must render on first paint with no network dependency (NFR-001).
**Constraints**: No new third-party script, font host, CDN or analytics (NFR-002) — the Privacy Notice's "no tracking" claim is load-bearing and verifiable in the diff.
**Scale/Scope**: 3 documents · 6 placements · 2 backend endpoints · 1 schema subdoc · ~8 frontend files touched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Addressed? | Notes |
|-----------|-----------|-------|
| I. Code Quality | [x] | Legal text lives in `frontend/src/pages/legal/`; version constants in a single shared module per side. Acceptance logic goes in `onboarding.service.js` alongside the existing transaction, not in the controller. |
| II. Testing Standards | [x] | Static document text is not meaningfully unit-testable; coverage targets the mechanisms — acceptance enforcement, record integrity, notice acknowledgement, unauthenticated reachability. Deviation recorded in spec.md. |
| III. User Experience Consistency | [x] | Notice panels reuse existing card/alert patterns. The admin acknowledgement fires **once per administrator**, never per record — a dialog on every student created becomes muscle memory inside a week and stops meaning anything. |
| IV. Performance Requirements | [x] | No new query on any hot path. Acceptance is written inside the existing registration transaction; the admin ack is a single dedicated write, not middleware on student/teacher creation. |
| V. Security | [x] | Accepted version is stamped from a **server-side constant**, never echoed from the request body (FR-006c). Source IP recorded via the existing proxy-aware request handling. No new authenticated surface beyond one admin-scoped ack endpoint. |
| VI. Scalability | [x] | Additive embedded fields; no new index needed — `School` and `User` are always fetched by `_id` or an existing index on these paths. |
| VII. UI Animation & Modern Design | [x] | Legal pages use the existing `fadeInUp` variant, which already gates on `prefers-reduced-motion`. Long documents get no scroll-triggered animation at all. |
| VIII. Multi-Tenancy & School Isolation | [~] | **Deliberate deviation** — see Complexity Tracking. Legal routes are platform-level, not slug-scoped. `School.legal` is per-tenant and read only through an already-scoped School document. |

**Multi-Tenancy Gate**:
- [x] `schoolId` on all new tenant-scoped models — *N/A, no new model; `legal` is embedded in `School`.*
- [x] `schoolScope` on all new authenticated routes — applies to `POST /admin/legal/ack`.
- [x] Cross-tenant isolation assertion in integration tests — T-029 asserts one school's `legal` record is never visible to another.
- [~] Public routes use `slugToSchool` — **intentionally not applied.** See Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/011-legal-terms-privacy/
├── spec.md              # Feature specification
├── plan.md              # This file
├── data-model.md        # Schema additions
├── contracts/           # API contract deltas
│   └── legal.api.md
└── tasks.md             # Task breakdown
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── constants/
│   │   └── legalVersions.js          # NEW — server-side source of truth for versions
│   ├── models/
│   │   ├── School.model.js           # + legal subdoc
│   │   └── User.model.js             # + noticeAckedAt, adminDataAckAt
│   ├── services/
│   │   ├── onboarding.service.js     # write acceptance inside existing transaction
│   │   ├── passwordReset.service.js  # set noticeAckedAt on change-password
│   │   ├── email.service.js          # notice block in sendTempPassword
│   │   └── legal.service.js          # NEW — admin acknowledgement
│   ├── controllers/
│   │   ├── onboarding.controller.js  # pass acceptedTerms + IP through
│   │   └── admin/legal.controller.js # NEW
│   ├── validators/
│   │   └── onboarding.validator.js   # require acceptedTerms === true
│   ├── routes/
│   │   └── admin.routes.js           # + POST /legal/ack
│   └── jobs/                         # + retention purge job, IF T-002 says build
└── tests/integration/
    ├── legal.acceptance.test.js      # NEW
    └── first.login.test.js           # extended

frontend/
├── src/
│   ├── constants/legalVersions.js    # NEW — display only; never sent as truth
│   ├── pages/legal/
│   │   ├── Terms.jsx                 # NEW
│   │   ├── Privacy.jsx               # NEW
│   │   ├── Refunds.jsx               # NEW
│   │   ├── LegalLayout.jsx           # NEW — shared shell, ToC, version header
│   │   └── versions/                 # NEW — superseded versions, kept reachable
│   ├── pages/
│   │   ├── Onboarding.jsx            # acceptance checkbox, step 3
│   │   ├── Register.jsx              # acceptance checkbox, school-admin branch
│   │   ├── ChangePassword.jsx        # notice panel
│   │   ├── Home.jsx                  # footer links
│   │   └── SchoolLanding.jsx         # footer links
│   ├── components/admin/
│   │   ├── StudentForm.jsx           # standing notice
│   │   └── billing/UpgradeModal.jsx  # renewal + refund acknowledgement
│   └── App.jsx                       # 3 public routes + archive route
└── src/pages/legal/Legal.test.jsx    # NEW
```

**Structure Decision**: Standard `backend/` + `frontend/` split, following the existing layout exactly. Two new directories: `backend/src/constants/` (the repo has no constants directory today — the alternative, hanging the version off an existing util, hides a value that must be findable during a legal amendment) and `frontend/src/pages/legal/`.

## Design decisions

**Legal text lives in the frontend as JSX, not in the database or in Markdown.**
It changes on a legal timescale, not a runtime one; it needs no editorial UI; and putting it in the database would mean a document could differ between environments — the last thing you want in a text you may have to produce in a dispute. JSX keeps it in version control, where the diff *is* the amendment history. Markdown would need a renderer dependency for no gain.

**Two version constants, and only one of them is authoritative.**
`frontend/src/constants/legalVersions.js` exists purely to render "Version 1.0" in the page header. `backend/src/constants/legalVersions.js` is what gets written to the acceptance record. They will drift, and that is fine — the backend one is the only one that can be relied on. **The client never sends a version string.** T-029 asserts this by attempting to register with a forged version and checking what was stored.

**Superseded versions stay in the tree.**
`pages/legal/versions/Terms-v1.0.jsx` routed at `/terms/v/1.0`. A recorded acceptance of 1.0 is worthless if 1.0 is no longer readable. Cheap now, impossible to reconstruct later.

**The admin acknowledgement is recorded, not enforced by middleware.**
A `requireDataAck` middleware on the student/teacher create routes would gate a hot path, add a failure mode for any API consumer, and break existing integration tests for no legal gain — what matters evidentially is that the acknowledgement was made and recorded, not that the server refused to act without it. Client-side gate, dedicated write endpoint. This is a deliberate asymmetry with FR-006, where server-side enforcement *is* required because that acceptance forms a contract.

**Notice acknowledgement piggybacks on the existing change-password write.**
`passwordReset.service.js:70` already updates the user on `PUT /auth/change-password`; setting `noticeAckedAt` in the same `$set` costs nothing and cannot drift out of sync with the flag it accompanies.

## Phasing

| Phase | Contents | Gate |
|---|---|---|
| **0** | Placeholder values, legal review, and the T-002 decision on the two unkept promises | **Blocking. No code ships before this.** |
| **1** | Public documents + routes + footers | Independent of Phase 2+; can ship alone and already delivers most of the value |
| **2** | Schema + server-enforced acceptance at registration | Depends on Phase 1 (documents must be readable before they can be accepted) |
| **3** | Notice delivery — email, first login, admin forms | Depends on Phase 1 for the link target; independent of Phase 2 |
| **4** | Billing acknowledgement | Depends on Phase 1 |
| **5** | Retention purge and/or data export | **Only if T-002 says build.** Otherwise the wording is softened in Phase 0. |
| **6** | Tests | Continuous, but gated by the CI hazard in T-033 |

Phases 2, 3 and 4 are mutually independent once Phase 1 lands and can be parallelised across people.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Public legal routes are **not** slug-scoped, bypassing the Principle VIII pattern of `slugToSchool` on public routes | The documents describe the *platform operator's* obligations and are byte-identical for every tenant. A prospective school evaluating the product, a parent following a link from an email, and a regulator all need to reach them without knowing any slug. | Serving them at `/schools/:slug/terms` would imply each school has its own terms — false, and legally misleading. It would also make the documents unreachable to anyone without a school context, including Razorpay's merchant review, which checks for publicly accessible policy pages. |
| A new `backend/src/constants/` directory for a two-line module | The accepted-version constant must be trivially findable by whoever ships a legal amendment eighteen months from now, possibly not the author. | Hanging it off `utils/` or inlining it in `onboarding.service.js` buries the one value that has to change in lockstep with a published document, and invites someone to "fix" a drifted version string in the wrong place. |
| Legal document text duplicated between `pages/legal/Terms.jsx` and `pages/legal/versions/Terms-v1.0.jsx` on first amendment | FR-003 requires superseded versions to stay readable at a stable URL. | Generating old versions from git history at build time is more machinery than a copied file, and fails exactly when it matters — during a dispute, on a checkout that may not have full history. |
