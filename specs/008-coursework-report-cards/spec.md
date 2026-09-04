# Feature Specification: Coursework & Report Cards — Separating Formative from Summative Assessment

**Feature Branch**: `008-coursework-report-cards`
**Created**: 2026-08-30
**Status**: Draft
**Input**: "Result and exam module seem somewhat similar — I need more clarity. Exam is created by admin, teacher uploads marks, admin publishes, then the user sees it, generally for term and final exams. But Result also has marks from teacher-given assignments or class tests. This needs to be segregated properly, or replaced, or removed."

---

## Overview

The platform currently has **three** independent ways to write a student's mark, each with different governance:

| Path | Who writes | Governance | Student sees it |
|---|---|---|---|
| **A.** `Exam → SubjectSubmission → Result` | Teacher enters, admin publishes | Full state machine; publish gated on every subject submitted; ranks; PDF report card | Only after admin publishes |
| **B.** `PUT /admin/exams/:examId/results` | Admin, directly | None — bypasses teachers and the state machine | Immediately |
| **C.** `Marks` collection | Teacher, directly | None | Immediately |

Path A is correct and stays. This feature fixes **Path C**, which is the source of the confusion and contains a real governance defect.

### The defect

`backend/src/models/Marks.model.js` defines `examType: ['midterm', 'final', 'quiz', 'assignment']`. Two of those four values — **`midterm` and `final`** — name the *same events* the Exam module governs. A teacher can open the Marks page, select "final", and publish final-exam marks straight to a student and parent with **no admin approval, no rank, no report card, and no audit trail**, while the real final exam is simultaneously running through the governed pipeline.

`Marks` is also unfit as a coursework tool. Its unique index is `(schoolId, studentId, subject, classId, examType)` — **one quiz and one assignment per subject, permanently** — with no year or term dimension, so a later year's entry silently overwrites the earlier one.

Students see the two systems side by side as `Marks` and `My Results`, two nav items showing two different overall percentages with no stated relationship.

### History — this was a known, twice-deferred decision

- `specs/004-school-portal-ux/research.md` §R-005: *"Adding year+term semantics to the existing Marks model would require breaking changes... Rejected — would break the existing `examType` enum logic and require migrating test data for 259 existing tests."* `Exam`+`Result` was therefore built **beside** `Marks` for test-migration cost reasons, not domain reasons. *"Both coexist."*
- `specs/005-exam-result-management/spec.md` line 180: *"The legacy 'marks' model... is unrelated to this feature and is left untouched."*

### The domain position

Two assessment concepts genuinely exist in every school and **should remain separate** — merging them would be the wrong fix:

- **Summative** — term exams. Formal, moderated, admin-published, produces the report card. This is `Exam → Result`. It stays exactly as it is.
- **Formative** — class tests, assignments, quizzes, projects. Frequent, teacher-owned, low ceremony. This is what `Marks` was attempting to be.

This feature shrinks `Marks` to formative-only, renames both concepts so the boundary is self-evident, and closes the parent-visibility gap. It does **not** restructure any model beyond `Marks`, and does not change the exam pipeline.

### Ratified decisions

| Question | Decision |
|---|---|
| Naming | **Coursework** (formative) / **Report Cards** (summative) |
| Coursework on the report card | A **separate reference section, no weighting** into the exam percentage — **deferred**, see Deferred Scope |
| Legacy `Marks` data | Pre-launch; **safe to drop**. No data migration script required |
| Coursework governance | **Teacher publishes directly.** No admin approval — this is the deliberate contrast with exams |
| Scope of this feature | **Separate and relabel only.** The `Assessment`/`AssessmentScore` remodel is deferred |
| Parent gap | **Fixed here** — parents currently cannot see report cards at all |
| Path B (admin direct entry) | **Left as-is** this pass |

---

## User Scenarios & Testing

### User Story 1 — A Teacher Records Coursework and Cannot Shadow-Record a Term Exam (Priority: P1)

A teacher opens **Coursework**, picks a class and subject, chooses an assessment type from *Class Test, Quiz, Assignment, Project, Practical*, sets the maximum marks, and enters scores. The marks are visible to the student and parent immediately — no admin step. The teacher has no way, through the UI or the API, to record a mark typed as a midterm or a final; those belong exclusively to the governed exam pipeline.

**Why this priority**: This closes the governance hole. Every other story in this spec is presentation; this one is correctness. Until `midterm` and `final` are removed from the enum, a teacher can bypass admin publication entirely.

**Independent Test**: A teacher saves a Project scored out of 150 and it persists. A direct `POST /api/v1/teacher/marks` carrying `assessmentType: "final"` is rejected with a 422 validation error.

