# Tasks: Legal Terms, Privacy Notice & Data-Subject Notice Delivery

**Branch**: `011-legal-terms-privacy` | **Date**: 2026-09-05
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/legal.api.md](./contracts/legal.api.md)

`[P]` = parallelisable with its siblings.

**The critical path is Phase 0, and none of it is engineering.** Every task from Phase 1 onward is straightforward; the ones that can actually hurt you are T-001 (real values for the placeholders), T-002 (two clauses the code cannot honour), and T-003 (a lawyer reading the text). Shipping a published legal document with `[LEGAL ENTITY NAME]` in it, or one promising a purge that never runs, is worse than shipping nothing.

Draft text for all three documents: the legal pack artifact from 2026-09-05.

---

## Phase 0 — Decisions and content freeze 🔴 BLOCKING

- [ ] **T-001** 🔴 **Fill every placeholder.** The drafts carry `[SLOT]` markers that must all resolve before publication. Nothing in Phase 1 can be written without these.

  | Placeholder | Notes |
  |---|---|
  | Legal entity name, type, registered address | A sole proprietorship, LLP and Pvt Ltd sign differently, and the entity is what the school contracts with. If the entity does not exist yet, that is a business blocker on this whole feature, not a detail. |
  | Product name + canonical domain | Used in all three documents and in the temp-password email. |
  | Four email addresses: support, privacy, billing, security | May all forward to one inbox. Publish them separately — a single `info@` reads as an operation with nobody accountable. |
  | Grievance Officer — **a real named person** | Indian intermediary rules expect a named contact published on the site; DPDP requires a data-protection contact. One person can hold both. A generic alias is not compliance. |
  | Governing law + courts | Your city and state. |
  | Pricing URL, plan prices, per-plan student limits | Cross-check against `School.model.js` `PLAN_TYPES` and the pricing service so the published table cannot contradict the code. |
  | Hosting regions (MongoDB Atlas, Render, Vercel) + SMTP provider name | Privacy Notice §5 and §6 name them. Verify against the actual dashboards, not from memory. |

- [ ] **T-002** 🔴 **Decide the two unkept promises. This gates publication.** See spec.md → "Two promises the code does not keep".

  | Clause | What it promises | Reality today | Options |
  |---|---|---|---|
  | Terms 13.2 / Privacy §7 | Soft-deleted records purged after 30 days | `isDeleted: true` is terminal; nothing ever purges | **(a)** build T-020, or **(b)** reword to describe deletion as "removed from view and retained in our systems", and tighten when T-020 lands |
  | Terms 7.6 / 12.4 | School Data exportable for 30 days after termination | No export endpoint | **(a)** build T-021, or **(b)** reword to "on written request we will provide an export" — a manual promise you can actually keep at this scale |

  Option (b) is legitimate and often correct for a product at this stage. What is not acceptable is publishing (a)'s wording while shipping (b)'s system. Record the decision in this file before proceeding.

- [ ] **T-003** 🔴 **Lawyer review.** Non-negotiable, for two specific reasons rather than as generic caution: the platform processes the personal data of **minors**, and it **takes payments**. Direct the reviewer at:
  - DPDP §9 and the DPDP Rules' educational-institution carve-out — does the school's reliance discharge the platform's exposure, given `dateOfBirth` is mandatory and the platform therefore always knows the subject is a child?
  - Terms clause 6 (school warranties + indemnity) — is it enforceable as drafted?
  - Clause 16 liability cap — 12 months' fees is the small-SaaS norm; confirm it survives in your jurisdiction.
  - Whether processor status is correctly established given the platform chooses the schema (i.e. decides which fields *can* exist), even though the school chooses what to enter.

- [ ] **T-004** `[P]` **Settle the open commercial numbers.** Defaults in the draft, all changeable: refund window **7 days**, liability cap **12 months' fees**, breach notification **72 hours**, sub-processor notice **30 days**, post-termination export window **30 days**, purge **30 days**, backup purge **90 days**. Only promise a 72-hour breach notification if you can actually *detect* a breach that fast — an undetectable promise is a liability, not a selling point.

