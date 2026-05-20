# Feature Specification: School Portal Identity & Student/Teacher UX Overhaul

**Feature Branch**: `004-school-portal-ux`
**Created**: 2026-05-18
**Status**: Draft

## Overview

This feature bundle transforms the generic school management SaaS into a branded school portal experience. It covers six interconnected areas: password reset via email, student dashboard sub-section fixes with a dynamic marks/exam module, login modal overlay behaviour, school slug-based identity throughout the URL and branding system, and a complete redesign of the student and teacher dashboard home screens to feel like a real school portal.

---

## User Scenarios & Testing

### User Story 1 — Student/Teacher Receives and Resets Temporary Password (Priority: P1)

A school admin creates a new student or teacher account. The system assigns a temporary password and emails it to the user's registered Gmail address. The user logs in with the temporary password, is prompted to change it, and sets a new permanent password.

**Why this priority**: Without working account creation and first-login flow, no other portal experience can begin. This unblocks all downstream user journeys.

**Independent Test**: A new student account can be created by the school admin, the student receives an email with a temporary password, logs in, and successfully changes their password — constituting a complete onboarding flow.

**Acceptance Scenarios**:

1. **Given** the school admin is on the "Add Student" or "Add Teacher" form, **When** they submit the form with the student's name and email, **Then** the system creates the account with a system-generated temporary password and sends that password to the provided email address.
2. **Given** a student has received a temporary password email, **When** they log in with it, **Then** the system recognises the account is in "password reset required" state and redirects them to the change-password screen before entering the dashboard.
3. **Given** a student or teacher is on the change-password screen, **When** they enter a new password that meets minimum requirements and confirm it, **Then** the password is updated and they are taken to their dashboard.
4. **Given** a student or teacher wants to reset a forgotten password, **When** they request a password reset with their email, **Then** they receive a reset link via email valid for 1 hour.
5. **Given** a reset link is expired or already used, **When** the user clicks it, **Then** they see a clear message that the link is invalid and a prompt to request a new one.

---

### User Story 2 — Student Views Marks for a Selected Exam Year and Term (Priority: P1)

A student selects the academic year and term from their marks page to view their exam results. Each result card shows the subject, marks obtained out of the total, percentage, and a pass/fail indicator. If no result exists for the selection, a friendly empty state is shown.

**Why this priority**: Marks are the core academic record students and parents need most. A non-functional marks section is the most visible gap in the current student dashboard.

**Independent Test**: A school admin creates an exam for Term 1, 2024 with two subjects; a result entry is added for a specific student. That student logs in, navigates to Marks, selects 2024 and Term 1, and sees their result cards correctly.

**Acceptance Scenarios**:

1. **Given** a student is on the Marks page, **When** they open the year selector, **Then** only years for which at least one exam exists for their school are shown — no hardcoded years.
2. **Given** a student selects a year, **When** they view the term options, **Then** only terms with exams in that year for their school are shown as selectable filters.
3. **Given** a student selects a year and term that has a result, **When** the results load, **Then** each subject is shown as a card displaying: subject name, marks obtained / total marks, percentage, and a "Pass" or "Fail" badge (threshold: 35% unless school overrides it).
4. **Given** no result exists for the selected year and term, **When** the results area renders, **Then** an empty state component appears with a relevant message ("No results published for this term yet").
5. **Given** an overall percentage and rank are available on the result record, **When** the student views that term's results, **Then** a summary row shows their class rank and overall percentage.

---

### User Story 3 — Admin Creates an Exam and Enters Student Results (Priority: P1)

A school admin creates an exam record for a specific year and term with a list of subjects and their maximum marks. The admin (or teacher) then enters each student's marks for that exam.

**Why this priority**: No student result data exists without this admin action. This is the data-creation half of User Story 2.

**Independent Test**: The admin can create an exam, enter results for at least one student, and the student can then see those results — the full data cycle is verified end-to-end.

**Acceptance Scenarios**:

