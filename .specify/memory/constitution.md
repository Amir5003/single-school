<!-- 
CONSTITUTION SYNC IMPACT REPORT - AMENDMENT 2 (2026-05-17)
Version: 2.0.0 (MAJOR Amendment)
Previous Version: 1.1.0
Ratified: 2026-04-07
Last Amended: 2026-05-17
Amendment Type: MAJOR — product scope redefined from single-school to multi-school SaaS platform

RATIONALE FOR MAJOR BUMP:
The product is fundamentally converting from a single-school system to a multi-tenant SaaS
platform serving multiple schools. This change:
- Redefines the entire data model (schoolId added to all tenant-scoped collections)
- Introduces a new School entity and slug-based identification
- Adds a new super-admin role with platform-wide access
- Makes the existing single-tenant architecture backward-incompatible
All previously valid deployments would require migration — hence MAJOR bump.

ORIGINAL PRINCIPLES (v1.1.0):
- I. Code Quality
- II. Testing Standards
- III. User Experience Consistency
- IV. Performance Requirements
- V. Security
- VI. Scalability
- VII. UI Animation & Modern Design

MODIFIED PRINCIPLES:
- V. Security: Added cross-tenant data isolation and super-admin RBAC requirements
- VI. Scalability: Redefined to mandate multi-tenant architecture, school slug approach,
  schoolId compound indexing, and stateless tenant resolution

NEW PRINCIPLE ADDED:
- VIII. Multi-Tenancy & School Isolation (slug-based URL identity + JWT-embedded schoolId
  for internal scoping; compound indexes; super-admin role)

SECTIONS UPDATED:
- Technology Stack & Architecture Standards: School model, schoolScope middleware,
  slug-based public routing, super-admin tier
- Development Workflow: Updated principle count references (seven → eight),
  added multi-tenancy as a Phase 2 foundational gate

TEMPLATES UPDATED:
- plan-template.md: Constitution Check references 8 principles ✅
- spec-template.md: Added multi-tenancy scope note ✅
- tasks-template.md: Added multi-tenancy as foundational gate requirement ✅

FOLLOW-UP TODOs:
- TODO(SLUG_MIGRATION): Existing single-school data will need a migration script to assign
  existing records to a default School document. Track in Phase 2 (002-multi-tenant-saas) tasks.
- TODO(SUPER_ADMIN_RATIFICATION_DATE): Confirm super-admin feature ratification with team
  before enabling in production.
-->

# MERN-based Multi-School Management Platform Constitution

## Core Principles

### I. Code Quality
**Non-Negotiable Requirements:**
- MUST use modular architecture with clear separation of concerns (controllers, services, models, middleware)
- MUST maintain consistent naming conventions across backend and frontend (camelCase for JS, snake_case for database fields)
- MUST design reusable components and utility functions to eliminate code duplication
- MUST follow REST API best practices: proper HTTP methods (GET, POST, PUT, DELETE), meaningful status codes, consistent endpoint naming

**Rationale:** Modularity enables maintainability at scale. Consistency reduces cognitive load for team members. Reusability accelerates feature delivery. REST adherence ensures API predictability across Admin, Teacher, and Student roles.

### II. Testing Standards
**Non-Negotiable Requirements:**
- MUST design each API endpoint to be independently testable with isolated test cases
- MUST implement basic unit testing for core business logic (authentication, enrollment, grading calculations)
- MUST validate all inputs at the API level before processing (type checking, required fields, format validation)
- MUST achieve minimum 70% code coverage for backend services and critical frontend utilities

**Rationale:** Independent test design prevents cascading failures. Unit tests catch logic errors early. Input validation is the first line of defense against invalid data and security exploits. Coverage metrics drive accountability.

### III. User Experience Consistency
**Non-Negotiable Requirements:**
- MUST maintain consistent UI layout across all three dashboards: Admin, Teacher, and Student (header, sidebar, main content area, footer)
- MUST provide simple, clean navigation with clearly labeled routes and breadcrumbs where applicable
- MUST provide explicit feedback for all user actions: success messages, error alerts with actionable guidance, loading states, confirmation dialogs for destructive actions

**Rationale:** Consistency reduces user learning curve and build trust. Clean navigation allows role-based users to find features intuitively. Clear feedback prevents user confusion and support tickets.

