# Research: School Portal Identity & Student/Teacher UX Overhaul

**Feature**: `004-school-portal-ux`  
**Date**: 2026-05-18  
**Status**: Complete — all unknowns resolved

---

## R-001: Email Delivery via NodeMailer

**Decision**: Use `nodemailer` with a free Gmail SMTP app-password (or any SMTP host configured via env vars).

**Rationale**: NodeMailer is the de-facto standard for Node.js email. It requires zero cost, has no rate-limit surprises for low-volume school apps, and configuration is fully env-var-driven so different deployments (dev, staging, prod) can use different providers without code changes.

**Implementation approach**:
- Add `nodemailer` to `backend/package.json`.
- Add a `backend/src/config/mailer.js` module that creates and exports a reusable transporter using env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Create `backend/src/services/email.service.js` with helper functions: `sendTempPassword(to, name, tempPassword)` and `sendPasswordResetLink(to, name, resetUrl)`.
- The service reads templates inline (no template engine needed at v1 — plain HTML string interpolation is sufficient).
- Errors from email sending MUST NOT roll back the account creation — they should be logged only.
- Dev environment can use `ethereal.email` (auto-create a test SMTP account) or a local SMTP mock.

**Alternatives considered**:
- **SendGrid / Mailgun SaaS**: Rejected — cost concern and API key coupling for a free-tier goal.
- **Embedding in a cron-based queue**: Rejected — over-engineering for v1 low-volume use.

---

## R-002: Temporary Password and First-Login Forced Change

**Decision**: Add `mustChangePassword: Boolean` (default `false`) to the `User` model. When a school admin creates a student or teacher account (admin-initiated creation), the backend generates a random 8-character alphanumeric temporary password, sets `mustChangePassword: true`, hashes and saves it, then sends it via email.

Authentication's POST `/auth/login` response will include `mustChangePassword: true` in the user payload. The frontend catches this flag and redirects the user to a dedicated change-password route before allowing access to the dashboard.

**Rationale**: A server-side flag on the user record is the simplest, tamper-proof mechanism. The flag is cleared server-side when the user updates their password, so it cannot be bypassed by client-side manipulation.

**Alternatives considered**:
- Forcing a password change via a one-time token URL (same as forgotten password): Rejected for the initial login case — too many steps for the admin-invited flow. Works better for forgotten password, which we address separately.
- No forced change (just recommend): Rejected — security risk, temporary passwords in email are inherently low-entropy.

---

## R-003: Password Reset Token via Email Link

**Decision**: Create a `PasswordResetToken` Mongoose model with fields: `{ userId, tokenHash, expiresAt, used }`. When a user requests a reset, generate a cryptographically random 32-byte token, store its SHA-256 hash in the collection, and send the raw token in the email URL as `?token=<raw>`. On reset, rehash the submitted token to look up the record.

**Rationale**: Storing the hash (not raw token) means a database breach doesn't let an attacker directly reset all accounts. TTL MongoDB index on `expiresAt` auto-deletes expired documents. Using a separate collection (rather than embedding in User) keeps the User model lean and allows compound queries without User document locking.

**Implementation**:
- Token expiry: 1 hour.
- The reset link format: `${FRONTEND_URL}/schools/${schoolSlug}/reset-password?token=${rawToken}`
- On use: mark `used: true` immediately before committing the new password hash.
- MongoDB TTL index: `expiresAt: 1` with `expireAfterSeconds: 0` handles cleanup.

**Alternatives considered**:
- Store raw token in User document: Rejected — enlarges User doc and exposes token in DB dumps.
- JWT-based reset token: Rejected — can't be invalidated without a blocklist (adds complexity).

---

## R-004: Change-Password Endpoint (Student & Teacher)

**Decision**: Add `PUT /api/v1/student/password` and `PUT /api/v1/teacher/password` endpoints, both protected by `authenticate + schoolScope + authorize(role)`. The request body contains `{ currentPassword, newPassword }`. The service verifies `currentPassword` against the stored bcrypt hash using `bcrypt.compare`, then hashes and saves `newPassword`. On success, clears `mustChangePassword: false`.

**Rationale**: Scoped by role route prefix for clarity and role-specific authorization. Reuses existing bcrypt infrastructure (BCRYPT_ROUNDS=12).

