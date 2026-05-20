# Implementation Plan: School Portal Identity & Student/Teacher UX Overhaul

**Branch**: `004-school-portal-ux` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-school-portal-ux/spec.md`

---

## Summary

Transform the existing generic school management SaaS into a branded school portal experience. Six interconnected work areas: (1) email-based password reset and first-login forced change via NodeMailer, (2) dynamic exam/result module with year-term selectors, (3) existing student sub-section empty state fixes, (4) login overlay modal replacing full-page navigation, (5) school slug-based branding fully loaded before login, and (6) personalised student and teacher dashboard home screens using school colour and identity. All backend work follows the established `authenticate → schoolScope → authorize` middleware chain; all new Mongoose models carry `schoolId` with compound indexes.

---

## Technical Context

**Language/Version**: Node.js 20 LTS (backend); React 18 + Vite 5 (frontend)  
**Primary Dependencies**:
- Backend: Express 5.x, Mongoose 9.x, jsonwebtoken 9.x, bcryptjs 3.x, express-validator 7.x, lru-cache 11.x, `nodemailer` (**NEW — needs `npm install nodemailer` in `/backend`**)
- Frontend: React Router 6, Redux Toolkit 2.x, Axios 1.x, Tailwind CSS 3.x, Framer Motion 11.x  

**Storage**: MongoDB Atlas — shared cluster. New collections: `exams`, `results`, `passwordresettokens`. Modified collection: `users` (2 new fields).  
**Testing**: Jest 29 + Supertest 7 (backend); Vitest 1 + React Testing Library 14 (frontend). Current baseline: 259 backend tests all passing.  
**Target Platform**: Web application. Backend: Render. Frontend: Vercel.  
**Performance Goals**: All new API endpoints < 500ms p95. Year/term dropdown queries use compound indexes on `exams` collection.  
**Constraints**: NodeMailer uses free SMTP (no paid service); `schoolId` always from `req.schoolId` (JWT/schoolScope), never from body; no new third-party state management; backward-compatible `EmptyState` enhancement; do not break 259 existing tests.  
**Scale/Scope**: Same as existing — ≤ 500 concurrent users; new exam/result data sized for ~30 classes × 50 students per school.

---

## Constitution Check

| Principle | Addressed? | Notes |
|-----------|-----------|-------|
| I. Code Quality | ✅ PASS | New services (`exam.service.js`, `result.service.js`, `email.service.js`, `passwordReset.service.js`) follow the controller → service → model layering. No controller imports models directly. All new routes follow REST conventions. |
| II. Testing Standards | ✅ PASS | Three new integration test files (`admin.exams.test.js`, `student.results.test.js`, `password.reset.test.js`). `email.service.js` is covered by unit tests with nodemailer transport mocked. Target: maintain ≥ 70% coverage across new code. |
| III. User Experience Consistency | ✅ PASS | All new pages use the existing `Layout` wrapper. `EmptyState` is enhanced (not replaced). Login modal reuses the existing `LoginForm` logic — share a `LoginForm.jsx` component between modal and page. Framer Motion `fadeInUp` on all new pages. |
| IV. Performance Requirements | ✅ PASS | New compound indexes on `exams` (`schoolId, classId, year, term`) and `results` (`schoolId, studentId, examId`) cover all query patterns. Year dropdown uses a lightweight `distinct` query. |
| V. Security | ✅ PASS | Password reset token stored as SHA-256 hash (not raw). `mustChangePassword` enforced server-side. All new authenticated routes have `authenticate + schoolScope + authorize` chain. `schoolId` injected from JWT only. Public school info endpoint strips `isActive`. NodeMailer credentials in env vars, never hardcoded. |
| VI. Scalability | ✅ PASS | All new models have `schoolId` field with compound indexes. Soft delete on `Exam` (`isDeleted`). PasswordResetToken has TTL index for automatic cleanup. `schoolScope` middleware applied to all new authenticated routes. |
| VII. UI Animation & Modern Design | ✅ PASS | Greeting banners, stat cards, result cards, and the login modal all use Framer Motion `motion.div` with `fadeInUp`/`staggerContainer` variants. `prefers-reduced-motion` respected via existing `useReducedMotion` hook from `SchoolBrandingProvider`. Skeleton loaders on branding load. Mobile responsive (single-column below 640px). |
| VIII. Multi-Tenancy & School Isolation | ✅ PASS | `Exam` and `Result` models have `schoolId: required`. All admin/student/teacher exam+result endpoints go through `schoolScope`. Year/term dropdown queries filter by `schoolId`. Cross-tenant isolation tests in `admin.exams.test.js` and `student.results.test.js`. Public school info endpoint uses `slugToSchool` middleware. |

**Multi-Tenancy Gate**:
- [x] `schoolId` added to `Exam` and `Result` models
- [x] `schoolScope` middleware applied to all new authenticated routes
- [x] Cross-tenant isolation assertions in integration tests
- [x] Public school info endpoint uses `slugToSchool` (not raw schoolId in URL)

**Constitution Check Result: ALL GATES PASS — proceed to implementation phases**

---

## Project Structure

### Documentation (this feature)

```text
specs/004-school-portal-ux/
├── plan.md              ← this file
├── spec.md              ← feature specification
├── research.md          ← Phase 0 output (all unknowns resolved)
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output (API contract)
├── checklists/
│   └── requirements.md  ← Spec quality checklist
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code — New Files

