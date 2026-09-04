# Feature Specification: Coursework Assessments

**Feature Branch**: `009-coursework-assessments`
**Created**: 2026-09-02
**Status**: Implemented
**Input**: "Coursework will become a mess for a student in a year. If a student has 30 coursework results, how will they identify which is for what? There is no date, no teacher name, and I need some more extra details."

---

## Overview

Spec 008 separated Coursework from Report Cards and named them correctly, but deliberately deferred the underlying remodel. Testing 008 surfaced exactly the limitation it parked.

The complaint was that coursework entries are indistinguishable. The defect underneath is worse: they were also **destroying each other**.

### The two defects

**1. Entries carry no identity.** The student endpoint returned four fields — `subject`, `assessmentType`, `marksObtained`, `maxMarks`. A row read "Mathematics · Class Test · 18/20" with no title, no date and no teacher, so two class tests in the same subject were indistinguishable even in principle.

**2. A second assessment of the same type silently overwrote the first.** The flat `Marks` unique key was `(schoolId, studentId, subject, classId, assessmentType)`. That key contains the *type* of assessment rather than the assessment *itself*, so a teacher recording "Unit Test 2" in Mathematics overwrote "Unit Test 1" with no error. The write path used `findOneAndUpdate(..., { upsert: true })`, so the overwrite was silent, and an integration test asserted it as correct behaviour.

This also capped a student's coursework history at roughly 5 types × N subjects. The premise of "30 entries in a year" was not reachable — the data was being lost on the way in.

### The fix

Split the one flat row into two entities:

- **`Assessment`** — one row per real classroom event. Holds the facts shared by the whole class: title, subject, type, maxMarks, the date it was conducted, the academic year, and which teacher set it.
- **`AssessmentScore`** — one row per student per assessment. Holds that student's mark, an absent flag, and a per-student remark.

The unique key moves to `(schoolId, assessmentId, studentId)`. Because the key now names the assessment itself, any number of class tests can coexist in a subject.

The split also makes shared facts editable in one place: correcting a mistyped title or a wrong date fixes it for every student at once, which is impossible when those values are copied onto each student's row.

### Ratified decisions

| Question | Decision |
|---|---|
| Structure | **Assessment + AssessmentScore split** |
| Extra detail | **Title, conducted date, teacher name, per-student remarks, absent flag, class average** |
| Student layout | **Grouped by subject**, newest first within each group |
| Governance | Unchanged from 008 — **teacher-owned, no admin publish** |
| Flat `Marks` model | **Replaced, not kept alongside.** Keeping both would recreate the duplication 008 removed |
| Old coursework data | **Not migrated.** It has no title, date or author to migrate, and only the most recent mark per type survived anyway |

---

## User Scenarios & Testing

### User Story 1 — A Teacher Creates a Named Assessment, Then Enters Marks (Priority: P1)

A teacher opens **Coursework**, clicks "New assessment", and names it — "Unit Test 1", Mathematics, Class Test, out of 20, conducted 14 July. The assessment appears in their list. They open it and see the full class roster, entering a mark, an optional remark, and an absent tick per student. Saving makes it visible to students and parents immediately.

**Why this priority**: Creating the assessment as its own step is what gives every mark a title, a date and an author. Without it, nothing else in this spec is possible.

**Independent Test**: A teacher creates two assessments of the same type in one subject and enters marks on both. Both persist and are separately identifiable.

**Acceptance Scenarios**:

1. **Given** a teacher assigned to a class, **When** they create an assessment with a title and maxMarks, **Then** it is saved with the conducted date, the academic year copied from the class, and `createdBy` set to that teacher.
2. **Given** an assessment exists, **When** the teacher opens it, **Then** they see one row per student in the class, including students with no mark yet.
3. **Given** a teacher enters marks, **When** they save, **Then** each student gets exactly one score row, and re-saving updates in place rather than duplicating.
4. **Given** a teacher creates "Unit Test 1" and later "Unit Test 2" in the same subject, **When** both are saved, **Then** both exist independently — neither overwrites the other.
5. **Given** a teacher mistypes a title, **When** they correct it on the assessment, **Then** the correction applies to every student at once.
6. **Given** a score already recorded at 18, **When** the teacher tries to lower maxMarks to 10, **Then** the request is rejected rather than leaving a self-contradictory record.
7. **Given** a teacher not assigned to the class, **When** they try to create an assessment for it, **Then** the system returns 403.
8. **Given** any caller, **When** `assessmentType` is `final` or `midterm`, **Then** the request is rejected — term exams belong to the Report Cards pipeline.

---

### User Story 2 — A Student Can Tell Their Coursework Apart (Priority: P1)

A student opens **Coursework** and sees their entries grouped into a collapsible section per subject, each showing the subject average. Inside a group, entries are newest first, and each one shows its title, type, conducted date, teacher, mark, and the class average beside it.

**Why this priority**: This is the presenting complaint. Thirty entries must be navigable and each one identifiable.

**Independent Test**: A student with entries across three subjects sees three groups; every entry displays a title, a date and a teacher name.

**Acceptance Scenarios**:

