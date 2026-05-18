# Feature Specification: Multi-School SaaS Platform

**Feature Branch**: `003-multi-school-saas`  
**Created**: 2026-05-17  
**Status**: Draft  
**Input**: Convert current single-school implementation to a multi-school slug-based SaaS platform with tenant isolation, dynamic branding, SaaS onboarding, and role-based access (super-admin / school-admin / teacher / student / parent).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — School Onboarding & Slug Registration (Priority: P1)

A school owner or administrator visits the platform, creates a new school account, chooses a unique slug (e.g., `lincoln-high`), and receives a fully isolated tenant workspace accessible at `lincoln-high.yourdomain.com` (or `/schools/lincoln-high`).

**Why this priority**: Without this, no other school-specific feature can be used. It is the entry point to the entire SaaS product and gates all downstream stories.

**Independent Test**: Can be fully tested by registering a new school via the onboarding form, receiving confirmation, and verifying the school's workspace is accessible at its slug URL with a correctly isolated database context.

**Acceptance Scenarios**:

1. **Given** no school exists with slug `sunrise-academy`, **When** a user submits the onboarding form with name "Sunrise Academy" and slug `sunrise-academy`, **Then** the system creates the school, returns a success response, and the school workspace is accessible at the slug URL.
2. **Given** a school with slug `sunrise-academy` already exists, **When** another user attempts to register with the same slug, **Then** the system rejects the request with a clear "slug already taken" message and suggests alternatives.
3. **Given** a user submits an invalid slug (e.g., `My School!`), **When** the form is submitted, **Then** the system rejects it with a validation message explaining slug format rules (lowercase, alphanumeric, hyphens only).
4. **Given** registration completes, **When** the school admin first logs in, **Then** they land on a dashboard scoped exclusively to their school with no data from other schools visible.

---

### User Story 2 — Cross-Tenant Data Isolation (Priority: P1)

Any user (admin, teacher, student) authenticated to School A cannot read or write data belonging to School B — even with a valid JWT — regardless of the API endpoint called.

**Why this priority**: P1 tie with onboarding — this is the foundational security requirement of multi-tenancy. A single data leak across tenants would be a critical breach.

**Independent Test**: Can be fully tested by creating two schools (A and B), authenticating as a School A user, and attempting to access School B's students, classes, attendance, and marks via direct API calls — all MUST return 403 or empty results, never School B's data.

**Acceptance Scenarios**:

1. **Given** a teacher authenticated to School A, **When** they call the students list endpoint, **Then** only School A students are returned.
2. **Given** a student authenticated to School A, **When** they attempt to fetch another school's timetable via URL manipulation, **Then** the system returns 403 Forbidden.
3. **Given** two schools share the same email domain for their users, **When** a School A admin calls any data endpoint, **Then** no School B records appear in any response.
4. **Given** a super-admin, **When** they access cross-school analytics, **Then** they see aggregated data but no individual student records without explicit per-school drill-down access.

---

### User Story 3 — Role-Based Access Control (5 Roles) (Priority: P1)