1. **Given** the school admin is on the Exams page, **When** they create a new exam with a name, year, term, and at least one subject (name + total marks), **Then** the exam is saved and appears in the exam list.
2. **Given** an exam exists, **When** the admin navigates to "Enter Results" for that exam, **Then** they see a list of all students in the selected class with input fields for each subject.
3. **Given** an admin enters marks for a student and saves, **When** the student views that term in their marks page, **Then** their entered marks appear correctly.
4. **Given** an admin tries to enter marks greater than the subject's total marks, **When** they attempt to save, **Then** the form rejects the entry with a validation message.

---

### User Story 4 — Student Dashboard Shows Friendly Empty States for Timetable, Attendance, and Announcements (Priority: P2)

When a student navigates to any sub-section of their dashboard (Timetable, Attendance, Announcements) before the admin has populated data, instead of a broken screen or loading spinner, they see a clear friendly empty state with an icon and helpful message.

**Why this priority**: Prevents first-time users from seeing a broken product. A clean empty state maintains trust even before content exists.

**Independent Test**: A freshly-created student account with no existing data loads the Timetable, Attendance, and Announcements pages — each shows the appropriate empty state card without any errors or blank screens.

**Acceptance Scenarios**:

1. **Given** no timetable has been created for the student's class, **When** the student opens the Timetable page, **Then** they see a friendly empty state: an icon, title "No timetable set yet", and message "Your school admin will add your class schedule soon."
2. **Given** no attendance has been recorded for the student, **When** the student opens the Attendance page, **Then** they see a friendly empty state with message "No attendance records yet — check back after your first class."
3. **Given** no announcements exist for the student's school, **When** the student opens the Announcements page, **Then** they see an empty state with message "No announcements yet — your teachers will post updates here."
4. **Given** an empty state is displayed, **When** data later becomes available, **Then** the empty state is replaced by real content on the next visit or page refresh.

---

### User Story 5 — Login Modal Appears as an Overlay, Not a Page Navigation (Priority: P2)

When a logged-out user clicks a link or button that requires authentication (e.g. "My Profile" in the navbar), instead of being navigated away to a separate login page, a modal overlay appears on the current page. A close button and Escape key dismiss it. After login, the user stays on the same page (or is redirected to a previously-attempted protected route).

**Why this priority**: The current behaviour breaks the back-button flow and disorients users. Fixing this directly impacts first-time impressions.

**Independent Test**: A logged-out user on the school home page clicks "My Profile", the overlay modal appears without any URL change, the user logs in, and sees their profile — the home page URL was never changed.

**Acceptance Scenarios**:

1. **Given** a user is not logged in and clicks "My Profile" or another auth-gated element in the navbar, **When** the click fires, **Then** a login modal overlay appears over the current page without any route change.
2. **Given** the login modal is open, **When** the user clicks the X button in the top-right, **Then** the modal closes and the user is back on the page they were on.
3. **Given** the login modal is open, **When** the user clicks the semi-transparent background behind the modal, **Then** the modal closes.
4. **Given** the login modal is open, **When** the user presses the Escape key, **Then** the modal closes.
5. **Given** the login modal is open and the user successfully authenticates, **When** login completes, **Then** the modal closes and the user remains on the same page without a full redirect.
6. **Given** a user was redirected to a protected route and the modal opened, **When** they log in via the modal, **Then** they are taken to the protected route they originally requested.

---

### User Story 6 — School Slug in URL Loads School Branding Before Login (Priority: P2)

A school admin shares a link like `/schools/greenwood-high/login` with students and teachers. When any user opens that link — even before logging in — the school's name, logo, and primary colour are loaded from a public API and displayed on the login page and throughout the app.

**Why this priority**: The slug-based identity is what makes this a school portal rather than a generic SaaS tool. It directly addresses the user's stated concern about students feeling like they're on "some other business website."

**Independent Test**: Opening `/schools/greenwood-high/login` in a fully logged-out browser shows the school's name and logo on the login page without requiring authentication.