---

## Phase 1 — Publish the documents

Independent of everything below. Can ship alone and already delivers most of the value: it is what makes the documents referenceable, and it is what Razorpay's merchant review looks for.

- [ ] **T-010**: **`LegalLayout.jsx` — shared document shell.** `frontend/src/pages/legal/`. Renders a version/effective-date header, a table of contents, and the document body. Constrain the measure (~68ch) — an unbounded legal document at full viewport width is unreadable. Reuse `fadeInUp`; no scroll-triggered animation anywhere in these pages (Constitution VII, and long documents are read, not experienced).

- [ ] **T-011**: **Version constants, both sides.** `backend/src/constants/legalVersions.js` (authoritative) and `frontend/src/constants/legalVersions.js` (display only). Each file comments the other and points at this spec. Per data-model.md, the failure mode is someone bumping one during an amendment and not the other.

- [ ] **T-012** `[P]`: **`Terms.jsx`** — 20 clauses from the draft, with T-001 values and the T-002 wording.
- [ ] **T-013** `[P]`: **`Privacy.jsx`** — 11 sections. §2 (data categories) must match the schema exactly: `User` name/email/phone/password-hash/role, `Student` enrollmentId/dateOfBirth/address/classId, attendance, assessments, results, fees, homework uploads, `ParentStudentLink`, `refreshTokenHash`, request logs. §5 sub-processor table must match reality: MongoDB Atlas, Render, Vercel, Cloudinary, SMTP provider, Razorpay. **§3 states there is no tracking or advertising — verify that is still true in the diff before shipping** (`grep -rn -i "gtag\|analytics\|posthog\|mixpanel\|sentry\|pixel" frontend/src backend/src frontend/index.html` must stay empty).
- [ ] **T-014** `[P]`: **`Refunds.jsx`** — 5 clauses. Keep it short; it is read by a payment-gateway reviewer and by a school that wants its money back.

- [ ] **T-015**: **Routes.** `/terms`, `/privacy`, `/refunds`, plus `/terms/v/:version` and `/privacy/v/:version`. Add beside the existing public routes at `App.jsx:136-142`, **outside** the `/schools/:slug` subtree — see plan.md → Complexity Tracking for why these are not slug-scoped. Unknown `:version` falls through to `NotFound`.

- [ ] **T-016**: **Create `pages/legal/versions/` and seed it with v1.0 copies** at the moment of first publication, not at first amendment. FR-003 requires a recorded acceptance to point at readable text; the copy is cheap now and impossible to reconstruct convincingly later.

- [ ] **T-017** `[P]`: **Footer links.** `Home.jsx:417-455` and `SchoolLanding.jsx:241-253` both already have a link row — add Privacy · Terms · Refunds. `SchoolLanding` matters most: it is the page a parent is most likely to reach first.

---

## Phase 2 — Acceptance at registration

Depends on Phase 1 (documents must be readable before they can be accepted).

- [ ] **T-018**: **Schema.** `legal` subdoc on `School.model.js`; `noticeAckedAt` + `adminDataAckAt` on `User.model.js`. Additive, no migration, no index — see data-model.md. Do not widen the `toJSON` transform.

- [ ] **T-019**: **Server-side enforcement + acceptance record.**
  - `onboarding.validator.js`: require `acceptedTerms === true`. Strict — reject `"true"`, `1`, `"on"`.
  - `onboarding.service.js`: write `legal` **inside the existing `session.withTransaction`**, stamping the version from the backend constant. Never from the request body (FR-006c).
  - `onboarding.controller.js`: pass `acceptedTerms` and the request IP through.

  > ⚠️ **Ordering trap.** `School.create` runs before `User.create`, so `admin._id` does not exist when the school is first written. Either write `legal` in a second update inside the same transaction, or pre-generate the admin `_id`. **Do not move the acceptance write outside the transaction to make this easier** — a school with no acceptance record is the single state this feature exists to prevent.

  > 🔎 **Adjacent bug, while you are in this file.** `onboarding.controller.js:41` destructures only `{ name, slug, adminEmail, adminPassword }` and never forwards `phone`, although `onboarding.validator.js` validates it and `onboarding.service.js` accepts it. The admin's phone number is silently dropped on every registration. Pre-existing and unrelated to 011 — fix it in the same edit or raise it separately, but do not leave it unrecorded.