### IV. Performance Requirements
**Non-Negotiable Requirements:**
- MUST optimize API response times to <500ms for basic queries (student list, class schedule, attendance records)
- MUST implement pagination (limit 20-50 records per page) for all list endpoints returning >100 records
- MUST avoid unnecessary re-renders in React frontend (use React.memo, useMemo, useCallback for optimized components)
- MUST implement database indexing on frequently queried fields (student ID, class ID, academic year)

**Rationale:** Sub-500ms response times keep user interactions snappy. Pagination reduces memory strain for large datasets. Render optimization improves perceived responsiveness. Indexing scales database performance as data grows.

### V. Security
**Non-Negotiable Requirements:**
- MUST implement JWT-based authentication with secure token storage (httpOnly cookies, `secure: true`, `sameSite: 'none'` in production)
- MUST enforce role-based access control (RBAC) with four distinct roles: Super-Admin (platform-wide access, all schools), Admin (full access within their school only), Teacher (class and student data within their school), Student (own data only within their school)
- MUST protect all sensitive routes with middleware authentication checks on every request
- MUST NEVER log passwords or sensitive credentials; use encrypted fields for sensitive data at rest
- MUST validate and sanitize all user inputs to prevent injection attacks (SQL injection, XSS, NoSQL injection)
- MUST enforce cross-tenant isolation: no API endpoint SHALL return or modify data belonging to a school other than the one embedded in the authenticated user's JWT — this is a hard security boundary, not a best-effort check
- MUST validate `schoolId` at the service layer on every query, even when `req.schoolId` is derived from a trusted JWT, as defense-in-depth against middleware bypass
- MUST restrict super-admin endpoints to the super-admin role exclusively; no other role may access platform management routes

**Rationale:** JWT is industry standard for stateless authentication. Four-tier RBAC ensures strict data isolation between user types and between schools. Cross-tenant isolation is the single most critical security requirement for a multi-tenant SaaS platform — a breach here leaks data across all schools. Defense-in-depth at the service layer prevents single-point middleware failures from exposing tenant data.

### VI. Scalability
**Non-Negotiable Requirements:**
- MUST support multi-tenant architecture: every tenant-scoped collection (Student, Teacher, Class,
  ClassTeacher, Timetable, Attendance, Marks, Announcement) MUST carry a `schoolId` field
  (ObjectId reference to the School document) with a compound index on `(schoolId, <primary lookup field>)`
- MUST identify schools via a human-readable `slug` field (URL-safe, lowercase, hyphenated, globally unique,
  e.g., `lincoln-high`). The slug is used in public-facing URLs (`/schools/:schoolSlug/...`);
  internal authenticated routes resolve school context from `schoolId` embedded in the JWT
- MUST embed `schoolId` in the JWT payload at login so all authenticated requests carry tenant context
  without relying on URL parameters — reduces attack surface and simplifies middleware
- MUST implement a `schoolScope` middleware that attaches `req.schoolId` from the JWT on every
  authenticated request; all service-layer queries MUST include `schoolId: req.schoolId` as an
  implicit filter (no service function may query tenant-scoped collections without it)
- MUST design database schemas to accommodate future extensions (fees management, exam results,
  notification system) with `schoolId` already present to avoid costly schema migrations
- MUST keep services loosely coupled through well-defined APIs and minimal cross-service dependencies
- MUST implement soft delete patterns where historical records are needed (student enrollments, grade changes)
- MUST structure code to support horizontal scaling (stateless services, database replication ready)
- MUST support a super-admin portal that can manage school onboarding, subscription status, and
  cross-school analytics without being scoped to any single `schoolId`

**Rationale:** Multi-tenancy is the foundational architectural requirement as of v2.0.0. Slug-based
public identity gives each school a clean canonical URL. JWT-embedded schoolId prevents URL-parameter
spoofing and centralises tenant resolution in a single trusted location. Compound indexes ensure
queries remain fast as the number of schools and records grows. Stateless design enables horizontal
scaling of API servers.