**Acceptance Scenarios**:

1. **Given** a URL contains a valid school slug, **When** the page loads, **Then** the app calls the public school info endpoint, retrieves name and branding, and renders the school's name in the header — before the user logs in.
2. **Given** the school has a logo URL configured, **When** the page loads, **Then** the school logo appears in the header instead of the generic app name.
3. **Given** the school has a primary colour configured, **When** the page loads, **Then** that colour is applied as the accent colour on buttons, the active sidebar item, and the banner — without requiring a page reload.
4. **Given** a URL contains an unknown/invalid slug, **When** the page loads, **Then** a "School not found" page is shown rather than a broken app.
5. **Given** a user is loading a slug-based page, **When** the school info is still loading, **Then** skeleton loaders appear in the header instead of missing content.

---

### User Story 7 — Returning User is Automatically Directed to Their School Portal (Priority: P3)

After a user logs in, their school's slug is saved to local storage. The next time they visit the app's root (`/`), they are automatically redirected to their school's dashboard rather than seeing a generic landing page.

**Why this priority**: Reduces friction for returning users (majority of daily usage) by preserving context across sessions. This is a convenience improvement, not critical path.

**Independent Test**: A student logs in via `/schools/abc-school/student/dashboard`, then opens a new browser tab and navigates to `/`. They are immediately redirected to `/schools/abc-school/student/dashboard`.

**Acceptance Scenarios**:

1. **Given** a user successfully logs in through a slug-based URL, **When** login completes, **Then** the school slug is persisted to local storage (`lastSchoolSlug`).
2. **Given** `lastSchoolSlug` is set in local storage and the user visits `/`, **When** the root route loads, **Then** they are redirected to `/schools/{lastSchoolSlug}/dashboard`.
3. **Given** the user logs out or their session expires, **When** they visit `/`, **Then** they are redirected to `/schools/{lastSchoolSlug}/login` (maintains school context, requires re-auth).
4. **Given** `lastSchoolSlug` is not set (first-time visitor), **When** they visit `/`, **Then** they see the generic landing page (no redirect).

---

### User Story 8 — Student and Teacher Dashboard Home Feels Like a School Portal (Priority: P3)

The student and teacher dashboard home screens are redesigned to feel like a branded school portal. A personalised greeting uses the student's/teacher's name. Stat cards show attendance, upcoming exams, unread announcements, and current term. Today's timetable is shown as a schedule. The school name appears in the sidebar header and in section headings.

**Why this priority**: This is the biggest perceived improvement in product quality but depends on all prior data plumbing being in place (marks, attendance, announcements working correctly first).

**Independent Test**: A student with populated data (attendance records, an upcoming exam, at least one announcement) logs in and sees a personalised greeting banner, at least one meaningful stat card, and today's timetable — all using the school's branding colours.

**Acceptance Scenarios**:

1. **Given** a student logs in, **When** the dashboard home loads, **Then** it displays "Good morning/afternoon/evening, [First Name]" with today's date, using the school's primary colour as the banner accent.
2. **Given** the school's branding is loaded in Redux, **When** any dashboard page renders, **Then** the sidebar top shows the school logo (or name if no logo) instead of a generic app label.
3. **Given** attendance data is available, **When** the student dashboard home loads, **Then** a stat card shows today's attendance status (Present/Absent/Not yet marked).
4. **Given** upcoming exams exist, **When** the student dashboard home loads, **Then** a stat card shows the next exam name and date.
5. **Given** at least three results exist, **When** the student views the dashboard home, **Then** a "Recent Results" card shows the last 3 subjects with their percentage, linked to the full Marks page.
6. **Given** a teacher logs in, **When** the teacher dashboard home loads, **Then** they see quick-action buttons for "Mark Today's Attendance" and "Post Announcement", plus a stat card for total students in their assigned class.
7. **Given** school branding is still loading, **When** the dashboard renders, **Then** skeleton loaders appear in the banner and stat card positions instead of blank space or layout shift.
8. **Given** the screen width is below 640 px, **When** the dashboard renders, **Then** all stat cards stack to a single column with no horizontal overflow.

