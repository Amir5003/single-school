# Tasks: Multi-School SaaS Platform

**Input**: Design documents from `/specs/003-multi-school-saas/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: User story label — [US1] through [US6]; omitted for Setup and Foundational phases
- Paths follow web app convention: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Install & Configure New Dependencies)

**Purpose**: Add new packages and configuration files required by the feature before any code changes.

- [x] T001 Install new backend dependencies: `lru-cache`, `node-cron`, `cloudinary`, `multer-storage-cloudinary` in `backend/package.json`
- [x] T002 [P] Create `backend/src/config/cloudinary.js` — initialize Cloudinary SDK from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` env vars
- [x] T003 [P] Update `backend/src/config/env.js` — add and document new env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `REFRESH_TOKEN_SECRET`, `SEED_SCHOOL_ID`
- [x] T004 [P] Create `backend/src/jobs/` directory — add placeholder `index.js` that registers all cron jobs; update `backend/server.js` to call `jobs/index.js` after DB connect

---

## Phase 2: Foundational (Multi-Tenancy Gate — Blocking Prerequisites)

**Purpose**: All models, slug cache, tenant middleware, updated auth, and schoolId-filtered services. No user story implementation can begin until this phase is complete.

**⚠️ CRITICAL — Multi-Tenancy Gate**: All items below must be complete before Phase 3.

### New Models

- [x] T005 [P] Create `backend/src/models/School.model.js` — fields: `name`, `slug` (unique, immutable after lock), `slugLockedAt`, `plan` (free/standard/premium), `isActive`, `branding` sub-schema (`logoUrl`, `primaryColor`, `secondaryColor`, `tagline`, `address`, `contactNumber`), timestamps; indexes: `{ slug: 1 }` unique, `{ isActive: 1 }`, `{ plan: 1 }`
- [x] T006 [P] Create `backend/src/models/ParentStudentLink.model.js` — fields: `schoolId` (required ref School), `parentId` (ref User), `studentId` (ref Student), timestamps; indexes: `{ schoolId, parentId }`, `{ schoolId, studentId }`, `{ parentId, studentId }` unique
- [x] T007 [P] Create `backend/src/models/Fee.model.js` — fields: `schoolId`, `studentId`, `amount`, `description`, `dueDate`, `status` (pending/paid/overdue, default pending), `paidAt`, timestamps; indexes: `{ schoolId, studentId, status }`, `{ schoolId, dueDate, status }`
- [x] T008 [P] Create `backend/src/models/Homework.model.js` — fields: `schoolId`, `classId`, `teacherId`, `title`, `description`, `dueDate`, `attachments[]` (`url`, `publicId`, `filename`), `isDeleted` (default false), timestamps; indexes: `{ schoolId, classId, dueDate }`, `{ schoolId, teacherId }`
- [x] T009 [P] Create `backend/src/models/Notification.model.js` — fields: `schoolId`, `senderId`, `targetRole` (all/teacher/student/parent), `title`, `body`, `readBy[]` (ObjectId array), `createdAt`; indexes: `{ schoolId, targetRole, createdAt }`, `{ schoolId, createdAt }`

### Modified Models (add `schoolId` + compound indexes)

- [x] T010 [P] Modify `backend/src/models/User.model.js` — add `schoolId` (required for non-super-admin, null for super-admin), expand `role` enum to `super-admin|school-admin|teacher|student|parent`, add `refreshTokenHash` (String, default null); add indexes `{ schoolId, role }`, `{ schoolId, isActive }`
- [x] T011 [P] Modify `backend/src/models/Student.model.js` — add `schoolId` (required ref School); replace global `enrollmentId` unique index with compound `{ schoolId, enrollmentId }` unique; add indexes `{ schoolId, classId }`, `{ schoolId, isDeleted }`
- [x] T012 [P] Modify `backend/src/models/Teacher.model.js` — add `schoolId` (required ref School); replace global `employeeId` unique with compound `{ schoolId, employeeId }` unique; add index `{ schoolId, isDeleted }`
- [x] T013 [P] Modify `backend/src/models/Class.model.js` — add `schoolId` (required ref School); add compound unique `{ schoolId, name, academicYear }` unique; add index `{ schoolId, academicYear }`
- [x] T014 [P] Modify `backend/src/models/ClassTeacher.model.js` — add `schoolId` (required ref School); add indexes `{ schoolId, classId, teacherId }`, `{ schoolId, teacherId }`
- [x] T015 [P] Modify `backend/src/models/Attendance.model.js` — add `schoolId` (required ref School); update unique index to `{ schoolId, studentId, date }` unique; add index `{ schoolId, classId, date }`
- [x] T016 [P] Modify `backend/src/models/Marks.model.js` — add `schoolId` (required ref School); add indexes `{ schoolId, studentId, examType, subject }`, `{ schoolId, classId, examType }`
- [x] T017 [P] Modify `backend/src/models/Timetable.model.js` — add `schoolId` (required ref School); update unique index to `{ schoolId, classId, day }` unique
- [x] T018 [P] Modify `backend/src/models/Announcement.model.js` — add `schoolId` (required ref School); add indexes `{ schoolId, createdAt: -1 }`, `{ schoolId, targetRole }`