### VII. UI Animation & Modern Design
**Non-Negotiable Requirements:**
- MUST implement thoughtful animations for all Student module features (page transitions, form submissions, list updates, feedback indicators)
- MUST prioritize animation in Student dashboard: smooth scrolling, micro-interactions on buttons, loading animations, success/error feedback animations
- MUST follow modern web design standards: responsive layouts (mobile-first), contemporary color schemes, accessible typography, clean whitespace usage
- MUST use consistent animation timing and easing functions across all components (200ms-400ms for micro-interactions, 300ms-600ms for page transitions)
- MUST ensure animations are performant (60fps target) and do not interfere with accessibility (respect prefers-reduced-motion)
- MUST apply UI polish to all role-based dashboards (Admin, Teacher, Student) with professional, modern visual hierarchy

**Special Student Module Requirements:**
- MUST include entrance animations for cards showing assignments, grades, attendance, schedule
- MUST provide animated feedback for student actions (enrollment confirmation, assignment submission, grade viewing)
- MUST design intuitive animated navigation that makes student features feel responsive and engaging
- MUST use modern design patterns: glassmorphism, smooth gradients, subtle shadows, micro-interactions on hover/focus

**Rationale:** Animations enhance perceived performance and user engagement. Student module benefits most from polish as it's the primary user-facing interface. Modern design attracts and retains users. Performance and accessibility ensure animations don't harm UX. Consistent timing creates professional feel.

### VIII. Multi-Tenancy & School Isolation

**Non-Negotiable Requirements:**

**School Identity & Slug:**
- MUST define a `School` document with fields: `_id` (ObjectId), `name` (string), `slug`
  (unique URL-safe string, e.g., `springfield-elementary`), `plan` (enum: `free|standard|premium`),
  `isActive` (boolean), `createdAt`, `updatedAt`
- The `slug` MUST be generated at school creation (lowercase, hyphen-separated, derived from name),
  MUST be immutable after first use in public URLs, and MUST be globally unique at the platform level
- MUST expose school-specific public pages at `/schools/:schoolSlug` (registration form, timetable,
  announcements) — no authentication required for read-only public routes
- MUST NOT use the slug as the primary database key for tenant scoping; always resolve slug →
  `schoolId` (ObjectId) at the route/middleware layer and use `schoolId` in all DB queries

**Tenant Data Isolation:**
- Every tenant-scoped model MUST declare `schoolId: { type: ObjectId, ref: 'School', required: true,
  index: true }` and MUST include compound indexes covering the most common query patterns
- The `schoolScope` middleware MUST run after `authenticate` on all non-public authenticated routes;
  it extracts `schoolId` from `req.user` (JWT payload) and sets `req.schoolId`; requests lacking a
  valid `schoolId` MUST be rejected with HTTP 403
- No service function operating on tenant-scoped data may accept a `schoolId` argument from the
  controller — it MUST be injected exclusively via `req.schoolId` to prevent controller-level
  tenant spoofing
- Integration tests MUST assert that School A's data is never accessible from School B's
  authenticated session (cross-tenant leakage tests are mandatory, not optional)

**Super-Admin Tier:**
- MUST provide a `super-admin` role that is NOT school-scoped; super-admin JWT does NOT embed a
  `schoolId` and bypasses the `schoolScope` middleware
- Super-admin routes MUST live under a separate prefix (`/api/v1/platform/...`) and MUST be
  protected by an `authorize('super-admin')` guard — no other role may reach these routes
- Super-admin capabilities: school CRUD, user-across-school lookup (read-only), plan management,
  platform-wide analytics; super-admins MUST NOT be able to directly read student/marks/attendance
  records of any school without explicit audit trail

**Migration & Backward Compatibility:**
- All existing single-school data MUST be migrated to a default School document during the
  002-multi-tenant-saas deployment; migration scripts MUST be idempotent and reversible
- TODO(SLUG_MIGRATION): Draft and test migration script before deploying to production

**Rationale:** Multi-tenancy without strict isolation is a data breach waiting to happen. Using
slug only for public URLs (never as the DB key) prevents URL-guessing-based data access. Injecting
`schoolId` from JWT rather than request parameters closes a common tenant-spoofing attack vector.
Mandatory cross-tenant leakage tests ensure isolation is verified in CI, not just assumed.

## Technology Stack & Architecture Standards

## Technology Stack & Architecture Standards