```text
backend/
├── src/
│   ├── config/
│   │   └── mailer.js                         ← NEW: nodemailer transporter
│   ├── models/
│   │   ├── PasswordResetToken.model.js        ← NEW
│   │   ├── Exam.model.js                      ← NEW
│   │   └── Result.model.js                    ← NEW
│   ├── services/
│   │   ├── email.service.js                   ← NEW
│   │   ├── passwordReset.service.js           ← NEW
│   │   ├── exam.service.js                    ← NEW
│   │   └── result.service.js                  ← NEW
│   ├── validators/
│   │   ├── exam.validator.js                  ← NEW
│   │   └── result.validator.js                ← NEW
│   └── controllers/
│       ├── exam.controller.js                 ← NEW
│       └── result.controller.js               ← NEW
└── tests/
    └── integration/
        ├── admin.exams.test.js                ← NEW
        ├── student.results.test.js            ← NEW
        └── password.reset.test.js             ← NEW

frontend/
└── src/
    ├── components/
    │   └── common/
    │       └── LoginModal.jsx                 ← NEW (portal-based overlay)
    ├── pages/
    │   ├── ChangePassword.jsx                 ← NEW
    │   ├── admin/
    │   │   ├── ExamsPage.jsx                  ← NEW
    │   │   └── ResultEntryPage.jsx            ← NEW
    │   └── student/
    │       └── ResultsPage.jsx                ← NEW (year+term dynamic marks)
    └── api/
        ├── exam.api.js                        ← NEW
        └── result.api.js                      ← NEW
```

### Source Code — Modified Files

```text
backend/src/
├── models/User.model.js                       ← Add mustChangePassword, passwordResetExpiry
├── services/school.service.js                 ← Strip isActive from getSchoolConfigBySlug
├── services/auth.service.js                   ← Include mustChangePassword in login response
├── services/student.service.js                ← Temp password + email on admin-create
├── services/teacher.service.js                ← Temp password + email on admin-create
├── routes/auth.routes.js                      ← forgot-password, reset-password, change-password
├── routes/admin.routes.js                     ← exam + result routes
├── routes/student.routes.js                   ← years, exams, results, change-password
└── routes/teacher.routes.js                   ← change-password route

frontend/src/
├── redux/slices/uiSlice.js                    ← loginModal state (openLoginModal, closeLoginModal)
├── components/common/EmptyState.jsx           ← Add icon + title props (backward compatible)
├── components/common/Navbar.jsx               ← dispatch openLoginModal; show school name
├── components/common/Sidebar.jsx              ← school logo/name in header
├── components/common/ProtectedRoute.jsx       ← dispatch openLoginModal instead of navigate
├── pages/Login.jsx                            ← localStorage.setItem; mustChangePassword redirect
├── pages/Home.jsx                             ← redirect via lastSchoolSlug
├── App.jsx                                    ← new routes + LoginModal render
├── pages/student/StudentDashboard.jsx         ← greeting banner + school branding
└── pages/teacher/TeacherDashboard.jsx         ← greeting banner + school branding
```

---

## Implementation Phases

### Phase A — Backend Foundation (data models + email infrastructure)

**Sequence**: Must complete before all other backend phases.

#### A1. Install nodemailer + create mailer config
- `cd backend && npm install nodemailer`
- Create `backend/src/config/mailer.js` — reads SMTP env vars; exports a singleton transporter.
- Add SMTP env var entries to `.env.example` (document with comments).
- Validate: `node -e "require('./src/config/mailer')"` — no crash if env vars are missing (warning only).

