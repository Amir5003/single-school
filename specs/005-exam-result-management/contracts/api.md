# API Contract: Examination & Result Management Module

**Branch**: `005-exam-result-management` | **Date**: 2026-05-24

All endpoints below sit under the existing API base prefix and inherit the standard middleware chain `authenticate → schoolScope → authorize`. Responses follow the existing `ApiResponse` envelope `{ statusCode, data, message, success }`.

`schoolId` is always read from `req.school._id`. The body MUST NOT include `schoolId`; if present, it is ignored.

---

## Admin endpoints — Exam lifecycle

All require `authorize('school-admin')`.

### `POST /admin/exams/:examId/activate`
Transition exam from `draft` to `active`. Creates one `SubjectSubmission` per subject, populating `assignedTeacherId` from the matching `ClassTeacher` row.

**Body**: none.

**Responses**:
- `200 OK` with `{ exam, submissions: [...] }` — also returned if already activated (idempotent).
- `404` if exam not found.
- `409` if exam state is `published` or `locked`.

---

### `POST /admin/exams/:examId/publish`
Aggregate all SubjectSubmissions → produce per-student `Result` documents (published=true) → lock submissions → set exam state to `published`.

**Body**: none. `publishedBy` is taken from `req.user._id`.

**Responses**:
- `200 OK` with `{ exam, resultsCreated: <int> }`.
- `409` if any SubjectSubmission is not in `submitted` state (response includes `blocking: [{ subject, state }]`).
- `404` if exam not found.

---

### `POST /admin/exams/:examId/revert-to-draft`
Roll an `active` exam back to `draft`. Deletes all SubjectSubmissions. Only allowed when no submission has reached `submitted` (data-loss guard).

**Body**: none.

**Responses**:
- `200 OK` with `{ exam }`.
- `409` if any submission is `submitted` or exam is `published`.

---

### `GET /admin/exams/:examId/dashboard`
Returns completion stats + per-subject rows for the admin dashboard.

**Response data shape**:
```json
{
  "exam": { "_id":"...", "name":"...", "state":"active", "year":2026, "term":"Term 1", "classId":{...} },
  "stats": {
    "totalSubjects": 6,
    "submittedCount": 3,
    "draftCount": 1,
    "pendingCount": 2,
    "unassignedCount": 1,
    "completionPercentage": 50
  },
  "submissions": [
    {
      "_id":"...",
      "subject":"Math",
      "totalMarks": 100,
      "passMark": 35,
      "assignedTeacher": { "_id":"...", "name":"Asha" } | null,
      "state":"submitted",
      "lastSavedAt":"2026-05-24T08:31:00Z",
      "submittedAt":"2026-05-24T08:45:00Z"
    }
  ]
}
```

**Responses**:
- `200 OK`.
- `404` if exam not found.

---

### `POST /admin/exams/:examId/submissions/:submissionId/reopen`
Re-open a `submitted` SubjectSubmission for teacher editing (state moves back to `draft`).

**Body**: none.

**Responses**:
- `200 OK` with `{ submission }`.
- `409` if exam is `published` or submission is not `submitted`.
- `404` if submission not found or doesn't belong to the exam/school.

---

### `POST /admin/exams/:examId/submissions/:submissionId/reassign`
Replace the assigned teacher for a SubjectSubmission. Marks are preserved.

**Body**: `{ teacherId: "<ObjectId>" }`.

**Validation**: `teacherId` must be a MongoId. The teacher must belong to the same school.

**Responses**:
- `200 OK` with `{ submission }`.
- `404` if teacher not found in school.
- `409` if exam is `published`.

---

## Teacher endpoints — Subject submission

All require `authorize('teacher')`.

### `GET /teacher/exams`
Lists exams where the calling teacher has at least one assigned SubjectSubmission.

**Response data**:
```json
{
  "exams": [
    {
      "_id":"...",
      "name":"Mid-Term",
      "year":2026,
      "term":"Term 1",
      "state":"active",
      "classId":{...},
      "mySubmissions": [{ "_id":"...", "subject":"Math", "state":"draft" }]
    }
  ]
}
```

---

