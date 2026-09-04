# API Contract: Coursework & Report Cards

**Branch**: `008-coursework-report-cards` | **Date**: 2026-08-30

All endpoints sit under the `/api/v1` base prefix and inherit the standard chain `authenticate → schoolScope → authorize(role)`. Responses use the existing `ApiResponse` envelope `{ statusCode, data, message, success }`.

`schoolId` is always read from `req.school._id`. The body MUST NOT include `schoolId`; if present it is ignored.

This feature changes **one** request field and adds **four** parent endpoints. Everything else in the assessment domain is unchanged.

---

## Changed — Teacher coursework

### `POST /teacher/marks` — **BREAKING request-field change**

Middleware unchanged: `authorize('teacher')` → `checkSubscriptionAccess('teacher_write')` → `checkFeatureAccess(FEATURES.EXAMS_RESULTS)`.

**Body — before**:
```json
{
  "studentId": "...",
  "classId": "...",
  "subject": "Mathematics",
  "examType": "final",
  "marksObtained": 82,
  "maxMarks": 100
}
```

**Body — after**:
```json
{
  "studentId": "...",
  "classId": "...",
  "subject": "Mathematics",
  "assessmentType": "class_test",
  "marksObtained": 82,
  "maxMarks": 100
}
```

| Field | Change |
|---|---|
| `examType` | **Removed.** No longer read. Sending it has no effect and the value is discarded. |
| `assessmentType` | **New.** Optional, defaults to `class_test`. One of `class_test`, `quiz`, `assignment`, `project`, `practical`. |
| `marksObtained` | Ceiling is now `maxMarks` instead of a fixed 100. |

**Responses**:
- `200 OK` with `{ mark }` — the upserted document.
- `422` if `assessmentType` is outside the permitted enum. **`"final"` and `"midterm"` now fall here** — this is the governance fix (FR-003).
- `422` if `marksObtained > maxMarks`, or `marksObtained < 0`.
- `403` if the teacher is not assigned to the class.
- `402` if the plan lacks `exams_results`, or on a subscription write block.

> **Status-code convention — do not use 400 here.** `backend/src/middleware/errorHandler.js:21-26` maps any Mongoose `ValidationError` (enum, min, max, required) to **422** with `{ success: false, errors: [{ field, msg }] }`, and `middleware/validate.js` returns 422 for express-validator failures. The existing suite asserts this: `teacher.marks.test.js:165` expects 422 for an over-ceiling mark. The service-layer guard added by T-B2 must therefore throw `ApiError(422, ...)`, not `ApiError(400, ...)`, so both the schema path and the service path return the same status.
>
> Note the two paths return different **body shapes** — the `ApiError` path uses the `ApiResponse` envelope, the Mongoose path returns `{ success, errors }`. Both carry `success: false` and the same status, which is all the existing tests assert.

> **Client impact**: `frontend/src/api/teacher.api.js` and `frontend/src/pages/teacher/MarksPage.jsx` are the only callers. There are no external API consumers.

---

### `GET /teacher/marks?classId=&subject=`

Unchanged in path, parameters and guards. Each returned record now carries `assessmentType` in place of `examType`.

---

## Changed — Student coursework

### `GET /student/marks`

Unchanged in path and guards. Response shape is unchanged:

```json
{ "marks": [ { "subject": "Math", "assessmentType": "quiz", "marksObtained": 18, "maxMarks": 20 } ],
  "overallPercentage": 82.5 }
```

Only the per-record field name changes. `overallPercentage` is **retained** so the response contract does not break; it is relabelled "Coursework average" in the UI (FR-010) and its computation is unchanged.

---

## New — Parent report-card access

Four endpoints. All require `authorize('parent')`, all call the existing `requireLink(parentId, studentId, schoolId)` guard before returning anything, and all are wrapped in `checkFeatureAccess(FEATURES.EXAMS_RESULTS)`.

