# API Contract: Coursework Assessments

**Branch**: `009-coursework-assessments` | **Date**: 2026-09-02

All endpoints sit under `/api/v1` and inherit `authenticate → schoolScope → authorize(role)`. Responses use the `ApiResponse` envelope `{ statusCode, data, message, success }`. `schoolId` always comes from `req.school._id`, never the body.

Every route below is gated by `checkFeatureAccess(FEATURES.EXAMS_RESULTS)`; mutations additionally by `checkSubscriptionAccess('teacher_write')`.

**Status codes**: express-validator failures and Mongoose `ValidationError` both map to **422** (`middleware/validate.js`, `middleware/errorHandler.js:21-26`). Service-level guards throw `ApiError(422, …)` to match. 400 is not used here.

---

## Removed

| Endpoint | Replacement |
|---|---|
| `POST /teacher/marks` | `POST /teacher/assessments` + `PUT /teacher/assessments/:id/scores` |
| `GET /teacher/marks` | `GET /teacher/assessments` |
| `GET /student/marks` | `GET /student/coursework` |
| `GET /parent/children/:studentId/marks` | `GET /parent/children/:studentId/coursework` |

The flat write path is gone. Recording a mark is now two steps — create the assessment, then enter scores — which is what gives every mark a title, a date and an author.

---

## Teacher

### `POST /teacher/assessments`

Create a coursework assessment. `academicYear` is copied from the class; `createdBy` from the authenticated teacher.

```json
{
  "classId": "…",
  "subject": "Mathematics",
  "title": "Unit Test 1",
  "assessmentType": "class_test",
  "maxMarks": 20,
  "date": "2026-07-14"
}
```

- `201` with `{ assessment }`.
- `422` — missing/blank `title`, `maxMarks < 1`, invalid `date`, or an `assessmentType` outside the five permitted values. **`final` and `midterm` land here** — term exams belong to the Report Cards pipeline.
- `403` — the teacher is not assigned to that class.
- `404` — class not found in this school.

### `GET /teacher/assessments?classId=&subject=`

The teacher's own assessments, newest first, each with `scoresEntered` so they can see what still needs marking.

- `200` with `{ assessments: [ { …assessment, classId: { name, grade, section }, scoresEntered } ] }`.

### `GET /teacher/assessments/:id`

The assessment plus **the full class roster** — students with no mark yet come back with nulls, so nobody is silently missed.

```json
{
  "assessment": { "_id": "…", "title": "Unit Test 1", "maxMarks": 20, "date": "…" },
  "students": [
    { "studentId": "…", "name": "Aarav Sharma", "enrollmentId": "STU-0041",
      "marksObtained": 18, "absent": false, "remarks": "Good work" }
  ],
  "classAverage": 90
}
```

- `200`. `403` if not assigned. `404` if not found in this school.

### `PUT /teacher/assessments/:id/scores`

Bulk upsert. Every row is validated **before any is written**, so one bad mark cannot leave a class half-saved.

```json
{ "scores": [
  { "studentId": "…", "marksObtained": 18, "remarks": "Good work" },
  { "studentId": "…", "absent": true }
] }
```

- `200` with the same shape as `GET /:id`, including a recomputed `classAverage`.
- `422` — a mark below 0 or above the assessment's `maxMarks`, or remarks over 300 characters.
- `403` if not assigned.

Setting `absent: true` stores `marksObtained: null`. Re-sending updates in place — one row per student per assessment, always.

### `PUT /teacher/assessments/:id`

Edit the shared facts: `title`, `subject`, `assessmentType`, `maxMarks`, `date`. Because they live on one document, a correction applies to every student at once.

- `200` with `{ assessment }`.
- `422` — lowering `maxMarks` below a score already recorded against it.
- `403` if not assigned.

### `DELETE /teacher/assessments/:id`

Soft-deletes the assessment and hard-deletes its scores, so no orphan rows remain in students' views.

- `204`. `403` if not assigned.

---

## Student

### `GET /student/coursework?academicYear=`

Grouped by subject, newest first within each group.

```json
{
  "subjects": [
    {
      "subject": "Mathematics",
      "average": 88.33,
      "count": 3,
      "entries": [
        {
          "_id": "…", "assessmentId": "…",
          "title": "Unit Test 1", "assessmentType": "class_test",
          "date": "2026-07-14T00:00:00.000Z", "academicYear": "2026-27",
          "teacherName": "Mr Ahmed",
          "marksObtained": 18, "maxMarks": 20,
          "absent": false, "remarks": "Good work",
          "percentage": 90, "classAverage": 82.5
        }
      ]
    }
  ],
  "overallPercentage": 84.2,
  "totalCount": 7
}
```

- `200`. `403` for a non-student role. `402` if the plan lacks `exams_results`.

`percentage` and `classAverage` are `null` for an absent entry, and absences are excluded from `average` and `overallPercentage`. `average` is `null` — not `0` — when a subject has no counted entries, so the UI can omit it rather than show a misleading zero.

---

## Parent

### `GET /parent/children/:studentId/coursework`

Identical payload to the student route, behind `requireLink`. It delegates to the same service, so the two views cannot drift.

- `200`. `403` if unlinked or cross-tenant. `402` if the plan lacks `exams_results`.

---

## Unchanged

The Report Cards pipeline is untouched: `GET|POST /admin/exams`, `…/activate`, `…/publish`, `…/dashboard`, `…/submissions/:id/reopen|reassign`, all `GET|PUT /teacher/submissions/:id/*`, `GET /student/exams|results|results/:examId/report-card`, and the parent report-card routes added in 008.