### `GET /teacher/exams/:examId/submissions`
Lists the calling teacher's submissions for a specific exam.

**Response data**: `{ submissions: [...] }` (same shape as `mySubmissions` above plus `marks` populated).

---

### `GET /teacher/submissions/:id`
Single submission with student roster for the entry grid.

**Response data**:
```json
{
  "submission": {
    "_id":"...","subject":"Math","totalMarks":100,"passMark":35,"state":"draft","marks":[{"studentId":"...","marksObtained":78}]
  },
  "exam": { "_id":"...","name":"...","year":2026,"term":"Term 1","classId":{...},"state":"active" },
  "students": [{ "_id":"...","name":"Ravi","enrollmentId":"S-001" }, ...]
}
```

**Responses**:
- `200 OK`.
- `403` if the submission is not assigned to the calling teacher.
- `404` if submission not found or wrong school.

---

### `PUT /teacher/submissions/:id/marks`
Save draft marks for the submission. Transitions state `pending|draft → draft`.

**Body**:
```json
{ "marks": [{ "studentId":"<id>", "marksObtained": 0 }, ...] }
```

**Validation**:
- Each `marksObtained` must satisfy `0 <= value <= totalMarks` for the submission's subject.
- Each `studentId` must be a MongoId.

**Responses**:
- `200 OK` with `{ submission }`.
- `400` on validation failure.
- `403` if not assigned.
- `409` if exam state is `locked` or `published`.

---

### `POST /teacher/submissions/:id/submit`
Mark the submission as `submitted`. Cannot be undone by the teacher (admin can reopen).

**Body**: none.

**Responses**:
- `200 OK` with `{ submission }`.
- `409` if the submission is already `submitted` / `locked`, or if the exam is `published`.
- `403` if not assigned.

---

## Student endpoints — Published results + Report card

All require `authorize('student')`. All filter by `published: true` on Result and `state: 'published'` on Exam (with the legacy-shim exception described in data-model.md).

### `GET /student/exams/years` (existing — modified)
Returns years that contain at least one `published` exam for the student's school.

### `GET /student/exams?year=...` (existing — modified)
Returns the student's class exams in the given year **filtered to state=published**.

### `GET /student/results?examId=...` (existing — modified)
Returns the student's result for the given exam — only if Result.published is true (and not explicitly false). 404 otherwise.

### `GET /student/results/:examId/report-card` (new)
Returns a single payload designed for client-side PDF rendering.

**Response data**:
```json
{
  "school": {
    "name":"Greenwood High",
    "logoUrl":"https://cdn.../logo.png",
    "address":"123 Main St",
    "primaryColor":"#1a73e8"
  },
  "student": {
    "_id":"...","name":"Aarav Mehta","enrollmentId":"S-001","class":"8A"
  },
  "exam": {
    "_id":"...","name":"Mid-Term","term":"Term 1","year":2026
  },
  "marks": [
    { "subject":"Math","marksObtained":78,"totalMarks":100,"passMark":35,"passed":true }
  ],
  "totals": { "obtained":78, "total":100 },
  "percentage": 78,
  "passed": true,
  "rank": 3,
  "generatedAt":"2026-05-24T10:12:00Z"
}
```

**Responses**:
- `200 OK`.
- `404` if result is not published or not found.

---

## Validators (summary)

| Endpoint | Validator |
|----------|-----------|
| `POST /admin/exams/:examId/submissions/:submissionId/reassign` | `body('teacherId').isMongoId()` |
| `PUT /teacher/submissions/:id/marks` | `body('marks').isArray({ min: 0 })`; each `marks.*.studentId.isMongoId()`; each `marks.*.marksObtained.isFloat({ min: 0 })` |

Existing validators for `createExam`, `updateExam`, and legacy `upsertResults` are unchanged.

---

## Errors

All errors use the existing `ApiError(statusCode, message)` pattern, handled by `errorHandler.js`. Common new error messages:

- `"Exam already activated"` (409)
- `"Publish blocked — N subject(s) not yet submitted"` (409)
- `"You are not assigned to this subject"` (403)
- `"Exam is locked — marks entry closed"` (409)
- `"No published result"` (404)