The platform supports 5 roles: Super-Admin (platform-wide), School-Admin (full school access), Teacher (own classes), Student (own records), Parent (child's records). Each role has clearly defined access boundaries enforced on every API call.

**Why this priority**: Without RBAC, all authenticated users would have unrestricted access within a tenant, which is a security and functional blocker.

**Independent Test**: Can be tested by creating one user of each role type, then verifying that each role can only access its permitted endpoints and is denied the others with 403.

**Acceptance Scenarios**:

1. **Given** a Teacher, **When** they attempt to access admin-only class management endpoints, **Then** the system returns 403 Forbidden.
2. **Given** a Student, **When** they access their own attendance and marks, **Then** the data is returned correctly.
3. **Given** a Parent linked to a specific student, **When** they access that student's records, **Then** they see only their child's data.
4. **Given** a Super-Admin, **When** they access any school's platform-management endpoints, **Then** they have full access; **When** they attempt to read individual student marks without audit trail, **Then** the system restricts it per constitution.
5. **Given** a School-Admin, **When** they attempt to access another school's admin endpoints, **Then** the system returns 403 Forbidden.

---

### User Story 4 — Dynamic School Branding (Priority: P2)

Each school can configure its own logo, primary/secondary colours, and school info (tagline, address, contact). These brand settings are surfaced on the school's public page, login screen, and authenticated dashboards.

**Why this priority**: Not a functional blocker, but directly impacts adoption — schools identify strongly with their brand and are more likely to adopt and recommend a product that reflects it.

**Independent Test**: Can be tested by updating a school's brand settings via the admin panel and verifying that the school's login page and public landing page reflect the correct logo and colour scheme, while another school's branding remains unchanged.

**Acceptance Scenarios**:

1. **Given** a School-Admin uploads a logo and sets a primary colour, **When** any user visits that school's login page, **Then** the logo and colour are displayed correctly.
2. **Given** a School-Admin updates branding, **When** another school's users visit their own login page, **Then** the other school's branding is completely unaffected.
3. **Given** no custom logo is set, **When** a user visits the school page, **Then** a default platform logo is displayed gracefully (no broken images).

---

### User Story 5 — MVP School Operations (Attendance, Fees, Homework, Results, Notifications) (Priority: P2)

Within an isolated school workspace, teachers can record attendance and homework, manage student results, and send notifications. School admin manages fees. Students and parents receive notifications.

**Why this priority**: This is the core value proposition of the product — what schools actually pay for. Branding alone doesn't retain users; functional features do.

**Independent Test**: Can be tested by creating a class in a school, enrolling students, recording attendance and marks, and verifying students and parents receive notifications — all scoped to that school's workspace.

**Acceptance Scenarios**:

1. **Given** a Teacher, **When** they mark attendance for their class, **Then** each student's attendance record is updated for that school only.
2. **Given** a School-Admin, **When** they create a fee record for a student, **Then** the student and parent are notified within the school's workspace.
3. **Given** a Teacher, **When** they upload homework for a class, **Then** all enrolled students can see the homework in their dashboard.
4. **Given** results are published for a class, **When** a Student or Parent logs in, **Then** they see the results on their dashboard.
5. **Given** a notification is sent by the School-Admin, **When** it is targeted to a role (e.g., all parents), **Then** only users of that role in that school receive it.

---

### User Story 6 — Subdomain / Slug-Based URL Routing (Priority: P2)

Each school is accessible via its unique slug in the URL, either as a subdomain (`lincoln-high.yourdomain.com`) or as a path segment (`/schools/lincoln-high`). The system resolves the school context from the URL for public routes and from the JWT for authenticated routes.

**Why this priority**: This is the identity and branding layer. The slug makes the product feel like a dedicated system to each school while being multi-tenant underneath.

**Independent Test**: Can be tested by visiting two different slug URLs and verifying each renders the correct school's public page with the correct branding and without cross-contamination.

**Acceptance Scenarios**:

1. **Given** a valid slug `sunrise-academy`, **When** a user visits `sunrise-academy.yourdomain.com` or `/schools/sunrise-academy`, **Then** the correct school's public page loads with its branding.
2. **Given** an invalid or non-existent slug, **When** a user visits the URL, **Then** a friendly "school not found" page is shown.
3. **Given** a public timetable at `/schools/sunrise-academy/timetable`, **When** an unauthenticated user visits it, **Then** the timetable for Sunrise Academy is shown with no authentication required.

---

### Edge Cases

- What happens when a school is deactivated by the Super-Admin? All its users should be denied login with a clear "school account suspended" message.
- What if a slug is changed after schools have shared the URL publicly? Slug MUST be immutable after first public use (as per constitution).
- What if a parent is linked to students in two different schools (e.g., siblings)? The parent has separate school-scoped sessions.
- What if the JWT's `schoolId` is tampered with? The `schoolScope` middleware validates `schoolId` against the database and rejects tokens with non-existent or inactive school IDs.
- What if two schools are created with very similar names that would generate the same slug? The system detects collision and appends a numeric suffix or prompts the user to pick a unique alternative.

---

## Requirements *(mandatory)*

### Functional Requirements

**Tenant Management:**
- **FR-001**: System MUST allow a new school to be onboarded via a self-service form that captures school name, desired slug, admin email/password, and contact details.
- **FR-002**: System MUST validate slug uniqueness in real-time (slug availability check endpoint) and enforce slug format (lowercase, alphanumeric, hyphens only, 3–50 characters).
- **FR-003**: System MUST create an isolated tenant workspace (School document + admin user) as a single atomic operation upon successful onboarding.
- **FR-004**: System MUST support school deactivation by Super-Admin; deactivated schools MUST block all user logins for that tenant.
- **FR-005**: System MUST store `schoolId` (ObjectId reference to School document) on every tenant-scoped record (students, teachers, classes, attendance, marks, timetable, announcements, fees, homework).

**Authentication & RBAC:**
- **FR-006**: System MUST embed `schoolId` in the JWT payload at login for school-scoped roles; super-admin JWT MUST NOT carry a `schoolId`.
- **FR-007**: System MUST enforce a 5-tier RBAC: super-admin, school-admin, teacher, student, parent — each with distinct permission sets enforced at the middleware layer.
- **FR-008**: System MUST reject any authenticated request where the JWT's `schoolId` does not match the school context of the requested resource (HTTP 403).
- **FR-009**: System MUST support a parent role that can be linked to one or more student records; a parent's data access is limited to their linked children's records within the same school.

**School Branding:**
- **FR-010**: System MUST allow School-Admin to set/update: school logo (image upload), primary colour, secondary colour, school tagline, address, and contact number.
- **FR-011**: System MUST store branding configuration per school and serve it via a public API endpoint (`/api/v1/schools/:slug/config`) without authentication.
- **FR-012**: System MUST fall back to platform default branding gracefully when a school has not configured custom branding.

**Slug & URL Routing:**
- **FR-013**: System MUST resolve school context from the URL slug (`/schools/:slug/...` or subdomain) for all public routes using `slugToSchool` middleware.
- **FR-014**: System MUST support wildcard subdomain routing at the DNS and server level (`*.yourdomain.com`) as an optional deployment configuration.
- **FR-015**: Slug MUST be immutable after the school's public URL has been shared (first login by a non-admin user triggers immutability lock).

**Core Operations (MVP):**
- **FR-016**: System MUST support attendance marking by teachers for their assigned classes, scoped to their school.
- **FR-017**: System MUST support fee record creation, tracking, and status updates by school admins.
- **FR-018**: System MUST support homework posting by teachers, visible to enrolled students.
- **FR-019**: System MUST support results/marks entry by teachers and read access by students and parents.
- **FR-020**: System MUST support in-platform notifications from school-admin or teachers to targeted roles within the school.

**Super-Admin:**
- **FR-021**: System MUST provide a super-admin portal with capabilities: school CRUD, subscription plan management, cross-school aggregated analytics (counts, activity), and school activation/deactivation.
- **FR-022**: Super-admin MUST NOT be able to read individual student records directly without an explicit audit-logged action.

### Key Entities *(include if feature involves data)*

- **School**: The top-level tenant entity. Fields: `_id`, `name`, `slug` (unique, immutable after lock), `plan` (free/standard/premium), `isActive`, `branding` (logo URL, primaryColor, secondaryColor, tagline, address, contact), `slugLockedAt`, `createdAt`, `updatedAt`.
- **User**: Polymorphic user with role enum (`super-admin` | `school-admin` | `teacher` | `student` | `parent`). All non-super-admin users carry `schoolId`.
- **ParentStudentLink**: Junction entity linking a parent User to one or more student Users within the same school. Fields: `parentId`, `studentId`, `schoolId`.
- **TenantConfig**: Per-school configuration/branding document (may be embedded in School or a separate document for easy caching). Fields: `schoolId`, `logoUrl`, `primaryColor`, `secondaryColor`, `tagline`, `address`, `contactNumber`.
- All existing entities (Student, Teacher, Class, Attendance, Marks, Timetable, Announcement) gain a mandatory `schoolId` field.
- **New**: `Fee` entity with `schoolId`, `studentId`, `amount`, `description`, `dueDate`, `status` (pending/paid/overdue).
- **New**: `Homework` entity with `schoolId`, `classId`, `teacherId`, `title`, `description`, `dueDate`, `attachments[]`.
- **New**: `Notification` entity with `schoolId`, `senderId`, `targetRole`, `title`, `body`, `createdAt`, `readBy[]`.

### Multi-Tenancy Scope *(mandatory)*

- **Tenant Scope**: Single-school (schoolId from JWT) for all school-scoped operations; Platform-wide (super-admin only) for school management.
- **schoolId Required**: Yes — all data reads/writes MUST include schoolId filter; only public slug-resolved routes and super-admin platform routes are exempt.
- **Public URL Shape**: `/schools/:schoolSlug/` prefix for unauthenticated routes (public timetable, branding config, registration).
- **Cross-Tenant Risk**: Parent-student linking must be validated to ensure parent and student belong to the same school; slug collision handling must not leak existence of other tenants; super-admin aggregated analytics must never return raw PII.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new school can be fully onboarded (registered, configured, first admin login) in under 5 minutes from the landing page.
- **SC-002**: Zero cross-tenant data leakage — automated cross-tenant isolation tests pass 100% in CI across all API endpoint categories.
- **SC-003**: Slug availability check responds in under 300ms; school onboarding form submission completes in under 3 seconds.
- **SC-004**: Each school's public page and login screen reflect the correct branding within 1 second of a branding update.
- **SC-005**: 90% of school admin users can complete adding their first student and recording attendance without assistance.
- **SC-006**: The platform supports at least 100 schools concurrently with no degradation in API response times (<500ms for standard queries).
- **SC-007**: Role-based access is correctly enforced — automated RBAC tests achieve 100% pass rate across all 5 role × endpoint combinations.
- **SC-008**: Parent-linked users can access their child's attendance and results within 2 taps/clicks from their dashboard.

---

## Assumptions

- **Slug approach selected over subdomain-only**: The primary public URL pattern is path-based (`/schools/:slug/`). Subdomain routing (`slug.domain.com`) is treated as an optional deployment enhancement, not a v1 requirement, to avoid DNS/SSL complexity blocking the MVP.
- **Existing single-school data migration**: All current data (students, teachers, classes, etc.) will be migrated to a default "seed school" document during deployment. A migration script will be provided as part of the 003 feature tasks.
- **Parent role is P2**: While specified in RBAC, the parent portal UI is a P2 deliverable; the backend permission model is P1 (built alongside school-admin/teacher/student).
- **WhatsApp/SMS notifications are out of scope for v1**: In-platform notifications only for MVP. WhatsApp integration is a future enhancement.
- **Mobile app is out of scope for v1**: The platform will be a responsive web app (mobile-first design). A native mobile app is a post-MVP deliverable.
- **Bus tracking, online exams, and AI report cards are out of scope for v1**: Listed as future enhancements.
- **Image storage**: School logos and homework attachments will be stored via a third-party object store (e.g., Cloudinary or S3-compatible service). The platform does not handle binary file storage directly.
- **Subscription/payment processing**: Plan tiers (free/standard/premium) are tracked in the database but payment gateway integration is out of scope for v1. Super-admin manually manages plan assignments.
- **Wildcard SSL/DNS for subdomain routing**: If subdomain routing is enabled, the deployment team will configure wildcard DNS (`*.yourdomain.com`) and a wildcard SSL certificate. This is infrastructure configuration, not application code.
- **Target market**: Small-to-medium schools and tuition centres in Tier 2/3 markets (Bihar focus) that currently use WhatsApp + Excel. Affordable pricing is a key product constraint.