**Acceptance Scenarios**:

1. **Given** a teacher assigned to a class, **When** they open the Coursework page, **Then** the assessment-type selector offers exactly *Class Test, Quiz, Assignment, Project, Practical* and no exam-like option.
2. **Given** a teacher saves a coursework mark, **When** the request succeeds, **Then** the record persists with the chosen `assessmentType` and is immediately readable by that student and their linked parent.
3. **Given** any caller, **When** `POST /teacher/marks` is sent with `assessmentType` of `"final"`, `"midterm"`, or any value outside the five permitted types, **Then** the system rejects it with a **422** validation error and writes nothing. *(422, not 400 — `errorHandler.js:21-26` maps Mongoose `ValidationError` to 422, which is the convention the existing marks tests already assert.)*
4. **Given** a subject scored out of more than 100 (e.g. a Project out of 150), **When** the teacher enters 128, **Then** the save succeeds. *(Today this fails: `marksObtained` carries a hard `max: 100` that contradicts the settable `maxMarks`.)*
5. **Given** a teacher records a Quiz and then an Assignment for the same student, subject and class, **When** both are saved, **Then** both records coexist — neither overwrites the other.
6. **Given** a teacher records a Quiz and later corrects that same Quiz mark, **When** they save again, **Then** the existing record is updated in place rather than duplicated.

---

### User Story 2 — A Student Sees Two Obviously Different Things (Priority: P1)

A student's sidebar shows **Coursework** and **Report Cards** instead of *Marks* and *My Results*. Coursework lists day-to-day class marks with an aggregate labelled "Coursework average". Report Cards lists published term exams with the official percentage, rank, pass/fail, and the PDF download. Nothing about the two screens invites the reader to confuse them.

**Why this priority**: This is the deliverable the user actually asked for — the two concepts being indistinguishable in the UI is the presenting complaint.

**Independent Test**: A student with both coursework marks and one published exam result sees two distinctly-titled screens, and the coursework aggregate is never presented as the student's official percentage.

**Acceptance Scenarios**:

1. **Given** a logged-in student, **When** the sidebar renders, **Then** it reads *Coursework* and *Report Cards*.
2. **Given** a student on the Coursework screen, **When** the aggregate renders, **Then** it is labelled "Coursework average" and is visibly not the official result.
3. **Given** an exam that is `draft`, `active`, or `locked`, **When** the student opens Report Cards, **Then** that exam does not appear. *(Unchanged behaviour — regression guard.)*
4. **Given** a student with published results across multiple years, **When** Report Cards loads, **Then** the year selector defaults to the **most recent** year. *(Today it defaults to the oldest: `ResultsPage.jsx:71` reads `yr[yr.length - 1]` while `getDistinctYears` returns descending.)*
5. **Given** a published exam, **When** the student clicks Download Report Card, **Then** the PDF generates as before. *(Unchanged — regression guard.)*

---

### User Story 3 — A Parent Can Finally See Their Child's Report Card (Priority: P1)

A parent opens a child's detail page and finds a **Coursework** tab and a **Report Cards** tab. Report Cards shows the same published exam results the student sees — per-subject marks, overall percentage, rank, pass/fail — subject to the same publication gating. A parent can only ever see a child they are linked to.

**Why this priority**: Parents today can read **only** the legacy `Marks` collection (`parent.service.js:63-66`). There is no parent route to `Result` at all, so a parent has never been able to see the report card their child sees. Renaming the existing tab to "Coursework" without adding this would leave the parent portal visibly half-built.

**Independent Test**: An admin publishes an exam. The linked parent opens the child's Report Cards tab and sees the identical result the student sees. An unlinked parent receives 403.

**Acceptance Scenarios**:

1. **Given** a parent linked to a student, **When** they open the child's Report Cards tab, **Then** they see the published exams and per-subject results for that child.
2. **Given** an exam that is not published, **When** the linked parent requests it, **Then** the system returns 404, exactly as it does for the student.
3. **Given** a parent **not** linked to a student, **When** they request that student's results by ID, **Then** the system returns 403.
4. **Given** a parent authenticated in School A, **When** they request a student ID belonging to School B, **Then** the system returns 403 and leaks nothing.
5. **Given** a parent on a plan without the exams feature, **When** they request results **or** coursework, **Then** the system returns 402 `FEATURE_NOT_AVAILABLE`. *(The existing parent marks route is currently the only marks endpoint in the app missing this gate.)*
6. **Given** a parent viewing the Coursework tab, **When** a mark renders, **Then** it shows as `85/100`. *(Today it renders `85/undefined` — `ChildDetail.jsx:83` reads `m.totalMarks`, but the field is `maxMarks`.)*

