# Implementation Plan: Coursework & Report Cards

**Branch**: `008-coursework-report-cards` | **Date**: 2026-08-30
**Spec**: [spec.md](./spec.md) · **Data Model**: [data-model.md](./data-model.md) · **API**: [contracts/api.md](./contracts/api.md) · **Tasks**: [tasks.md](./tasks.md)

---

## Summary

Shrink the legacy `Marks` collection to formative assessment only, rename both concepts so the boundary is self-evident in the UI, and close the parent report-card gap.

The governance fix is one line of schema: removing `midterm` and `final` from the assessment-type enum, which stops a teacher publishing term-exam marks outside the admin publish workflow. Everything else is a rename, a validator correction, or thin delegation to services that already exist.

**No new models. No new business logic. No change to `Exam`, `SubjectSubmission`, or `Result`.**

---

## Technical Context

**Language/Version**: Node.js 20 LTS (backend); React 19 + Vite 8 (frontend)
**Primary Dependencies**: Express 5.x, Mongoose 9.x, express-validator 7.x (backend); React Router 7, Redux Toolkit 2.x, Axios 1.x, Tailwind 3.x, Framer Motion 12.x (frontend). **No new dependencies, backend or frontend.**
**Storage**: MongoDB Atlas. Modified collection: `marks` (field rename + enum narrowing + index rename). **No new collections.**
**Testing**: Jest 29 + Supertest (backend, `--runInBand`); Vitest + React Testing Library (frontend).
**Target Platform**: Web (Render backend, Vercel frontend).
**Performance Goals**: No change. New parent endpoints delegate to existing student services and inherit their profile.
**Constraints**: `schoolId` always from `req.school._id`; the 005 exam pipeline must be provably untouched; the 005 test files must pass **unedited**; a repo-wide search for `examType` must return nothing on completion.
**Scale/Scope**: Unchanged — ~30 classes × 50 students per school.

---

## Constitution Check

| Principle | Addressed? | Notes |
|-----------|-----------|-------|
| I. Code Quality | ✅ PASS | No new layers. Parent additions follow the existing `routes → controller → service → model` chain and copy the shape of `getChildAttendance` exactly. The `marksObtained ≤ maxMarks` check lands in the service, where the existing validation lives, not in the controller. |
| II. Testing Standards | ✅ PASS | New `parent.results.test.js` with cross-tenant assertions. A new negative test asserts `assessmentType: "final"` is rejected — the regression guard for the governance hole. Existing marks fixtures updated, 005 files untouched. |
| III. UX Consistency | ✅ PASS | Pure relabelling of existing screens. The new parent Report Cards tab reuses the established `TABS` pattern in `ChildDetail.jsx` and the card layout from the student results view. No new visual language. |
| IV. Performance | ✅ PASS | Indexes keep the same shape and cardinality — only a field name changes. Parent endpoints add no queries beyond the existing `requireLink` lookup. |
| V. Security | ✅ PASS | **Improves** posture on two counts: the enum narrowing closes a governance bypass, and the parent marks route gains the `checkFeatureAccess` gate it currently lacks. Every new parent endpoint enforces `requireLink` server-side before returning data. |
| VI. Scalability | ✅ PASS | `Marks` indexes stay `schoolId`-leading, so uniqueness stays per-tenant. |
| VII. UI Animation | ✅ PASS | Existing `fadeInUp` / `staggerContainer` variants carry over unchanged; the new parent tab reuses the animation the sibling tabs already use. |
| VIII. Multi-Tenancy | ✅ PASS | New parent routes read `schoolId` from `req.school._id` and delegate to services that already take it as their first argument and filter on it. No new scoping pattern is introduced. |

**Multi-Tenancy Gate**:
- [x] `Marks.schoolId` unchanged and still required; all three indexes stay `schoolId`-leading
- [x] `schoolScope` already applied at the parent router level; new routes inherit it
- [x] Cross-tenant assertions required in `parent.results.test.js` (T-D5)
- [x] `requireLink` ownership check enforced in the service layer, not the route

**Constitution Check Result: ALL GATES PASS**

---

## Project Structure

### New files

```
backend/
├── scripts/
│   └── drop-stale-marks-indexes.js        ← index cleanup (see Risk R1)
└── tests/integration/
    └── parent.results.test.js             ← parent access + cross-tenant

specs/008-coursework-report-cards/
├── spec.md · plan.md · data-model.md · tasks.md · quickstart.md
└── contracts/api.md
```