**Backend:** Node.js + Express.js with MongoDB
**Frontend:** React.js with Redux for state management
**Database:** MongoDB with Mongoose ODM
**Authentication:** JWT with role-based middleware; `schoolId` embedded in payload for tenant scoping
**Testing:** Jest for backend, Vitest for frontend, Supertest for API integration tests
**UI & Animation:** Tailwind CSS + Framer Motion (or React Spring) for modern design and smooth animations

**Multi-Tenancy Standards:**
- MUST add `School` model with `slug`, `name`, `plan`, `isActive` fields
- MUST add `schoolId` to all tenant-scoped Mongoose schemas with compound indexes
- MUST implement `schoolScope` middleware (runs after `authenticate`; sets `req.schoolId`)
- MUST implement `slugToSchool` middleware for public routes that resolve `:schoolSlug` → `schoolId`
- MUST add `super-admin` role and `/api/v1/platform/` prefix for platform management routes
- MUST implement `resolveSlug` service that caches slug→schoolId lookups (Redis or in-memory LRU)

**Design Standards:**
- MUST use Tailwind CSS for consistent styling and rapid modern UI development
- MUST use Framer Motion or React Spring for declarative, performant animations
- MUST follow mobile-first responsive design principles
- MUST implement dark mode support for modern user preference alignment

**Architecture Enforcements:**
- Backend structured as: `/routes`, `/controllers`, `/services`, `/models`, `/middleware`, `/utils`
- Frontend structured as: `/components`, `/pages`, `/redux`, `/utils`, `/hooks`, `/api`
- All API routes MUST be prefixed with `/api/v1` for versioning
- Tenant-authenticated routes MUST include `authenticate` → `schoolScope` → `authorize(role)` middleware chain
- Public school routes MUST include `slugToSchool` middleware to resolve school context
- Database operations MUST flow through service layer (controllers never import models directly)

## Development Workflow & Quality Gates

**Code Review Process:**
- All PRs MUST pass linting (ESLint), formatting (Prettier), and syntax validation before review
- All PRs MUST include tests demonstrating the feature works as specified
- All PRs MUST be reviewed by at least one team member with no approvals from authors of related code
- All PRs MUST verify compliance against all **eight** core principles listed above
- All PRs touching tenant-scoped data MUST include at least one cross-tenant isolation assertion

**Deployment Gates:**
- MUST pass all test suites (unit tests, integration tests) with >70% coverage
- MUST verify API response times against Performance Requirements (IV)
- MUST confirm all sensitive routes are protected with security middleware
- MUST validate RBAC enforcement for Super-Admin, Admin, Teacher, and Student roles
- MUST verify `schoolScope` middleware is applied to every non-public authenticated route
- MUST confirm no API endpoint returns data outside the caller's `schoolId` scope

**Issue Tracking & Specification:**
- Every feature MUST be specified in accordance with Feature Specification template
- Every implementation plan MUST include a Constitution Check section verifying alignment with all **eight** core principles
- Every task MUST be categorized by principle alignment (which principle it delivers/improves)
- Every task touching multi-tenant data MUST explicitly note which `schoolId` scoping pattern it implements (Principle VIII)
- Every Student module feature MUST explicitly plan for animation and modern design implementation (Principle VII)

## Governance

**Amendment Process:**
- Constitution amendments MUST be documented in this file with ratification date and version bump
- MAJOR version increments: Backward incompatible principle removals or redefinitions
- MINOR version increments: New principle additions or material expansions
- PATCH version increments: Clarifications, wording improvements, non-semantic refinements
- All amendments MUST include detailed rationale and affected file updates

**Compliance Enforcement:**
- All specifications, plans, and tasks MUST explicitly reference which principle(s) they serve
- Technical debt or principle violations MUST be documented in PRs with justification and remediation dates
- Bi-weekly code reviews MUST include a principle alignment check
- Runtime development guidance in README.md and docs/ MUST stay synchronized with constitution principles

**Superseding Rules:**
- Constitution supersedes all other development practices and guidelines
- Exceptions to principles MUST be raised in team discussion, documented in PR, and tracked as technical debt
- No feature branch SHALL merge to main without principle compliance verification

**Version**: 2.0.0 | **Ratified**: 2026-04-07 | **Last Amended**: 2026-05-17