1. **Given** a student with coursework in several subjects, **When** they open Coursework, **Then** entries are grouped by subject with a per-subject average.
2. **Given** entries within a subject, **When** the group renders, **Then** they are ordered newest first.
3. **Given** any entry, **When** it renders, **Then** it shows title, type, conducted date and the teacher's name.
4. **Given** an entry the teacher left a remark on, **When** it renders, **Then** the remark is shown to the student.
5. **Given** an assessment other students also sat, **When** the entry renders, **Then** the class average is shown alongside the student's own mark.
6. **Given** a student marked absent, **When** the entry renders, **Then** it reads "Absent" rather than 0, and is excluded from every average.

---

### User Story 3 — A Parent Sees the Same Detail (Priority: P2)

A parent opens their child's **Coursework** tab and sees the same subject grouping, titles, dates, teachers and remarks the student sees.

**Why this priority**: Parents are the audience most likely to ask "what was this mark for". They read through the same service as the student, so the two views cannot drift.

**Acceptance Scenarios**:

1. **Given** a linked parent, **When** they open the Coursework tab, **Then** they see the child's coursework grouped by subject with full detail.
2. **Given** an unlinked or cross-tenant parent, **When** they request coursework, **Then** the system returns 403.

---

### Edge Cases

- Every student in a class absent → class average is `null`, not `0`, and the UI shows no average rather than a misleading zero.
- A score saved, then the assessment deleted → scores are removed with it; the student's view drops the entry rather than showing an orphan.
- An assessment with no scores yet → appears in the teacher's list with `scoresEntered: 0`, and in no student's view.
- A student who changes class mid-year keeps their existing scores, since scores are keyed to the assessment rather than the class.
- A project scored out of 150 → accepted; the ceiling is the assessment's own `maxMarks`.

---

## Requirements

### Functional Requirements

- **FR-001**: An assessment MUST carry a title, subject, type, maxMarks, conducted date, academic year and creating teacher.
- **FR-002**: The score uniqueness key MUST be `(schoolId, assessmentId, studentId)`, so assessments of the same type coexist within a subject.
- **FR-003**: `assessmentType` MUST accept only `class_test`, `quiz`, `assignment`, `project`, `practical` — never `midterm` or `final`.
- **FR-004**: A score MUST be validated against its own assessment's `maxMarks`, with the whole batch rejected before any row is written.
- **FR-005**: `maxMarks` MUST NOT be lowered below a score already recorded against it.
- **FR-006**: An absent student MUST store no mark, and MUST be excluded from the student average, the subject average and the class average.
- **FR-007**: A teacher MUST only create, read or modify assessments for classes they are assigned to.
- **FR-008**: Student coursework MUST be returned grouped by subject, newest first within each group, with a per-subject average.
- **FR-009**: Each entry MUST carry title, type, conducted date, teacher name, marks, maxMarks, remarks, own percentage and class average.
- **FR-010**: Parents MUST read coursework through the same service as students, so gating and shape cannot diverge.
- **FR-011**: Deleting an assessment MUST remove its scores.
- **FR-012**: The flat `Marks` model, service, controller and routes MUST be removed — not left in place beside the new path.
- **FR-013**: The Exam → SubjectSubmission → Result pipeline MUST remain untouched.

### Key Entities

- **`Assessment`** — *new.* One per classroom event.
- **`AssessmentScore`** — *new.* One per student per assessment.
- **`Marks`** — *removed.* Replaced entirely.
- **`Exam`, `SubjectSubmission`, `Result`, `ClassTeacher`** — *unchanged.*

### Multi-Tenancy Scope

Per Constitution Principle VIII. Both new collections carry a required `schoolId` and every index is `schoolId`-leading. All routes run `authenticate → schoolScope → authorize(role)`; `schoolId` comes from `req.school._id`, never the body. Teacher access is additionally gated by `ClassTeacher` assignment, parent access by `requireLink`.

---

## Success Criteria

1. Two assessments of the same type in one subject both persist.
2. Every student-facing entry shows a title, a conducted date and a teacher name.
3. A remark written by a teacher reaches the student and the parent.
4. An absent student shows "Absent" and moves no average.
5. Class average appears beside the student's own mark.
6. Student coursework is grouped by subject with a per-subject average.
7. A project out of 150 saves.
8. `assessmentType: "final"` is rejected.
9. No reference to the flat `Marks` model remains.
10. The 005 exam-pipeline tests pass unedited.

---

## Assumptions

- Pre-launch: coursework recorded under the flat model is disposable and is not migrated. `backend/scripts/retire-marks-collection.js` drops the orphaned collection.
- Class average is computed on read rather than stored, so it stays correct as marks are entered or corrected.
- `academicYear` is copied from the class at creation. A class whose `academicYear` is unset yields `null`, which groups normally.
- Subjects remain free-text strings, consistent with the rest of the codebase — there is still no `Subject` entity.

---

## Deferred Scope

- **Term/semester grouping.** `academicYear` is stored and filterable but not yet surfaced as a UI filter; date ordering covers the immediate need.
- **Coursework on the report card.** Still deferred from 008: a separate reference section, no weighting into the exam percentage.
- **School-configurable grading policy.** Weightings and letter-grade bands per tenant.
- **Assessment attachments.** A question paper or rubric on the assessment.
- **Bulk import.** CSV upload of marks for a class.