---

### User Story 4 — The Exam Pipeline Is Provably Untouched (Priority: P1)

Every part of the `Exam → SubjectSubmission → Result` flow behaves exactly as it does today: admin creates and activates, teachers save drafts and submit, publish stays gated on all subjects being submitted, ranks compute identically, students and the PDF are unchanged.

**Why this priority**: The explicit constraint on this work is that nothing existing may break. The exam pipeline is the most valuable thing in the product and this feature must not perturb it.

**Independent Test**: The full 005 integration suite — `admin.exam.lifecycle.test.js`, `teacher.subject.submission.test.js`, `student.published.results.test.js` — passes unmodified, with no edits to those files.

**Acceptance Scenarios**:

1. **Given** the 005 test files, **When** this feature is complete, **Then** they pass **without having been edited**.
2. **Given** the full exam lifecycle, **When** walked end to end manually, **Then** every state transition and guard behaves as before.
3. **Given** `Exam`, `SubjectSubmission`, and `Result`, **When** this feature is complete, **Then** none of those three schemas has changed in any way.

---

### Edge Cases

- **Stale MongoDB indexes.** Renaming the field changes the unique index. Mongoose runs with `autoIndex` on (`backend/src/config/db.js` calls `mongoose.connect` with no options) so it **creates** the new index but **never drops** the old one. The obsolete unique index on `examType` survives; every new document has `examType` absent, indexing as `null`, so the *second* coursework row for the same student+subject+class collides and fails with `E11000`. **This is the single most likely way this feature breaks a running environment** and is handled by a dedicated task. Precedent: `.claude/settings.local.json` still allowlists `node scripts/drop-stale-unique-indexes.js`, a script that no longer exists.
- A teacher records coursework, then the admin publishes a term exam for the same subject. Both must remain visible and clearly attributed to their own screen.
- A student has coursework but no published exam: Coursework populates, Report Cards shows its empty state.
- A student has a published exam but no coursework: the reverse.
- `assessmentType` values contain an underscore (`class_test`), unlike today's single-word values. Any UI rendering the raw value must map it to a display label.
- A parent linked to two children in the same school must see each child's results independently.

---

## Requirements

### Functional Requirements

**Coursework model and governance**

- **FR-001**: The system MUST rename the `Marks.examType` field to `Marks.assessmentType`.
- **FR-002**: `assessmentType` MUST accept exactly `class_test`, `quiz`, `assignment`, `project`, `practical`, defaulting to `class_test`.
- **FR-003**: The system MUST reject any write carrying `midterm` or `final` as an assessment type, at the schema level, so the API rejects it regardless of the UI.
- **FR-004**: `marksObtained` MUST be validated against the record's own `maxMarks` rather than a fixed ceiling of 100.
- **FR-005**: The coursework uniqueness key MUST remain `(schoolId, studentId, subject, classId, assessmentType)`, preserving today's upsert-in-place behaviour.
- **FR-006**: Obsolete indexes carrying `examType` MUST be dropped from any environment that has run a previous build.
- **FR-007**: Coursework MUST remain teacher-owned with no admin approval step.

**Naming**

- **FR-008**: All user-visible references to the legacy marks concept MUST read **Coursework**.
- **FR-009**: All user-visible references to published exam results MUST read **Report Cards**.
- **FR-010**: The coursework aggregate MUST be labelled "Coursework average", never presented as an official or overall percentage.
- **FR-011**: `assessmentType` values MUST render through a display-label map, never as raw underscore-separated strings.

**Parent access**

- **FR-012**: The system MUST expose parent endpoints for a linked child's exam years, published exams, result for an exam, and report-card payload.
- **FR-013**: Each parent endpoint MUST enforce the existing `requireLink` guard before returning data.
- **FR-014**: Parent endpoints MUST reuse the existing student-facing services so publication gating cannot diverge between the two audiences.
- **FR-015**: All parent exam, result and coursework routes MUST sit behind `checkFeatureAccess(FEATURES.EXAMS_RESULTS)`, including the existing `/children/:studentId/marks` route which currently lacks it.
- **FR-016**: The parent coursework view MUST render the denominator from `maxMarks`.

**Regression protection**

- **FR-017**: `Exam`, `SubjectSubmission`, and `Result` schemas MUST NOT change.
- **FR-018**: The 005 integration tests MUST pass unedited.
- **FR-019**: Every `examType` reference in the codebase MUST be updated; a repository-wide search for `examType` MUST return no results on completion.
- **FR-020**: The student Report Cards year selector MUST default to the most recent year.

