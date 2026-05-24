# Feature Specification: Examination & Result Management Module

**Feature Branch**: `005-exam-result-management`
**Created**: 2026-05-24
**Status**: Draft

## Overview

This feature builds a production-grade Examination & Result Management module on top of the existing 004 exam scaffolding. It introduces a controlled state machine for exams and per-subject submissions, restricts teachers to only the subjects they are assigned to, gives admins a live completion dashboard, gates result publication on every subject being submitted, and lets students download a dynamically generated PDF report card after results are published.

All work follows the same multi-tenant pattern as the rest of the platform: every record carries `schoolId`, every authenticated route runs `authenticate → schoolScope → authorize`, and `schoolId` is always read from `req.school._id` — never the body.

---

## User Scenarios & Testing

### User Story 1 — Admin Creates an Exam in Draft, Activates It, and Assignments Materialise (Priority: P1)

A school admin creates an exam for a specific class with a list of subjects (max marks + pass marks). The exam starts in `draft`. The admin reviews it, then clicks "Activate". The system creates a `SubjectSubmission` record for each subject, derived from the existing `ClassTeacher` assignments — so the right teacher already owns the right subject. Subjects without an assigned teacher are flagged as "unassigned" but still created.

**Why this priority**: Without the exam → submission materialisation, teachers have nothing to enter marks against. This is the entry point of the entire workflow.

**Independent Test**: An admin creates an exam with three subjects (Math, English, Science) for Class 8A. After activation, three SubjectSubmission rows exist, each linked to the teacher assigned to that subject in Class 8A — verifiable in the admin dashboard.

**Acceptance Scenarios**:

1. **Given** the admin is on the Exams page, **When** they create an exam with name, year, term, class, and subject list, **Then** the exam is saved with `state = draft` and no SubjectSubmissions exist yet.
2. **Given** a draft exam exists, **When** the admin clicks "Activate", **Then** the system creates one `SubjectSubmission` per subject with `state = pending`, exam `state = active`, and the `assignedTeacherId` is resolved from the matching `ClassTeacher` record (subject + class).
3. **Given** a subject has no matching `ClassTeacher` record, **When** activation runs, **Then** the SubjectSubmission is still created with `assignedTeacherId = null`, surfaced in the dashboard as "Unassigned" so the admin can fix it.
4. **Given** an exam is already `active`, `locked`, or `published`, **When** the admin tries to activate again, **Then** the request fails with a 409 "exam already activated" error.
5. **Given** an active exam has at least one SubjectSubmission with `state != pending`, **When** the admin tries to edit subjects on the exam, **Then** the request fails with a 409 "cannot modify subjects once marks entry has begun" error.

---

### User Story 2 — Teacher Enters Marks for Assigned Subjects Only, with Draft + Submit Workflow (Priority: P1)

A teacher logs in and sees a list of exams that include at least one subject they are assigned to. For each such subject they can open a marks-entry grid (one row per student), save it as a draft, and later submit it. After submitting, the row is locked from the teacher's edit — but the admin can request a re-open. The teacher cannot see or edit subjects they are not assigned to, even by guessing the SubjectSubmission ID.

**Why this priority**: Without correct per-subject role gating, the whole "teachers don't publish, teachers don't edit other subjects" guarantee from the requirements collapses. This is the security spine of the feature.

**Independent Test**: Teacher A is assigned to teach Math in Class 8A. Teacher B teaches English in the same class. After exam activation, Teacher A sees only the Math submission, Teacher B sees only English. A direct `PUT /teacher/submissions/<englishId>/marks` from Teacher A returns 403.

**Acceptance Scenarios**:

1. **Given** an active exam has SubjectSubmissions, **When** a teacher requests `GET /teacher/exams`, **Then** they only see exams that have at least one subject submission where `assignedTeacherId == self`.
2. **Given** a teacher opens their assigned SubjectSubmission, **When** the page loads, **Then** they see one input field per student in the class with the subject's `totalMarks` as the max.
3. **Given** a teacher edits values and clicks "Save draft", **When** the request is accepted, **Then** the submission state moves to `draft`, the marks array is persisted, and the response returns the updated submission.
4. **Given** a teacher clicks "Submit", **When** the request succeeds, **Then** the state moves to `submitted`, `submittedAt` and `submittedBy` are recorded, and future `PUT /marks` on this submission returns 409 from the teacher (admin override allowed).
5. **Given** a teacher attempts to enter marks for a SubjectSubmission they are not assigned to, **When** the request is made, **Then** the system returns 403 "you are not assigned to this subject".
6. **Given** a teacher enters a `marksObtained` value greater than the subject's `totalMarks`, **When** they try to save, **Then** validation rejects the entry with a clear error.
7. **Given** the exam is `locked` or `published`, **When** the teacher tries to save or submit, **Then** the system returns 409 "exam is locked, marks entry closed".

