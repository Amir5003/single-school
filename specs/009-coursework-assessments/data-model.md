# Data Model: Coursework Assessments

**Branch**: `009-coursework-assessments` | **Date**: 2026-09-02

Two collections added, one removed. The exam triad is untouched.

---

## 1. `Assessment` (new)

File: `backend/src/models/Assessment.model.js`

One document per real classroom event. Holds the facts shared by the whole class.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schoolId` | ObjectId ref `School` | yes | Tenant scope. |
| `classId` | ObjectId ref `Class` | yes | |
| `subject` | String, trimmed | yes | Free text — no `Subject` entity exists in this codebase. |
| `title` | String, trimmed, max 120 | yes | **The field that makes an entry identifiable** — "Unit Test 1". |
| `assessmentType` | String enum | no (default `class_test`) | `class_test`, `quiz`, `assignment`, `project`, `practical`. Term-exam values are deliberately absent. |
| `maxMarks` | Number, min 1 | yes | The per-assessment ceiling. Replaces the old fixed 100. |
| `date` | Date | yes (default now) | **Conducted** date, teacher-set. Distinct from `createdAt`, which is only when marks were typed. |
| `academicYear` | String | no (default null) | Denormalised from the class so a multi-year history can be scoped without a join. |
| `createdBy` | ObjectId ref `Teacher` | yes | Supplies the teacher name on the student's view. |
| `isDeleted` | Boolean | no (default false) | Soft delete. |
| `createdAt` / `updatedAt` | Date | yes | Mongoose timestamps. |

**Indexes**
- `(schoolId, classId, subject, date desc)` — the student/subject read path.
- `(schoolId, classId, isDeleted)` — list filtering.
- `(schoolId, createdBy)` — a teacher's own assessments.

No unique index. Two assessments may legitimately share a title within a class — a re-sat test, for instance — and a unique constraint interacting with soft delete would block reusing a title after deletion.

---

## 2. `AssessmentScore` (new)

File: `backend/src/models/AssessmentScore.model.js`

One document per student per assessment.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schoolId` | ObjectId ref `School` | yes | Tenant scope. |
| `assessmentId` | ObjectId ref `Assessment` | yes | Parent event. |
| `studentId` | ObjectId ref `Student` | yes | |
| `marksObtained` | Number, min 0 | no (default null) | **Null when absent** — never coerced to 0. |
| `absent` | Boolean | no (default false) | Excluded from every average. |
| `remarks` | String, trimmed, max 300 | no (default `''`) | Per-student note, visible to student and parent. |
| `createdAt` / `updatedAt` | Date | yes | Mongoose timestamps. |

**Indexes**
- **Unique `(schoolId, assessmentId, studentId)`** — the defect fix. See below.
- `(schoolId, studentId)` — the student's own coursework.
- `(schoolId, assessmentId)` — the teacher's entry grid and class average.

### Why the key change is the whole point

The flat model it replaces keyed on:

```
(schoolId, studentId, subject, classId, examType)   ← the assessment TYPE
```

That key identifies "this student's class-test mark in Maths" — a slot, not an event. Writing a second class test in Maths matched the same slot, and because the write used `findOneAndUpdate(..., { upsert: true })`, it **overwrote the first with no error**. It also capped a student's whole coursework history at roughly 5 types × N subjects.

The new key is:

```
(schoolId, assessmentId, studentId)                 ← the assessment ITSELF
```

Two assessments are two documents, so their scores never collide. Re-saving the same assessment still updates in place, which is the behaviour teachers want when correcting a mark.

---

## 3. `Marks` (removed)

Files deleted: `backend/src/models/Marks.model.js`, `backend/src/services/marks.service.js`, `backend/src/controllers/teacher/marks.controller.js`.

Removed rather than kept alongside. Leaving it would recreate precisely the two-parallel-systems problem spec 008 existed to remove.

### Data is not migrated

Old rows cannot be migrated faithfully:

- They have **no title** — the field that makes an entry identifiable.
- They have **no conducted date** — only `createdAt`, when marks were typed.
- They have **no recorded author**, so no teacher name.
- Because of the old unique key, **only the most recent mark per type per subject survived** anyway; earlier ones were already destroyed.

A migration would therefore invent the three fields this feature exists to add. The application is pre-launch and the data is disposable.

`backend/scripts/retire-marks-collection.js` drops the orphaned collection. It is **dry-run by default** and reports the document count; `--confirm` performs the drop. Dropping also removes the collection's indexes, which matters because Mongoose never drops indexes for a model it no longer defines — they would otherwise linger on a collection with no code behind it.

The script accepts `MONGO_URI` or `MONGODB_URI` (`db.js` uses the first, `migrate-to-multitenant.js` the second) and fails loudly if neither is set, rather than silently connecting to a default.

---

## 4. Computed, not stored

Deliberately absent from both schemas:

| Value | Why computed |
|---|---|
| Class average | Recomputed on read so it stays correct as marks are entered or corrected. Stored, it would drift. |
| Subject average | Derived from the student's own entries at read time. |
| Overall coursework percentage | Mean of entry percentages, absences excluded. |
| Student percentage per entry | `marksObtained / maxMarks`. |

All live in `assessment.service.js`. Absences are filtered out of every one of them — an absent student is not a zero.

---

## 5. Models NOT changed

| Model | Status |
|---|---|
| `Exam`, `SubjectSubmission`, `Result` | **Unchanged.** The Report Cards pipeline is untouched; the 005 tests pass unedited. |
| `ClassTeacher` | **Unchanged.** Still the authority for teacher↔class assignment, now guarding assessment access. |
| `Class`, `Student`, `ParentStudentLink` | **Unchanged.** |
