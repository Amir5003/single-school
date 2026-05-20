# Tasks: School Portal Identity & Student/Teacher UX Overhaul

**Feature**: `004-school-portal-ux` | **Date**: 2026-05-18  
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)  
**Total tasks**: 61 | **Phases**: 11

---

## Phase 1: Setup

> Install new dependency and document environment variables required for the email infrastructure.

- [x] T001 Install nodemailer in `backend/package.json` via `cd backend && npm install nodemailer`
- [x] T002 Add Gmail SMTP env vars to `backend/.env.example` with descriptive comments (values below are illustrative — copy to your local `backend/.env` with real credentials, never commit `.env`):
  ```
  # Gmail SMTP — use a Gmail App Password (not your account password)
  # Generate at: https://myaccount.google.com/apppasswords
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-gmail-address@gmail.com
  SMTP_PASS=your-16-char-app-password
  SMTP_FROM=your-gmail-address@gmail.com
  ```
  Then add the real values to your local `backend/.env` (already in `.gitignore`)

---

## Phase 2: Foundational

> Blocking prerequisites for all user stories. These models and config files must exist before any service or route can be built. All tasks in this phase are independent and can run in parallel.

**Independent test**: All 6 files import without errors in a Node REPL; `User.model.js` schema includes `mustChangePassword` and `passwordResetExpiry`; `Exam.model.js` and `Result.model.js` have compound indexes visible via `Model.schema.indexes()`.

- [x] T003 [P] Add `mustChangePassword: { type: Boolean, default: false }` field to `backend/src/models/User.model.js` (note: `passwordResetExpiry` is **not** added here — token expiry is tracked entirely on the `PasswordResetToken` document via `expiresAt`; adding it to User would be dead schema code)
- [x] T004 [P] Create `backend/src/models/PasswordResetToken.model.js` with fields `userId` (ref: User), `tokenHash`, `expiresAt`, `used`; TTL index on `expiresAt`; plain indexes on `userId` and `tokenHash`
- [x] T005 [P] Create `backend/src/models/Exam.model.js` with fields per data-model.md §3 (`schoolId`, `classId`, `name`, `year`, `term`, `subjects[]`, `publishedAt`, `isDeleted`); compound indexes on `{schoolId,classId,year,term}` and `{schoolId,year}` and `{schoolId,isDeleted}`; unique compound on `{schoolId,classId,name,year,term}`
- [x] T006 [P] Create `backend/src/models/Result.model.js` with fields per data-model.md §4 (`schoolId`, `examId`, `studentId`, `marks[]`, `overallPercentage`, `rank`, `isDeleted`); unique compound index on `{schoolId,examId,studentId}`; indexes on `{schoolId,studentId,examId}` and `{schoolId,examId}`
- [x] T007 [P] Create `backend/src/config/mailer.js` — reads `SMTP_HOST/PORT/USER/PASS/FROM` from `process.env`; creates and exports a nodemailer transporter singleton; logs a warning (not a thrown error) if `SMTP_HOST` is not set, so the app starts cleanly without a mail server configured
- [x] T008 [P] Remove `isActive` from the returned object in `getSchoolConfigBySlug` in `backend/src/services/school.service.js` so the public school config endpoint never exposes operational data

---

## Phase 3: User Story 3 — Admin Creates Exams and Enters Results (P1)

> Admin can create exam records, enter student marks, and retrieve results through the API. This must land before the student results phase since it creates the data students will read.

**Story goal**: A school admin API client can POST an exam, list exams, and bulk-upsert results for a student — and the response matches the contracts in `contracts/api.md`.

**Independent test**: Using a supertest helper, `POST /api/v1/admin/exams` with a valid body returns 201 with the exam object; `PUT /api/v1/admin/exams/:id/results` with one student's marks returns 200; a student from a different school cannot access either endpoint (403/404).