### Key Entities

- **`Marks`** — *modified.* Becomes coursework-only. Field renamed, enum narrowed, marks ceiling corrected. No structural change.
- **`Exam`, `SubjectSubmission`, `Result`, `ClassTeacher`** — *unchanged.* Listed to make the boundary explicit.

### Multi-Tenancy Scope

Per Constitution Principle VIII. Every touched route already runs `authenticate → schoolScope → authorize(role)`. New parent routes read `schoolId` from `req.school._id`, never the body, and delegate to services that already take `schoolId` as their first argument and filter on it. The `Marks` indexes stay `schoolId`-leading. No new tenant-scoping pattern is introduced; the new endpoints inherit the existing one and must be covered by explicit cross-tenant tests.

---

## Success Criteria

1. A repository-wide search for `examType` returns zero results.
2. `POST /teacher/marks` with `assessmentType: "final"` returns 422.
3. A teacher can record a Quiz **and** an Assignment for the same student and subject, and both persist.
4. A Project scored out of 150 saves successfully.
5. Students and parents see *Coursework* and *Report Cards*; the word "Marks" no longer appears as a nav label.
6. A linked parent can open a published report card; an unlinked or cross-tenant parent gets 403.
7. Parent coursework renders `85/100`, not `85/undefined`.
8. The Report Cards year selector opens on the newest year.
9. The 005 integration tests pass **unedited**.
10. The backend suite shows no failures beyond the captured baseline. Note the suite is **non-deterministic** — two runs on an unchanged tree gave disjoint failure sets — so the baseline must be captured over two runs and a failure counts only if it reproduces or lands in a suite this feature touches. See plan.md Risk R4 and tasks.md T-002.

---

## Assumptions

- The application is pre-launch. `Marks` data is disposable, so the field rename needs no backfill — dropping the collection is acceptable in every environment.
- `Marks` is not referenced by any report, export, or analytics surface. Verified: the only readers are the teacher marks page, the student marks page, the student dashboard tile, and the parent marks tab.
- `student.service.getStudentMarks` keeps returning an `overallPercentage` field so the response shape is unchanged; only its UI label changes. Its value remains an unweighted average across all coursework ever recorded — acknowledged as crude, and out of scope to fix here.
- Route *paths* (`/student/marks`) may keep their current URLs. Renaming them is optional and separated into its own phase.
- The five assessment types cover the common Indian-school case implied by the existing Term 1/2/3 and 35% pass-mark conventions.

---

## Deferred Scope

Recorded so these are not lost. **None are built by this feature.**

- ~~**`Assessment` + `AssessmentScore` remodel.**~~ **DONE in spec 009** (`specs/009-coursework-assessments/`) — testing 008 surfaced this limitation immediately, and worse than anticipated: the flat unique key meant a second class test in a subject silently *overwrote* the first. Original note follows.
- **`Assessment` + `AssessmentScore` remodel.** The real fix for the one-row-per-type-forever index and the missing year/term dimension: a per-event `Assessment` (title, type, maxMarks, date, term, year) with one `AssessmentScore` per student. This feature deliberately keeps the flat `Marks` shape.
- **Coursework on the report card.** Decided — a separate reference section with no weighting into the exam percentage — but it needs the model above to be meaningful.
- **School-configurable grading policy.** Weightings and letter-grade bands per tenant. A genuine SaaS differentiator and a candidate premium-tier feature; the 35% pass threshold is currently hardcoded in three places (`result.service.js`, `exam.service.js`, and a comment in `Exam.model.js`) with no shared constant.
- **Path B, admin direct entry.** Left as-is by decision. It still writes `published: true` without checking `exam.state`, so it can attach published results to a `draft` exam; `getStudentResult` masks this on read, `buildReportCardPayload` does not.
- **`marks.service.assertAssigned` does not check `subject`** (`marks.service.js:16`) — any teacher assigned to a class may enter coursework for any subject in it. A real authorization gap, but tightening it could break schools where teachers cover for one another. Needs a product decision.
- **Duplicated exam/result logic.** Dense-rank is copy-pasted between `result.service._computeRanks` and `exam.service.publishExam`; percentage is computed in three places with three different denominators, and `buildReportCardPayload` ignores the stored `result.overallPercentage`, so the report card can disagree with the results page if `Exam.subjects` was edited after publication.
- **`Exam.state: 'locked'`** is in the enum and several guards branch on it, but nothing ever assigns it.
