# Tasks: Coursework & Report Cards

**Branch**: `008-coursework-report-cards` | **Date**: 2026-08-30
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md) · **API**: [contracts/api.md](./contracts/api.md)

`[P]` = parallelisable with its siblings. Each phase must leave the repo green before the next begins — a **partial rename is the specific failure mode that breaks things silently**, because a stale `examType` key in a Mongoose filter does not error, it just matches nothing and turns an upsert into an unintended insert.

**Scale**: 33 `examType` references across 13 files. Every one is enumerated below.

---

## Phase 0 — Pre-flight (do not skip)

- [x] **T-001**: Confirm the working tree is clean before starting: `git status --short` should show nothing but this spec directory.

  **Verified clean 2026-09-02.** Earlier in the same session the tree carried 12 modified files (an announcement `visibleUntil` feature plus responsive-UI work); that work has since been resolved and `visibleUntil` is now in `HEAD` via commit `0116d4d`. No stash action is needed.

  If uncommitted work reappears before you start, these are the files where it would collide with this feature — check them specifically:
  - `backend/src/services/student.service.js` — this feature edits `getStudentMarks` (line 364). Prior WIP touched `getStudentAnnouncements` (~line 388); different function, so a collision is unlikely but worth confirming.
  - `backend/tests/integration/student.test.js` — this feature edits lines 355 and 364.
  - `frontend/src/pages/Home.jsx` — this feature edits marketing copy; prior WIP was header layout.
  - `frontend/src/utils/reportCardPdf.js` — this feature does **not** touch it, but it is central to the report card, so land any WIP there before Phase E to keep the diff reviewable.

- [x] **T-002**: Capture the test baseline before changing any code. **Run the suite at least twice** — see the flakiness warning below:
  ```bash
  cd backend
  npm test 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > /tmp/baseline-008-run1.txt
  npm test 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > /tmp/baseline-008-run2.txt
  grep -E '^FAIL|^(Test Suites:|Tests:)' /tmp/baseline-008-run*.txt
  ```

  🔴 **The backend suite is non-deterministic. This is the single biggest obstacle to proving nothing broke.** Two consecutive full runs on an *unchanged* tree (2026-08-30) produced entirely disjoint results:

  | | Run 1 | Run 2 |
  |---|---|---|
  | Suites | 3 failed, 23 passed, 26 total | 2 failed, 24 passed, 26 total |
  | Tests | 7 failed, 317 passed, **324** total | 2 failed, 323 passed, **325** total |
  | Failing | `onboarding.test.js`, `auth.approval.test.js`, +1 | `admin.timetable.test.js`, `teacher.attendance.test.js` |

  No overlap between the two failure sets, and even the collected test *count* differs — a suite failing in a `beforeAll` changes how its remaining tests are reported.

  Both run-2 failures share one signature: `TypeError: Cannot read properties of null (reading 'teacher')` at the fixture line `teacherId = tRes.body.data.teacher._id` (`admin.timetable.test.js:69`, `teacher.attendance.test.js:133`) — i.e. the create-teacher request returned a non-2xx and `data` was null. This is **not** fixture collision: each test file gets its own `MongoMemoryReplSet` (`tests/setup.js` `beforeAll`), and `employeeId` is unique per-school via the compound index `{schoolId, employeeId}` on `Teacher.model.js:37`, so the duplicate `TCH-001` shared by those two files is harmless. It is consistent with the transient replica-set/transaction issue that `tests/setup.js` already acknowledges and only partially mitigates by pre-creating collections.

  **Consequence for this feature**: a single red run after your changes proves nothing on its own. Before blaming your diff, re-run and check whether the same suite fails twice. Only a failure that reproduces across runs — or one in a suite this feature actually touches (`services.test.js`, `teacher.marks.test.js`, `student.test.js`, `parent.results.test.js`) — counts as a real regression.

  Also note `npm test` **exits 0 even when tests fail**, so never treat the exit code as a pass signal.

  ⚠️ `specs/007-multi-school-membership/plan.md` §6 lists `admin.teachers.test.js` as a known failure — **stale**; it now passes 19/19 when run alone. Trust the files you capture, not 007.