---

### User Story 3 — Admin Dashboard Shows Live Completion Status and Publish Gating (Priority: P1)

An admin opens an active exam's detail page and sees, for each subject: assigned teacher, current state (pending/draft/submitted), and last update time. A summary header shows total subjects, count submitted, count drafted, count pending, and an overall completion percentage. The "Publish Results" button is disabled until every subject is `submitted`.

**Why this priority**: The admin needs to know what is blocking publication. Without this view, the workflow is opaque and the admin has no signal on when to publish.

**Independent Test**: After activation, the dashboard shows 0% complete. After one teacher submits, the dashboard moves to (1 / total) % complete. When all subjects are submitted, the Publish button becomes enabled and the publish action succeeds.

**Acceptance Scenarios**:

1. **Given** an active exam exists, **When** the admin opens `GET /admin/exams/:examId/dashboard`, **Then** the response contains: `totalSubjects`, `submittedCount`, `draftCount`, `pendingCount`, `completionPercentage`, and `submissions[]` with per-subject details.
2. **Given** at least one subject is not in `submitted` state, **When** the admin sends `POST /admin/exams/:examId/publish`, **Then** the request returns 409 "publish blocked — N subject(s) not yet submitted" and exam state is unchanged.
3. **Given** every subject is `submitted`, **When** the admin clicks Publish, **Then** the system: sets exam `state = published`, sets `publishedAt`, locks every SubjectSubmission (`state = locked`), generates one `Result` document per student with `published = true`, and returns 200.
4. **Given** the admin needs to allow a teacher to re-edit a submitted subject before publishing, **When** the admin sends `POST /admin/exams/:examId/submissions/:submissionId/reopen`, **Then** the submission goes back to `draft` and the teacher can edit again.
5. **Given** an exam is `published`, **When** the admin tries to reopen any submission, **Then** the system returns 409 "exam already published".

---

### User Story 4 — Student Views Published Results Only and Downloads a PDF Report Card (Priority: P1)

A student logs in to their results page. They see published exams only — drafts/active/locked are invisible. For a published exam, they see per-subject marks, totals, overall percentage, and pass/fail. They click "Download Report Card" and a PDF is generated on the fly containing the school's branding, their personal details, the per-subject marks table, totals, percentage, and pass/fail status. The PDF is generated at runtime — nothing is pre-stored.

**Why this priority**: This is the user-visible outcome — without it, the whole feature has no consumer. The PDF is a hard requirement.

**Independent Test**: An admin publishes an exam. The corresponding student logs in, sees their result for that exam, and clicks "Download Report Card". The browser downloads a single-page PDF with all required content.

**Acceptance Scenarios**:

1. **Given** an exam is in `draft`, `active`, or `locked` state, **When** the student requests `GET /student/results?examId=...`, **Then** the response returns 404 "no published result" — the student never sees pre-publication data.
2. **Given** an exam is `published`, **When** the student requests their result, **Then** they get marks per subject, per-subject pass/fail, overall percentage, overall pass/fail, and the exam meta (name, term, year).
3. **Given** a student is viewing a published result, **When** they click "Download Report Card", **Then** a PDF is generated containing: school name + logo + address (if set), student name + enrollment ID + class, exam name + term + year, a marks table (subject, marks obtained, total marks, pass/fail), the total marks obtained / total max, overall percentage, and an overall pass/fail label.
4. **Given** the student has results for multiple terms, **When** they switch year/term in the selector, **Then** the report-card download regenerates for the currently selected exam.
5. **Given** the school has uploaded a logo, **When** the PDF is generated, **Then** the logo is embedded in the report card header.

---

### User Story 5 — Re-Activation Resilience and Edge Cases (Priority: P2)

When admin assignments change after an exam is activated (e.g. a new teacher takes over English mid-term), the SubjectSubmission's `assignedTeacherId` can be reassigned without losing draft marks. Deleted teachers leave their pending submissions in "unassigned" state until reassigned.

**Why this priority**: Handles real-world staff churn. Not on the critical path for the first publish cycle but needed for v1 stability.