### Modified files

```
backend/src/
├── models/Marks.model.js                  ← FR-001..005: rename, enum, validator, 3 indexes
├── services/marks.service.js              ← rename; add marksObtained ≤ maxMarks guard
├── services/student.service.js            ← .select() projection only (line 364)
├── services/parent.service.js             ← +4 delegating functions
├── controllers/teacher/marks.controller.js ← JSDoc only
├── controllers/parent.controller.js       ← +4 handlers
└── routes/parent.routes.js                ← +4 routes; +feature gate on existing /marks

backend/tests/
├── unit/services.test.js                  ← 8 examType references
├── integration/teacher.marks.test.js      ← fixture, test name, max-100 assertion
└── integration/student.test.js            ← 2 fixtures

frontend/src/
├── components/common/Sidebar.jsx          ← 3 nav labels
├── components/student/MarksCard.jsx       ← style map keys, label map, aggregate label
├── pages/teacher/MarksPage.jsx            ← 4 refs: state, payload, selector, summary
├── pages/student/MarksPage.jsx            ← heading, empty state
├── pages/student/ResultsPage.jsx          ← heading; newest-year fix (line 71)
├── pages/student/StudentDashboard.jsx     ← tile label (line 114)
├── pages/student/StudentDashboard.test.jsx ← fixture (line 41)
├── pages/parent/ChildDetail.jsx           ← TABS, +Report Cards tab, maxMarks fix (line 83)
├── api/parent.api.js                      ← +4 client functions
└── api/teacher.api.js                     ← JSDoc (line 29)

specs/005-exam-result-management/spec.md   ← line 180 correction
README.md                                  ← schema drift correction (~lines 360-363)
```

**Deliberately not modified**: `Exam.model.js`, `SubjectSubmission.model.js`, `Result.model.js`, `exam.service.js`, `subjectSubmission.service.js`, `result.service.js`, `admin.routes.js`, `teacher.routes.js`, `student.routes.js`, and all three 005 test files.

---

## Implementation Phases

### Phase A — Backend schema and index safety

The load-bearing phase. Rename `examType` → `assessmentType`, narrow the enum to the five coursework types, replace the fixed `max: 100` with a `maxMarks` check, and rename all three indexes.

Ships with `backend/scripts/drop-stale-marks-indexes.js`, because Mongoose creates the new indexes but never drops the old ones — see Risk R1, which is the most likely way this feature breaks a running environment.

### Phase B — Backend services and controllers

`marks.service.js` takes the rename and gains the authoritative `marksObtained ≤ maxMarks` guard. It must live here, not only in the schema: `upsertMark` uses `findOneAndUpdate` with `runValidators`, and under an update a custom Mongoose validator's `this` is the Query rather than the document, so sibling paths are not reliably reachable. The service already receives both values in one call.

`student.service.js` changes only its `.select()` projection string.

### Phase C — Parent report-card access

Four delegating service functions, four controller handlers, four routes. Each follows the existing `getChildAttendance` shape: `await requireLink(...)`, then call the student-facing service. No new query logic, which is what keeps publication gating from diverging between students and parents.

The existing `/children/:studentId/marks` route also gains `checkFeatureAccess(FEATURES.EXAMS_RESULTS)` — it is currently the only marks endpoint in the app without it.

### Phase D — Backend tests

Update the three files carrying `examType` fixtures. Add the negative test asserting `assessmentType: "final"` is rejected — the permanent regression guard for the governance hole. Add `parent.results.test.js` covering linked access, unpublished 404, unlinked 403, and cross-tenant 403.

The 005 test files are **not** touched; their passing unedited is the proof that FR-017 holds.

### Phase E — Frontend relabel

Sidebar, teacher coursework page, student coursework page, student report cards page, dashboard tile, parent child detail. Includes the two rendering bugs found in these files: the parent `maxMarks` denominator and the newest-year default.

Because `class_test` contains an underscore — unlike today's single-word values — every surface rendering the raw value needs a shared display-label map. That map is defined once and imported, not duplicated per component.

### Phase F — Documentation

Correct `specs/005-exam-result-management/spec.md:180`, which currently asserts the `Marks` model "is unrelated to this feature and is left untouched" — no longer true. Correct the README's drifted schema section.

