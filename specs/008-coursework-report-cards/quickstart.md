# Quickstart: Coursework & Report Cards

**Branch**: `008-coursework-report-cards` | **Date**: 2026-08-30

How to verify the feature end to end. Run after Phase E; the automated gates are in [tasks.md](./tasks.md) Phase D and the Verification Gate.

---

## Prerequisites

```bash
# From the repo root
npm run dev          # starts backend (nodemon) + frontend (vite) concurrently
```

**One-time, before first run after Phase A** — clear the stale indexes. Mongoose creates the new `assessmentType` indexes automatically but never drops the old `examType` ones, and the obsolete unique index will make the *second* coursework row for a student+subject+class fail with `E11000`:

```bash
cd backend && node scripts/drop-stale-marks-indexes.js
```

Skipping this is the single most likely way this feature appears broken. Tests are unaffected — `mongodb-memory-server` builds a fresh database per run.

---

## 1. Governance — the defect this feature exists to fix

The important check. With a teacher token:

```bash
curl -X POST http://localhost:5000/api/v1/teacher/marks \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"...","classId":"...","subject":"Mathematics",
       "assessmentType":"final","marksObtained":82,"maxMarks":100}'
```

**Expect `422`.** Repeat with `"midterm"` — also `422`. A teacher must have no route to record a term-exam mark outside the admin publish workflow. Verify this by API, not only through the UI: removing the dropdown option is not the fix, rejecting the value is.

*(422 rather than 400 is this codebase's convention — `errorHandler.js` maps Mongoose `ValidationError` to 422.)*

```bash
# And the positive case
-d '{"...":"...","assessmentType":"class_test","marksObtained":18,"maxMarks":20}'
```
**Expect `200`.**

---

## 2. Teacher — Coursework

Log in as a teacher assigned to a class, open **Coursework** (the nav item formerly labelled "Marks"):

- The assessment-type selector offers exactly **Class Test, Quiz, Assignment, Project, Practical** — no exam-like option.
- Types render as "Class Test", never as the raw `class_test`.
- Save a **Project** scored **128 out of 150**. It must succeed — this proves the old fixed `max: 100` ceiling is gone.
- Save a **Quiz** for a student, then an **Assignment** for the *same student, same subject, same class*. **Both must persist.** If the second fails with `E11000`, the stale index was not dropped — go back to Prerequisites.
- Re-save the Quiz with a corrected mark. It must update in place, not duplicate.

---

## 3. Admin — the exam pipeline is untouched

This is a regression check, not new behaviour. Nothing below should feel different:

1. **Admin → Exams** → create an exam (name, year, term, class, subjects with total and pass marks). State is `draft`.
2. **Activate.** One SubjectSubmission per subject appears on the dashboard, each with its teacher resolved from `ClassTeacher`.
3. As each **teacher**, open the submission, save a draft, then submit.
4. Back on the admin dashboard, confirm **Publish stays disabled until every subject is submitted**, and that attempting it early names the blocking subjects.
5. **Publish.** Results generate, ranks compute, submissions lock.

---

## 4. Student — two obviously different screens

Log in as a student in that class:

- The sidebar reads **Coursework** and **Report Cards** — the words "Marks" and "My Results" are gone.
- **Coursework** shows the class marks from step 2. The aggregate is labelled **"Coursework average"** and does not read as an official percentage.
- **Report Cards** shows only the *published* exam. Create a second exam and leave it `draft` — it must not appear here.
- The year selector opens on the **most recent** year, not the oldest.
- **Download Report Card** produces the PDF as before.

---

## 5. Parent — the gap this feature closes

Log in as a parent linked to that student and open the child's detail page:

- Tabs read **Coursework** and **Report Cards**.
- **Report Cards** shows the same published result the student sees — same subjects, same percentage, same rank.
- The unpublished exam does not appear.
- **Coursework** renders marks as `85/100` — **not `85/undefined`**, which is what it showed before this feature.

---

## 6. Negative and isolation checks

Do not skip these — `cross-tenant.test.js` is the only backstop for `schoolId` scoping, as there is no Mongoose-level plugin enforcing it.

| Check | Expect |
|---|---|
| Parent requests results for a child they are **not** linked to | `403` |
| Parent in School A requests a student ID in School B | `403`, no data leaked |
| Parent requests results for a `draft` / `active` exam | `404` (identical to the student route) |
| School on the **starter** plan requests parent results **or** parent coursework | `402 FEATURE_NOT_AVAILABLE` — note coursework returning 402 is new; that route previously had no feature gate |
| Teacher opens a submission for a subject they are not assigned to | `403` (unchanged 005 behaviour) |

---

## 7. Completeness gate

```bash
# Must return nothing at all
grep -rn "examType" backend/src backend/tests frontend/src

# Must show no changes to the exam pipeline
git diff --stat -- backend/src/services/exam.service.js \
  backend/src/services/subjectSubmission.service.js \
  backend/src/services/result.service.js \
  backend/src/models/Exam.model.js \
  backend/src/models/Result.model.js \
  backend/src/models/SubjectSubmission.model.js \
  backend/tests/integration/admin.exam.lifecycle.test.js \
  backend/tests/integration/teacher.subject.submission.test.js \
  backend/tests/integration/student.published.results.test.js
```

The first command is the mechanical check for a partial rename: Mongoose does not error on an unrecognised filter key, it just matches nothing, so a missed reference turns an upsert into a duplicate insert instead of raising anything.

The second must print nothing. The 005 tests passing **unedited** is the proof the exam pipeline was not perturbed.

---

## 8. Test suites

```bash
cd backend  && npm test    # compare against the baseline captured in tasks.md T-002
cd frontend && npm test
```

Three things to know about these commands:

- 🔴 **The backend suite is flaky.** Two consecutive runs on an unchanged tree gave disjoint failure sets (run 1: `onboarding`, `auth.approval`; run 2: `admin.timetable`, `teacher.attendance`) and even different test totals. **A single red run proves nothing.** Re-run before blaming your diff. A failure counts as a real regression only if it reproduces, or if it lands in a suite this feature touches: `services.test.js`, `teacher.marks.test.js`, `student.test.js`, `parent.results.test.js`. See tasks.md T-002.
- **`npm test` exits 0 even when tests fail.** Never treat the exit code as a pass signal — read the summary counts and diff them against the baseline.
- `frontend/src/components/common/ProtectedRoute.test.jsx` OOMs its worker, so its 3 tests silently do not run. Pre-existing, unrelated to this feature.