---

### Edge Cases

- What happens when the school's email (SMTP) delivery fails during password reset? — The user sees a clear error message ("We couldn't send the email — please try again or contact your school admin") and no account state change occurs.
- What happens when a student selects a year that has exams but no result record for them specifically? — The empty state is shown ("No results published for you yet in this term").
- What happens when the `/schools/:slug/public` endpoint is called for a school with `isActive: false`? — Returns 404 to prevent deactivated schools from loading.
- What happens when the temporary password email bounces or is undeliverable? — The account is created regardless; the admin can resend or manually share the temporary password.
- What happens when a user manually navigates to `/schools/unknown-slug/login`? — "School not found" page with a link back to the home page.
- What happens if a student belongs to a class with no timetable record? — Empty state is displayed; no crash.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST send an email containing a temporary password to the student's or teacher's registered email address when a school admin creates their account.
- **FR-002**: The system MUST detect accounts in "password must be changed" state and redirect those users to a change-password screen immediately after login before any other navigation.
- **FR-003**: Students and teachers MUST be able to change their password from their profile settings while logged in.
- **FR-004**: The system MUST provide a "forgot password" flow that sends a time-limited reset link (1 hour) to the user's registered email address.
- **FR-005**: The system MUST expose a public endpoint at `GET /api/v1/public/schools/:slug/config` that returns only school name, logo URL, primary colour, and tagline — no sensitive data. (Note: the path `/schools/:slug/public` used elsewhere in this document is a draft shorthand; the canonical API path is `/api/v1/public/schools/:slug/config` as defined in `contracts/api.md`.)
- **FR-006**: The frontend MUST read the school slug from the URL path on every page load, call the public school info endpoint, and store the result in Redux (`schoolSlice`) before rendering content.
- **FR-007**: All school-specific frontend routes MUST follow the pattern `/schools/:slug/[role]/[section]`.
- **FR-008**: The system MUST display a "School not found" page when an unrecognised slug is accessed.
- **FR-009**: After a successful login, the system MUST persist the school slug to `localStorage` under the key `lastSchoolSlug` to support automatic redirect on subsequent visits.
- **FR-010**: The login overlay MUST be rendered as a portal above the current page — triggered by a Redux action — not by React Router navigation.
- **FR-011**: The login overlay MUST be dismissible via the close (X) button, clicking outside the modal, and pressing Escape.
- **FR-012**: The system MUST provide a reusable `EmptyState` component accepting `{ icon, title, message }` props, used consistently across all sections with no data.
- **FR-013**: Timetable, Attendance, and Announcements sub-sections of the student dashboard MUST render the `EmptyState` component when no data is available, rather than a blank or broken screen.
- **FR-014**: The admin MUST be able to create an Exam record with: name, academic year, term, and a list of subjects with total marks per subject — all scoped to the school.
- **FR-015**: The admin MUST be able to enter a Result record per student per exam, containing the marks obtained for each subject.
- **FR-016**: Students MUST be able to view their results filtered by academic year and term, where year and term options are dynamically derived from available exam records for their school.
- **FR-017**: Each result card MUST display: subject name, marks obtained / total marks, calculated percentage, and a pass/fail indicator (threshold default: 35%).
- **FR-018**: The student and teacher dashboard home screens MUST display a personalised greeting using the authenticated user's first name and today's date.
- **FR-019**: The dashboard home MUST use the school's primary colour (from `schoolSlice`) as a CSS custom property (`--school-primary`) applied to the banner accent, active sidebar items, and primary action buttons.
- **FR-020**: The sidebar header MUST display the school's name and logo from `schoolSlice` instead of the app name.
- **FR-021**: Where school branding data has not yet loaded, the dashboard header and stat card areas MUST show skeleton loaders rather than blank space.
- **FR-022**: Dashboard stat cards and content grids MUST be responsive — stacking to a single column on screens narrower than 640 px.