**Note**: School admin password change is deferred (noted in spec assumptions). Super-admin password change is also deferred.

---

## R-005: Exam and Result Data Models (Dynamic Marks Module)

**Decision**: Create two new tenant-scoped Mongoose models:

- **`Exam`**: `{ schoolId, name, year (Number), term (String enum: 'Term 1'|'Term 2'|'Term 3'|'Final'), subjects: [{ name, totalMarks, passMark }], classId (optional) }`. Represents one examination event.
- **`Result`**: `{ schoolId, examId, studentId, marks: [{ subject, marksObtained }], overallPercentage (Number, virtual or stored), rank (Number, optional) }`. Represents one student's outcome in one exam.

**Distinction from existing `Marks` model**: The existing `Marks` model (flat per-subject, per-class, per-student records with `examType: enum`) is used by the teacher's "enter marks" workflow. It's the operational/daily marks collection. The new `Exam`+`Result` system is for structured, admin-published academic results with year/term grouping. Both coexist — the scope narrows to `Exam`+`Result` for the student-facing marks view in this feature.

**Rationale**: Adding year+term semantics to the existing Marks model would require breaking changes to the existing schema and all existing marks-related tests. A new model keeps the feature isolated and independent.

**Year/term selector**: The frontend fetches distinct years from `GET /api/v1/student/exams/years`, then fetches terms for a selected year. This enables fully dynamic dropdowns without hardcoding.

**Alternatives considered**:
- Extend existing Marks model with `year` and `term` fields: Rejected — would break the existing `examType` enum logic and require migrating test data for 259 existing tests.
- Single flat `Result` document with embedded exam details: Rejected — duplicates exam metadata across all student result records.

---

## R-006: Login Overlay Modal vs. Full-Page Navigate

**Decision**: Add `loginModal: { isOpen: boolean, redirectTo: string | null }` to `uiSlice`. Create a `LoginModal.jsx` component that uses `ReactDOM.createPortal` to render into `document.body`. The modal contains the existing login form logic (extracted to a shared `LoginForm.jsx`). The full-page `/login` route continues to exist (uses `LoginForm.jsx` directly).

**Existing state**: `uiSlice` has `loading` and `toast` but no modal state. The `Login.jsx` is a full page navigated to via `react-router`. No portal/modal exists.

**Trigger change**: The profile link in `Navbar.jsx` currently navigates to `/login` for unauthenticated users. The fix dispatches `openLoginModal()` instead.

**ProtectedRoute change**: Instead of `navigate('/login')`, ProtectedRoute dispatches `openLoginModal({ redirectTo: currentPath })` and renders an empty container (or the wrapped route with a redirect guard).

**Post-login behaviour**: On successful login inside the modal, if `redirectTo` is set, navigate there; otherwise stay on the current page.

**Rationale**: Preserves page context (URL unchanged), eliminates the broken back-button experience, and follows modern UX conventions for auth gates.

**Alternatives considered**:
- Route-based modal (React Router 6 modal pattern with `<Dialog>`): Rejected — still changes the URL, doesn't address the back-button issue fully.
- Pure client-side `useState` modal in each auth-guarded component: Rejected — duplicates logic, not a system-level solution.

---

## R-007: School Public Info Endpoint

**Decision**: The endpoint `/api/v1/public/schools/:slug/config` **already exists** (added in feature 003). It uses `slugToSchool` middleware and `schoolService.getSchoolConfigBySlug`. It currently returns: `{ name, slug, isActive, branding }`.

**Gap found**: The spec says NOT to expose `isActive` on the public route. The current service returns it. **Action**: Remove `isActive` from the `getSchoolConfigBySlug` return value in `school.service.js`.

**Frontend `SchoolContextLoader`**: Already exists in `App.jsx` and dispatches `setSchoolConfig` when the `:slug` param is present. No change needed there — it already loads branding before render.

**Rationale**: `isActive` is operational metadata and could be used to infer school subscription status by scrapers. Removing it from the public endpoint closes this minor exposure.

---

## R-008: `lastSchoolSlug` Persistence for Returning Users

**Decision**: In `Login.jsx` (and inside `LoginModal.jsx`), after a successful login that returns a `schoolSlug`, call `localStorage.setItem('lastSchoolSlug', schoolSlug)`. On the root `/` route, read `lastSchoolSlug` from localStorage — if present and user is not yet authenticated, redirect to `/schools/${lastSchoolSlug}/login`; if authenticated, redirect to the appropriate dashboard path.

