# School Management System — Development Guidelines

Auto-generated from feature plan `003-multi-school-saas`. Last updated: 2026-05-17

## Active Technologies

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4.x
- **ODM**: Mongoose 8.x (MongoDB)
- **Auth**: JWT (jsonwebtoken 9.x) in httpOnly cookies, bcryptjs (rounds=12); `schoolId` embedded in access token; separate 7-day refresh token cookie
- **Multi-Tenancy**: Shared MongoDB database; `schoolId` ObjectId on every tenant-scoped collection; `schoolScope` middleware + `slugToSchool` middleware
- **Cache**: `lru-cache` (in-process, max 500 entries, 5-min TTL) for slug→schoolId resolution
- **Jobs**: `node-cron` — daily fee overdue status transition (`pending → overdue`)
- **Image Storage**: `cloudinary` + `multer-storage-cloudinary` (logos, homework attachments)
- **Validation**: express-validator 7.x
- **Testing**: Jest 29 + Supertest 7 + mongodb-memory-server

### Frontend
- **Build Tool**: Vite 5 + React 18
- **Routing**: React Router 6 (declarative routes with `<Routes>`); school context via `/schools/:slug/` path prefix
- **State**: Redux Toolkit 2.x (`authSlice` + `uiSlice` + `schoolSlice`); component-local state for forms
- **HTTP Client**: Axios 1.x with `withCredentials: true` (cookie auth)
- **Styling**: Tailwind CSS 3.x — utility-first; per-school branding applied via CSS custom properties from `schoolSlice`
- **Animations**: Framer Motion 11.x — `motion.div`, `AnimatePresence`, `variants`
- **Testing**: Vitest 1 + React Testing Library 14

### Deployment
- **Frontend**: Vercel (auto-deploy from `frontend/` directory)
- **Backend**: Render (Node.js Web Service)
- **Database**: MongoDB Atlas (shared cluster, multi-tenant)

## Project Structure

```text
school-management/
├── backend/
│   ├── scripts/            # migrate-to-multitenant.js, seed-super-admin.js
│   ├── src/
│   │   ├── config/         # db.js, env.js, cloudinary.js
│   │   ├── models/         # Mongoose schemas (all have schoolId; School.model.js is new)
│   │   ├── validators/     # express-validator chains per entity
│   │   ├── middleware/     # authenticate.js, authorize.js, schoolScope.js, slugToSchool.js, validate.js, errorHandler.js, uploadMiddleware.js
│   │   ├── services/       # Business logic (DB access lives here only; all filter by schoolId)
│   │   ├── controllers/    # HTTP request/response; delegates to services
│   │   ├── routes/         # auth, admin, teacher, student, public, onboarding, platform (super-admin), parent
│   │   ├── jobs/           # feeOverdueJob.js (node-cron)
│   │   └── utils/          # ApiResponse, ApiError, logger
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/    # cross-tenant.test.js and rbac.test.js are mandatory
│   └── server.js
└── frontend/
    ├── src/
    │   ├── api/            # axiosInstance + per-role API functions (+ onboarding.api, platform.api, parent.api, fee.api, homework.api, notification.api)
    │   ├── components/
    │   │   ├── common/     # Layout, Navbar, ProtectedRoute, SchoolBrandingProvider, modals
    │   │   ├── admin/      # Admin-specific form components
    │   │   ├── teacher/    # Teacher-specific components
    │   │   ├── student/    # Student cards (ALL animated with Framer Motion)
    │   │   └── parent/     # Parent-specific components
    │   ├── pages/          # Route-level page components by role (+ platform/, parent/, Onboarding.jsx, SchoolLanding.jsx)
    │   ├── redux/          # store.js + slices/ (authSlice, uiSlice, schoolSlice)
    │   ├── hooks/          # useAuth, useApi, useSchoolBranding
    │   └── utils/          # formatDate, calculatePercentage, animationVariants
    └── vite.config.js
```

## Commands

```bash
# Backend
cd backend && npm run dev          # Dev server (nodemon)
cd backend && npm test             # All tests
cd backend && npm test -- --coverage   # Coverage report

# Frontend
cd frontend && npm run dev         # Vite dev server (:5173)
cd frontend && npm run build       # Production build
cd frontend && npm test            # Vitest component tests

# Both servers together (from root)
npm run dev
```