### Phase G — Optional: route paths

Rename `/student/marks` → `/student/coursework` and `/teacher/marks` → `/teacher/coursework` in `App.jsx` and the sidebar. Cosmetic, pre-launch so no bookmarks break, and it makes the URL bar as unambiguous as the nav. **Separated so it can be dropped without affecting any other phase.**

---

## Phase Sequencing and Dependencies

```
A ──► B ──► D(partial: marks fixtures)
      │
      ├──► C ──► D(parent.results.test.js)
      │
      └──► E ──► G (optional)

F is independent — can run at any point.
```

- **A before B**: services reference the renamed field.
- **B before E**: the frontend sends `assessmentType`; the backend must accept it first.
- **C is independent of A/B** — it touches no `Marks` code — but is sequenced after B so the suite is green at each checkpoint.
- **G last**, and droppable.

Each phase must leave the repository green. Do not begin a phase with the previous one half-applied: a partial rename is the specific failure mode that produces silent breakage, because a stale `examType` key in a Mongoose filter does not error — it simply matches nothing, turning an upsert into an unintended insert.

---

## Risks

### R1 — Stale MongoDB indexes *(high likelihood, high impact)*

`backend/src/config/db.js` calls `mongoose.connect(process.env.MONGO_URI)` with no options, so `autoIndex` defaults to on. The three new `assessmentType` indexes are created on boot; the three `examType` indexes are **not** removed.

The old unique index `(schoolId, studentId, subject, classId, examType)` then indexes every new document's absent `examType` as `null`. A teacher saves a Quiz — fine. The same teacher saves an Assignment for the same student, subject and class — the four leading fields match, both index `null`, and the write dies with `E11000 duplicate key error` naming a field that no longer exists in the schema.

This repository has hit this before: `.claude/settings.local.json` still allowlists `node scripts/drop-stale-unique-indexes.js`, a script no longer on disk.

**Mitigation**: T-A3 ships `backend/scripts/drop-stale-marks-indexes.js`. Because `Marks` data is disposable pre-launch, the default path drops the `marks` collection outright, which removes documents and indexes together. A keep-data path drops only indexes whose key contains `examType`. Tests are immune — `mongodb-memory-server` builds a fresh database per run — so this is a local-and-deployed concern only.

**Note**: the script must accept `process.env.MONGO_URI || process.env.MONGODB_URI`. `db.js` reads the former, `scripts/migrate-to-multitenant.js` reads the latter, and silently connecting to a default would make the script appear to succeed while doing nothing.

### R2 — A missed `examType` reference *(medium likelihood, high impact)*

Mongoose does not error on an unrecognised key in a filter or update — it matches nothing. A missed reference in `marks.service.upsertMark`'s filter would silently convert upsert-in-place into insert-a-duplicate, which surfaces later as mysterious duplicate rows rather than as an error.

**Mitigation**: `tasks.md` enumerates all 33 references across 13 files, and T-V1 makes `grep -rn "examType" backend/src backend/tests frontend/src` returning empty a hard gate (FR-019).

### R3 — Working-tree churn around shared files *(low likelihood now, medium impact)*

The tree was **verified clean on 2026-09-02** — `git status` showed nothing but this spec directory. Earlier in the same session it carried 12 modified files (an announcement `visibleUntil` feature plus responsive-UI work); that work is now in `HEAD` via commit `0116d4d`, so no stash is required.

The risk is recorded because it recurs: this feature edits three files that active work tends to touch.

- `backend/src/services/student.service.js` — this feature edits `getStudentMarks` (line 364). Prior WIP sat in `getStudentAnnouncements` (~line 388) — a different function, so collisions are unlikely but worth a look.
- `backend/tests/integration/student.test.js` — this feature edits lines 355 and 364.
- `frontend/src/pages/Home.jsx` — this feature edits marketing copy; prior WIP was header layout.
- `frontend/src/utils/reportCardPdf.js` — untouched by this feature, but central to the report card, so land any WIP there before Phase E to keep the diff reviewable.

**Mitigation**: T-001 is a one-line `git status` check before anything else starts.

### R4 — The backend test suite is non-deterministic *(certain, HIGH impact)*

**This is the most serious risk to the "nothing may break" constraint, and it is worse than the 007 notes suggest.**

