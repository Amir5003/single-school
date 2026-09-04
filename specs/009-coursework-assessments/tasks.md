# Tasks: Coursework Assessments

**Branch**: `009-coursework-assessments` | **Date**: 2026-09-02
**Spec**: [spec.md](./spec.md) · **Data Model**: [data-model.md](./data-model.md) · **API**: [contracts/api.md](./contracts/api.md)

Status reflects what was actually implemented. Anything not done is marked and says why.

---

## Phase A — Models

- [x] **T-A1**: `backend/src/models/Assessment.model.js` — title, subject, type, maxMarks, conducted `date`, `academicYear`, `createdBy`, soft delete. Three `schoolId`-leading indexes.
- [x] **T-A2**: `backend/src/models/AssessmentScore.model.js` — `marksObtained` (null when absent), `absent`, `remarks`. **Unique `(schoolId, assessmentId, studentId)`** — the defect fix.

## Phase B — Service

- [x] **T-B1**: `backend/src/services/assessment.service.js` — `createAssessment`, `listAssessmentsForTeacher`, `getAssessmentWithScores`, `saveScores`, `updateAssessment`, `deleteAssessment`, `getStudentCoursework`.
- [x] **T-B2**: `assertAssigned` guard on every teacher entry point, reusing the `ClassTeacher` check.
- [x] **T-B3**: Validate the whole score batch before writing any row, so one bad mark cannot half-save a class.
- [x] **T-B4**: Refuse lowering `maxMarks` below a recorded score.
- [x] **T-B5**: Class/subject/overall averages computed on read, with absences excluded from all three.

## Phase C — Routes and controllers

- [x] **T-C1**: `backend/src/controllers/teacher/assessment.controller.js` — six handlers.
- [x] **T-C2**: `backend/src/validators/assessment.validator.js` — create, update and score validators. The enum here is the first line of defence against `final`/`midterm`.
- [x] **T-C3**: Teacher routes replacing the flat marks pair.
- [x] **T-C4**: `GET /student/coursework` replacing `GET /student/marks`.
- [x] **T-C5**: `GET /parent/children/:studentId/coursework` replacing the marks route, delegating to the same service.

## Phase D — Remove the flat path

- [x] **T-D1**: Delete `Marks.model.js`, `marks.service.js`, `marks.controller.js`.
- [x] **T-D2**: `backend/scripts/retire-marks-collection.js` — dry-run by default, `--confirm` to drop. Accepts `MONGO_URI` or `MONGODB_URI` and fails loudly if neither is set.
- [x] **T-D3**: Remove every reference to the flat path across services, controllers, routes and tests.

- [ ] **T-D4** ⚠️ **NOT DONE — REQUIRES YOU**: Run the retire script against your database. Not run during implementation because it needs a live MongoDB connection, and it deletes data.
  ```bash
  cd backend
  node scripts/retire-marks-collection.js            # reports what would be dropped
  node scripts/retire-marks-collection.js --confirm  # actually drops it
  ```
  Any coursework you entered while testing 008 lives in that collection and **will be lost**. It is not reachable by the new code either way — no model, service or route reads it.

## Phase E — Tests

- [x] **T-E1**: `teacher.assessments.test.js` (renamed from `teacher.marks.test.js`) — create, validation, governance guard, scores, remarks, absent, ceiling, update, delete. **24 pass.**
- [x] **T-E2**: Governance regression kept — `assessmentType` of `final` or `midterm` returns 422. **Do not delete.**
- [x] **T-E3**: `student.test.js` — grouped-by-subject shape, and a test proving two same-type assessments coexist. **21 pass.**
- [x] **T-E4**: `parent.results.test.js` — parent coursework detail plus unlinked 403.
- [x] **T-E5**: Remove the obsolete `marks.service` unit block from `services.test.js`.

## Phase F — Frontend

- [x] **T-F1**: `frontend/src/api/assessment.api.js`.
- [x] **T-F2**: `pages/teacher/CourseworkPage.jsx` — assessment list plus a create form (title, type, maxMarks, conducted date).
- [x] **T-F3**: `pages/teacher/AssessmentEntryPage.jsx` — roster grid with marks, absent checkbox, per-student remarks, live class average.
- [x] **T-F4**: `components/student/CourseworkList.jsx` — collapsible per-subject groups with subject average; each entry shows title, type, date, teacher, remark and class average.
- [x] **T-F5**: `pages/student/MarksPage.jsx` rewritten against the grouped payload.
- [x] **T-F6**: `pages/parent/ChildDetail.jsx` — Coursework tab renders the same grouped shape.
- [x] **T-F7**: Routes `/{teacher,student}/coursework` and `/teacher/coursework/:assessmentId`; sidebar and dashboard links updated.
- [x] **T-F8**: `vite build` passes — every import resolves.

## Phase G — Docs

- [x] **T-G1**: This spec set.
- [x] **T-G2**: Update `README.md` — its schema table still lists `Marks (Coursework)` from spec 008. Replace with `Assessment` and `AssessmentScore`.
- [x] **T-G3**: Append a note to `specs/008-coursework-report-cards/spec.md` Deferred Scope recording that the Assessment remodel is now done in 009.

---

## Verification

- [x] `grep -rn "Marks.model\|marks.service\|examType"` across `backend/src`, `backend/tests`, `frontend/src` → zero hits.
- [x] Exam pipeline files show **no diff**; the three 005 test suites pass unedited.
- [x] App boots — no circular import from `parent.service`/`student.service` requiring `assessment.service`.
- [x] `vite build` clean.
- [x] **Full backend suite: 342/342 pass, 27 suites, zero failures** (run serially, nothing competing). Frontend: 20/20, `vite build` clean.

### On the backend suite

An earlier full run showed widespread failures in suites this feature never touches (`cross-tenant`, `admin.timetable`, `auth.approval`). Those were **resource contention, not regressions** — suites that normally take ~20s took 496s and 919s because a second jest process was running concurrently. Confirmed: re-run serially, the suite is **fully green at 342/342**.

Two known harness behaviours, both pre-existing and documented in 008 T-002:

- The suite is **non-deterministic** — two runs on an unchanged tree produced disjoint failure sets. A single red run proves nothing; re-run before blaming a diff.
- `npm test` **exits 0 even when tests fail.** Read the summary counts.
- `student.test.js` can hang after its assertions pass (an open handle, not a failure). `--forceExit` gets a clean result: **21/21 pass**.