### Slug Cache & Tenant Middleware

- [x] T019 Create `backend/src/services/slugCache.service.js` — LRU cache wrapper using `lru-cache`; max 500 entries, 5-min TTL; exports `getSchoolBySlug(slug)` (cache-first: check cache → DB lookup → cache result) and `invalidate(slug)` (for admin updates)
- [x] T020 Create `backend/src/middleware/schoolScope.js` — extracts `schoolId` from `req.user` (set by authenticate); queries School (or cache) to confirm `isActive`; sets `req.school`; returns 403 if school not found or inactive; super-admin requests bypass this middleware
- [x] T021 Create `backend/src/middleware/slugToSchool.js` — extracts `:slug` from `req.params`; resolves to School doc via `slugCache.service.js`; sets `req.school` and `req.schoolId`; returns 404 with "School not found" if slug does not exist
- [x] T022 [P] Create `backend/src/middleware/uploadMiddleware.js` — configure `multer-storage-cloudinary` for image/file uploads; export `uploadLogo` (single image, folder: `school-logos`) and `uploadHomeworkAttachment` (array, max 5, folder: `homework-attachments`, allow pdf/image)

### Auth & Existing Middleware Updates

- [x] T023 Modify `backend/src/middleware/authenticate.js` — after JWT verify, populate `req.user` with `{ _id, role, schoolId }` (schoolId from token payload); super-admin token has no schoolId (null/undefined is valid for super-admin role)
- [x] T024 Modify `backend/src/middleware/authorize.js` — update role enum check to accept all 5 roles: `super-admin`, `school-admin`, `teacher`, `student`, `parent`

### Auth Service & JWT

- [x] T025 Modify `backend/src/services/auth.service.js` — embed `{ _id, role, schoolId }` in access token payload (15 min TTL); issue separate refresh token (7-day TTL, `REFRESH_TOKEN_SECRET`) and store `bcrypt.hash(refreshToken, 12)` as `refreshTokenHash` in User doc; add `refreshAccessToken(refreshToken)` method; add `logout()` to clear `refreshTokenHash`

### Route Auth Registration

- [x] T026 Modify `backend/src/routes/auth.routes.js` — add `POST /auth/refresh` endpoint (accepts refresh token cookie, returns new access token cookie) and `POST /auth/logout` (clears both cookies, nullifies `refreshTokenHash`)

### schoolId-Scoped Service Modifications

- [x] T027 [P] Modify `backend/src/services/student.service.js` — add `schoolId` as required filter on all DB queries; inject `schoolId` from `req.school._id` (never from `req.body`); enforce in `getAll`, `getById`, `create`, `update`, `softDelete`
- [x] T028 [P] Modify `backend/src/services/teacher.service.js` — same schoolId scoping pattern as T027
- [x] T029 [P] Modify `backend/src/services/class.service.js` — same schoolId scoping pattern as T027
- [x] T030 [P] Modify `backend/src/services/attendance.service.js` — same schoolId scoping pattern as T027
- [x] T031 [P] Modify `backend/src/services/marks.service.js` — same schoolId scoping pattern as T027
- [x] T032 [P] Modify `backend/src/services/timetable.service.js` — same schoolId scoping pattern as T027
- [x] T033 [P] Modify `backend/src/services/announcement.service.js` — same schoolId scoping pattern as T027

### Frontend Redux Foundation

- [x] T034 [P] Modify `frontend/src/redux/slices/authSlice.js` — add `schoolId` and `schoolSlug` fields to the auth state shape; update `setCredentials` and `logout` reducers accordingly
- [x] T035 [P] Create `frontend/src/redux/slices/schoolSlice.js` — state: `{ slug, name, branding: { logoUrl, primaryColor, secondaryColor, tagline } }`; actions: `setSchoolConfig`, `clearSchoolConfig`
- [x] T036 Modify `frontend/src/redux/store.js` — register `schoolSlice` reducer under `school` key