#### A2. Create `PasswordResetToken.model.js`
- Fields: `userId`, `tokenHash`, `expiresAt`, `used`.
- TTL index on `expiresAt`.
- Indexes on `userId` and `tokenHash`.

#### A3. Create `Exam.model.js`
- Fields per data-model.md Section 3.
- Compound unique index on `(schoolId, classId, name, year, term)`.
- Compound index on `(schoolId, classId, year, term)` for filters.
- Index on `(schoolId, year)` for years dropdown.

#### A4. Create `Result.model.js`
- Fields per data-model.md Section 4.
- `pre('save')` hook: compute `overallPercentage` from `marks` array (requires populated `examId`). Since `totalMarks` per subject lives in the linked `Exam` document, the service layer must pass subject totalMarks for the calculation — the hook stores the pre-computed value supplied by the service.
- Unique compound index on `(schoolId, examId, studentId)`.

#### A5. Add `mustChangePassword` to `User.model.js`
- Add `mustChangePassword: { type: Boolean, default: false }` to `userSchema`.
- Existing documents default to `false` — no migration needed (Mongoose applies schema defaults to new saves only; reads return `undefined` for existing docs which is falsy — safe).

---

### Phase B — Email and Password Reset Services

**Depends on**: Phase A

#### B1. Create `email.service.js`
- `sendTempPassword(to, name, tempPassword)` — sends welcome email with temp password.
- `sendPasswordResetLink(to, name, resetUrl)` — sends reset link email.
- Both use inline HTML (no template engine). Plain text fallback included.
- Errors are caught and logged via `logger.js`; they do NOT throw (non-blocking).

#### B2. Create `passwordReset.service.js`
- `requestPasswordReset(email)` — finds user by email, creates `PasswordResetToken`, calls `email.service.sendPasswordResetLink`. If email not found: returns silently (no user enumeration).
- `resetPassword(rawToken, newPassword)` — SHA-256-hashes the raw token, looks up `PasswordResetToken` (checks `!used && expiresAt > now`), updates `User.password`, marks token `used: true`.
- `changePassword(userId, currentPassword, newPassword)` — verifies current password via `bcrypt.compare`, updates password, sets `mustChangePassword: false`.