- [ ] **T-002a** *(recommended, not blocking — not done)*: Consider stabilising the suite before starting, or at minimum opening a separate issue for it. Flaky integration tests make the FR-018 guarantee — "the 005 tests pass unedited" — unverifiable in one run, and that guarantee is the main safety net for this feature.

- [x] **T-003**: Confirm no consumer of `Marks` was missed. `grep -rn "Marks" backend/src frontend/src` should show only: the teacher coursework page, the student coursework page, the student dashboard tile, the parent marks tab, and their services/APIs. If anything else reads it, add it to Phase E before starting.

---

## Phase A — Backend schema and index safety

- [x] **T-A1**: Rewrite `backend/src/models/Marks.model.js` per [data-model.md §1](./data-model.md) — 5 references at lines 25, 46 (comment), 48, 52, 53:
  - Rename `examType` → `assessmentType`.
  - Enum → `['class_test', 'quiz', 'assignment', 'project', 'practical']`, default `'class_test'`. **This single change closes the governance hole (FR-002, FR-003).**
  - Replace `marksObtained`'s `max: [100, ...]` with a custom validator against `maxMarks` (FR-004). See the caveat in data-model.md §1 — it is unreliable under `findOneAndUpdate`, which is why T-B2 adds the authoritative check.
  - Rename the field in all three indexes: unique `(schoolId, studentId, subject, classId, assessmentType)`, plus `(schoolId, studentId, assessmentType, subject)` and `(schoolId, classId, assessmentType)`. Keep all three `schoolId`-leading.
  - Update the stale comment on line 46.

- [x] **T-A2**: Create `backend/scripts/drop-stale-marks-indexes.js`. **This is the highest-risk item in the feature — see plan.md Risk R1.** Mongoose creates the new indexes on boot but never drops the old ones, so the obsolete unique index on `examType` survives and makes the *second* coursework row for a student+subject+class fail with `E11000`.
  - Default path: drop the `marks` collection outright (sanctioned — data is disposable pre-launch). Tolerate `NamespaceNotFound`.
  - `--keep-data` path: enumerate indexes and drop only those whose key includes `examType`.
  - Read `process.env.MONGO_URI || process.env.MONGODB_URI` — `db.js` uses the first, `migrate-to-multitenant.js` the second. **Fail loudly if neither is set**; do not fall back to localhost, or the script will appear to succeed while doing nothing.
  - Follow the idempotent `_migrations` sentinel pattern from `backend/scripts/migrate-to-multitenant.js`.
  - Precedent: `.claude/settings.local.json` still allowlists `node scripts/drop-stale-unique-indexes.js`, a script that no longer exists — this trap has been hit here before.

- [ ] **T-A3** ⚠️ **NOT DONE — REQUIRES YOU**: Run T-A2's script against your local database. Not run during implementation because it needs a live MongoDB connection. **Run `node scripts/drop-stale-marks-indexes.js` before you next start the app against an existing database**, or the second coursework row a teacher saves will fail with E11000. Tests need no such step — `mongodb-memory-server` builds a fresh DB per run — so this is a local-and-deployed concern only.

---

## Phase B — Backend services and controllers

- [x] **T-B1**: `backend/src/services/marks.service.js` — 4 references at lines 26 (comment), 28 (JSDoc), 33, 38. Rename in the `upsertMark` destructure (`examType = 'final'` → `assessmentType = 'class_test'`) and in the `findOneAndUpdate` filter. **The filter is the dangerous one** — a missed rename there silently converts upsert-in-place into duplicate inserts (Risk R2). Leave `assertAssigned` unchanged.