**Independent Test**: Reassigning a teacher to a different subject mid-exam: the new teacher gains access to the SubjectSubmission, the prior teacher loses access, and the draft marks remain intact.

**Acceptance Scenarios**:

1. **Given** an active exam has a draft SubjectSubmission, **When** the admin reassigns the teacher for that subject + class, **Then** the SubjectSubmission's `assignedTeacherId` updates and the draft marks remain.
2. **Given** a teacher is deleted, **When** the SubjectSubmission referencing them is queried, **Then** the dashboard shows "Unassigned" and the admin can reassign.
3. **Given** an admin deletes a student from the class after some draft marks were entered, **When** the dashboard reloads, **Then** that student's row disappears from the entry grid; the underlying mark stays orphaned until next save (which re-syncs).

---

### Edge Cases

- What if an exam is activated for a class with zero students? — Activation still succeeds; teachers see "no students yet" empty state on the entry page.
- What if a subject's pass mark is null? — Falls back to ceil(35% × totalMarks) as the implicit pass mark.
- What if the admin tries to delete an active exam? — Returns 409 "cannot delete an active exam, first revert to draft or finish publish lifecycle".
- What if a student is added to the class after publish? — They have no Result document; the API returns 404 for that student — admin must manually publish a per-student result if needed (v1 keeps it manual; later automation is out of scope).
- What if the PDF generation fails (e.g., images blocked)? — Frontend falls back to a text-only PDF and shows a toast "PDF generated without logo".

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST persist an `Exam.state` field with the values `draft`, `active`, `locked`, `published` and enforce transitions only via dedicated endpoints (activate, lock, publish, revert-to-draft).
- **FR-002**: The system MUST persist a `SubjectSubmission` record per (exam, subject) with a `state` field of `pending`, `draft`, `submitted`, or `locked`.
- **FR-003**: On exam activation, the system MUST create one SubjectSubmission per subject, populating `assignedTeacherId` from the matching `ClassTeacher` record (`schoolId + classId + subject`). When no match exists, `assignedTeacherId = null`.
- **FR-004**: Teachers MUST only be able to read and write SubjectSubmissions whose `assignedTeacherId` equals their own `Teacher._id`. All other access is rejected with 403, enforced on the backend.
- **FR-005**: Teachers MUST be able to save draft marks (transitioning the submission state to `draft`) and submit (transitioning to `submitted`). Once submitted, teachers cannot edit again unless the admin re-opens.
- **FR-006**: Admins MUST be able to re-open a `submitted` SubjectSubmission, moving it back to `draft` (only while the exam is `active`, not after publish).
- **FR-007**: The system MUST expose `GET /admin/exams/:examId/dashboard` returning counts (`total`, `submitted`, `draft`, `pending`, `unassigned`) and per-subject rows with teacher name, state, and `lastUpdatedAt`.
- **FR-008**: The system MUST reject `POST /admin/exams/:examId/publish` with a 409 unless all SubjectSubmissions are in `submitted` state.
- **FR-009**: On publish, the system MUST: (a) set exam `state = published` and stamp `publishedAt` + `publishedBy`, (b) lock every SubjectSubmission, (c) compute aggregate `Result` documents per student for that exam with `published = true`, and (d) compute and store `overallPercentage` and per-subject pass/fail at compute time.
- **FR-010**: Student-facing endpoints (`GET /student/results`, `GET /student/exams`) MUST hide any exam whose state is not `published` or whose Result has `published = false`.
- **FR-011**: Each subject MUST support `totalMarks` (>= 1) and an optional `passMark` (defaulting to ceil(35% × totalMarks)).
- **FR-012**: Mark validation MUST reject any `marksObtained > totalMarks` at the API layer, regardless of caller role.
- **FR-013**: The system MUST expose `GET /student/results/:examId/report-card` returning a serialised payload containing school identity (name, logo URL, address), student identity (name, enrollment ID, class), exam meta (name, term, year), and the full marks breakdown — enough for the frontend to render a PDF at runtime.
- **FR-014**: The frontend MUST generate the PDF client-side using a pure-JS PDF library, dynamically — nothing is pre-rendered or cached on disk.
- **FR-015**: The admin "Publish Results" button MUST be disabled in the UI when any subject's state is not `submitted`. The disabled state MUST be derived from the dashboard endpoint, not from client-side guessing.
- **FR-016**: All new endpoints MUST be guarded by the existing `authenticate → schoolScope → authorize(<role>)` chain. The teacher subject-submission endpoints additionally enforce per-submission assignment.
- **FR-017**: The system MUST keep existing `004` endpoints functional (`PUT /admin/exams/:examId/results` for legacy direct upsert) for backward compatibility, but mark them as legacy. New workflows go through SubjectSubmissions.
- **FR-018**: The system MUST expose `GET /teacher/exams` (exams with at least one assigned submission) and `GET /teacher/exams/:examId/submissions` (submissions assigned to caller) plus `GET /teacher/submissions/:id` (single submission with student roster).
- **FR-019**: The system MUST expose `PUT /teacher/submissions/:id/marks` (save draft) and `POST /teacher/submissions/:id/submit` (finalise).
- **FR-020**: The system MUST expose `POST /admin/exams/:examId/activate`, `POST /admin/exams/:examId/publish`, `POST /admin/exams/:examId/submissions/:submissionId/reopen`, and `POST /admin/exams/:examId/submissions/:submissionId/reassign` (body: `teacherId`).