- [ ] **T-020a**: **Acceptance checkbox — `Onboarding.jsx` step 3.** Above the Create School button. Not pre-ticked (FR-006e). Button stays disabled until ticked. Links open in a new tab so a half-filled 3-step form is not lost.
- [ ] **T-020b**: **Acceptance checkbox — `Register.jsx` school-admin branch** (~line 322-360). Same rules. Both paths hit the same endpoint, so the server gate covers both — but both need the UI, or one path just gets a 400 with no explanation.

---

## Phase 3 — Notice delivery to End Users

Depends on Phase 1 for link targets. Independent of Phase 2 — can run in parallel.

- [ ] **T-021**: 🥇 **First-login notice panel — `ChangePassword.jsx`.** **Highest-value task in the feature.** `mustChangePassword: true` is set on every admin-created student (`student.service.js:74`) and teacher (`teacher.service.js:60`), so every one of them is forced through this screen. It is the only moment the platform can be certain the End User themselves is reading.

  Panel above the form: names the school, lists what is held, links to `/privacy`, says corrections go to the school. Render only when `mustChangePassword` is true so returning users are not nagged — the flag is on the user object from `LoginForm.jsx:59`.

  > Note: this component hardcodes a redirect to `/student/dashboard` on success (line ~37), so a teacher forced through it lands on a student route. Pre-existing, out of scope for 011 — but you will see it while working here, so record it rather than silently fixing or silently ignoring it.

- [ ] **T-022**: **Record the acknowledgement.** `passwordReset.service.js:70` `changePassword` — add `noticeAckedAt: new Date()` to the **same** `$set` that clears `mustChangePassword`. One write, cannot drift.

- [ ] **T-023** `[P]`: **Temp-password email — `email.service.js:10-36`.** Add the notice block below the credentials table in both the `html` and `text` bodies (the `text` branch is easy to forget and is what many clients render). Names the school, states what is held, links to the Privacy Notice, tells the recipient what to do if unexpected.

  Requires threading the school name into `sendTempPassword`, which currently takes `(to, name, tempPassword)` — both call sites (`student.service.js:175`, `teacher.service.js:73`) have `schoolId` in scope but not the school name. Add a parameter rather than a lookup inside the mailer; the send is already fire-and-forget and should not gain a DB round-trip.

- [ ] **T-024** `[P]`: **Standing notice — `StudentForm.jsx`** above the submit button (~line 227), and the equivalent teacher form. One line, always visible: an account will be created and a temporary password emailed to the address entered.

- [ ] **T-025**: **One-time admin acknowledgement.** `POST /api/v1/admin/legal/ack` (`authenticate` → `schoolScope` → `authorize('school-admin')`), idempotent, sets `adminDataAckAt` and never overwrites it. Frontend shows the modal once when `adminDataAckAt` is null and the admin first opens the create-student form.

  > ⚠️ **Once per administrator, never per record.** A dialog that fires on every student added becomes muscle memory inside a week and stops being meaningful acknowledgement of anything. It is also explicitly **not** enforced by middleware on the create routes — see contracts/legal.api.md §2 for why recording beats gating here.

---

## Phase 4 — Billing acknowledgement

- [ ] **T-026**: **`UpgradeModal.jsx` footer** (~line 669, the `STEP.PLAN`/`STEP.REVIEW` footer). Checkbox acknowledging auto-renewal and the Refund Policy, gating the primary button. Separate from the signup acceptance, which may be months old and was made by a different person.

---

## Phase 5 — Make the promises true ⚠️ conditional on T-002

**Do not start either of these until T-002 has recorded a decision.** If T-002 chose option (b) for a clause, its task here is closed as "not needed — wording softened" and must not be picked up out of habit.