These are **thin delegations** — no new query logic. Each mirrors the corresponding student route, which is what guarantees publication gating cannot drift between the two audiences (FR-014).

| New parent endpoint | Delegates to | Student equivalent |
|---|---|---|
| `GET /parent/children/:studentId/exam-years` | `examService.getDistinctYears(schoolId)` | `GET /student/exams/years` |
| `GET /parent/children/:studentId/exams?year=` | `examService.getExamsForStudent(schoolId, studentId, year)` | `GET /student/exams` |
| `GET /parent/children/:studentId/results?examId=` | `resultService.getStudentResult(schoolId, studentId, examId)` | `GET /student/results` |
| `GET /parent/children/:studentId/results/:examId/report-card` | `examService.buildReportCardPayload(schoolId, studentId, examId)` | `GET /student/results/:examId/report-card` |

All four target services already take `(schoolId, studentId, ...)` as their leading arguments, so they compose directly behind `requireLink` with no adaptation.

---

### `GET /parent/children/:studentId/exam-years`

Distinct years having at least one **published** exam.

**Responses**:
- `200 OK` with `{ years: [2026, 2025] }` — descending.
- `403` if the parent is not linked to this student, or the student belongs to another school.
- `402` if the plan lacks `exams_results`.

---

### `GET /parent/children/:studentId/exams?year=<int>`

Published exams for the child's class, optionally filtered by year. Draft, active and locked exams are never returned.

**Responses**:
- `200 OK` with `{ exams: [ { _id, name, year, term, state: "published", ... } ] }`.
- `403` if not linked or cross-tenant.

---

### `GET /parent/children/:studentId/results?examId=<id>`

The child's result for one published exam, with per-subject pass/fail attached — byte-identical in shape to the student response.

**Responses**:
- `200 OK` with `{ ...result, marks: [ { subject, marksObtained, totalMarks, passed } ], exam }`.
- `404` if the exam is not published, or the child has no result for it. Identical gating to the student route (FR-014).
- `403` if not linked or cross-tenant.

---

### `GET /parent/children/:studentId/results/:examId/report-card`

The report-card payload — school branding, student details, per-subject marks, totals, percentage, rank, pass/fail — for client-side PDF generation.

**Responses**:
- `200 OK` with the same payload the student route returns.
- `404` if the exam is not published.
- `403` if not linked or cross-tenant.

---

## Changed — Parent coursework

### `GET /parent/children/:studentId/marks`

Path, guards and response shape are unchanged except that each record carries `assessmentType` instead of `examType`.

**One middleware addition**: this route gains `checkFeatureAccess(FEATURES.EXAMS_RESULTS)`. It is currently the **only** marks endpoint in the application without that gate — every admin, teacher and student equivalent already has it (FR-015).

**New response**:
- `402 FEATURE_NOT_AVAILABLE` when the school's plan excludes `exams_results` (i.e. the `starter` tier). Previously this route returned `200` on a starter plan, which was a gating leak.

---

## Unchanged — stated explicitly

None of the following is touched by this feature. Listed so review can confirm the blast radius, per FR-017 and FR-018:

**Admin exam lifecycle** — `GET|POST /admin/exams`, `GET|PUT|DELETE /admin/exams/:examId`, `POST /admin/exams/:examId/activate`, `.../publish`, `.../revert-to-draft`, `GET .../dashboard`, `POST .../submissions/:submissionId/reopen`, `.../reassign`.

**Admin legacy direct entry** — `GET|PUT /admin/exams/:examId/results`. Left as-is by ratified decision, including its known defect of writing `published: true` without consulting `exam.state`.

**Teacher exam submissions** — `GET /teacher/exams`, `GET /teacher/exams/:examId/submissions`, `GET /teacher/submissions/:id`, `PUT /teacher/submissions/:id/marks`, `POST /teacher/submissions/:id/submit`.

**Student results** — `GET /student/exams/years`, `GET /student/exams`, `GET /student/results`, `GET /student/results/:examId/report-card`.