- [x] **T-B2**: In the same file, add the authoritative ceiling check to `upsertMark`: throw **`ApiError(422, 'marksObtained cannot exceed maxMarks')`** when `marksObtained > (maxMarks ?? 100)`. Required because `upsertMark` uses `findOneAndUpdate` with `runValidators`, and under an update a custom Mongoose validator's `this` is the Query, not the document, so it cannot reliably read the sibling `maxMarks`.
  ⚠️ **422, not 400.** `middleware/errorHandler.js:21-26` maps Mongoose `ValidationError` to 422, and the existing suite asserts it (`teacher.marks.test.js:165`). Using 400 here would make the service path disagree with the schema path and break the established convention.

- [x] **T-B3** [P]: `backend/src/controllers/teacher/marks.controller.js` line 10 — JSDoc body comment only.

- [x] **T-B4** [P]: `backend/src/services/student.service.js` line 364 — change the `.select('subject examType marksObtained maxMarks')` projection to `assessmentType`. **Nothing else in this file changes**; leave `overallPercentage` exactly as it is so the response contract holds (it is relabelled in the UI by T-E4, not recomputed).

---

## Phase C — Parent report-card access

- [x] **T-C1**: `backend/src/services/parent.service.js` — add four functions, each following the exact shape of the existing `getChildAttendance` (line ~63): `await requireLink(parentId, studentId, schoolId)`, then delegate. **No new query logic** — this is what stops publication gating diverging between students and parents (FR-014):
  - `getChildExamYears` → `examService.getDistinctYears(schoolId)`
  - `getChildExams` → `examService.getExamsForStudent(schoolId, studentId, year)`
  - `getChildResult` → `resultService.getStudentResult(schoolId, studentId, examId)`
  - `getChildReportCard` → `examService.buildReportCardPayload(schoolId, studentId, examId)`
  All four target services already take `(schoolId, studentId, ...)` as leading arguments, so they compose without adaptation. Top-level `require` of `exam.service` and `result.service` is safe — neither requires any other service, so there is no cycle.

- [x] **T-C2**: `backend/src/controllers/parent.controller.js` — four handlers matching the existing `getChildMarks` shape. `schoolId` from `req.school._id`, parent id from `req.user._id`, never the body.

- [x] **T-C3**: `backend/src/routes/parent.routes.js` — wire four `GET` routes per [contracts/api.md](./contracts/api.md): `/children/:studentId/exam-years`, `/exams`, `/results`, `/results/:examId/report-card`. Wrap all four in `checkFeatureAccess(FEATURES.EXAMS_RESULTS)` — this file does not currently import that middleware, so add the import. Registration order does not matter (Express matches full paths); mirror `student.routes.js:66,79`, which registers `/results` before `/results/:examId/report-card`.

- [x] **T-C4**: In the same file, add `checkFeatureAccess(FEATURES.EXAMS_RESULTS)` to the **existing** `/children/:studentId/marks` route (FR-015). It is currently the only marks endpoint in the app without that gate; every admin, teacher and student equivalent has it. This is a deliberate behaviour change: starter-plan parents will now get 402 instead of 200.

---

## Phase D — Backend tests

- [x] **T-D1**: Update `backend/tests/unit/services.test.js` — 8 references at lines 153, 162, 173, 178, 190, 200, 207, 213. **These failures are intended**: the tests currently encode the governance hole as correct behaviour.
  - Lines 153, 162, 173, 178, 190, 200: `examType: 'final'` → `assessmentType: 'class_test'` in the `upsertMark` fixtures.
  - Line 207 test name + line 213 assertion: `defaults examType to "final"` → `defaults assessmentType to "class_test"`, asserting `mark.assessmentType`.
  - Line 186 is named `it('rejects marksObtained above 100 via schema validator')`. It passes `marksObtained: 101` with **no `maxMarks`**, which defaults to 100, so it still correctly rejects under the new rule — only the fixture field and the test name need updating (→ "above maxMarks"). The assertion is `.rejects.toBeDefined()`, so it tolerates either the schema or the T-B2 service error.
  - ℹ️ The test at lines 170-184 (`updates an existing mark record (upsert)` → asserts `count === 1`) is an **existing guard for Risk R2**: if the rename in `marks.service`'s `findOneAndUpdate` filter is missed, the upsert becomes an insert and the count is 2. Keep it.