- [ ] **T-027**: **Retention purge job.** Only if T-002(a) for retention. Daily `node-cron`, following the existing `feeOverdueJob` (01:00) pattern. Hard-deletes documents soft-deleted more than N days ago.

  > 🔴 **Blocking sub-task.** `Student` and `Teacher` carry `deletedAt`; `Result`, `Homework`, `Exam`, `Assessment` and `Announcement` carry only `isDeleted`. **A purge job cannot honour a 30-day promise on a model that never recorded when deletion happened.** Either add `deletedAt` to those models and backfill (existing rows have no true deletion date — decide whether to stamp them at migration time or exempt them permanently), or narrow the published promise to the models that can actually support it. Resolve this before writing the job, not during.

- [ ] **T-028**: **Data export endpoint.** Only if T-002(a) for export. `GET /api/v1/admin/export` — the school's own data as JSON, `schoolScope`d, `school-admin` only. Must be streamed or paginated: a large school's attendance history assembled in memory will fall over on Render's free tier. Assert cross-tenant isolation explicitly; an export endpoint that leaks another school's rows is the worst possible bug in a feature about data protection.

---

## Phase 6 — Tests

- [ ] **T-029** `[P]`: **`backend/tests/integration/legal.acceptance.test.js`** (new)
  - register without `acceptedTerms` → `400`
  - register with `acceptedTerms: false` → `400`
  - register with `"true"` / `1` / `"on"` → `400` (strict validation)
  - register with `acceptedTerms: true` → `201`, and `School.legal` populated with version, timestamp, `termsAcceptedBy` = the created admin, and an IP
  - **forged version**: post `termsVersion: "99.0"` and assert the *stored* value is the backend constant (FR-006c)
  - transactional integrity: a school document can never exist with `legal.termsAcceptedAt == null`
  - cross-tenant: school A's `legal` is not readable through any school B route

- [ ] **T-030** `[P]`: **Extend `backend/tests/integration/onboarding.test.js`.** Existing fixtures will fail once T-019 lands — that failure is the contract working. Update them to send `acceptedTerms: true` rather than relaxing the validator.

- [ ] **T-031** `[P]`: **Extend `backend/tests/integration/first.login.test.js`.** After `PUT /auth/change-password`, assert `noticeAckedAt` is set and `mustChangePassword` is false, in one document read — they must move together.

- [ ] **T-032** `[P]`: **`frontend/src/pages/legal/Legal.test.jsx`** (new). `/terms`, `/privacy`, `/refunds` render for a logged-out visitor with **no API call and no school context** (NFR-001) — assert the axios instance is never touched. Version header renders. Footer links resolve.

- [ ] **T-033**: **Do not trust a green test run here.** Documented in `008/tasks.md` T-002 and `010/tasks.md` T-007: backend `npm test` **exits 0 even when tests fail**, and `vitest` exits 0 when a worker dies — this is how three `ProtectedRoute` tests went unrun (`c730e41`). Assert on reported pass/fail counts, not exit codes. This matters more than usual here: a silently unrun `legal.acceptance.test.js` means the acceptance gate is unverified while looking verified, in the one feature whose entire purpose is evidential.

---

## Verification checklist before merge

- [ ] Zero `[PLACEHOLDER]` markers remain in any published page — `grep -rn "\[[A-Z_ ]\{3,\}\]" frontend/src/pages/legal/` returns nothing
- [ ] T-002 decision recorded in this file, and the published wording matches the shipped system
- [ ] Lawyer review complete (T-003)
- [ ] Tracking grep still empty — the Privacy Notice's "no tracking" claim holds
- [ ] No new dependency in either `package.json` (NFR-002)
- [ ] A school cannot be created without an acceptance record — verified by test, not by inspection
- [ ] Legal pages readable at 390px

---

## Deferred (do not start)

- **Re-acceptance flow for a new document version.** Schema detects the mismatch; the prompt is not built. Needed before the first material amendment ships, not before launch.
- **Negotiated DPA + security questionnaire pack.** The first large institutional buyer will demand both. Not a launch blocker.
- **Sub-processor change notification mechanism.** Clause 7.3 promises 30 days' notice. Manual and human at this scale — acceptable, but there is no mailing list to send it to.