### App-Level Route Mounting

- [x] T037 Modify `backend/src/app.js` — mount onboarding routes (public, T043), update existing route mounts to use `authenticate → schoolScope → authorize(role)` chain, reserve `/api/v1/platform` for platform routes (no schoolScope), register public school config routes

**Checkpoint**: Foundation complete — all models have `schoolId`, tenant middleware is created, auth embeds schoolId, all existing services scope by schoolId. User story work can now begin.

---

## Phase 3: User Story 1 — School Onboarding & Slug Registration (P1) 🎯 MVP

**Goal**: A new school can register, choose a unique slug, and receive an isolated workspace. Existing data is migrated to a seed school.

**Independent Test**: Register a new school via `POST /api/v1/onboarding/register`, verify the school doc is created, the admin user has `schoolId` set, and the workspace is accessible at its slug URL.

- [x] T038 [P] [US1] Create `backend/src/validators/onboarding.validator.js` — validate `POST /register`: `name` (required, 2-200 chars), `slug` (required, `/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/`), `adminEmail` (valid email), `adminPassword` (min 8 chars, 1 uppercase, 1 digit); validate `GET /slug-check`: `slug` query param format
- [x] T039 [P] [US1] Create `backend/src/validators/school.validator.js` — validate branding update: optional `primaryColor`/`secondaryColor` (6-digit hex), `tagline` (max 200), `address` (max 500), `contactNumber` (trim); validate plan enum for super-admin
- [x] T040 [US1] Create `backend/src/services/onboarding.service.js` — `checkSlugAvailability(slug)`: query School for existing slug, return `{ available, suggestions }`; `registerSchool({ name, slug, adminEmail, adminPassword })`: atomic transaction — create School doc + create User (role: school-admin, schoolId) + hash password; return `{ school, admin }`
- [x] T041 [US1] Create `backend/src/controllers/onboarding.controller.js` — `checkSlug` handler (GET /slug-check): call service, return availability; `registerSchool` handler (POST /register): call service, auto-login admin (issue JWT cookies), return school config
- [x] T042 [US1] Create `backend/src/routes/onboarding.routes.js` — `GET /slug-check` and `POST /register`; no auth middleware (public); apply onboarding validators + `validate` middleware
- [x] T043 [US1] Register onboarding routes in `backend/src/app.js` at `/api/v1/onboarding` — place before any auth middleware (must be fully public)
- [x] T044 [US1] Create `backend/scripts/migrate-to-multitenant.js` — idempotent migration: (1) check `_migrations` collection for `"001-add-school-id"` record — skip if found; (2) create seed School doc; (3) bulk `$set: { schoolId: seedSchoolId }` on all 9 existing collections; (4) drop old global `enrollmentId` unique on `students` and recreate as compound; (5) insert `_migrations` record on success
- [x] T045 [US1] Create `backend/scripts/seed-super-admin.js` — create super-admin User (`role: super-admin`, no `schoolId`) using `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` env vars; guard against duplicate with `upsert`; print warning if password is default
- [x] T046 [P] [US1] Create `frontend/src/api/onboarding.api.js` — `checkSlugAvailability(slug)` and `registerSchool(data)` using axiosInstance (no auth required)
- [x] T047 [US1] Create `frontend/src/pages/Onboarding.jsx` — animated multi-step registration form using `motion.div` + `AnimatePresence` with `staggerContainer` variant; steps: (1) School Name + slug (with real-time slug availability check + debounce), (2) Admin credentials, (3) Confirmation; dispatch `setSchoolConfig` + `setCredentials` on success; navigate to school dashboard
- [x] T048 [US1] Create `frontend/src/pages/SchoolLanding.jsx` — public landing page for `/schools/:slug`; on mount call `school.api.js → getSchoolConfig(slug)`; display school logo, name, tagline, `Login` CTA and `Register` CTA; show friendly "school not found" if 404
- [x] T049 [US1] Add `/onboarding` and `/schools/:slug` routes to `frontend/src/App.jsx`; wrap `/schools/:slug/*` subtree with a `SchoolContextLoader` component that fetches and dispatches school config before rendering children

**Checkpoint**: A new school can be registered and accessed at its slug URL. Existing data can be migrated with the migration script.

---

## Phase 4: User Story 2 — Cross-Tenant Data Isolation (P1)

**Goal**: Users authenticated to School A cannot access School B's data through any API endpoint.