- [x] **T-D2**: Update `backend/tests/integration/teacher.marks.test.js` — line 120 fixture, line 139 test name. **Line 165, `it('422 — marksObtained above 100 is rejected')`, asserts the old fixed ceiling** — rewrite it to send `{ marksObtained: 101, maxMarks: 100 }` and still expect **422**, then add a positive case proving a Project at `{ marksObtained: 128, maxMarks: 150 }` now returns 200 (FR-004). Keep the expected status at 422 throughout; do not switch to 400.

- [x] **T-D3**: Update `backend/tests/integration/student.test.js` — lines 355 and 364. ⚠️ This file has uncommitted WIP (T-001); check for collisions before editing.

- [x] **T-D4**: Add the governance regression test to `teacher.marks.test.js`: `POST /teacher/marks` with `assessmentType: "final"` MUST return **422** (Mongoose enum rejection), and again with `"midterm"`. **This is the permanent guard for the defect this whole feature exists to fix** — it must never be deleted.

- [x] **T-D5**: Create `backend/tests/integration/parent.results.test.js`, modelled on the existing `student.published.results.test.js`. Cover: linked parent sees a published result; unpublished/draft exam returns 404; unlinked parent gets 403; **cross-tenant parent gets 403** (Constitution Principle VIII — `cross-tenant.test.js` is the only backstop for `schoolId` scoping since there is no Mongoose-level plugin enforcing it); starter plan returns 402.

- [x] **T-D6**: Run `cd backend && npm test` and diff against T-002's baseline. **The 005 files — `admin.exam.lifecycle.test.js`, `teacher.subject.submission.test.js`, `student.published.results.test.js` — must pass with zero edits.** That is the proof FR-017/FR-018 hold. Do not "fix" them; if one fails, the exam pipeline was perturbed and the cause must be found instead.

---

## Phase E — Frontend relabel

- [x] **T-E1**: Create a shared display-label map — e.g. `frontend/src/utils/assessmentTypes.js` — exporting the five values plus labels: `class_test` → "Class Test", `quiz` → "Quiz", `assignment` → "Assignment", `project` → "Project", `practical` → "Practical". **Required**: `class_test` contains an underscore, unlike today's single-word values, and there are **four sites rendering the raw value** (`MarksCard.jsx:44`, `StudentDashboard.jsx:114`, `ChildDetail.jsx:81`, teacher `MarksPage.jsx:239`). Define once, import everywhere — do not duplicate per component.

- [x] **T-E2**: `frontend/src/components/common/Sidebar.jsx` — teacher line 49 `Marks` → `Coursework`; student line 58 `Marks` → `Coursework`; student line 59 `My Results` → `Report Cards` (FR-008, FR-009).

- [x] **T-E3**: `frontend/src/pages/teacher/MarksPage.jsx` — 4 references at lines 21, 122, 204, 239. Rename `EXAM_TYPES` (line 13) → `ASSESSMENT_TYPES` importing from T-E1; state `examType` → `assessmentType`; the `saveMark` payload key (line 122); the selector label "Exam Type" → "Assessment Type" (line 204); the summary line (line 239) via the label map. Page heading → "Coursework".

- [x] **T-E4**: `frontend/src/components/student/MarksCard.jsx` — 2 references at lines 41 and 44. Re-key `EXAM_TYPE_STYLES` to the five new values (add styles for `project` and `practical`); read `mark.assessmentType`; render through the label map. **Relabel the aggregate "Coursework average"** (FR-010) — leaving it as a bare overall percentage puts a second, contradictory headline number beside the report card's official one, which is the exact confusion being removed.

