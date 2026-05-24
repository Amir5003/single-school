# Implementation Plan: Examination & Result Management Module

**Branch**: `005-exam-result-management` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-exam-result-management/spec.md`

---

## Summary

Layer a controlled state machine and per-subject submission workflow on top of the existing 004 Exam/Result scaffolding. Add `Exam.state` (draft/active/locked/published), a new `SubjectSubmission` collection (one per exam-subject) with `state` (pending/draft/submitted/locked) and embedded marks, and a `Result.published` flag so students only see results after admin publish. Teachers are restricted to subjects they own via `ClassTeacher`; admins get a completion dashboard that gates the Publish button; students download a runtime PDF report card via `jspdf` + `jspdf-autotable`.

All backend work reuses the established `authenticate → schoolScope → authorize` middleware chain. New collections carry `schoolId` with compound indexes. Existing 259 backend tests must continue passing — legacy direct-upsert endpoint (`PUT /admin/exams/:examId/results`) is kept for backward compatibility.

---

## Technical Context

**Language/Version**: Node.js 20 LTS (backend); React 19 + Vite 8 (frontend)
**Primary Dependencies**:
- Backend: Express 5.x, Mongoose 9.x, jsonwebtoken 9.x, express-validator 7.x, nodemailer 8.x (existing — no new backend deps required for this feature)
- Frontend: React Router 7, Redux Toolkit 2.x, Axios 1.x, Tailwind CSS 3.x, Framer Motion 12.x, **`jspdf` (NEW)**, **`jspdf-autotable` (NEW)**

**Storage**: MongoDB Atlas. New collection: `subjectsubmissions`. Modified collections: `exams` (+state, +publishedAt, +publishedBy), `results` (+published).
**Testing**: Jest 29 + Supertest 7 (backend); Vitest 1 + React Testing Library 16 (frontend).
**Target Platform**: Web (Render backend, Vercel frontend).
**Performance Goals**: Dashboard endpoint < 500 ms p95; publish action < 1500 ms p95 for a class of 50 students × 8 subjects.
**Constraints**: `schoolId` always from `req.school._id`; no body-supplied schoolId; per-submission teacher gating enforced server-side; no breaking change to existing 004 endpoints; PDF generated at runtime in browser (no server-side rendering).
**Scale/Scope**: Same as existing — ~30 classes × 50 students per school. A typical activation creates 8 SubjectSubmissions; a typical publish creates 50 Result documents.

---

## Constitution Check

| Principle | Addressed? | Notes |
|-----------|-----------|-------|
| I. Code Quality | ✅ PASS | New service (`subjectSubmission.service.js`) follows controller → service → model layering. Exam state transitions encapsulated in `exam.service` (activate, publish, revertToDraft). No controller imports models directly. |
| II. Testing Standards | ✅ PASS | New integration tests: `admin.exam.lifecycle.test.js` (activate + publish gating), `teacher.subject.submission.test.js` (role + state enforcement), `student.published.results.test.js` (gated visibility). Cross-tenant assertions in each file. |
| III. UX Consistency | ✅ PASS | All new pages use existing `Layout` wrapper + `EmptyState`. Animations use `fadeInUp` / `staggerContainer`. PDF download is a single primary-coloured button on the result page. |
| IV. Performance | ✅ PASS | SubjectSubmission queries use compound index `(schoolId, examId)`. Dashboard endpoint is one aggregate query. Publish uses bulkWrite for Result upsert. |
| V. Security | ✅ PASS | Per-submission teacher gating enforced in the service layer (not just the route). Admins cannot publish until all subjects are submitted (enforced server-side, not just UI). `schoolId` always from JWT. Marks validated server-side (no `marksObtained > totalMarks`). |
| VI. Scalability | ✅ PASS | New model carries `schoolId` with compound indexes. State machine prevents invalid transitions. Idempotent activation (re-activate is a no-op or rejected). |
| VII. UI Animation | ✅ PASS | New admin dashboard, teacher submission page, student PDF download all use Framer Motion `motion.div` with `fadeInUp` / `staggerContainer`. `prefers-reduced-motion` respected via existing hook. |
| VIII. Multi-Tenancy | ✅ PASS | `SubjectSubmission.schoolId` is required. All endpoints filter by `req.school._id`. Cross-tenant tests in every new test file. |

**Multi-Tenancy Gate**:
- [x] `schoolId` added to `SubjectSubmission`
- [x] `schoolScope` middleware applied to all new authenticated routes
- [x] Cross-tenant isolation assertions in integration tests
- [x] Teacher per-submission ownership check enforced server-side

**Constitution Check Result: ALL GATES PASS — proceed to implementation phases**

---

## Project Structure

### Documentation (this feature)

```text
specs/005-exam-result-management/
├── plan.md              ← this file
├── spec.md              ← feature specification
├── tasks.md             ← executable task breakdown
├── data-model.md        ← schema definitions
├── quickstart.md        ← end-to-end manual test path
├── contracts/
│   └── api.md           ← API contract
└── checklists/
    └── (already exists, empty for now)