**Independent Test**: Create two schools (A and B), authenticate as a School A teacher, call all GET endpoints — none returns School B records. Attempt to access School B admin endpoints — receive 403.

- [x] T050 [P] [US2] Apply `authenticate → schoolScope → authorize('school-admin')` middleware chain to all admin route handlers in `backend/src/routes/admin.routes.js`
- [x] T051 [P] [US2] Apply `authenticate → schoolScope → authorize('teacher')` middleware chain to all teacher route handlers in `backend/src/routes/teacher.routes.js`
- [x] T052 [P] [US2] Apply `authenticate → schoolScope → authorize('student')` middleware chain to all student route handlers in `backend/src/routes/student.routes.js`
- [x] T053 [US2] Create `backend/tests/integration/cross-tenant.test.js` — spin up two schools (A and B) with mongodb-memory-server; authenticate as School A teacher token; assert all `GET /api/v1/admin/*`, `GET /api/v1/teacher/*`, `GET /api/v1/student/*` endpoints return only School A data; assert tampered schoolId in JWT body returns 403; assert deactivated school returns 403 on login
- [x] T054 [US2] Update `backend/tests/helpers.js` — add `createSchool(overrides)`, `createSchoolAdmin(schoolId)`, `createTeacher(schoolId)`, `createStudent(schoolId)` factory helpers; update `getAuthCookies(user, schoolId)` to embed schoolId in JWT
- [x] T055 [US2] Update existing integration test fixtures

**Checkpoint**: Zero cross-tenant data leakage verified by automated integration tests. All existing tests pass with schoolId-aware fixtures.

---

## Phase 5: User Story 3 — Role-Based Access Control (5 Roles) (P1)

**Goal**: All 5 roles (super-admin, school-admin, teacher, student, parent) have clearly enforced access boundaries. Super-admin portal and parent portal are functional.

**Independent Test**: Create one user of each role, call all endpoints with each role's token — each receives 200 for permitted endpoints and 403 for all others. Super-admin can list/activate/deactivate schools. Parent can read their linked child's data.

- [x] T056 [P] [US3] Create `backend/src/services/platform.service.js` — `listSchools({ page, limit, search, plan, isActive })`, `getSchoolById(id)`, `activateSchool(id)`, `deactivateSchool(id)`, `getAnalytics()` (aggregated counts per school: students, teachers, classes — no individual PII)
- [x] T057 [US3] Create `backend/src/controllers/platform.controller.js` — handlers for all super-admin endpoints; delegate to platform.service; never return individual student record lists
- [x] T058 [US3] Create `backend/src/routes/platform.routes.js` — mount with `authenticate → authorize('super-admin')` only (NO schoolScope); routes: `GET /schools`, `GET /schools/:id`, `PATCH /schools/:id/activate`, `PATCH /schools/:id/deactivate`, `GET /analytics`
- [x] T059 [US3] Register platform routes in `backend/src/app.js` at `/api/v1/platform` — must be BEFORE schoolScope is applied globally
- [x] T060 [P] [US3] Create `backend/src/services/parent.service.js` — `getChildren(parentId, schoolId)`: query ParentStudentLink, populate student + user; `getChildAttendance(parentId, studentId, schoolId)`: verify link exists, return attendance; `getChildMarks(parentId, studentId, schoolId)`: verify link + return marks; `getChildFees(parentId, studentId, schoolId)`: verify link + return fees
- [x] T061 [US3] Create `backend/src/controllers/parent.controller.js` — handlers for all parent portal endpoints; inject schoolId from `req.school._id`
- [x] T062 [US3] Create `backend/src/routes/parent.routes.js` — `authenticate → schoolScope → authorize('parent')` chain; routes: `GET /children`, `GET /children/:studentId/attendance`, `GET /children/:studentId/marks`, `GET /children/:studentId/fees`, `GET /children/:studentId/homework`, `GET /children/:studentId/notifications`
- [x] T063 [US3] Register parent routes in `backend/src/app.js` at `/api/v1/parent`
- [x] T064 [US3] Create `backend/tests/integration/rbac.test.js` — for each of the 5 roles × each endpoint category: assert correct HTTP status (200 for permitted, 403 for forbidden); include explicit assertions: teacher cannot access `/admin/*`, student cannot POST attendance, parent cannot access another parent's children, super-admin cannot access school-scoped routes without bypassing schoolScope, school-admin cannot access platform routes
- [x] T065 [P] [US3] Create `frontend/src/api/platform.api.js` — `listSchools(params)`, `getSchool(id)`, `activateSchool(id)`, `deactivateSchool(id)`, `getAnalytics()`
- [x] T066 [P] [US3] Create `frontend/src/api/parent.api.js` — `getChildren()`, `getChildAttendance(studentId)`, `getChildMarks(studentId)`, `getChildFees(studentId)`, `getChildHomework(studentId)`, `getChildNotifications(studentId)`
- [x] T067 [P] [US3] Create `frontend/src/pages/platform/SchoolsList.jsx` — table of all schools with status badge (active/inactive/plan tier), search/filter, activate/deactivate action buttons; animate rows with `staggerContainer` variant
- [x] T068 [P] [US3] Create `frontend/src/pages/platform/SchoolDetail.jsx` — school info card, analytics counts (students/teachers/classes), activate/deactivate toggle, branding preview
- [x] T069 [P] [US3] Create `frontend/src/pages/parent/ParentDashboard.jsx` — list of linked children cards; each card shows child name, class, and quick stats; animated with `staggerContainer` + `fadeInUp` variants from `animationVariants.js`
- [x] T070 [P] [US3] Create `frontend/src/pages/parent/ChildDetail.jsx` — tabbed view (Attendance | Marks | Fees | Homework | Notifications) for a single child; each tab animated with `slideInRight` variant
- [x] T071 [US3] Add `/platform/*` and `/schools/:slug/parent/*` route groups to `frontend/src/App.jsx`; wrap with `<ProtectedRoute allowedRoles={['super-admin']} />` and `<ProtectedRoute allowedRoles={['parent']} />` respectively