Two consecutive full runs on an unchanged tree (2026-08-30) produced **disjoint** failure sets:

| | Run 1 | Run 2 |
|---|---|---|
| Suites | 3 failed, 23 passed, 26 total | 2 failed, 24 passed, 26 total |
| Tests | 7 failed, 317 passed, **324** total | 2 failed, 323 passed, **325** total |
| Failing | `onboarding.test.js`, `auth.approval.test.js`, +1 | `admin.timetable.test.js`, `teacher.attendance.test.js` |

Not one failing suite is common to both runs, and the collected test count itself differs.

Both run-2 failures share the signature `TypeError: Cannot read properties of null (reading 'teacher')` at `teacherId = tRes.body.data.teacher._id` — the create-teacher request returned a non-2xx. This is **not** cross-suite fixture collision: each test file gets its own `MongoMemoryReplSet` in `tests/setup.js`, and `employeeId` is unique per-school via `{schoolId, employeeId}` (`Teacher.model.js:37`), so the `TCH-001` shared by `admin.timetable` and `teacher.attendance` is harmless. It matches the transient replica-set/transaction failure that `tests/setup.js` already acknowledges in a comment and only partially mitigates by pre-creating collections.

`specs/007-multi-school-membership/plan.md` §6 is also **stale** — it lists `admin.teachers.test.js` as failing, but that suite now passes 19/19.

**Why this matters here**: FR-018 — "the 005 tests pass unedited" — is the main safety net for this feature, and a flaky suite makes it unverifiable in a single run.

**Mitigation**: T-002 requires capturing the baseline over **two** runs, and defines the decision rule: a failure counts as a real regression only if it reproduces across runs, or if it lands in a suite this feature actually touches (`services.test.js`, `teacher.marks.test.js`, `student.test.js`, `parent.results.test.js`). T-002a recommends stabilising the suite first, or at least tracking it separately. Note also that `npm test` exits 0 even when tests fail, so the exit code is never a pass signal.

### R5 — Enum change breaks existing test fixtures *(certain, low impact)*

Eight `examType: 'final'` references across three test files will fail, including `it('defaults examType to "final" when not provided')`. This is **intended** — those tests currently encode the governance hole as correct behaviour. They are work items (T-D1), not regressions.

---

## Lower-risk fallback

If the team decides the rename is more churn than they want, **Phase B's rename can be dropped while keeping the enum narrowing**: leave the field named `examType`, change only its enum values and the `marksObtained` validator. This still closes the governance hole (FR-002, FR-003, FR-004) and cuts the touched-file count from 20 to roughly 8.

The cost is a permanent naming defect — a field called "exam type" whose five permitted values contain no exams — which is the exact confusion this feature exists to remove. **Recommendation: take the rename.** The app is pre-launch, all 33 references are enumerated in `tasks.md`, and FR-019 makes completeness mechanically checkable.

Trade-off, stated precisely:

- The fallback **does avoid Risk R1**. Index *keys* are unchanged when the field keeps its name — only the enum's permitted values change, and indexes are indifferent to values. T-A2 and T-A3 could then be dropped.
- The fallback **does not avoid Phase D**. The same eight `examType: 'final'` fixtures still violate the narrowed enum and still need updating.
- Old documents carrying `examType: 'final'` would survive, since Mongoose validates on write and not on read. Harmless, but they are stale rows that no longer match any selectable type — and dropping them is free pre-launch.

---

## Complexity Tracking

| Item | Justification |
|---|---|
| New script `drop-stale-marks-indexes.js` | Not incidental complexity — without it, R1 breaks every environment that has already run the app. Follows the existing idempotent `_migrations` sentinel pattern from `migrate-to-multitenant.js`. |
| Validation duplicated in schema and service | Deliberate. `findOneAndUpdate` cannot reach sibling paths in a custom validator, so the service check is authoritative and the schema check guards direct `.save()` paths and test fixtures. |
| Four parent endpoints rather than one combined | Mirrors the four existing student routes one-for-one. A combined endpoint would need its own gating logic and could drift from the student path — the precise failure FR-014 exists to prevent. |

---

## Post-Design Constitution Re-check

No principle is weakened. Principle V improves on two counts (governance bypass closed, missing feature gate added). Principle VIII is unchanged in pattern and newly covered by explicit cross-tenant tests for the parent surface. No new dependency, no new collection, no new architectural layer.