### Key Entities

- **Exam**: Represents one examination event for a school. Attributes: school (scoped), name, academic year (e.g. 2024), term (e.g. "Term 1"), list of subjects each with a name and maximum marks.
- **Result**: Represents a single student's outcome in one exam. Attributes: linked exam, linked student, school (scoped), array of subject marks (subject name, marks obtained), calculated overall percentage, optional rank.
- **PasswordResetToken**: A short-lived token linking to a user account. Attributes: user reference, hashed token value, expiry timestamp, used flag.
- **SchoolPublicInfo**: A read-only projection of the School document — only name, logo URL, primary colour, secondary colour, and tagline. No plan, billing, or ownership data.

### Multi-Tenancy Scope

- **Tenant Scope**: Single-school for all student, teacher, and admin data. Public school-info endpoint is slug-resolved with no authentication.
- **schoolId Required**: Yes — Exam, Result, and PasswordResetToken records all carry `schoolId`. All reads via protected endpoints must filter by `schoolId` extracted from `req.school` (set by `schoolScope` middleware), never from the request body.
- **Public URL Shape**: `/schools/:slug/` for all school-scoped frontend routes; `/api/schools/:slug/public` for the unauthenticated school-info endpoint.
- **Cross-Tenant Risk**: The year/term dropdown for marks must be built from exams scoped to the student's own school only. The public school-info endpoint must only return data for the requested slug's own school document.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A newly created student or teacher account receives a password email within 30 seconds of account creation in 95% of cases.
- **SC-002**: A student with existing result data can navigate from login to viewing their marks for a specific year and term in under 4 clicks.
- **SC-003**: Zero broken or blank screens appear when a student with no data visits any sub-section of their dashboard (Timetable, Attendance, Marks, Announcements).
- **SC-004**: The school's name and branding colours are visible on the login page before the user enters any credentials — confirmed by opening a slug-based login URL in a logged-out browser.
- **SC-005**: The login modal opens and closes without any URL change, confirmed by checking the browser address bar before and after opening the modal.
- **SC-006**: Returning users are redirected from the root URL to their school portal in under 1 second, based on locally stored slug.
- **SC-007**: Dashboard home screens (student and teacher) display at least one piece of personalised content (name, today's attendance, upcoming exam) on first load after account setup.
- **SC-008**: All dashboard layouts are usable on mobile screens (no horizontal scrollbar, no overlapping text) at 375 px viewport width.

---

## Assumptions

- Email delivery uses NodeMailer with a free SMTP provider (e.g. Gmail app password or similar). Deliverability SLA is best-effort; hard bounces are not tracked in v1.
- The temporary password is a randomly generated 8-character alphanumeric string. No SMS fallback is planned.
- Change-password is in scope for student and teacher roles only. School-admin and super-admin password change will be planned separately.
- The pass/fail threshold defaults to 35% unless a per-school or per-exam override is implemented later. v1 uses 35% globally.
- Rank on result cards is optional — it will only show if a `rank` field is populated on the Result record. Auto-calculation of rank across all students is out of scope for v1.
- The existing `schoolSlice` in Redux already holds `slug`, `name`, and `branding`. The public school-info endpoint completes this by populating it before login.
- The `/schools/:slug/public` endpoint will not be rate-limited in v1 (can be added if abuse is observed).
- Academic year is a plain integer (e.g. `2024`). Multi-year academic calendars (e.g. 2024–25) are out of scope.
- The teacher dashboard redesign shares the same stat-card and greeting pattern as the student dashboard but uses teacher-specific data (assigned classes, attendance marked today).
- Mobile responsiveness applies to viewports ≥ 375 px. Tablet-specific layouts are not required for v1.
- The existing `schoolScope` middleware ensures all data reads are already filtered by `schoolId`. This feature does not change that contract — it only adds new models that must follow the same pattern.