## Code Style

### Backend (JavaScript / Node.js)
- **Naming**: camelCase for variables/functions, PascalCase for classes/models, SCREAMING_SNAKE_CASE for env constants
- **Route handler pattern**: Controller calls service; controller never imports models directly
- **Error handling**: Throw `ApiError` in services; `errorHandler.js` middleware catches all
- **Async pattern**: `async/await` everywhere; wrap route handlers with try/catch or `asyncHandler` utility
- **Response format**: Always use `ApiResponse` wrapper: `{ success, message, data }`

### Frontend (React / JSX)
- **Naming**: PascalCase for components, camelCase for hooks/utilities, kebab-case for CSS classes
- **Component pattern**: Functional components only; no class components
- **State**: Keep state as local as possible; lift only when needed; Redux only for auth + UI global state
- **API calls**: All `axios` calls go through `/api/*.api.js` functions — no inline `axios.get()` in components
- **Animation**: Student module components MUST use `motion.div` with variants from `animationVariants.js`; check `prefers-reduced-motion`

### Security Non-Negotiables
- `bcryptjs` rounds = 12 (never lower)
- JWT cookie: `httpOnly: true, sameSite: 'none', secure: true` in production
- All protected routes: `authenticate` + `schoolScope` + `authorize(role)` middleware — no exceptions
- Never log `req.body.password` or any credential fields
- Input sanitize via `express-validator` on every mutation endpoint
- `schoolId` must be injected from `req.school` (set by `schoolScope`) — never trust `req.body.schoolId`
- Super-admin routes under `/api/v1/platform/` use `authenticate` + `authorize('super-admin')` only (no schoolScope)

## Recent Changes

### 003-multi-school-saas (2026-05-17)
**Added**:
- Multi-school SaaS architecture: shared MongoDB with `schoolId` on all tenant-scoped collections
- School entity: slug, branding (logo, primaryColour, secondaryColour), isActive flag
- 5-tier RBAC: super-admin, school-admin (was admin), teacher, student, parent
- `schoolScope` middleware: validates JWT `schoolId` + checks school `isActive`
- `slugToSchool` middleware: resolves `:slug` URL param → schoolId via LRU cache
- JWT-embedded `schoolId` (access token 15m); refresh token (7d httpOnly cookie)
- LRU slug cache: `lru-cache` in-process, 500 entries, 5-min TTL
- 5 new Mongoose collections: School, ParentStudentLink, Fee, Homework, Notification
- Fee module: pending → paid | overdue state machine; daily `node-cron` job for overdue transition
- Homework module: file attachments via Cloudinary (`multer-storage-cloudinary`)
- Notification module: in-platform notifications with per-user `readBy` tracking
- Parent portal: read-only access to linked children's attendance, marks, fees, homework
- Super-admin portal: school lifecycle management (approve, suspend, analytics) at `/api/v1/platform/`
- SaaS onboarding: public slug-check + school registration endpoints
- Migration script: `scripts/migrate-to-multitenant.js` (idempotent, guarded by `_migrations` collection)
- Dynamic branding: CSS custom properties per school applied via `SchoolBrandingProvider`

### 001-school-management (2026-04-07)
**Added**:
- Complete backend architecture: models, validators, services, controllers, routes, middleware
- 9 MongoDB collections: users, students, teachers, classes, class_teachers, timetable, attendance, marks, announcements
- JWT auth system with httpOnly cookies and RBAC (admin/teacher/student)
- Full REST API: `/api/v1/auth/*`, `/api/v1/admin/*`, `/api/v1/teacher/*`, `/api/v1/student/*`, `/api/v1/public/*`
- React SPA with Vite 5, role-based protected routing
- Admin dashboard: student/teacher/class/timetable management
- Teacher dashboard: attendance marking (bulk), marks entry (upsert), announcements
- Student dashboard: profile, timetable, attendance summary, marks (all Framer Motion animated)
- `animationVariants.js`: `fadeInUp`, `staggerContainer`, `slideInRight`, `scaleIn` variants
- Deployment: Vercel (frontend) + Render (backend) + MongoDB Atlas

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