- [x] T009 [P] [US3] Create `backend/src/validators/exam.validator.js` — express-validator chains for `createExam` (name, year, term, classId, subjects[].name, subjects[].totalMarks) and `updateExam`
- [x] T010 [P] [US3] Create `backend/src/validators/result.validator.js` — express-validator chains for `upsertResults` body (array of `{ studentId, marks: [{ subject, marksObtained }] }`)
- [x] T011 [US3] Create `backend/src/services/exam.service.js` with functions: `createExam(schoolId, data)`, `listExams(schoolId, filters)`, `getExam(schoolId, examId)`, `updateExam(schoolId, examId, data)` (guard: reject if results exist), `deleteExam(schoolId, examId)` (soft delete; guard if results exist), `getDistinctYears(schoolId)` — all filter by `schoolId`; never trust body schoolId
- [x] T012 [US3] Create `backend/src/services/result.service.js` with functions: `upsertResults(schoolId, examId, results)` (bulk `bulkWrite`; validate `marksObtained ≤ totalMarks` from linked Exam per subject), `getResultsForExam(schoolId, examId)`, `getStudentResult(schoolId, studentId, examId)` (includes per-subject pass/fail computed at read time using subject `passMark ?? global 35%`), `getExamsForStudent(schoolId, studentId, year)` (joins via student's classId)
- [x] T013 [P] [US3] Create `backend/src/controllers/exam.controller.js` — delegates to `exam.service.js`; reads `req.schoolId` (never `req.body.schoolId`); wraps all handlers with `asyncHandler`; returns `ApiResponse`
- [x] T014 [P] [US3] Create `backend/src/controllers/result.controller.js` — delegates to `result.service.js`; same schoolId and error-handling conventions
- [x] T015 [US3] Add admin exam routes to `backend/src/routes/admin.routes.js`: `GET /exams`, `POST /exams`, `GET /exams/:examId`, `PUT /exams/:examId`, `DELETE /exams/:examId`, `GET /exams/:examId/results`, `PUT /exams/:examId/results` — all with `authenticate + schoolScope + authorize('school-admin')` + appropriate validator chains
- [x] T016 [US3] Create `backend/tests/integration/admin.exams.test.js` covering: create exam (success + validation errors), list with year filter, bulk upsert results (valid + marks-exceed-total rejected), soft delete (with and without results), and a mandatory cross-tenant assertion: school A admin cannot read school B exams or results
- [x] T017 [US3] Create `frontend/src/api/exam.api.js` with: `getAdminExams(filters)` → `GET /admin/exams`, `createExam(data)` → `POST /admin/exams`, `updateExam(id, data)`, `deleteExam(id)`, `getExamResults(examId)` → `GET /admin/exams/:id/results`, `upsertResults(examId, results)` → `PUT /admin/exams/:id/results`; and `frontend/src/api/result.api.js` with: `getExamYears()` → `GET /student/exams/years`, `getExamsForYear(year)` → `GET /student/exams?year=`, `getStudentResult(examId)` → `GET /student/results?examId=`
- [x] T018 [P] [US3] Create `frontend/src/pages/admin/ExamsPage.jsx` — lists exams fetched from `getAdminExams()`; "Create Exam" button opens an inline or modal form with fields: name, year, term, classId dropdown (fetched from existing classes API), subjects rows (add/remove, each with name + totalMarks); on submit re-fetches list; each exam row shows name/year/term/class/draft-or-published status and a "Enter Results" link; uses `motion.div` with `fadeInUp` variant; uses `EmptyState` when list is empty
- [x] T019 [P] [US3] Create `frontend/src/pages/admin/ResultEntryPage.jsx` — route `/schools/:slug/admin/exams/:examId/results`; fetches exam metadata + existing results grid; renders a table with one row per student and one column per subject; editable number inputs capped at subject `totalMarks`; bulk-save button calls `upsertResults`; shows success toast on save; uses `EmptyState` when class has no students
- [x] T020 [US3] Add exam routes and admin sidebar nav: in `frontend/src/App.jsx` add `<Route path="exams" element={<ExamsPage />} />` and `<Route path="exams/:examId/results" element={<ResultEntryPage />} />` inside the admin route group; add "Exams" nav item to the admin `Sidebar` component linking to `exams`

---

## Phase 4: User Story 1 — Temp Password and Password Reset (P1)

> Admin-created accounts receive a temporary password by email. Users are forced to change it on first login. Forgot-password flow issues a time-limited reset link.

**Story goal**: An admin creates a student account → student gets an email with a temp password → student logs in → sees the change-password screen → changes password → lands on dashboard. Forgot-password flow succeeds end-to-end with mocked transport.

**Independent test**: `POST /api/v1/auth/forgot-password` with valid email returns 200 and creates a `PasswordResetToken` document; with unknown email also returns 200 (no enumeration). `POST /api/v1/auth/reset-password` with a raw token returns 200 and clears the token. `PUT /api/v1/auth/change-password` with correct current password returns 200 and sets `mustChangePassword: false` on the user.

- [x] T021 [US1] Create `backend/src/services/email.service.js` with: `sendTempPassword(to, name, tempPassword)` and `sendPasswordResetLink(to, name, resetUrl)` — both compose inline HTML with plain-text fallback and call the nodemailer transporter from `config/mailer.js`; errors are caught inside the function and logged via `logger.js` (non-blocking, never throw)
- [x] T022 [US1] Create `backend/src/services/passwordReset.service.js` with: `requestPasswordReset(email)` — finds user by email; if found creates `PasswordResetToken` with SHA-256-hashed random 32-byte token and 1-hour expiry, then fires `email.service.sendPasswordResetLink`; if email not found returns silently; `resetPassword(rawToken, newPassword)` — SHA-256 hashes the raw token, finds PasswordResetToken where `!used && expiresAt > Date.now()`, updates `User.password` (bcrypt 12 rounds), marks token `used: true`; `changePassword(userId, currentPassword, newPassword)` — bcrypt.compare current password, update password, set `mustChangePassword: false`
- [x] T023 [US1] Update `backend/src/services/student.service.js` admin-create path: use `crypto.randomBytes(6).toString('hex')` to generate an 8-char temp password; set `mustChangePassword: true` on the new User; fire-and-forget `email.service.sendTempPassword` via `setImmediate` with a catch that calls `logger.error`; return the student without waiting for email
- [x] T024 [US1] Update `backend/src/services/teacher.service.js` admin-create path: same temp-password + `mustChangePassword: true` + fire-and-forget email pattern as T023
- [x] T025 [US1] Update `backend/src/services/auth.service.js` `loginUser` function: ensure the user object returned to the controller includes `mustChangePassword` — verify the Mongoose `toJSON` transform or explicit field selection does not strip the field; if it does, add `mustChangePassword` to the select or projection
- [x] T026 [US1] Add forgot-password, reset-password, and change-password routes to `backend/src/routes/auth.routes.js`: `POST /forgot-password` (public), `POST /reset-password` (public + validator for token + newPassword ≥ 8 chars), `PUT /change-password` (authenticate + schoolScope + authorize(['student','teacher']) + validator for currentPassword + newPassword ≥ 8 chars different from current)
- [x] T027 [US1] Add `PUT /password` route to `backend/src/routes/student.routes.js` and `backend/src/routes/teacher.routes.js` — both delegate to `passwordReset.service.changePassword(req.user._id, currentPassword, newPassword)`; same middleware chain as other protected routes
- [x] T028 [US1] Create `backend/tests/integration/password.reset.test.js` covering: forgot-password with valid email (200, token created); with unknown email (200, no enumeration); reset with valid token (200, password updated, token marked used); reset with expired token (400); reset with already-used token (400); change-password with correct current (200, mustChangePassword cleared); change-password with wrong current (401); nodemailer transport mocked using `jest.mock` or a custom transport spy
- [x] T029 [US1] Create `frontend/src/pages/ChangePassword.jsx` — form with `currentPassword`, `newPassword`, `confirmPassword` fields; validates `newPassword === confirmPassword` client-side; calls `PUT /auth/change-password` via axiosInstance; on 200 dispatches a success toast via `showToast` and navigates to the role dashboard; on 401 shows "Current password is incorrect" inline error; uses `motion.div` with `fadeInUp`
- [x] T030 [US1] Update `frontend/src/pages/Login.jsx`: after a successful login response, if `user.mustChangePassword === true`, redirect to `/${schoolSlug}/change-password` before any other navigation; extract redirect logic into a clear `handlePostLogin(user)` helper inside the component
- [x] T031 [US1] Add `/change-password` route in `frontend/src/App.jsx` inside the school-scoped group (accessible to both student and teacher): `<Route path="change-password" element={<ChangePassword />} />` — wrap in `<ProtectedRoute />` (unauthenticated users trigger login modal) but do **not** add a role-specific prop since both student and teacher access this route; role enforcement is handled entirely by the backend `authorize(['student','teacher'])` guard
- [x] T058 [US1] Create `frontend/src/pages/ForgotPasswordPage.jsx` — a page with a single email input and "Send Reset Link" button; calls `POST /auth/forgot-password` via axiosInstance; on any 200 response (success or unknown email) shows "If that email is registered, you'll receive a reset link shortly" — never reveal whether the address exists; on network error shows an inline alert; uses `motion.div` with `fadeInUp` variant; add a public route `/forgot-password` (outside any school-scoped route group) in `frontend/src/App.jsx`; add a "Forgot your password?" link to this page from `LoginForm.jsx` and from `ChangePassword.jsx`
- [x] T059 [US1] Create `frontend/src/pages/ResetPasswordPage.jsx` — reads the raw token from the URL query param `?token=` using `useSearchParams()`; renders a form with `newPassword` and `confirmPassword` fields; validates match client-side; calls `POST /auth/reset-password` via axiosInstance on submit; on 200 shows "Password reset successfully" and navigates to the login page (use `lastSchoolSlug` from localStorage if set, else `/`); on 400 shows "This reset link is invalid or has expired" with a "Request a new link" anchor back to `ForgotPasswordPage` (satisfies US1 AS5); uses `motion.div` with `fadeInUp`; add a public route `/reset-password` in `frontend/src/App.jsx`; confirm that `passwordReset.service.js` (T022) constructs the email link as `${process.env.FRONTEND_URL}/reset-password?token=<rawToken>` where `FRONTEND_URL` is an env var
- [x] T060 [US1] Add rate limiting to `POST /auth/forgot-password`: run `cd backend && npm install express-rate-limit` and apply `rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })` as middleware on that specific route in `auth.routes.js` **before** the route handler; keyed by client IP — prevents brute-force email enumeration and SMTP quota exhaustion; update the `POST /auth/forgot-password` entry in `contracts/api.md` to reflect max 5 requests per 15 min per IP

---

## Phase 5: User Story 2 — Student Views Dynamic Exam Results (P1)

> Students can select an academic year and term, then view per-subject marks with pass/fail indicators. Year/term options are dynamically derived from real exam data for their school.

**Story goal**: A student navigates to `/schools/:slug/student/results`, selects 2024 from a year dropdown, picks "Term 1", and sees a card per subject with marks, percentage, and a Pass/Fail badge. If no result exists, the EmptyState component renders.

**Independent test**: `GET /student/exams/years` returns an array of years; `GET /student/exams?year=2024` returns exams for the student's class; `GET /student/results?examId=<id>` returns the result with per-subject pass/fail computed. Student from school B cannot access school A's exam years.

- [x] T032 [US2] Add student exam and results routes to `backend/src/routes/student.routes.js`: `GET /exams/years` → `exam.service.getDistinctYears`; `GET /exams` (query: `?year=`) → `exam.service.getExamsForStudent`; `GET /results` (query: `?examId=`) → `result.service.getStudentResult` — all with `authenticate + schoolScope + authorize('student')` chain
- [x] T033 [US2] Create `backend/tests/integration/student.results.test.js`: student sees own result for published exam; student cannot see another student's result; years endpoint only returns years with exams for that school; no result for selection returns 404 with expected message; cross-tenant assertion: student from school A gets 403/404 on school B exam endpoints
- [x] T034 [US2] Create `frontend/src/pages/student/ResultsPage.jsx`: on mount call `getExamYears()` and populate a `<select>` year dropdown; on year change call `getExamsForYear(year)` and render term pills (one pill per unique term with `term` as label, `examId` as value); on term pill click call `getStudentResult(examId)` and render one `motion.div` card per subject showing subject name, `marksObtained / totalMarks`, `(marksObtained/totalMarks*100).toFixed(1)%`, a progress bar using `var(--school-primary)` fill, and a "Pass" (green badge) or "Fail" (red badge) badge; render a summary row with `result.overallPercentage` and `result.rank ?? '—'`; render `<EmptyState title="No results yet" message="Results for this term haven't been published yet." />` when no result is returned; all cards animate with `staggerContainer` + `fadeInUp` variants from `animationVariants.js`
- [x] T035 [US2] Add results route in `frontend/src/App.jsx` inside the student route group: `<Route path="results" element={<ResultsPage />} />` (keep the existing `marks` route untouched for backward compat)
- [x] T036 [US2] Add "My Results" nav item to the student `Sidebar` component with a link to `results`; it should sit adjacent to (or replace) any existing "My Marks" item; do not remove the old marks link if other components depend on it

---

## Phase 6: User Story 4 — Friendly Empty States Across Student Sub-sections (P2)

> All student dashboard sub-sections gracefully handle empty data with helpful messages and icons rather than blank or broken screens.

**Story goal**: A fresh student account can open Timetable, Attendance, and Announcements with zero data — each page renders an `EmptyState` with an icon, a title, and a helpful message. No console errors.

**Independent test**: Render `<EmptyState />` with no props — existing message-only usage still works. Render with `icon={<SomeIcon />}` and `title="Foo"` — icon and title appear above the message. Render `TimetablePage` in a test with an empty timetable — `EmptyState` renders with the correct title.

- [x] T037 [US4] Enhance `frontend/src/components/common/EmptyState.jsx`: add optional `icon` prop (React node, rendered above title if provided) and optional `title` prop (string, rendered as `<p className="font-semibold text-gray-700 mt-2">` between icon and message); all existing call sites continue to work unchanged since both props default to `undefined`
- [x] T038 [P] [US4] Apply `EmptyState` in `frontend/src/pages/student/TimetablePage.jsx`: replace any existing `<p className="text-gray-500">No timetable...</p>` or blank render with `<EmptyState title="No timetable set yet" message="Your school admin will add your class schedule soon." />`
- [x] T039 [P] [US4] Apply `EmptyState` in `frontend/src/pages/student/AttendancePage.jsx`: replace any blank-or-zero render with `<EmptyState title="No attendance records yet" message="Attendance will appear after your first class." />`
- [x] T040 [P] [US4] Apply `EmptyState` in the announcements sub-page (check `frontend/src/pages/student/` for the announcements page filename): replace blank render with `<EmptyState title="No announcements yet" message="Your teachers will post updates and notices here." />`

---

## Phase 7: User Story 5 — Login Modal Overlay (P2)

> Auth-gated navigation triggers a modal overlay instead of a full-page redirect. Escape, backdrop click, and X button close it. After login, the user stays on the same page.

**Story goal**: A logged-out user on the school home page clicks "My Profile" in the Navbar — a modal appears over the page with no URL change. The user logs in. The modal closes. They are on the same page they were on.

**Independent test**: `uiSlice` initial state has `loginModal: { isOpen: false, redirectTo: null }`; dispatching `openLoginModal({ redirectTo: '/foo' })` sets `isOpen: true` and `redirectTo: '/foo'`; dispatching `closeLoginModal()` resets both. `LoginModal` renders into `document.body` (check with `getByRole` queries outside the normal render container). Pressing Escape fires `closeLoginModal`.

- [x] T041 [US5] Add `loginModal: { isOpen: false, redirectTo: null }` to initial state in `frontend/src/redux/slices/uiSlice.js`; add `openLoginModal(state, action)` reducer that sets `isOpen: true, redirectTo: action.payload?.redirectTo ?? null`; add `closeLoginModal(state)` reducer that resets `isOpen: false, redirectTo: null`; export `selectLoginModal` selector
- [x] T042 [US5] **Depends on T030 being complete.** Extract the login form (fields, validation, submit handler, API call) from `frontend/src/pages/Login.jsx` into `frontend/src/components/common/LoginForm.jsx` that accepts `onSuccess(user)` and optional `onCancel` props; `Login.jsx` imports `LoginForm` and wraps it in its page layout; the form previously in `Login.jsx` is removed and replaced with `<LoginForm onSuccess={handlePostLogin} />`; the `handlePostLogin` callback (including the `mustChangePassword → redirect-to-change-password` branch added in T030) MUST live inside `LoginForm.jsx` — not in `Login.jsx`'s page wrapper — because `LoginModal.jsx` (T043) reuses `LoginForm` and requires the same post-login logic
- [x] T043 [US5] Create `frontend/src/components/common/LoginModal.jsx`: uses `ReactDOM.createPortal(content, document.body)`; reads `selectLoginModal` from Redux; renders only when `isOpen === true`; backdrop element is `<div className="fixed inset-0 bg-black/50 z-50" onClick={() => dispatch(closeLoginModal())} />` — the `onClick` on the backdrop satisfies US5 AS3 (click outside closes modal); panel is `<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>` — `stopPropagation` prevents clicks inside the panel from bubbling to the backdrop; contains `<LoginForm onSuccess={handleModalSuccess} onCancel={() => dispatch(closeLoginModal())} />`; `handleModalSuccess(user)` dispatches `closeLoginModal()` then if `mustChangePassword` redirects to change-password else navigates to `redirectTo ?? location.pathname`; `useEffect` attaches `keydown` listener for Escape → `closeLoginModal`; `AnimatePresence` + `motion.div` for entrance/exit
- [x] T044 [US5] Update `frontend/src/components/common/ProtectedRoute.jsx`: when the user is not authenticated, dispatch `openLoginModal({ redirectTo: location.pathname })` and render `null` (or a loading spinner) instead of calling `navigate('/login')`
- [x] T045 [US5] Update `frontend/src/components/common/Navbar.jsx`: any click on an auth-gated element (avatar, "My Profile", or any protected nav link) while `!isAuthenticated` should dispatch `openLoginModal()` instead of navigating to `/login`
- [x] T046 [US5] Render `<LoginModal />` in `frontend/src/App.jsx` at the root level, outside `<Routes>`, so it is always mounted and can receive Redux state from any page

---

## Phase 8: User Story 6 — School Slug Branding Before Login (P2)

> School name, logo, and primary colour are visible as soon as the page loads for a slug URL — even before the user authenticates.

**Story goal**: Opening `/schools/greenwood-high/login` in a logged-out browser shows the school name in the Navbar and the school logo in the Sidebar header. The `--school-primary` CSS variable is set. All of this happens with no login required.

**Independent test**: `GET /api/v1/public/schools/greenwood-high/config` response body does NOT include `isActive`. `Navbar` renders `schoolSlice.name` when the Redux store has that state populated; when `schoolSlice.name` is null, the SkeletonCard placeholder renders instead of the school name.

- [x] T047 [US6] Update `frontend/src/components/common/Navbar.jsx`: replace any hardcoded `"SchoolMS"` string with `useSelector(selectSchoolName) ?? 'SchoolMS'`; if `selectSchoolBranding()?.logoUrl` is set, render `<img src={branding.logoUrl} alt={schoolName} className="h-8 w-auto" />` in place of the text; if `schoolName` is null (still loading), render a `SkeletonCard` line in that position
- [x] T048 [US6] Update `frontend/src/components/common/Sidebar.jsx`: add a school header block at the very top of the sidebar (above nav items): if `branding.logoUrl` exists render the logo image; else render the school name as `<span className="font-bold" style={{ color: 'var(--school-primary)' }}>`; if `schoolName` is null show a single `SkeletonCard` placeholder row; this block is visible to all roles and in logged-out school pages
- [x] T061 [US6] Create `frontend/src/pages/SchoolNotFoundPage.jsx` — a simple centered page with heading "School not found", message "We couldn't find a school at this URL. Please check the link or ask your school admin for the correct address.", and a "Go to Home" button (`<Link to="/">`); in the component or hook that fires `GET /api/v1/public/schools/:slug/config` (likely `SchoolBrandingProvider` or a route-level `useEffect`), handle a 404 response by rendering `<SchoolNotFoundPage />` (or navigating to a `/school-not-found` route with `replace: true`) instead of the normal app layout; add a corresponding catch route in `App.jsx`; this satisfies FR-008 and US6 AS4 — verify with a test that rendering a slug-based route with an invalid slug shows this page rather than a blank or broken screen

---

## Phase 9: User Story 7 — Returning User Directed to Their School Portal (P3)

> After a successful login, the school slug is persisted to localStorage. The next visit to `/` redirects the user to their school context automatically.

**Story goal**: A student logs in and closes the tab. They come back and go to `/`. They are shown a "Return to Greenwood High School" link to `/schools/greenwood-high/login` (or redirected straight to dashboard if still authenticated).

**Independent test**: After `handlePostLogin(user)` runs, `localStorage.getItem('lastSchoolSlug')` is the slug from the user's school. `Home.jsx` with `lastSchoolSlug = 'test-school'` in localStorage and `isAuthenticated: true` causes a navigate call to `/schools/test-school/student/dashboard`. With `isAuthenticated: false`, a "Return to your school" link renders. Without `lastSchoolSlug` set, no redirect and no link.

- [x] T049 [US7] Update `frontend/src/pages/Login.jsx`: in `handlePostLogin(user)` (or equivalent success callback), call `localStorage.setItem('lastSchoolSlug', schoolSlug)` where `schoolSlug` comes from the URL param `:slug` via `useParams()` before navigating to the dashboard
- [x] T050 [US7] Update `frontend/src/pages/Home.jsx`: at component mount, read `const slug = localStorage.getItem('lastSchoolSlug')`; if truthy and `isAuthenticated` → `navigate(`/schools/${slug}/${user.role}/dashboard`, { replace: true })`; if truthy and NOT authenticated → render a `<Link to={`/schools/${slug}/login`}>Return to your school portal</Link>` button; if falsy → render the existing generic home content unchanged
- [x] T051 [US7] Add `localStorage.removeItem('lastSchoolSlug')` to the logout handler: find where `clearCredentials` is dispatched (Navbar logout button or auth thunk) and add the localStorage removal before or after the dispatch; also call this in `LoginModal.jsx`'s `handleModalSuccess` flow if `mustChangePassword` causes redirect to change-password (avoid stale slug on account-lockout scenarios)

---

## Phase 10: User Story 8 — Personalised Dashboard Home (P3)

> Student and teacher dashboard home screens display a personalised greeting banner with the school's primary colour, school branding in sidebar, and stat cards appropriate to each role.

**Story goal**: A student with populated data logs in. Dashboard shows "Good morning, Alice" with today's date, a school-primary-colour left accent, stat cards for upcoming exams and attendance, and the school name/logo in the sidebar header (covered by US6). Teacher sees "Good morning, Mr. Smith" with quick-action buttons. Below 640px, all cards stack to a single column.

**Independent test**: `StudentDashboard` rendered with a mock Redux store (`user.name = 'Alice Smith'`, `schoolSlice.name = 'Test School'`) at 09:00 shows "Good morning, Alice". Rendered at 14:00 shows "Good afternoon". Snapshot shows `border-l-4` class on the banner div. Mocked `matchMedia` for 320px viewport — all stat cards have `flex-col` or `grid-cols-1`.

- [x] T052 [US8] Update `frontend/src/pages/student/StudentDashboard.jsx`: add a greeting banner `<motion.div>` at the top using `fadeInUp` variant; banner has `border-l-4 pl-4 py-2` with `style={{ borderColor: 'var(--school-primary)' }}`; displays `"Good {getTimeOfDay()}, {user.name.split(' ')[0]}"` where `getTimeOfDay()` returns `'morning'` (5–11), `'afternoon'` (12–16), or `'evening'` (17–4); displays today's date formatted via `Intl.DateTimeFormat`; while `schoolName` is null renders `<SkeletonCard />` in place of the full banner; **Upcoming exam stat card (US8 AS4)**: on mount call `getExamsForYear(new Date().getFullYear())` (endpoint defined in T032), find the first exam whose term has not yet passed (or the earliest if no date metadata — sort by term label ascending), display its name as the stat card value with label "Next Exam" — if none show "No upcoming exams"; **Recent Results card (US8 AS5)**: from the same exam list pick the exam with the most recent `publishedAt`, call `getStudentResult(examId)` (endpoint from T035), render up to 3 entries from `result.marks` as compact rows (subject name + percentage) with the card header linked to the `/results` route; skip this card entirely if no result is returned (no error state on the dashboard home — only show when data exists)
- [x] T053 [US8] Update `frontend/src/pages/teacher/TeacherDashboard.jsx`: add the same greeting banner pattern from T052; add two primary-colour action buttons (`style={{ backgroundColor: 'var(--school-primary)' }}`): "Mark Today's Attendance" (links to attendance route) and "Post Announcement" (links to announcements route); add a stat card showing total students in the teacher's assigned class (fetch count from the existing classes API or attach to the teacher dashboard data fetch)
- [x] T054 [US8] Apply school primary colour to stat card value text in `frontend/src/pages/student/StudentDashboard.jsx`: for the key numeric stat values (attendance rate, upcoming exam count), add `style={{ color: 'var(--school-primary)' }}` to the value `<span>` element; ensure all stat cards are inside a responsive grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`) so they stack below 640px

---

## Phase 11: Polish & Cross-Cutting Concerns

> Final verification pass for security, accessibility, and mobile responsiveness across all new code.

- [x] T055 Audit all new backend routes: verify each new route in `auth.routes.js`, `admin.routes.js`, `student.routes.js`, and `teacher.routes.js` has the correct `authenticate + schoolScope + authorize(role)` chain in place; public routes (`forgot-password`, `reset-password`) have NO auth middleware; document any discrepancy found
- [x] T056 Verify mobile responsiveness of `ResultsPage.jsx`, `ExamsPage.jsx`, `ResultEntryPage.jsx`, and both dashboard greeting banners: confirm year dropdown + term pills stack vertically on narrow viewports; confirm result cards use single-column grid below 640px; confirm the `ResultEntryPage` table has horizontal scroll (`overflow-x-auto`) on mobile
- [x] T057 Verify no `req.body.schoolId` references were introduced in any new controller or service — run `grep -r "req.body.schoolId" backend/src` and resolve any matches found

---

## Dependencies (User Story Completion Order)

```
Phase 2 (Foundational)
    │
    ├─── Phase 3 (US3: Admin Exam) ──── Phase 5 (US2: Student Results)
    │
    └─── Phase 4 (US1: Password Reset)

Phase 6 (US4: Empty States)   ← no dependencies, start any time
Phase 7 (US5: Login Modal)    ← no dependencies, start any time
Phase 8 (US6: School Branding)← no dependencies, start any time
Phase 9 (US7: Returning User) ← depends on Phase 8 (school slug present in state)
Phase 10 (US8: Dashboards)    ← depends on Phase 8 (school primary colour in CSS var)

Phase 11 (Polish)             ← after all phases complete
```

**Mandatory cross-tenant assertions** (constitution requirement):
- T016 (admin.exams.test.js): school A admin cannot read school B's exams or results
- T033 (student.results.test.js): student from school A cannot access school B's exam endpoints

---

## Parallel Execution Examples

**Day 1 — can all start in parallel after T001–T002**:
- T003 (User model) + T004 (PasswordResetToken model) + T005 (Exam model) + T006 (Result model) + T007 (mailer.js) + T008 (school.service fix)

**Within Phase 3 — after T011+T012 (services exist)**:
- T013 (exam.controller) + T014 (result.controller) in parallel
- T018 (ExamsPage) + T019 (ResultEntryPage) in parallel

**Within Phase 6 — all fully parallel**:
- T038 (TimetablePage) + T039 (AttendancePage) + T040 (AnnouncementsPage) in parallel (after T037)

**Frontend Phases 6–9 — mostly parallel with backend Phases 3–4**:
- Backend Phases 3–4 in progress → frontend engineer takes Phases 6 + 7 + 8 + 9 simultaneously

---

## Implementation Strategy

**MVP scope (implement first — unblocks everything else)**:
1. Phase 1 + 2 (setup + foundation)
2. Phase 3 US3 backend only (T009–T016) — enables result data creation
3. Phase 4 US1 backend only (T021–T028) — enables account creation with passwords
4. Phase 5 US2 backend only (T032–T033) — closes the student data read cycle

Once backend Phases 3–5 are done, all three P1 user stories are testable via API. Then add frontend in parallel.

**Incremental delivery order**:
- Sprint A: Phases 1–4 (all backend, all P1)
- Sprint B: Phases 5–8 (US2 frontend, empty states, login modal, branding)
- Sprint C: Phases 9–10 (returning user, dashboard redesign)
- Sprint D: Phase 11 (polish + audit)
