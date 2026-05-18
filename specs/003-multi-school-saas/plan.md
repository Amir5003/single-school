# Implementation Plan: Multi-School SaaS Platform

**Branch**: `003-multi-school-saas` | **Date**: 2026-05-17 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/003-multi-school-saas/spec.md`

---

## Summary

Convert the existing single-school MERN application into a fully multi-tenant SaaS platform serving multiple schools under a shared MongoDB database. Each school is identified by a URL-safe `slug` (e.g., `sunrise-academy`) for public routes and by a JWT-embedded `schoolId` (ObjectId) for all authenticated API calls. The platform adds: school self-service onboarding, dynamic per-school branding (logo + colours), a 5-tier RBAC system (super-admin / school-admin / teacher / student / parent), three new feature domains (fees, homework, in-platform notifications), and a super-admin portal for school lifecycle management. Existing single-school data is migrated to a default seed school via an idempotent migration script.

---

## Technical Context

**Language/Version**: JavaScript (Node.js 20 LTS) + JSX (React 18)  
**Primary Dependencies**:
- Backend: Express 4.x, Mongoose 8.x, jsonwebtoken 9.x, bcryptjs, express-validator 7.x, `lru-cache`, `node-cron`, `cloudinary` + `multer-storage-cloudinary`
- Frontend: Vite 5, React 18, React Router 6, Redux Toolkit 2.x, Axios 1.x, Tailwind CSS 3.x, Framer Motion 11.x  

**Storage**: MongoDB Atlas (shared database, all schools in same cluster)  
**Testing**: Jest 29 + Supertest 7 + mongodb-memory-server (backend), Vitest 1 + React Testing Library 14 (frontend)  
**Target Platform**: Deployed on Vercel (frontend) + Render (backend) + MongoDB Atlas  
**Project Type**: Multi-tenant SaaS web application  
**Performance Goals**: <500ms p95 for authenticated queries; slug check <300ms; onboarding form <3s  
**Constraints**: Shared MongoDB cluster (no per-tenant DB); in-process LRU cache (no Redis for v1); Cloudinary for image storage; no payment gateway v1  
**Scale/Scope**: MVP targeting ~100 schools, ~500 users per school; ~59 API endpoints; ~12 Mongoose models; ~14 frontend pages

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — all gates pass.*

| Principle | Addressed? | Notes |
|-----------|-----------|-------|
| I. Code Quality | ✅ | Modular service/controller/model/middleware layers; no cross-layer leaks; REST naming via `/api/v1/` prefix |
| II. Testing Standards | ✅ | Cross-tenant leakage tests mandatory; RBAC tests cover all 5 roles × endpoints; Jest + Supertest; >70% coverage target |
| III. User Experience Consistency | ✅ | Shared layout shell per role; school branding applied via CSS custom properties; consistent feedback (toast, loading, error) |
| IV. Performance Requirements | ✅ | Compound indexes on all `(schoolId, <lookup>)` fields; pagination on all list endpoints; LRU cache for slug→school resolution; <500ms goal |
| V. Security | ✅ | JWT httpOnly cookies; 5-tier RBAC; schoolScope middleware enforces cross-tenant isolation; service-layer schoolId injection; super-admin restricted to platform routes; bcrypt rounds=12 |
| VI. Scalability | ✅ | Shared DB + schoolId on all tenant-scoped collections; compound indexes; stateless services; soft deletes; super-admin portal; migration script for existing data |
| VII. UI Animation & Modern Design | ✅ | Framer Motion on student module; school branding via CSS variables; mobile-first Tailwind; prefers-reduced-motion respected; onboarding flow animated |
| VIII. Multi-Tenancy & School Isolation | ✅ | School entity with slug; slugToSchool middleware; schoolScope middleware; JWT-embedded schoolId; super-admin tier; cross-tenant leakage integration tests; ParentStudentLink schoolId validation |

**Multi-Tenancy Gate**:
- ✅ `schoolId` added to all new and existing tenant-scoped models (see data-model.md)
- ✅ `schoolScope` middleware applied to all authenticated non-platform routes
- ✅ Cross-tenant isolation assertions in integration test suite
- ✅ Public routes use `slugToSchool` middleware (not raw schoolId in URL)

---

## Project Structure

### Documentation (this feature)

```text
specs/003-multi-school-saas/
├── plan.md          ← this file
├── spec.md
├── research.md      ← Phase 0 (8 decisions resolved)
├── data-model.md    ← Phase 1 (13 entities, migration delta)
├── quickstart.md    ← Phase 1
├── contracts/
│   └── api.md       ← Phase 1 (~59 endpoints, 8 route groups)
├── checklists/
│   └── requirements.md
└── tasks.md         ← Phase 2 (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── scripts/
│   ├── migrate-to-multitenant.js  ← NEW: one-time migration script
│   └── seed-super-admin.js        ← NEW: super-admin seed
├── src/
│   ├── config/
│   │   ├── db.js
│   │   ├── env.js
│   │   └── cloudinary.js          ← NEW: Cloudinary SDK config
│   ├── models/
│   │   ├── School.model.js        ← NEW
│   │   ├── ParentStudentLink.model.js ← NEW
│   │   ├── Fee.model.js           ← NEW
│   │   ├── Homework.model.js      ← NEW
│   │   ├── Notification.model.js  ← NEW
│   │   ├── User.model.js          ← MODIFIED (schoolId, new roles, refreshTokenHash)
│   │   ├── Student.model.js       ← MODIFIED (schoolId, compound indexes)
│   │   ├── Teacher.model.js       ← MODIFIED (schoolId, compound indexes)
│   │   ├── Class.model.js         ← MODIFIED (schoolId, compound indexes)
│   │   ├── ClassTeacher.model.js  ← MODIFIED (schoolId)
│   │   ├── Attendance.model.js    ← MODIFIED (schoolId)
│   │   ├── Marks.model.js         ← MODIFIED (schoolId)
│   │   ├── Timetable.model.js     ← MODIFIED (schoolId)
│   │   └── Announcement.model.js  ← MODIFIED (schoolId)
│   ├── middleware/
│   │   ├── authenticate.js        ← MODIFIED (embed schoolId in req.user)
│   │   ├── authorize.js           ← MODIFIED (5 roles)
│   │   ├── schoolScope.js         ← NEW: validates schoolId from JWT, checks isActive
│   │   ├── slugToSchool.js        ← NEW: resolves :slug param → schoolId
│   │   ├── uploadMiddleware.js    ← NEW: multer-storage-cloudinary
│   │   ├── validate.js            ← existing
│   │   └── errorHandler.js        ← existing
│   ├── services/
│   │   ├── school.service.js      ← NEW
│   │   ├── onboarding.service.js  ← NEW
│   │   ├── parent.service.js      ← NEW
│   │   ├── fee.service.js         ← NEW
│   │   ├── homework.service.js    ← NEW
│   │   ├── notification.service.js ← NEW
│   │   ├── platform.service.js    ← NEW (super-admin operations)
│   │   ├── slugCache.service.js   ← NEW (LRU cache wrapper)
│   │   ├── auth.service.js        ← MODIFIED (schoolId in JWT, refresh token)
│   │   ├── student.service.js     ← MODIFIED (schoolId filter)
│   │   ├── teacher.service.js     ← MODIFIED (schoolId filter)
│   │   ├── class.service.js       ← MODIFIED (schoolId filter)
│   │   ├── attendance.service.js  ← MODIFIED (schoolId filter)
│   │   ├── marks.service.js       ← MODIFIED (schoolId filter)
│   │   ├── timetable.service.js   ← MODIFIED (schoolId filter)
│   │   └── announcement.service.js ← MODIFIED (schoolId filter)
│   ├── controllers/
│   │   ├── onboarding.controller.js ← NEW
│   │   ├── platform.controller.js   ← NEW
│   │   ├── parent.controller.js     ← NEW
│   │   ├── fee.controller.js        ← NEW
│   │   ├── homework.controller.js   ← NEW
│   │   ├── notification.controller.js ← NEW
│   │   └── admin/, teacher/, student/ ← MODIFIED (branding, new endpoints)
│   ├── routes/
│   │   ├── onboarding.routes.js   ← NEW
│   │   ├── platform.routes.js     ← NEW (super-admin)
│   │   ├── parent.routes.js       ← NEW
│   │   ├── public.routes.js       ← MODIFIED (school config, public timetable)
│   │   ├── admin.routes.js        ← MODIFIED (fees, branding, parent mgmt)
│   │   ├── teacher.routes.js      ← MODIFIED (homework, notifications)
│   │   ├── student.routes.js      ← MODIFIED (fees, homework, notifications)
│   │   └── auth.routes.js         ← MODIFIED (refresh token endpoint)
│   ├── validators/
│   │   ├── school.validator.js    ← NEW
│   │   ├── onboarding.validator.js ← NEW
│   │   ├── fee.validator.js       ← NEW
│   │   ├── homework.validator.js  ← NEW
│   │   └── [existing validators]  ← MODIFIED (add schoolId where needed)
│   ├── jobs/
│   │   └── feeOverdueJob.js       ← NEW: daily cron for pending→overdue transition
│   └── utils/
│       ├── ApiError.js            ← existing
│       ├── ApiResponse.js         ← existing
│       └── logger.js              ← existing
├── tests/
│   ├── integration/
│   │   ├── cross-tenant.test.js   ← NEW (mandatory isolation tests)
│   │   ├── rbac.test.js           ← NEW (5-role × endpoint matrix)
│   │   ├── onboarding.test.js     ← NEW
│   │   ├── platform.test.js       ← NEW
│   │   ├── fee.test.js            ← NEW
│   │   ├── homework.test.js       ← NEW
│   │   ├── notifications.test.js  ← NEW
│   │   └── [existing tests]       ← MODIFIED (add schoolId to fixtures)
│   └── unit/
│       ├── slugCache.test.js      ← NEW
│       └── [existing unit tests]  ← MODIFIED

frontend/
├── src/
│   ├── api/
│   │   ├── onboarding.api.js      ← NEW
│   │   ├── platform.api.js        ← NEW
│   │   ├── parent.api.js          ← NEW
│   │   ├── fee.api.js             ← NEW
│   │   ├── homework.api.js        ← NEW
│   │   ├── notification.api.js    ← NEW
│   │   └── [existing *.api.js]    ← MODIFIED (ensure schoolId context)
│   ├── components/
│   │   ├── common/
│   │   │   ├── SchoolBrandingProvider.jsx ← NEW (CSS custom properties from branding config)
│   │   │   └── [existing components]
│   │   ├── admin/                 ← MODIFIED + NEW (branding form, fee table, parent mgmt)
│   │   ├── teacher/               ← MODIFIED + NEW (homework form, notification sender)
│   │   ├── student/               ← MODIFIED + NEW (fees card, homework card, notifications)
│   │   └── parent/                ← NEW (children list, child attendance/marks/fees views)
│   ├── pages/
│   │   ├── Onboarding.jsx         ← NEW (school registration page)
│   │   ├── SchoolLanding.jsx      ← NEW (/schools/:slug)
│   │   ├── platform/              ← NEW (super-admin portal pages)
│   │   ├── parent/                ← NEW (parent dashboard)
│   │   └── [existing admin/teacher/student pages] ← MODIFIED
│   ├── hooks/
│   │   ├── useSchoolBranding.js   ← NEW
│   │   └── [existing hooks]
│   ├── redux/
│   │   ├── slices/
│   │   │   ├── authSlice.js       ← MODIFIED (add schoolId to auth state)
│   │   │   └── schoolSlice.js     ← NEW (branding, school config)
│   │   └── store.js               ← MODIFIED (add schoolSlice)
│   └── utils/
│       └── animationVariants.js   ← existing (reused for new pages)
```

**Structure Decision**: Web application (Option 2) — `backend/` + `frontend/` split. The addition is a new `backend/scripts/` directory for migration and seeding utilities, plus a `backend/src/jobs/` directory for the daily fee overdue cron. All new source code follows the existing `routes → controllers → services → models` architecture from the constitution.

---

## Phase 0: Research Summary

All NEEDS CLARIFICATION items resolved in [research.md](research.md):

| Decision | Resolution |
|----------|-----------|
| Multi-tenancy strategy | Shared DB + schoolId compound indexes (not per-tenant DB) |
| JWT tenant context | Embed schoolId in payload; schoolScope validates isActive via LRU cache |
| Slug resolution cache | In-memory LRU (`lru-cache`, 5-min TTL, max 500 entries) — no Redis for v1 |
| Path vs subdomain routing | Path-based (`/schools/:slug/`) for v1; subdomain is optional deployment config |
| Image storage | Cloudinary via `multer-storage-cloudinary` |
| Migration strategy | Idempotent `migrate-to-multitenant.js` script with `_migrations` collection guard |
| Parent data access | ParentStudentLink junction; parent JWT carries schoolId; service validates link ownership |
| Fee management | Manual status tracking by school-admin; daily `node-cron` for overdue transition |

---

## Phase 1: Design Artifacts

All generated and complete:

| Artifact | Path | Status |
|----------|------|--------|
| Data Model | [data-model.md](data-model.md) | ✅ |
| API Contracts | [contracts/api.md](contracts/api.md) | ✅ |
| Quickstart Guide | [quickstart.md](quickstart.md) | ✅ |

### Constitution Re-check (Post-Design)

All 8 principles remain satisfied after Phase 1 design:
- Data model adds `schoolId` to all 9 existing collections + 5 new collections — Principle VIII compliant
- API contract explicitly lists `schoolScope` in middleware chain for every authenticated non-public route — Principle V compliant
- All list endpoints include `page`/`limit` pagination — Principle IV compliant
- Soft delete preserved on Student, Teacher, Homework — Principle VI compliant
- No API endpoint in contracts returns cross-tenant data — verified manually

### No Complexity Violations

No constitution principle violations requiring justification. The LRU cache and `node-cron` are minimal additions well within the YAGNI bounds of constitution Principle I (no over-engineering).

---

## Next Step

Run `/speckit.tasks` to generate the implementation task list from this plan.

**Tasks will cover**:
1. Migration script + super-admin seed
2. School model + updated User/Student/Teacher/Class/etc. models
3. New middleware (schoolScope, slugToSchool, uploadMiddleware)
4. Auth service updates (schoolId in JWT, refresh token)
5. All new services (school, onboarding, parent, fee, homework, notification, platform, slugCache)
6. All new controllers + routes
7. Cross-tenant + RBAC integration tests (mandatory)
8. Frontend SchoolBrandingProvider + school context routing
9. New frontend pages (onboarding, school landing, platform portal, parent portal)
10. New student/teacher/admin feature pages (fees, homework, notifications)