#### B3. Update `student.service.js` and `teacher.service.js` — admin-initiated creation
- When admin creates a student/teacher, generate an 8-char random alphanumeric temp password (using `crypto.randomBytes`).
- Set `mustChangePassword: true` on the new User record.
- Call `email.service.sendTempPassword` (non-blocking — don't await in the student/teacher service response path; use `setImmediate` or fire-and-forget with error-logging catch).

#### B4. Update `auth.service.js` — include `mustChangePassword` in login response
- The `loginUser` service function returns the user object. Ensure `mustChangePassword` is included (it's picked from the User document — verify the `toJSON` transform doesn't strip it).

---

### Phase C — Auth and Password Routes

**Depends on**: Phase B

#### C1. Add routes to `auth.routes.js`
- `POST /forgot-password` → `passwordReset.service.requestPasswordReset`
- `POST /reset-password` → `passwordReset.service.resetPassword`
- `PUT /change-password` → `authenticate + schoolScope + authorize(['student','teacher']) + passwordReset.service.changePassword`
- Validators: `express-validator` chains for each — validate body fields, use existing `validate` middleware.

#### C2. Update `student.routes.js` and `teacher.routes.js`
- `PUT /password` → delegates to `passwordReset.service.changePassword` (same service function).

---

### Phase D — Exam and Result Services + Routes

**Depends on**: Phase A

#### D1. Create `exam.service.js`
- `createExam(schoolId, data)` — creates Exam document with schoolId from service arg (passed from `req.schoolId` via controller).
- `listExams(schoolId, filters)` — query by schoolId; optional `year`, `classId` filter; excludes `isDeleted`.
- `getExam(schoolId, examId)` — single exam with schoolId guard.
- `updateExam(schoolId, examId, data)` — guard: reject if results exist.
- `deleteExam(schoolId, examId)` — soft delete; guard if results exist.
- `getDistinctYears(schoolId)` — `Exam.distinct('year', { schoolId, isDeleted: false })`.

#### D2. Create `result.service.js`
- `upsertResults(schoolId, examId, results)` — bulk upsert using `bulkWrite`; validates `marksObtained ≤ totalMarks` per subject from the linked Exam.
- `getResultsForExam(schoolId, examId)` — for admin result entry page.
- `getStudentResult(schoolId, studentId, examId)` — student's own result; includes computed pass/fail per subject.
- `getExamsForStudent(schoolId, studentId, year)` — returns exams for the student's class in a given year.

#### D3. Create `exam.controller.js` and `result.controller.js`
- Standard controller pattern: receive validated `req`, call service, send `ApiResponse`.
- Never reference `req.body.schoolId` — always use `req.schoolId`.

#### D4. Add exam + result routes to `admin.routes.js` and `student.routes.js`
- Admin routes per contracts/api.md.
- Student routes: `GET /exams/years`, `GET /exams`, `GET /results`.
- Validators for all mutation endpoints.

---

### Phase E — Backend Integration Tests

**Depends on**: Phase C and D

#### E1. `tests/integration/admin.exams.test.js`
- Create exam (success + validation errors).
- List exams with year filter.
- Enter results (bulk upsert + validation: marks exceeding total rejected).
- Soft delete exam (with and without results).
- **Cross-tenant test**: School A admin cannot read School B's exams or results (mandatory per constitution VIII).

#### E2. `tests/integration/student.results.test.js`
- Student can see their own result for a published exam.
- Student cannot see another student's result.
- Years dropdown returns only years with exams for the student's school.
- Empty result returns 404 with expected message.
- **Cross-tenant test**: Student from School A cannot access School B's exams.

#### E3. `tests/integration/password.reset.test.js`
- Forgot password with valid email → token created (email sending mocked).
- Forgot password with unknown email → 200 (no enumeration).
- Reset password with valid token → password updated.
- Reset password with expired token → 400.
- Reset password with already-used token → 400.
- Change password with correct current password → 200, `mustChangePassword` cleared.
- Change password with wrong current password → 401.

---

### Phase F — Frontend: Redux + Login Modal

**Depends on**: nothing (can start immediately in parallel with backend phases)

#### F1. Update `uiSlice.js`
- Add `loginModal: { isOpen: false, redirectTo: null }` to initial state.
- Add `openLoginModal(state, action)` and `closeLoginModal(state)` reducers.
- Export `selectLoginModal` selector.

#### F2. Extract `LoginForm.jsx`
- Extract the login form HTML + submit logic from `Login.jsx` into a shared `LoginForm.jsx` component that accepts `onSuccess(user)` callback.
- `Login.jsx` (the page) just wraps `LoginForm` with its page layout.
- Accept an optional `onCancel` prop (only used by modal — shows the X button and calls `closeLoginModal`).

#### F3. Create `LoginModal.jsx`
- Renders via `ReactDOM.createPortal(content, document.body)`.
- Reads `selectLoginModal` from Redux.
- Shows when `loginModal.isOpen === true`.
- Contains `LoginForm` with `onSuccess` → dispatch `closeLoginModal()` + navigate to `redirectTo` if set.
- Close triggers: X button, backdrop click, `Escape` key (`useEffect` keydown listener).
- Backdrop: `fixed inset-0 bg-black/50 z-50`.
- Modal panel: `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl p-8`.
- Framer Motion `AnimatePresence` + `motion.div` for entrance/exit animation.

#### F4. Render `LoginModal.jsx` in `App.jsx`
- Add `<LoginModal />` at the root level of App (outside `<Routes>`) so it's always available.

#### F5. Update `ProtectedRoute.jsx`
- When unauthenticated, dispatch `openLoginModal({ redirectTo: location.pathname })` instead of `navigate('/login')`.
- Render `null` (or a loading spinner) — the modal will collect credentials and trigger re-render.

#### F6. Update `Navbar.jsx` — profile click
- If a "My Profile" or avatar click fires while `!isAuthenticated`, dispatch `openLoginModal()` instead of navigating.
- Add profile icon/link to navbar if it doesn't exist (currently navbar just shows `user.name` — add a clickable avatar/name that routes to profile page when logged in, or opens modal when not).

---

### Phase G — Frontend: School Branding + Slug Memory

**Depends on**: nothing (parallel with Phase F)

#### G1. Update `Navbar.jsx` — school name
- Replace hardcoded "SchoolMS" with `useSelector(selectSchoolName) ?? 'SchoolMS'`.
- Show school logo if `selectSchoolBranding().logoUrl` is set (`<img>` with `alt={schoolName}`).

#### G2. Update `Sidebar.jsx` — school identity header
- At the top of the sidebar, show a school header block:
  - School logo (if `branding.logoUrl`) as a small image, else school name as bold text.
  - Use `var(--school-primary)` as text colour for the school name when displayed as text.
- While branding is loading (name is null), show a `SkeletonCard` placeholder row.

#### G3. Update `Login.jsx` — localStorage persistence
- After successful login (where `schoolSlug !== null`): `localStorage.setItem('lastSchoolSlug', schoolSlug)`.
- Also set in `LoginModal.jsx`'s `onSuccess` callback.
- On logout (`clearCredentials`): add `localStorage.removeItem('lastSchoolSlug')` to the dispatch sequence (either in thunk or in the logout handler function in Navbar/Login).

#### G4. Update `Home.jsx` — root redirect
- At the start of the Home component, check `localStorage.getItem('lastSchoolSlug')`.
- If set and user is already authenticated → `navigate(`/schools/${slug}/${role}/dashboard`)`.
- If set and user is NOT authenticated → render a "Return to your school" link to `/schools/${slug}/login` (don't auto-redirect — let the user decide).

#### G5. Update public school info — strip `isActive` from service
- In `backend/src/services/school.service.js`, `getSchoolConfigBySlug`: remove `isActive` from the returned object.

---

### Phase H — Frontend: EmptyState Enhancement + Student Sub-sections

**Depends on**: nothing (parallel)

#### H1. Enhance `EmptyState.jsx`
- Add `icon` prop (optional React element) — renders above title if provided.
- Add `title` prop (optional string) — rendered as `<p>` with `font-semibold` between icon and message.
- Default: if no `icon`, show existing SVG; if no `title`, skip the heading line.
- All existing call sites (`MarksPage.jsx` etc.) continue working unchanged.

#### H2. Apply EmptyState to student sub-sections with good copy
- `TimetablePage.jsx` — add import of EmptyState; already shows `<p className="text-gray-500">` when no data → replace with `<EmptyState title="No timetable set yet" message="Your school admin will add your class schedule soon." />`.
- `AttendancePage.jsx` — same treatment: `<EmptyState title="No attendance records yet" message="Attendance will appear after your first class." />`.
- `AnnouncementsPage.jsx` — `<EmptyState title="No announcements yet" message="Your teachers will post updates and notices here." />`.

---

### Phase I — Frontend: Dynamic Marks / Results Page

**Depends on**: Phase D (backend exam/result endpoints)

#### I1. Create `exam.api.js` and `result.api.js`
- `getExamYears()` → `GET /student/exams/years`
- `getExamsForYear(year)` → `GET /student/exams?year=...`
- `getResult(examId)` → `GET /student/results?examId=...`
- `getExams(filters)` → `GET /admin/exams?year=...&classId=...`
- `createExam(data)` → `POST /admin/exams`
- `upsertResults(examId, results)` → `PUT /admin/exams/:examId/results`
- `getExamResults(examId)` → `GET /admin/exams/:examId/results`

#### I2. Create `ResultsPage.jsx` (student)
- State: `selectedYear`, `selectedExam`.
- On mount: fetch years from `getExamYears()` → populate year dropdown.
- On year change: fetch exams from `getExamsForYear(year)` → render term pills/tabs.
- On exam select: fetch result from `getResult(examId)`.
- Render result cards per subject: subject name, `marksObtained / totalMarks`, percentage bar, Pass/Fail badge.
- Summary row: overall percentage (`result.overallPercentage`), rank (`result.rank ?? '—'`).
- If no result for selection: `<EmptyState title="No results yet" message="Results for this term haven't been published yet." />`.
- All cards animated with `motion.div` + `staggerContainer`.
- Uses `var(--school-primary)` colour on the progress bars and pass badge.

#### I3. Add `ResultsPage` to `App.jsx` routes
- Add `<Route path="results" element={<ResultsPage />} />` inside the student route group (alongside existing `marks` route — keep the old `marks` route pointing to the simple Marks page for backward compat during transition).

#### I4. Update student sidebar navigation
- Add "My Results" nav item pointing to `results` route.

---

### Phase J — Frontend: Admin Exam Management Pages

**Depends on**: Phase D (backend), Phase I (api files)

#### J1. Create `ExamsPage.jsx` (admin)
- Lists exams for the school.  
- "Create Exam" button → opens a form (modal or inline) with fields: name, year, term, classId (dropdown from existing classes), subjects (dynamic add/remove rows with name + totalMarks).
- After create: re-fetch list.
- Each exam row: name, year, term, class, status (draft/published), "Enter Results" link.

#### J2. Create `ResultEntryPage.jsx` (admin)
- Route: `/schools/:slug/admin/exams/:examId/results`
- Fetches exam + current results grid from `GET /admin/exams/:examId/results`.
- Table: one row per student, columns for each subject.
- Editable number inputs per cell, save button per row or bulk save all.
- Uses `PUT /admin/exams/:examId/results` for bulk save.
- Validation: number input max = subject's `totalMarks` (frontend + backend).
- Empty state if no students in the class.

#### J3. Add exam routes to `App.jsx` and admin sidebar
- `/schools/:slug/admin/exams` → `ExamsPage`
- `/schools/:slug/admin/exams/:examId/results` → `ResultEntryPage`
- Add "Exams" nav item to admin sidebar.

---

### Phase K — Frontend: Dashboard Personalisation

**Depends on**: Phase G (school branding + selectors available)

#### K1. Update `StudentDashboard.jsx` — greeting banner
- Add a banner `<div>` at the top with:
  - Left border accent: `border-l-4 border-[var(--school-primary)]`
  - "Good {timeOfDay}, {user.name.split(' ')[0]}" — time-of-day helper (morning/afternoon/evening).
  - Today's date: `new Intl.DateTimeFormat('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).format(new Date())`.
  - While `schoolName` is null (branding still loading): render `<SkeletonCard />` in place of the banner.
- Animated with Framer Motion `fadeInUp`.

#### K2. Enhance stat cards — school primary colour
- The existing `SummaryCard` component uses hardcoded Tailwind colour classes.
- Pass a `colour` prop (CSS custom property string) to stat cards that should use `var(--school-primary)`.
- Use `style={{ color: 'var(--school-primary)' }}` for the value text in key stat cards (attendance, exam count).

#### K3. Update `TeacherDashboard.jsx` — greeting banner  
- Same greeting banner pattern as K1.
- Replace the existing "Loading classes..." placeholder with a proper stat card showing: total students in assigned class.
- Quick-action buttons "Mark Today's Attendance" and "Post Announcement" become primary colour buttons using `var(--school-primary)`.

#### K4. Change-password page and flow
- Create `src/pages/ChangePassword.jsx` — form with currentPassword + newPassword + confirm fields.
- Calls `PUT /auth/change-password`.
- On success: dispatches a success toast via `showToast`, redirects to dashboard.
- Add route `/schools/:slug/change-password` (accessible to student and teacher; no role guard on the route since role is enforced on the backend endpoint).
- `Login.jsx` and `LoginModal.jsx`: after `onSuccess`, if `user.mustChangePassword === true`, redirect to `${base}/change-password` instead of the normal dashboard.

---

## Phase Sequencing and Dependencies

```
Phase A (models) ──┬── Phase B (email/password services) ── Phase C (auth routes)
                   └── Phase D (exam/result services) ────── Phase E (tests)

Phase F (Redux + modal) ─── independent, can start any time
Phase G (branding/slug) ─── independent, can start any time
Phase H (empty states)  ─── independent, can start any time
Phase I (results page)  ─── depends on Phase D
Phase J (admin exams UI)─── depends on Phase D
Phase K (dashboard)     ─── depends on Phase G

Recommended order for a single developer:
  1. A → B → C (auth/password backend)
  2. F + G + H (frontend state + branding + empty states — while backend matures)
  3. D → E (exam/result backend)
  4. I → J → K (dynamic marks + admin pages + dashboard polish)
```

---

## Complexity Tracking

No constitution violations requiring justification. No additional complexity introduced beyond what the spec requires.

---

## Post-Design Constitution Re-check

After designing all schemas and contracts:

- **Multi-tenancy gate**: Both `Exam` and `Result` carry `schoolId: required` with compound indexes. All service functions take `schoolId` as first argument (injected from `req.schoolId` by all controllers — controllers read `req.schoolId` not `req.body.schoolId`). ✅
- **Cross-tenant tests**: Explicitly planned in Phase E1, E2. ✅
- **Public endpoint security**: `getSchoolConfigBySlug` strips `isActive`. ✅
- **Password security**: Reset tokens stored as SHA-256 hashes. `mustChangePassword` enforced server-side. `bcryptjs` rounds=12 unchanged. ✅
- **Animation compliance**: All new pages (results, exams, change-password, modal) use `motion.div` with `fadeInUp`. `prefers-reduced-motion` respected via existing `useReducedMotion` hook. ✅

**Re-check result: ALL GATES PASS**