**Checkpoint**: All 5 roles have verified, tested access boundaries. Super-admin can manage schools. Parents can view their children's records.

---

## Phase 6: User Story 4 — Dynamic School Branding (P2)

**Goal**: Each school can configure logo, primary/secondary colours, and contact info. Public pages and dashboards reflect the school's branding via CSS custom properties.

**Independent Test**: School A admin updates logo + primaryColor. Fetch `GET /api/v1/schools/school-a/config` — response includes updated branding. Another school's branding is unchanged when fetched separately.

- [ ] T072 [P] [US4] Create `backend/src/services/school.service.js` — `getSchoolConfigBySlug(slug)`: resolve via slugCache, return public branding fields; `updateBranding(schoolId, brandingData)`: update School.branding subfield; `uploadLogo(schoolId, file)`: upload to Cloudinary, store URL in `branding.logoUrl`, invalidate slug cache
- [ ] T073 [US4] Create `backend/src/controllers/admin/branding.controller.js` — `updateBranding` handler (PATCH branding fields); `uploadLogo` handler (POST with uploadMiddleware.uploadLogo)
- [ ] T074 [US4] Add public endpoints to `backend/src/routes/public.routes.js` — `GET /schools/:slug/config` (slugToSchool → getSchoolConfigBySlug, returns name + branding + isActive); apply `slugToSchool` middleware to all `/schools/:slug/*` public routes
- [ ] T075 [US4] Add admin branding endpoints to `backend/src/routes/admin.routes.js` — `PATCH /school/branding` (with school.validator, authenticate → schoolScope → authorize('school-admin')) and `POST /school/logo` (with uploadMiddleware.uploadLogo, same middleware chain)
- [ ] T076 [US4] Create `backend/tests/integration/onboarding.test.js` — test full onboarding flow: `GET /slug-check` available → `POST /register` creates school + admin → `POST /auth/login` returns JWT with schoolId → `GET /schools/:slug/config` returns branding
- [ ] T077 [P] [US4] Create `frontend/src/components/common/SchoolBrandingProvider.jsx` — on mount, read `school.branding` from Redux `schoolSlice`; apply as CSS custom properties (`--school-primary`, `--school-secondary`, `--school-logo`) to a wrapping `div`; check `prefers-reduced-motion` media query and pass flag to children via context
- [ ] T078 [P] [US4] Create `frontend/src/hooks/useSchoolBranding.js` — on mount at school routes, dispatch `getSchoolConfig(slug)` API call and `setSchoolConfig` to Redux `schoolSlice`; return `{ branding, isLoading }`
- [ ] T079 [US4] Create `frontend/src/components/admin/BrandingForm.jsx` — form with `<input type="color">` pickers for primaryColor + secondaryColor, logo file upload with preview, tagline/address/contact fields; on submit call `admin.api.js → updateBranding` + `uploadLogo`; show live preview of CSS variable application
- [ ] T080 [US4] Wrap `/schools/:slug/*` route subtree with `<SchoolBrandingProvider>` in `frontend/src/App.jsx`; ensure branding loads before first render using `useSchoolBranding` hook in `SchoolContextLoader`