```

### Source Code — New Files

```text
backend/
└── src/
    ├── models/
    │   └── SubjectSubmission.model.js          ← NEW
    ├── services/
    │   └── subjectSubmission.service.js        ← NEW
    ├── controllers/
    │   ├── admin/
    │   │   └── examLifecycle.controller.js     ← NEW (activate/publish/reopen/reassign/dashboard)
    │   └── teacher/
    │       └── subjectSubmission.controller.js ← NEW (list/get/save-draft/submit)
    └── validators/
        └── subjectSubmission.validator.js      ← NEW

frontend/
└── src/
    ├── api/
    │   └── subjectSubmission.api.js            ← NEW
    ├── pages/
    │   ├── admin/
    │   │   └── ExamDashboardPage.jsx           ← NEW (per-exam admin dashboard)
    │   └── teacher/
    │       ├── MyExamsPage.jsx                 ← NEW (list assigned exams)
    │       └── SubmissionEntryPage.jsx         ← NEW (marks entry + draft/submit)
    └── utils/
        └── reportCardPdf.js                    ← NEW (jsPDF rendering)
```

### Source Code — Modified Files

```text
backend/src/
├── models/Exam.model.js                        ← Add state, publishedAt, publishedBy
├── models/Result.model.js                      ← Add published flag (default false)
├── services/exam.service.js                    ← activateExam, publishExam, getDashboard, revertToDraft
├── services/result.service.js                  ← Filter by published for student endpoints; build from SubjectSubmissions on publish
├── routes/admin.routes.js                      ← Wire new lifecycle endpoints
├── routes/teacher.routes.js                    ← Wire SubjectSubmission endpoints
└── routes/student.routes.js                    ← Filter exams/results by published