**Rationale**: Minimal implementation — no new infrastructure required. localStorage is persistent across sessions and tabs on the same browser.

**Alternatives considered**:
- Server-side session preference: Rejected — over-engineering for v1.
- Cookie: Rejected — localStorage is sufficient and simpler here (no backend needed).

---

## R-009: EmptyState Component Enhancement

**Decision**: The `EmptyState.jsx` component **already exists** at `frontend/src/components/common/EmptyState.jsx` but only accepts a `message` prop and uses a single hardcoded SVG icon. The plan is to **enhance** it to accept `{ icon, title, message }` where:
- `icon` is a React element (or string to map to a preset SVG)
- `title` is a bold heading line
- `message` is the sub-text
- All props are optional — backward-compatible defaults are preserved

**Rationale**: The existing component is used by the student `MarksPage` and potentially others. Enhancing it in-place preserves all existing usages while giving new pages richer empty states.

---

## R-010: Student and Teacher Dashboard Personalisation + School Branding in Sidebar

**Decision**:

**Greeting banner**: Add to both `StudentDashboard.jsx` and `TeacherDashboard.jsx`:
- "Good {morning/afternoon/evening}, {user.name}" — time-of-day derived via `Date` hours.
- Today's date formatted as "Monday, 18 May 2026".
- Banner left border accent uses `var(--school-primary)`.
- While school branding is loading, show a `SkeletonCard` (already exists in common components).

**Sidebar school identity**: `Sidebar.jsx` currently shows nothing about the school at the top. Add a school header: logo (from `schoolSlice.branding.logoUrl`) or school name (`schoolSlice.name`) as text fallback. This replaces or supplements "SchoolMS" branding in the sidebar header area.

**Navbar school name**: `Navbar.jsx` currently hardcodes "SchoolMS". Replace with `schoolSlice.name ?? 'SchoolMS'`.

**Student stat cards**: The existing `StudentDashboard.jsx` already has summary cards (`SummaryCard`). No full rebuild needed — enhance existing cards to use `var(--school-primary)` colour class and add "Today's attendance" and "Next exam" stat sources.

**Teacher dashboard**: `TeacherDashboard.jsx` needs a greeting banner and quick-action buttons ("Mark Today's Attendance", "Post Announcement") using the `navigate` calls already in place — wrap them in a redesigned action card layout.

**Rationale**: Maximum reuse of existing components; targeted enhancements only where the user's stated concerns apply.

---

## R-011: Admin Exam and Results Management UI

**Decision**: Add two new admin pages:
- `pages/admin/ExamsPage.jsx` — list, create, and view exams.
- `pages/admin/ResultEntryPage.jsx` — for a given exam, enter marks per student.

Both follow the existing admin page patterns (Layout wrapper, Framer Motion, useApi hook).

**Routes**: Add to `/schools/:slug/admin/` — `/exams` and `/exams/:examId/results`.

---

## Summary Table

| Unknown | Resolution | New Work |
|---------|-----------|----------|
| Email delivery mechanism | NodeMailer with SMTP env vars; `email.service.js` | Install package, create service + mailer config |
| Temp password + forced change | `mustChangePassword` on User; generate on admin create | User model change, new endpoint |
| Password reset via link | New `PasswordResetToken` model + email link | New model, 2 new endpoints, email template |
| Change-password endpoint | `PUT /student/password` + `PUT /teacher/password` | 2 new endpoints |
| Exam + Result data models | New `Exam` + `Result` models (separate from existing Marks) | 2 new models, 4+ new endpoints |
| Login modal overlay | `loginModal` state in uiSlice + `LoginModal.jsx` portal | New Redux state, new component, ProtectedRoute update |
| School public endpoint | Already exists — strip `isActive` from response | 1-line service change |
| LastSchoolSlug memory | localStorage in Login + redirect in `/` route | 2 small code additions |
| EmptyState enhancement | Enhance existing component — add icon + title props | Small component update |
| Dashboard personalisation | Greeting banner + school branding in navbar/sidebar | Targeted enhancements to existing pages |
| Admin exam/result UI | Two new admin pages | New pages + routes |