**Checkpoint**: Each school displays its own branding on public pages and dashboards. Branding updates reflect within 1 second of saving.

---

## Phase 7: User Story 5 — MVP School Operations (P2)

**Goal**: Teachers can mark attendance, post homework, and send notifications. School admin manages fees. Students and parents receive notifications and can view fees/homework.

**Independent Test**: In a single school: create a class, enroll students, mark attendance, create a fee record, post homework with attachment, send a notification to students. Verify student dashboard shows all of these. Verify daily cron transitions a past-due fee to overdue.

### Fees

- [ ] T081 [P] [US5] Create `backend/src/validators/fee.validator.js` — validate `POST /fees`: `studentId` (valid ObjectId), `amount` (positive number), `description` (required, max 300), `dueDate` (valid future date); validate `PATCH /fees/:id/pay`: no body required
- [ ] T082 [US5] Create `backend/src/services/fee.service.js` — `createFee(schoolId, data)`, `listFees(schoolId, filters: { studentId, status, page, limit })`, `markPaid(schoolId, feeId)` (status pending/overdue → paid, set paidAt), `transitionOverdue(schoolId)` (bulk update pending where dueDate < today → overdue — called by cron)
- [ ] T083 [US5] Create `backend/src/controllers/fee.controller.js` — handlers for all fee endpoints; inject schoolId from `req.school._id`
- [ ] T084 [US5] Add admin fee routes to `backend/src/routes/admin.routes.js` — `POST /fees`, `GET /fees` (with pagination, optional `studentId`/`status` query filter), `PATCH /fees/:id/pay`
- [ ] T085 [US5] Add `GET /fees` to `backend/src/routes/student.routes.js` (returns own fees only; service enforces student ownership + schoolId)
- [ ] T086 [US5] Create `backend/src/jobs/feeOverdueJob.js` — `node-cron` schedule `'0 1 * * *'` (1 AM daily); for each active school call `fee.service.js → transitionOverdue(schoolId)`; log count of updated records; export `{ start }` function
- [ ] T087 [US5] Register `feeOverdueJob.start()` in `backend/src/jobs/index.js` (from T004); confirm it runs only when `NODE_ENV !== 'test'`

### Homework

