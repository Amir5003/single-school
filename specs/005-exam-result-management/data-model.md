# Data Model: Examination & Result Management Module

**Branch**: `005-exam-result-management` | **Date**: 2026-05-24

This document defines the database schema changes and new collections required by the feature.

---

## 1. `Exam` (modified — existing model)

File: `backend/src/models/Exam.model.js`

**Existing fields** (unchanged): `schoolId`, `classId`, `name`, `year`, `term`, `subjects[]`, `publishedAt`, `isDeleted`, `createdAt`, `updatedAt`.

**New fields**:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `state` | `String` enum `['draft','active','locked','published']` | `'draft'` | State machine. New exams start in draft. |
| `publishedBy` | `ObjectId` ref `User` | `null` | Stamped when publish action runs. |

**Subject sub-schema** (existing): `{ name, totalMarks, passMark }`.

**Indexes** (existing, unchanged):
- Unique `(schoolId, classId, name, year, term)`
- `(schoolId, classId, year, term)`
- `(schoolId, year)`
- `(schoolId, isDeleted)`

**State transitions** (enforced in `exam.service`):
- `draft → active` via `activateExam`
- `active → published` via `publishExam` (requires all SubjectSubmissions = `submitted`)
- `active → draft` via `revertToDraft` (only if no submissions are `submitted`)
- `published` is terminal (no admin can revert without manual DB intervention)
- `locked` is reserved for future scheduling features (set automatically on publish so it doubles as a stopper); not exposed as a separate user action in v1

**Subjects immutability rule**: once any SubjectSubmission for this exam has state != `pending`, the `subjects[]` array is immutable. `updateExam` returns 409 if any subject mutation is attempted.

---

## 2. `SubjectSubmission` (new)

File: `backend/src/models/SubjectSubmission.model.js`

One document per (exam, subject). Created at exam activation time.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schoolId` | `ObjectId` ref `School` | yes | Multi-tenant scope. |
| `examId` | `ObjectId` ref `Exam` | yes | Parent exam. |
| `classId` | `ObjectId` ref `Class` | yes | Denormalised from exam for query efficiency. |
| `subject` | `String` | yes | Matches an entry in `exam.subjects[].name`. |
| `totalMarks` | `Number` | yes | Denormalised from exam subject for validation without join. |
| `passMark` | `Number` | no (default null) | When null, fall back to ceil(35% × totalMarks). |
| `assignedTeacherId` | `ObjectId` ref `Teacher` | no (default null) | Resolved from `ClassTeacher` at activation. Null = unassigned. |
| `state` | `String` enum `['pending','draft','submitted','locked']` | yes (default `'pending'`) | Submission lifecycle. |
| `marks` | `[{ studentId: ObjectId ref Student, marksObtained: Number }]` | yes (default `[]`) | Per-student marks for this subject only. |
| `submittedAt` | `Date` | no | Set when state moves to `submitted`. |
| `submittedBy` | `ObjectId` ref `User` | no | The teacher who submitted (`req.user._id`). |
| `lastSavedAt` | `Date` | no | Updated on every draft save. |
| `createdAt`, `updatedAt` | `Date` | yes | Mongoose timestamps. |

**Indexes**:
- Unique `(schoolId, examId, subject)` — one submission per exam-subject.
- `(schoolId, examId)` — admin dashboard fetch.
- `(schoolId, assignedTeacherId, state)` — teacher list query.
- `(schoolId, classId)` — auxiliary lookups.

**State transitions**:
- `pending → draft` on first `saveDraft`.
- `draft → submitted` on `submit`.
- `submitted → draft` on admin `reopen`.
- `submitted → locked` on exam `publish`.
- `pending → locked` is forbidden — publish requires all subjects to be in `submitted` first.

**Subject ↔ Exam consistency**: the `subject` field MUST match a name in `exam.subjects[]`. Enforced at creation time (activation). If the exam's subjects[] is mutated after activation (which is forbidden anyway), no auto-sync runs.

---

## 3. `Result` (modified — existing model)

File: `backend/src/models/Result.model.js`

**Existing fields** (unchanged): `schoolId`, `examId`, `studentId`, `marks[]`, `overallPercentage`, `rank`, `isDeleted`, `createdAt`, `updatedAt`.

**New fields**:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `published` | `Boolean` | `false` | True only when the admin runs the publish flow. Student endpoints filter on this. |

**Indexes** (existing + new):
- Unique `(schoolId, examId, studentId)` (existing)
- `(schoolId, studentId, examId)` (existing)
- `(schoolId, examId)` (existing)
- **New**: `(schoolId, studentId, published)` for fast student-side queries.

**Lifecycle**:
- Legacy `PUT /admin/exams/:examId/results` writes Result documents with `published: true` (preserves 004 behaviour and existing tests).
- New `POST /admin/exams/:examId/publish` writes Result documents with `published: true` after aggregating SubjectSubmissions.
- Direct admin upsert is discouraged for new exams but kept for migration.

---

## 4. `ClassTeacher` (existing — unchanged schema)

File: `backend/src/models/ClassTeacher.model.js`

Source of truth for "which teacher teaches which subject in which class". Used at exam activation time to populate `SubjectSubmission.assignedTeacherId`. Schema unchanged.

---

## Migration notes

- Existing Exam documents without `state` are treated as `active` for backward compatibility (the service layer reads `exam.state ?? 'active'` — old exams stay usable on the legacy result-entry path).
- Existing Result documents without `published` default to `false` on read (Mongoose returns undefined → falsy). Since 004 tests rely on students seeing those results, the test setup must explicitly mark seed Result docs as `published: true` OR the service must treat absent `published` as `true` for legacy results. **Chosen approach**: in `result.service.getStudentResult`, treat `result.published !== false` as visible (i.e. undefined and true both pass; only explicit false hides). This preserves 004 behaviour without a DB migration.
- No data backfill required at deploy time. All migrations are read-time compatibility shims.