frontend/src/
├── api/exam.api.js                             ← Add activate/publish/reopen/reassign/dashboard
├── api/result.api.js                           ← Add getReportCardPayload
├── pages/admin/ExamsPage.jsx                   ← Add state badge + link to ExamDashboardPage
├── pages/admin/ResultEntryPage.jsx             ← Add deprecation notice (legacy flow)
├── pages/student/ResultsPage.jsx               ← Add "Download Report Card" button
├── App.jsx                                     ← Routes for ExamDashboardPage, MyExamsPage, SubmissionEntryPage
├── components/common/Sidebar.jsx              ← Add "My Exams" nav item for teacher role
└── components/common/Layout.jsx                ← (no change expected; verify nav)
```

---

## Implementation Phases

### Phase A — Backend Schema Updates

**Sequence**: Must complete before all other backend phases.

#### A1. Extend `Exam.model.js`
- Add `state: { type: String, enum: ['draft','active','locked','published'], default: 'draft' }`
- Add `publishedBy: { type: ObjectId, ref: 'User', default: null }`
- Existing `publishedAt` already exists, no change.
- Existing documents default to `draft` on read (Mongoose returns undefined for absent fields → coerce in service to `draft`). New writes default to `draft`.
- **Backward-compat note**: legacy direct-upsert `PUT /admin/exams/:examId/results` continues to work for exams in `draft` or `active` state; it bypasses the SubjectSubmission flow but does NOT auto-publish.

#### A2. Extend `Result.model.js`
- Add `published: { type: Boolean, default: false }`
- Add compound index `(schoolId, studentId, published)` for student queries.
- Legacy results written via `PUT /admin/exams/:examId/results` default to `published: false` — admin must use the new publish flow (or pass `?legacyPublish=true` query param on the legacy endpoint, kept undocumented for migration only).
- **Migration shim**: the legacy upsertResults service will set `published: true` to preserve current behaviour (so existing 004 tests pass unchanged).

#### A3. Create `SubjectSubmission.model.js`
- Fields per data-model.md Section 2.
- Unique compound index `(schoolId, examId, subject)`.
- Compound index `(schoolId, examId)` for dashboard queries.
- Compound index `(schoolId, assignedTeacherId)` for teacher list query.

---

### Phase B — Backend Service Layer

**Depends on**: Phase A

#### B1. Create `subjectSubmission.service.js`
- `listForTeacher(schoolId, teacherId, filters)` — exams + submissions assigned to the teacher.
- `getForTeacher(schoolId, submissionId, teacherId)` — single submission with `students[]` roster.
- `saveDraft(schoolId, submissionId, teacherId, marks)` — validates assignment, validates marks ≤ totalMarks, sets state to `draft`, updates `marks` + `lastSavedAt`.
- `submit(schoolId, submissionId, teacherId)` — validates state = `draft` or `pending` with marks present, transitions to `submitted`, stamps `submittedAt`, `submittedBy`.
- `reopenForEdit(schoolId, submissionId)` — admin-only, transitions `submitted → draft` (rejects if exam published).
- `reassignTeacher(schoolId, submissionId, newTeacherId)` — admin-only, updates `assignedTeacherId` without touching marks.
- `getDashboard(schoolId, examId)` — returns counts + per-subject rows for the admin dashboard.

#### B2. Update `exam.service.js`
- Add `activateExam(schoolId, examId)`:
  - Verify exam state = `draft`. Set state = `active`.
  - For each subject in `exam.subjects`, resolve `ClassTeacher` by `(schoolId, classId, subject)`.
  - Create one `SubjectSubmission` per subject with `assignedTeacherId` (or null if no match) and `state = pending`.
  - Idempotent guard: if SubjectSubmissions already exist for this exam, return them without re-creating.
- Add `publishExam(schoolId, examId, publishedByUserId)`:
  - Verify exam state = `active` and every SubjectSubmission has `state = submitted`. Throw 409 otherwise.
  - Aggregate marks across all SubjectSubmissions for this exam.
  - For each student in the class, upsert a `Result` document with `marks[]`, `overallPercentage`, `published: true`.
  - Set every SubjectSubmission to `state = locked`.
  - Set exam state = `published`, stamp `publishedAt = now`, `publishedBy = user`.
  - Recompute ranks (existing helper).
- Add `revertToDraft(schoolId, examId)`:
  - Only when state = `active` and no SubjectSubmissions are `submitted` (otherwise admin must explicitly reopen each).
  - Deletes SubjectSubmissions and sets state back to `draft`. (Use cautiously — destructive.)

#### B3. Update `result.service.js`
- `getStudentResult(schoolId, studentId, examId)` — additionally filter `published: true`. If exam isn't published, return 404 with message "no published result".
- `getExamsForStudent(...)` in `exam.service` — additionally filter exams by `state: 'published'`.
- `getDistinctYears(...)` — additionally filter by `state: 'published'`.
- `upsertResults` (legacy) — set `published: true` to preserve 004 behaviour.

#### B4. Add `buildReportCardPayload(schoolId, studentId, examId)`
- Returns `{ school, student, exam, marks, totals, percentage, passed }` — everything needed for client-side PDF rendering, in a single round-trip.

---

### Phase C — Backend Controllers + Routes + Validators

**Depends on**: Phase B

#### C1. Create `controllers/admin/examLifecycle.controller.js`
- Handlers: `activate`, `publish`, `revertToDraft`, `dashboard`, `reopenSubmission`, `reassignSubmission`.
- Standard pattern: receive validated `req`, call service with `req.school._id` and `req.user._id` where needed, return `ApiResponse`.

#### C2. Create `controllers/teacher/subjectSubmission.controller.js`
- Handlers: `listMyExams`, `getMySubmissions`, `getOne`, `saveDraft`, `submit`.
- Each handler resolves the teacher's `Teacher._id` from `req.user._id` via `teacher.service.getTeacherByUserId`, then calls the service.

#### C3. Create `validators/subjectSubmission.validator.js`
- `saveDraftValidator`: `body('marks').isArray()`, `body('marks.*.studentId').isMongoId()`, `body('marks.*.marksObtained').isFloat({ min: 0 })`.
- `reassignValidator`: `body('teacherId').isMongoId()`.

#### C4. Wire routes
- `admin.routes.js`:
  - `POST /admin/exams/:examId/activate` → `examLifecycle.activate`
  - `POST /admin/exams/:examId/publish` → `examLifecycle.publish`
  - `POST /admin/exams/:examId/revert-to-draft` → `examLifecycle.revertToDraft`
  - `GET /admin/exams/:examId/dashboard` → `examLifecycle.dashboard`
  - `POST /admin/exams/:examId/submissions/:submissionId/reopen` → `examLifecycle.reopenSubmission`
  - `POST /admin/exams/:examId/submissions/:submissionId/reassign` → `examLifecycle.reassignSubmission`
- `teacher.routes.js`:
  - `GET /teacher/exams` → `subjectSubmission.listMyExams`
  - `GET /teacher/exams/:examId/submissions` → `subjectSubmission.getMySubmissions`
  - `GET /teacher/submissions/:id` → `subjectSubmission.getOne`
  - `PUT /teacher/submissions/:id/marks` → `subjectSubmission.saveDraft`
  - `POST /teacher/submissions/:id/submit` → `subjectSubmission.submit`
- `student.routes.js`:
  - `GET /student/results/:examId/report-card` → returns the buildReportCardPayload output.

---

### Phase D — Backend Integration Tests

**Depends on**: Phase C

#### D1. `tests/integration/admin.exam.lifecycle.test.js`
- Activate creates SubjectSubmissions matching ClassTeacher assignments.
- Activate is idempotent (re-call returns existing).
- Publish blocked while any subject is not submitted (409).
- Publish succeeds when all submitted → Result documents created with published=true, exam state=published.
- Reopen submission moves submitted→draft.
- Reopen blocked after publish (409).
- Cross-tenant: School A admin cannot activate or publish School B exams (403/404).

#### D2. `tests/integration/teacher.subject.submission.test.js`
- Teacher sees only their own assigned submissions.
- Save draft transitions pending→draft and persists marks.
- Submit transitions draft→submitted.
- Teacher cannot edit a different teacher's submission (403).
- Teacher cannot edit a locked submission (409).
- Mark > totalMarks rejected (400).
- Cross-tenant: Teacher in School A cannot access School B submissions (403/404).

#### D3. `tests/integration/student.published.results.test.js`
- Student gets 404 for unpublished exam result.
- Student gets full result for published exam.
- Years dropdown only returns years with at least one published exam.
- Report-card endpoint returns school + student + marks payload.
- Cross-tenant: Student in School A cannot read School B result.

---

### Phase E — Frontend: API clients

**Depends on**: Phase C (backend endpoints exist)

#### E1. Update `api/exam.api.js`
- Add `activateExam(examId)`, `publishExam(examId)`, `revertExamToDraft(examId)`, `getExamDashboard(examId)`, `reopenSubmission(examId, submissionId)`, `reassignSubmission(examId, submissionId, teacherId)`.

#### E2. Create `api/subjectSubmission.api.js`
- `getMyExams()`, `getMySubmissions(examId)`, `getSubmission(id)`, `saveSubmissionDraft(id, marks)`, `submitSubmission(id)`.

#### E3. Update `api/result.api.js`
- `getReportCardPayload(examId)` → `GET /student/results/:examId/report-card`.

---

### Phase F — Frontend: Admin UI

**Depends on**: Phase E

#### F1. Create `pages/admin/ExamDashboardPage.jsx`
- Route: `/schools/:slug/admin/exams/:examId/dashboard`.
- Loads `getExamDashboard(examId)` on mount.
- Header: exam name, year, term, class, state badge (colour-coded by state).
- KPI strip: total subjects, submitted, draft, pending, completion %.
- Per-subject table: subject | teacher (or "Unassigned") | state badge | last updated | actions (Reopen if submitted; Reassign anytime).
- "Publish Results" button: enabled only when completion = 100 %. Disabled state with tooltip listing the blocking subjects.
- "Activate Exam" button: only visible when state=draft.
- All cards animated with `fadeInUp` + `staggerContainer`.

#### F2. Update `pages/admin/ExamsPage.jsx`
- Add state badge to each exam row.
- Replace "Enter Results" link with "Open Dashboard" pointing to ExamDashboardPage.
- Keep "Enter Results" (legacy) as a secondary link only when state=draft or state=active (for v1 backward compat).
- Add an "Activate" inline button on draft exams that calls the lifecycle endpoint directly (also available from the dashboard).

---

### Phase G — Frontend: Teacher UI

**Depends on**: Phase E

#### G1. Create `pages/teacher/MyExamsPage.jsx`
- Route: `/schools/:slug/teacher/my-exams`.
- Lists exams with submissions assigned to the teacher.
- Per-exam row: exam name, year, term, class, list of assigned subjects with state badges, "Open" button → `/schools/:slug/teacher/submissions/:submissionId`.

#### G2. Create `pages/teacher/SubmissionEntryPage.jsx`
- Route: `/schools/:slug/teacher/submissions/:submissionId`.
- Loads submission + roster.
- Renders one row per student with a number input (max = subject.totalMarks).
- Two buttons: "Save Draft" (any time), "Submit" (disabled until at least one mark entered).
- After submit: page becomes read-only with a "Locked" banner ("Awaiting admin re-open").
- Validation: inline red border for any input > totalMarks.
- Banner: "Exam is locked" if the submission state is `locked`.

#### G3. Add "My Exams" nav item to teacher sidebar.

---

### Phase H — Frontend: Student PDF + Gating

**Depends on**: Phase E

#### H1. `npm install jspdf jspdf-autotable` in `/frontend`.

#### H2. Create `utils/reportCardPdf.js`
- Exports `generateReportCard(payload)` that builds and saves a PDF using jsPDF + autotable.
- Layout:
  - Header: school logo (left) + school name (centre, large) + school address (smaller). Logo loaded as data-URL — handle CORS errors gracefully.
  - Sub-header: "Report Card".
  - Student details: Name, Enrollment ID, Class.
  - Exam meta: Name, Term, Year.
  - Table: Subject | Marks Obtained | Total Marks | Pass Mark | Status (Pass/Fail).
  - Totals row: Total Obtained / Total Max | Percentage | Overall Result.
  - Footer: Generated on <date>.
- Returns the jsPDF document so the caller can `.save('report-card-<student>-<exam>.pdf')`.

#### H3. Update `pages/student/ResultsPage.jsx`
- Add a "Download Report Card" button next to the summary banner.
- On click: fetch `getReportCardPayload(activeExam._id)` → call `generateReportCard(payload).save(...)`.
- Disabled until the result is loaded.
- Show toast on failure.

#### H4. Update `App.jsx` routes
- Admin: `exams/:examId/dashboard` → ExamDashboardPage.
- Teacher: `my-exams` → MyExamsPage; `submissions/:submissionId` → SubmissionEntryPage.

---

### Phase I — Smoke Validation

- Run `npm test` in `/backend` — all existing 259 tests + new tests pass.
- Run `npm run build` in `/frontend` — build succeeds.
- Manual flow: create exam → activate → teacher saves draft → teacher submits → admin sees 100% → admin publishes → student sees result → student downloads PDF.

---

## Phase Sequencing and Dependencies

```
Phase A (schemas) ── Phase B (services) ── Phase C (controllers/routes) ── Phase D (tests)
                                                                          │