- [ ] T088 [P] [US5] Create `backend/src/validators/homework.validator.js` — validate `POST /homework`: `classId` (valid ObjectId), `title` (required, max 200), `dueDate` (valid date), `description` (optional, max 2000)
- [ ] T089 [US5] Create `backend/src/services/homework.service.js` — `createHomework(schoolId, teacherId, data, files)`: create doc + upload attachments to Cloudinary; `listForClass(schoolId, classId, filters)`: paginated list sorted by dueDate desc; `deleteHomework(schoolId, homeworkId, teacherId)`: soft-delete + remove Cloudinary assets via `publicId`
- [ ] T090 [US5] Create `backend/src/controllers/homework.controller.js` — handlers for homework CRUD; inject schoolId from `req.school._id`, teacherId from `req.user._id`
- [ ] T091 [US5] Add teacher homework routes to `backend/src/routes/teacher.routes.js` — `POST /homework` (with `uploadMiddleware.uploadHomeworkAttachment`), `GET /homework` (own/class), `DELETE /homework/:id`
- [ ] T092 [US5] Add `GET /homework` to `backend/src/routes/student.routes.js` (returns homework for student's classId, sorted by dueDate desc)

### Notifications

- [ ] T093 [US5] Create `backend/src/services/notification.service.js` — `createNotification(schoolId, senderId, { targetRole, title, body })`, `listForRecipient(schoolId, recipientRole, page, limit)`, `markRead(schoolId, notificationId, userId)` (push userId to `readBy` if not already present)
- [ ] T094 [US5] Create `backend/src/controllers/notification.controller.js` — handlers for notification endpoints; inject schoolId + senderId from request context
- [ ] T095 [US5] Add notification send routes to `backend/src/routes/admin.routes.js` — `POST /notifications`, `GET /notifications`
- [ ] T096 [US5] Add notification read + mark-read routes — `GET /notifications` + `PATCH /notifications/:id/read` to both `backend/src/routes/teacher.routes.js` and `backend/src/routes/student.routes.js`

### Parent Operations

- [ ] T097 [US5] Add parent homework and notification routes to `backend/src/routes/parent.routes.js` — `GET /children/:studentId/homework` and `GET /children/:studentId/notifications` (implemented via parent.service.js, which validates ParentStudentLink before returning data)

### Backend Tests

- [ ] T098 [US5] Create `backend/tests/integration/fee.test.js` — test create fee, list fees (admin), student views own fees, mark paid, cron overdue transition with mocked date
- [ ] T099 [US5] Create `backend/tests/integration/homework.test.js` — test create homework (with mock upload), list for class, student views homework, teacher deletes own homework, teacher cannot delete another teacher's homework
- [ ] T100 [US5] Create `backend/tests/integration/notifications.test.js` — test send notification to role, student receives own-role notifications, mark read (idempotent), parent receives notifications for child's school

### Frontend API Layer

- [ ] T101 [P] [US5] Create `frontend/src/api/fee.api.js` — `listFees(params)`, `markFeePaid(feeId)`, `createFee(data)`, `getStudentFees()`
- [ ] T102 [P] [US5] Create `frontend/src/api/homework.api.js` — `listHomeworkForClass(classId)`, `createHomework(formData)` (multipart), `deleteHomework(id)`, `getStudentHomework()`
- [ ] T103 [P] [US5] Create `frontend/src/api/notification.api.js` — `listNotifications()`, `sendNotification(data)`, `markNotificationRead(id)`

### Frontend Components

- [ ] T104 [P] [US5] Create `frontend/src/components/student/FeesCard.jsx` — `motion.div` with `fadeInUp` variant; shows fee description, amount, dueDate, status badge (color-coded: pending=yellow, paid=green, overdue=red); respect `prefers-reduced-motion`
- [ ] T105 [P] [US5] Create `frontend/src/components/student/HomeworkCard.jsx` — `motion.div` with `fadeInUp` variant; shows title, subject, dueDate, attachments (downloadable links); respect `prefers-reduced-motion`
- [ ] T106 [P] [US5] Create `frontend/src/components/student/NotificationsPanel.jsx` — `motion.div` list with `staggerContainer` variant; unread badge count; on click mark as read via API; respect `prefers-reduced-motion`
- [ ] T107 [P] [US5] Create `frontend/src/components/admin/FeeManagementTable.jsx` — paginated table of fee records with filters (status, studentId); "Mark Paid" action button; integrates with `fee.api.js`
- [ ] T108 [P] [US5] Create `frontend/src/components/teacher/HomeworkForm.jsx` — form with class selector, title, description, dueDate, file upload (max 5 files); submits as `multipart/form-data` via `homework.api.js`
- [ ] T109 [US5] Integrate `FeesCard`, `HomeworkCard`, `NotificationsPanel` into existing student dashboard page components; add admin `FeeManagementTable` to admin dashboard; add `HomeworkForm` to teacher dashboard

**Checkpoint**: All core school operations (attendance, marks, fees, homework, notifications) are functional and scoped per school. Parent portal shows child data.

---

## Phase 8: User Story 6 — Slug-Based URL Routing (P2)

**Goal**: Each school is accessible at its slug URL. Public routes (timetable, school config, landing) work without authentication. Invalid slugs show a friendly error.

**Independent Test**: Visit `/schools/sunrise-academy` — loads correct school branding. Visit `/schools/sunrise-academy/timetable` — returns timetable without auth. Visit `/schools/invalid-slug` — shows "school not found" page.

- [ ] T110 [P] [US6] Add public timetable endpoint to `backend/src/routes/public.routes.js` — `GET /schools/:slug/timetable?classId=` using `slugToSchool` middleware + timetable.service (no auth required); return class timetable for the resolved school
- [ ] T111 [P] [US6] Update `frontend/src/App.jsx` — nest all school-role routes under `/schools/:slug/` path prefix; ensure React Router passes `:slug` param to `SchoolContextLoader`; move login page to `/schools/:slug/login`; keep `/platform/*` and `/onboarding` outside the slug prefix
- [ ] T112 [US6] Handle slug-not-found error in `frontend/src/pages/SchoolLanding.jsx` (from T048) — if `getSchoolConfig(slug)` returns 404, display a 404-style panel with "This school workspace does not exist" message and a link back to the platform home; animate in with `scaleIn` variant
- [ ] T113 [US6] Create `frontend/src/api/school.api.js` — `getSchoolConfig(slug)` (public endpoint, no auth); used by `SchoolContextLoader` and `SchoolLanding`

**Checkpoint**: Full slug-based URL routing is functional for both public and authenticated school routes.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T114 [P] Verify `backend/src/env.js` exports all new constants with clear validation (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `REFRESH_TOKEN_SECRET`, `SEED_SCHOOL_ID`); throw on missing in production
- [x] T115 [P] Update `frontend/src/api/axiosInstance.js` — ensure the base URL logic accounts for `/schools/:slug/` routing; add a response interceptor to attempt token refresh on 401 using the refresh token cookie
- [x] T116 Run full backend test suite (`cd backend && npm test`) and fix any test failures caused by model/service changes in Phase 2
- [x] T117 Execute quickstart.md validation — run migration script, seed super-admin, register a test school via onboarding API, log in as school-admin, verify data isolation between two schools, confirm fee overdue job transitions a back-dated fee

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 only — no dependency on US2/US3
- **Phase 4 (US2)**: Depends on Phase 2 + Phase 3 (routes exist to apply middleware to)
- **Phase 5 (US3)**: Depends on Phase 2; can run in parallel with US1 on models/services
- **Phase 6 (US4)**: Depends on Phase 2 + Phase 3 (school doc must exist for branding)
- **Phase 7 (US5)**: Depends on Phase 2 + Phase 3 (students/classes must be in school scope)
- **Phase 8 (US6)**: Depends on Phase 3 (slug routing wraps US1 onboarding) + Phase 6 (branding)
- **Polish**: Depends on all prior phases

### User Story Dependencies

- **US1 (School Onboarding)** — independent after Foundation; MVP deliverable
- **US2 (Cross-Tenant Isolation)** — depends on US1 (routes must exist); tests verify Foundation correctness
- **US3 (RBAC)** — depends on Foundation only; independent of US1 (can run in parallel)
- **US4 (Branding)** — depends on US1 (School document must exist)
- **US5 (MVP Operations)** — depends on Foundation + US1 (school scope required for fees/homework)
- **US6 (Slug Routing)** — depends on US1 (slug identity) + US4 (branding config fetch)

### Within Each User Story

- Backend validators and models (if any) before services
- Services before controllers
- Controllers before routes
- Route registration before frontend API layer
- Frontend API layer before frontend components
- Frontend components before page integration

### Parallel Opportunities Per Phase

**Phase 2 Foundation**:
- T005–T018 (all new/modified models) — all parallel
- T019 (slugCache) can run with models
- T020 + T021 (middleware) parallel after T019
- T022 (uploadMiddleware) parallel with all above
- T027–T033 (service modifications) — all parallel, after T005–T018

**Phase 3 US1**:
- T038 + T039 (validators) — parallel
- T046 (frontend API) — parallel with T040–T045 (backend)
- T047 + T048 (pages) — parallel

**Phase 5 US3**:
- T056 (platform service) + T060 (parent service) — parallel
- T065 + T066 (frontend API files) — parallel
- T067 + T068 (platform pages) — parallel
- T069 + T070 (parent pages) — parallel

**Phase 7 US5**:
- T081 + T088 (fee + homework validators) — parallel
- T101 + T102 + T103 (frontend API files) — parallel
- T104 + T105 + T106 + T107 + T108 (frontend components) — all parallel

---

## Implementation Strategy

### MVP Scope (Suggested First Delivery)

Deliver **Phase 1 + Phase 2 + Phase 3 + Phase 4** (US1 + US2) first:
- All new schools can register with a unique slug
- All existing data is migrated to a seed school
- Cross-tenant isolation is verified and tested
- Foundation is solid for all subsequent stories

### Second Delivery

**Phase 5 (US3) + Phase 6 (US4)**:
- Super-admin portal for school management
- Dynamic branding per school

### Final Delivery

**Phase 7 (US5) + Phase 8 (US6)**:
- Fees, homework, notifications, parent portal
- Complete slug-based URL routing

---

## Task Summary

| Phase | Tasks | Story | Priority |
|-------|-------|-------|---------|
| Phase 1: Setup | T001–T004 | — | — |
| Phase 2: Foundation | T005–T037 | — | Blocking |
| Phase 3: US1 Onboarding | T038–T049 | US1 | P1 🎯 MVP |
| Phase 4: US2 Cross-Tenant | T050–T055 | US2 | P1 |
| Phase 5: US3 RBAC | T056–T071 | US3 | P1 |
| Phase 6: US4 Branding | T072–T080 | US4 | P2 |
| Phase 7: US5 MVP Ops | T081–T109 | US5 | P2 |
| Phase 8: US6 Routing | T110–T113 | US6 | P2 |
| Polish | T114–T117 | — | — |
| **Total** | **117 tasks** | | |