### Key Entities

- **Exam (modified)**: existing `Exam.model.js` gains a `state` enum (`draft|active|locked|published`), `publishedAt`, `publishedBy`. Subjects remain embedded; once any SubjectSubmission has moved past `pending`, the subjects array becomes immutable.
- **SubjectSubmission (new)**: One per (exam, subject). Holds `assignedTeacherId`, `state`, `marks[]` (per-student rows), `submittedAt`, `submittedBy`, `lastSavedAt`. Indexed unique on `(schoolId, examId, subject)`.
- **Result (modified)**: existing `Result.model.js` gains a `published: Boolean` flag (default `false`). Result documents are now produced by the publish flow rather than written directly by admins.
- **ClassTeacher (existing, unchanged schema)**: Source of truth for "who teaches what subject in what class". Used at activation time to populate `assignedTeacherId`.

### Multi-Tenancy Scope

- **Tenant Scope**: Every new collection (`SubjectSubmission`) carries `schoolId`. All reads filter by `req.school._id`.
- **schoolId Required**: Yes — `SubjectSubmission` schema validates `schoolId` as required and indexes it.
- **Cross-Tenant Risk**: A teacher in School A cannot see exams in School B because `schoolScope` middleware filters all queries by JWT `schoolId`. The per-submission assignment check (`assignedTeacherId == teacher._id AND schoolId == req.school._id`) is enforced for every teacher mutation.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: An admin can take an exam from draft to published in under 2 minutes once teachers have entered marks — verified by following the activate → submit → publish path manually.
- **SC-002**: 100 % of students with a published Result for an exam can download the PDF report card on the first click — verified by manual smoke test with sample data.
- **SC-003**: 0 % of students can see any data for an unpublished exam — verified by integration test that asserts 404 for non-published examIds.
- **SC-004**: 0 % of teachers can mutate a SubjectSubmission they aren't assigned to — verified by integration test that asserts 403 for cross-subject and cross-school requests.
- **SC-005**: The admin dashboard correctly reflects state within 1 second of a teacher saving or submitting — verified by manual refresh after teacher action.
- **SC-006**: Generated PDF report card opens in Chrome, Safari, and Firefox without console errors — verified manually on the local dev environment.

---

## Assumptions

- The frontend uses `jspdf` + `jspdf-autotable` for client-side PDF generation. These are added to `frontend/package.json` as new dependencies.
- The existing 004 direct-upsert endpoint (`PUT /admin/exams/:examId/results`) stays available for migration purposes but is no longer the recommended flow for new exams.
- A teacher may be assigned to multiple subjects in the same class; the system surfaces each as a separate SubjectSubmission.
- Pass mark defaults to ceil(35 % × totalMarks) when unset, matching the 004 convention.
- Rank computation runs once at publish time across all students in the class for that exam, descending on `overallPercentage`. Ties are co-ranked (1, 2, 2, 4).
- "Unassigned" subjects (no `ClassTeacher` match at activation) are flagged but do not block publish — admin must reassign or accept a 0-mark publish for that subject (admin can manually enter the marks via legacy `PUT /admin/exams/:examId/results` if needed).
- PDF generation runs on the client. The backend exposes a JSON "report card payload" endpoint that includes school branding so the client has everything in one round-trip.
- Existing 259 backend tests must keep passing. New integration tests cover: activate, save-draft, submit, publish gating, publish success, role enforcement, cross-tenant isolation.
- The legacy "marks" model (`Marks.model.js`, used by `MarksPage` for teachers) is unrelated to this feature and is left untouched.