- [x] **T-E5** [P]: `frontend/src/pages/student/MarksPage.jsx` — heading "My Marks" → "My Coursework"; empty-state copy.

- [x] **T-E6** [P]: `frontend/src/pages/student/ResultsPage.jsx` — heading → "Report Cards". **Also fix line 71**: `setSelectedYear(yr[yr.length - 1])` picks the *oldest* year because `getDistinctYears` returns descending, so students land on a stale year (FR-020).

- [x] **T-E7** [P]: `frontend/src/pages/student/StudentDashboard.jsx` line 114 — tile label and label-map render. Update the fixture in `StudentDashboard.test.jsx` line 41 to match.

- [x] **T-E8**: `frontend/src/pages/parent/ChildDetail.jsx` — line 15 `TABS`: `'Marks'` → `'Coursework'`, add `'Report Cards'`; add its fetcher to the map at lines 43-47 and a renderer reusing the student results card layout. Line 81 renders the type via the label map. **Fix line 83**: it reads `{m.marksObtained}/{m.totalMarks}` but the model field is `maxMarks`, so parents currently see `85/undefined` (FR-016).

- [x] **T-E9** [P]: `frontend/src/api/parent.api.js` — four client functions matching the existing one-liner style.

- [x] **T-E10** [P]: `frontend/src/api/teacher.api.js` line 29 — JSDoc only.

- [x] **T-E11** [P]: `frontend/src/pages/Home.jsx` — marketing copy mentioning "Marks". ⚠️ Has uncommitted WIP (T-001).

- [x] **T-E12**: Run `cd frontend && npm test`. Note `ProtectedRoute.test.jsx` OOMs its worker so its 3 tests silently do not run while the command still exits 0 — a known pre-existing condition, not caused by this work.

---

## Phase F — Documentation

- [x] **T-F1** [P]: `specs/005-exam-result-management/spec.md` line 180 — currently asserts the `Marks` model *"is unrelated to this feature and is left untouched"*. No longer true. Amend to point at spec 008.

- [x] **T-F2** [P]: `README.md` ~lines 360-363 — documents a `Result` with `subjectResults[]`/`grade` and a `SubjectSubmission` with `teacherId`/`status: accepted|reopened`. **None of those fields exist.** Correct to match the real schemas and add the Coursework/Report Cards distinction.

---

## Phase G — Optional: route paths

- [ ] **T-G1**: Rename `/student/marks` → `/student/coursework` and `/teacher/marks` → `/teacher/coursework` in `frontend/src/App.jsx` and `Sidebar.jsx`. Cosmetic; pre-launch so no bookmarks break. **Droppable without affecting any other phase.** Backend API paths stay `/api/v1/*/marks` — changing those is not in scope.

---

## Verification gate

- [x] **T-V1**: `grep -rn "examType" backend/src backend/tests frontend/src` returns **zero results** (FR-019). This is the mechanical completeness check for Risk R2 — Mongoose does not error on an unrecognised filter key, so a missed reference fails silently rather than loudly.

- [x] **T-V2**: `grep -rn "examType\|assessmentType" backend/src/models/Exam.model.js backend/src/models/Result.model.js backend/src/models/SubjectSubmission.model.js` returns zero — confirming the exam triad was not touched (FR-017).

- [x] **T-V3**: `git diff --stat` shows **no changes** to `exam.service.js`, `subjectSubmission.service.js`, `result.service.js`, `admin.routes.js`, `teacher.routes.js`, `student.routes.js`, or any 005 test file.

- [x] **T-V4**: Backend suite shows no failures beyond T-002's captured baseline.

- [x] **T-V5**: Walk the manual flow in [quickstart.md](./quickstart.md) end to end.