Phase E (frontend api) ───────────────────────────────────────────────────┤
                                                                          │
Phase F (admin UI) ───┐                                                   │
Phase G (teacher UI) ─┤── all parallel, depend on E ──── Phase I (smoke) ─┘
Phase H (student PDF)─┘
```

Recommended execution order for a single agent:
1. A → B → C (backend complete and runnable)
2. D (verify backend with tests)
3. E (frontend API surface)
4. F, G, H (UI work, can be done sequentially or interleaved)
5. I (smoke test)

---

## Complexity Tracking

No constitution violations requiring justification. The new `SubjectSubmission` model is justified because per-(exam, subject) state cannot be expressed cleanly on the existing `Result` model (Result is per-student aggregate). State machine logic is centralised in `exam.service` + `subjectSubmission.service` — no scattered if-chains in controllers.

---

## Post-Design Constitution Re-check

After designing all schemas and contracts:

- **Multi-tenancy gate**: `SubjectSubmission.schoolId` required. All service functions take `schoolId` as first arg. Controllers always read `req.school._id`. ✅
- **Cross-tenant tests**: Explicitly planned in Phase D1, D2, D3. ✅
- **Per-submission ownership**: Teacher gating is in the service layer (`assignedTeacherId.equals(teacherId)`), not just at the route level. ✅
- **Publish gate**: Server-side aggregate check prevents publish unless all submissions are `submitted` — UI button state mirrors the API. ✅
- **Result gating**: `Result.published` defaulted to false; student queries always filter on it. Legacy upsert path sets `published: true` to preserve 004 behaviour. ✅
- **Animation compliance**: All new pages use `motion.div` with `fadeInUp` / `staggerContainer`. `prefers-reduced-motion` respected via existing hook. ✅
- **No new backend deps**: Only frontend gets `jspdf` + `jspdf-autotable`. ✅

**Re-check result: ALL GATES PASS**
