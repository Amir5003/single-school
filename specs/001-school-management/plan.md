# Implementation Plan: School Management System

**Branch**: `001-school-management` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-school-management/spec.md`

## Summary

Build a complete MERN-based School Management System with role-based access (Admin, Teacher, Student). The system provides Admin with full user/class/timetable management, Teachers with attendance marking and marks entry, and Students with a modern animated dashboard presenting personal academic data. Deployed with frontend on Vercel, backend on Render, and database on MongoDB Atlas. Seven implementation phases from project bootstrap through final deployment.

## Technical Context

**Language/Version**: Node.js 20 LTS (backend); React 18 + Vite 5 (frontend)  
**Primary Dependencies**: Express 4.x, Mongoose 8.x, jsonwebtoken 9.x, bcryptjs 2.x, cookie-parser 1.x; React Router 6, Axios 1.x, Redux Toolkit 2.x, Tailwind CSS 3.x, Framer Motion 11.x  
**Storage**: MongoDB Atlas (cloud-hosted); 8 separate collections: users, students, teachers, classes, class_teachers, timetable, attendance, marks, announcements  
**Testing**: Jest 29 + Supertest 7 (backend integration + unit); Vitest 1 + React Testing Library 14 (frontend component tests)  
**Target Platform**: Web application; Backend: Render (Linux container, Node.js); Frontend: Vercel (CDN/Edge); Database: MongoDB Atlas (M0 free tier → M2 for production)  
**Project Type**: Full-stack web application (Express REST API + React SPA)  
**Performance Goals**: API p95 < 500ms; Student module animations at 60fps; Initial page load < 2s on 3G connection  
**Constraints**: MERN stack only; minimal frontend libraries (React Router + Axios + Tailwind + Framer Motion); Vercel + Render deployment; Constitution v1.1.0 compliance  
**Scale/Scope**: v1 targets ≤ 500 concurrent users; ~1000 students, ~50 teachers, ~30 classes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Verdict | Notes |
|-----------|-------|---------|-------|
| I. Code Quality | Layered architecture: routes → controllers → services → models; camelCase JS, schema-level field naming; shared utility components; all endpoints follow REST verbs + status codes | ✅ PASS | No violations |
| II. Testing Standards | Each route independently tested with Supertest; Jest unit tests for service logic; express-validator on every route handler | ✅ PASS | 70% coverage target enforced |
| III. UX Consistency | Single shared `Layout.jsx` wraps all dashboards; Tailwind design tokens (colors, spacing) applied globally; all forms use shared `StatusMessage` component | ✅ PASS | No deviations |
| IV. Performance | MongoDB compound indexes on all query filters; pagination on list endpoints (20/page); React.memo + useMemo in list components; Axios request deduplication | ✅ PASS | <500ms goal achievable |
| V. Security | JWT in httpOnly + sameSite cookies; RBAC middleware on every protected route; express-validator sanitizes all inputs; bcrypt rounds=12 for passwords; no credentials in logs | ✅ PASS | No violations |
| VI. Scalability | Schemas include `isDeleted`, `examType`, future-ready fields; services never import each other directly; stateless Express; soft-delete everywhere | ✅ PASS | Fees/exams ready |
| VII. UI Animation & Modern Design | Framer Motion `AnimatePresence` + `motion.div` on all Student module pages; Tailwind glassmorphism cards; `prefers-reduced-motion` respected via Framer Motion config | ✅ PASS | Student module priority |

**Constitution Check Result: ALL GATES PASS — Proceed to Phase 0**

## Project Structure

### Documentation (this feature)

```text
specs/001-school-management/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output
├── checklists/
│   └── requirements.md  ← Spec quality checklist
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
school-management/               ← project root (monorepo)
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js            ← MongoDB connection
│   │   │   └── env.js           ← env var validation
│   │   ├── models/
│   │   │   ├── User.model.js
│   │   │   ├── Student.model.js
│   │   │   ├── Teacher.model.js
│   │   │   ├── Class.model.js
│   │   │   ├── ClassTeacher.model.js
│   │   │   ├── Timetable.model.js
│   │   │   ├── Attendance.model.js
│   │   │   ├── Marks.model.js
│   │   │   └── Announcement.model.js
│   │   ├── validators/
│   │   │   ├── auth.validator.js
│   │   │   ├── student.validator.js
│   │   │   ├── teacher.validator.js
│   │   │   ├── class.validator.js
│   │   │   ├── timetable.validator.js
│   │   │   ├── attendance.validator.js
│   │   │   └── marks.validator.js
│   │   ├── middleware/
│   │   │   ├── authenticate.js  ← verifies JWT, attaches req.user
│   │   │   ├── authorize.js     ← role-based guard factory: authorize('admin')
│   │   │   ├── validate.js      ← runs express-validator chain, returns 422
│   │   │   └── errorHandler.js  ← global error handler
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── student.service.js
│   │   │   ├── teacher.service.js
│   │   │   ├── class.service.js
│   │   │   ├── timetable.service.js
│   │   │   ├── attendance.service.js
│   │   │   ├── marks.service.js
│   │   │   └── announcement.service.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── admin/
│   │   │   │   ├── student.controller.js
│   │   │   │   ├── teacher.controller.js
│   │   │   │   ├── class.controller.js
│   │   │   │   └── timetable.controller.js
│   │   │   ├── teacher/
│   │   │   │   ├── attendance.controller.js
│   │   │   │   ├── marks.controller.js
│   │   │   │   └── announcement.controller.js
│   │   │   └── student/
│   │   │       └── student.controller.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── admin.routes.js
│   │   │   ├── teacher.routes.js
│   │   │   ├── student.routes.js
│   │   │   └── public.routes.js
│   │   ├── utils/
│   │   │   ├── ApiResponse.js   ← { success, data, message } wrapper
│   │   │   ├── ApiError.js      ← extends Error with statusCode
│   │   │   └── logger.js        ← structured logging (no credentials)
│   │   └── app.js               ← Express app factory (no listen)
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── services/        ← service function unit tests
│   │   │   └── validators/      ← validator chain tests
│   │   └── integration/
│   │       ├── auth.test.js
│   │       ├── admin.students.test.js
│   │       ├── admin.teachers.test.js
│   │       ├── admin.classes.test.js
│   │       ├── admin.timetable.test.js
│   │       ├── teacher.attendance.test.js
│   │       ├── teacher.marks.test.js
│   │       └── student.test.js
│   ├── .env.example
│   ├── jest.config.js
│   ├── package.json
│   └── server.js                ← entry point (calls app.listen)
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axiosInstance.js ← base URL, credentials, interceptors
│   │   │   ├── auth.api.js
│   │   │   ├── admin.api.js
│   │   │   ├── teacher.api.js
│   │   │   └── student.api.js
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Layout.jsx        ← shared shell (Navbar + Sidebar + Content)
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── ProtectedRoute.jsx
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   ├── ConfirmModal.jsx
│   │   │   │   ├── StatusMessage.jsx ← shared success/error feedback
│   │   │   │   ├── Pagination.jsx
│   │   │   │   └── EmptyState.jsx
│   │   │   ├── admin/
│   │   │   │   ├── StudentForm.jsx
│   │   │   │   ├── TeacherForm.jsx
│   │   │   │   ├── ClassForm.jsx
│   │   │   │   └── TimetableForm.jsx
│   │   │   ├── teacher/
│   │   │   │   ├── AttendanceTable.jsx
│   │   │   │   ├── MarksTable.jsx
│   │   │   │   └── AnnouncementForm.jsx
│   │   │   └── student/             ← ALL use Framer Motion animations
│   │   │       ├── ProfileCard.jsx
│   │   │       ├── TimetableCard.jsx
│   │   │       ├── AttendanceSummary.jsx
│   │   │       ├── MarksCard.jsx
│   │   │       └── AnnouncementCard.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── NotFound.jsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── StudentsPage.jsx
│   │   │   │   ├── TeachersPage.jsx
│   │   │   │   ├── ClassesPage.jsx
│   │   │   │   └── TimetablePage.jsx
│   │   │   ├── teacher/
│   │   │   │   ├── TeacherDashboard.jsx
│   │   │   │   ├── AttendancePage.jsx
│   │   │   │   ├── MarksPage.jsx
│   │   │   │   └── AnnouncementsPage.jsx
│   │   │   └── student/             ← AnimatePresence wraps all routes
│   │   │       ├── StudentDashboard.jsx
│   │   │       ├── ProfilePage.jsx
│   │   │       ├── TimetablePage.jsx
│   │   │       ├── AttendancePage.jsx
│   │   │       └── MarksPage.jsx
│   │   ├── redux/
│   │   │   ├── store.js
│   │   │   └── slices/
│   │   │       ├── authSlice.js     ← user, token, role state
│   │   │       └── uiSlice.js       ← loading, toast messages
│   │   ├── hooks/
│   │   │   ├── useAuth.js           ← wraps authSlice selectors
│   │   │   └── useApi.js            ← loading/error state wrapper
│   │   ├── utils/
│   │   │   ├── formatDate.js
│   │   │   ├── calculatePercentage.js
│   │   │   └── animationVariants.js ← reusable Framer Motion variants
│   │   ├── App.jsx                  ← router + AnimatePresence root
│   │   ├── main.jsx
│   │   └── index.css                ← Tailwind directives
│   ├── public/
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

**Structure Decision**: Web Application (Option 2 from plan template). Clear `backend/` and `frontend/` separation at project root. Backend uses layered architecture (routes → controllers → services → models) per Principle I. Frontend uses feature-grouped components under `admin/`, `teacher/`, `student/` subdirectories per role separation. All Student UI components use Framer Motion per Principle VII.

## Implementation Phases

### Phase 1 — Project Bootstrap & Infrastructure
**Goal**: Repository initialized; both dev servers running; MongoDB connected; CI-ready  
**Effort**: ~2 days  
**Deliverables**: Running "Hello World" backend + blank React SPA; env vars configured

| Task | Details |
|------|---------|
| 1.1 Initialize project root | `mkdir school-management && git init`; create `backend/` and `frontend/` |
| 1.2 Bootstrap backend | `npm init`; install Express, Mongoose, dotenv, cors, cookie-parser, morgan, express-validator, jsonwebtoken, bcryptjs |
| 1.3 Bootstrap frontend | `npm create vite@latest frontend -- --template react`; install Axios, React Router, Redux Toolkit, Tailwind CSS, Framer Motion |
| 1.4 Configure Tailwind | `tailwind.config.js` with custom color palette (school brand); setup `index.css` with `@tailwind` directives |
| 1.5 Setup MongoDB connection | `config/db.js` using Mongoose; connect in `server.js`; graceful disconnect on SIGTERM |
| 1.6 Create env files | `backend/.env.example` and `frontend/.env.example` with all required keys; validate on startup via `config/env.js` |
| 1.7 Global error handler | `middleware/errorHandler.js`; `utils/ApiResponse.js`; `utils/ApiError.js` |
| 1.8 Setup test infrastructure | `jest.config.js` with `--testEnvironment node`; in-memory MongoDB (mongodb-memory-server) for tests |

---

### Phase 2 — Authentication & RBAC
**Goal**: Login/register/logout working; JWT in httpOnly cookie; role middleware protecting routes; login page working in frontend  
**Effort**: ~3 days  
**Deliverables**: `POST /api/v1/auth/*`; React Login page; ProtectedRoute component; Redux authSlice

| Task | Details |
|------|---------|
| 2.1 User model | `User.model.js`: email (unique), password (bcrypt pre-save hook, rounds=12), role (enum: admin/teacher/student), name, phone, isActive |
| 2.2 Auth validators | `auth.validator.js`: email format, password regex, role enum check |
| 2.3 Auth service | `auth.service.js`: `register()`, `login()` (compare hash), `logout()`; sign JWT with 7d expiry |
| 2.4 Auth controller | `auth.controller.js`: set httpOnly+sameSite=strict cookie on login; clear cookie on logout |
| 2.5 authenticate middleware | Verify JWT from `req.cookies.token`; attach `req.user`; return 401 if missing/invalid |
| 2.6 authorize middleware | `authorize(...roles)` factory; return 403 if `req.user.role` not in allowed roles |
| 2.7 Auth routes | `POST /api/v1/auth/register`, `/login`, `/logout`, `GET /api/v1/auth/me` |
| 2.8 Auth integration tests | `tests/integration/auth.test.js`: register, login, logout, bad credentials, role rejection |
| 2.9 Frontend Login page | `pages/Login.jsx` with Tailwind styled form; Axios POST to `/auth/login`; dispatch to authSlice |
| 2.10 Redux authSlice | Store `{ user, role, isAuthenticated }`; persist to sessionStorage |
| 2.11 ProtectedRoute | `components/common/ProtectedRoute.jsx`; redirect to `/login` if not authenticated or wrong role |
| 2.12 App router setup | `App.jsx` with React Router 6 `<Routes>`; `/login`, `/admin/*`, `/teacher/*`, `/student/*` all guarded |

---

### Phase 3 — Admin Module
**Goal**: Admin can fully manage Students, Teachers, Classes, and Timetable via CRUD APIs and React pages  
**Effort**: ~4 days  
**Deliverables**: Admin dashboard; Students/Teachers/Classes/Timetable CRUD pages

| Task | Details |
|------|---------|
| 3.1 Models | `Student.model.js`, `Teacher.model.js`, `Class.model.js`, `ClassTeacher.model.js` (see data-model.md) |
| 3.2 Student service + controller | createStudent, listStudents (paginate+search), getStudent, updateStudent, softDeleteStudent |
| 3.3 Teacher service + controller | createTeacher, listTeachers, getTeacher, updateTeacher, deleteTeacher, assignToClass |
| 3.4 Class service + controller | createClass, listClasses, getClass, updateClass, deleteClass, assignStudents |
| 3.5 Timetable service + controller | createEntry, listByClass, updateEntry, deleteEntry (conflict validation in service) |
| 3.6 Admin routes | All protected with `authenticate + authorize('admin')` |
| 3.7 Input validators | Validators for all 4 entities; run via `validate.js` middleware |
| 3.8 MongoDB indexes | `enrollment_id (unique)`, `employee_id (unique)`, `class+teacher+subject (compound unique)` |
| 3.9 Admin integration tests | Tests for each route: happy path, validation failures, auth/authz rejections, pagination |
| 3.10 Frontend AdminDashboard | Summary cards (student count, teacher count, class count) |
| 3.11 Frontend StudentsPage | Table with pagination + search; Create/Edit/Delete with ConfirmModal |
| 3.12 Frontend TeachersPage | Table with class assignment UI |
| 3.13 Frontend ClassesPage | Class cards with student + teacher assignment |
| 3.14 Frontend TimetablePage | Weekly grid view; form for adding periods; conflict error display |

---

### Phase 4 — Teacher Module
**Goal**: Teacher can view assigned classes, mark attendance, add/update marks, and post announcements  
**Effort**: ~3 days  
**Deliverables**: Teacher dashboard; Attendance marking; Marks entry; Announcements

| Task | Details |
|------|---------|
| 4.1 Attendance model | `Attendance.model.js`; compound unique index `(studentId, date)` |
| 4.2 Marks model | `Marks.model.js`; compound unique index `(studentId, subject, classId, examType)` |
| 4.3 Announcement model | `Announcement.model.js` |
| 4.4 Attendance service | `markBulkAttendance(classId, date, records)`; prevent future dates; upsert semantics |
| 4.5 Marks service | `upsertMark(studentId, subject, classId, marksObtained)`; validate 0-100 range |
| 4.6 Announcement service | CRUD; soft delete |
| 4.7 Teacher routes | Protected with `authenticate + authorize('teacher')` |
| 4.8 Teacher integration tests | Attendance duplicate prevention, future date rejection, marks range validation |
| 4.9 Frontend TeacherDashboard | Assigned classes list with quick-action buttons |
| 4.10 Frontend AttendancePage | Date picker; student list for selected class with Present/Absent/Leave toggle; bulk save |
| 4.11 Frontend MarksPage | Subject + class selector; student list with numeric inputs; save with validation feedback |
| 4.12 Frontend AnnouncementsPage | Post form + list of own announcements with edit/delete |

---

### Phase 5 — Student Module (Animation Priority)
**Goal**: Students view profile, timetable, attendance, marks with modern animated UI (Principle VII compliance)  
**Effort**: ~3 days  
**Deliverables**: Fully animated Student dashboard; all 4 info sections with Framer Motion

| Task | Details |
|------|---------|
| 5.1 Student read routes | `GET /api/v1/student/profile`, `/timetable`, `/attendance`, `/marks`, `/announcements` — each returns only requesting student's data |
| 5.2 `/student/attendance` response | Includes summary: `{ totalDays, presentDays, absentDays, percentage, records[] }` |
| 5.3 Student integration tests | Verify data isolation (student A cannot access student B data), 401 without auth |
| 5.4 `animationVariants.js` | Define reusable variants: `fadeInUp`, `staggerContainer`, `slideInRight`, `scaleIn` |
| 5.5 Framer Motion setup | `App.jsx`: wrap student routes with `AnimatePresence mode="wait"` for page transitions |
| 5.6 StudentDashboard | Summary cards (attendance %, latest marks, today's class) with `staggerContainer` entrance |
| 5.7 ProfilePage | `motion.div` with `fadeInUp`; glassmorphism card with Tailwind backdrop-blur |
| 5.8 TimetablePage | `motion.li` items with stagger delay; smooth scroll on mount; day filter animation |
| 5.9 AttendancePage | Animated donut chart (CSS + Framer Motion animate props); record list with `fadeInUp` |
| 5.10 MarksPage | `motion.div` per subject card; animated count-up for scores using Framer Motion `useMotionValue` |
| 5.11 `prefers-reduced-motion` | `animationVariants.js` checks `window.matchMedia('(prefers-reduced-motion: reduce)')` and returns instant transitions |

---

### Phase 6 — Integration, Home Page & Announcements
**Goal**: Cross-module flows work end-to-end; Home page complete; announcements wire up  
**Effort**: ~2 days  
**Deliverables**: Working end-to-end flows; Home page; public announcements endpoint

| Task | Details |
|------|---------|
| 6.1 Public announcements route | `GET /api/v1/public/announcements` — no auth; latest 5 only |
| 6.2 Home page | `pages/Home.jsx`: school name, tagline, contact info, latest announcements feed |
| 6.3 Cross-module flow tests | Admin creates class + assigns teacher → Teacher marks attendance → Student sees record |
| 6.4 Announcement visibility | Teacher posts → appears on Student dashboard + Home page |
| 6.5 Admin announcement management | Admin can edit/delete any announcement |
| 6.6 Error boundary | `ErrorBoundary.jsx` wrapping each dashboard; show helpful fallback UI |
| 6.7 Loading states | `LoadingSpinner.jsx` on all data-fetching hooks; skeleton loaders for Student cards |
| 6.8 Empty states | `EmptyState.jsx` shown when student has no marks/attendance yet; "Not Yet Available" message |

---

### Phase 7 — Testing, Deployment & Documentation
**Goal**: All tests passing; system deployed and accessible on Vercel + Render + MongoDB Atlas  
**Effort**: ~2 days  
**Deliverables**: Deployed production URLs; README with setup instructions; coverage report ≥ 70%

| Task | Details |
|------|---------|
| 7.1 Complete test suite | Ensure all integration tests pass; fill gaps to reach 70% coverage |
| 7.2 Frontend component tests | Vitest + RTL: Login flow, ProtectedRoute, Student dashboard card renders |
| 7.3 MongoDB Atlas setup | Create M0 cluster; create DB user with least privilege; whitelist Render IP range |
| 7.4 Backend deployment (Render) | New Web Service; Node 20; build: `npm install`; start: `node server.js`; env vars from Render dashboard |
| 7.5 Frontend deployment (Vercel) | Import frontend/ directory; set `VITE_API_URL=https://your-backend.render.com`; auto-deploy on main |
| 7.6 CORS configuration | Backend `cors()` configured for Vercel production URL and localhost:5173 |
| 7.7 Cookie SameSite policy | Confirm `sameSite: 'none', secure: true` on production JWT cookie (required for cross-origin) |
| 7.8 README.md | Project overview, tech stack, local setup steps, environment variables, deployment links |
| 7.9 Smoke test production | Login as all three roles on production URLs; verify all core flows work |

## Complexity Tracking

*No constitution violations. No exceptions required.*

## Phase 0 Artifacts

- [research.md](./research.md) — Technology decisions and best practices research
- Phase 0 complete: all NEEDS CLARIFICATION items resolved

## Phase 1 Artifacts

- [data-model.md](./data-model.md) — MongoDB schemas with field-level detail
- [contracts/api.md](./contracts/api.md) — Complete REST API contract for all endpoints
- [quickstart.md](./quickstart.md) — Local development setup guide
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) — Agent context updated

## Post-Plan Constitution Re-Check

After Phase 1 design, re-verifying all gates:

| Principle | Phase 1 Additions | Status |
|-----------|-------------------|--------|
| I. Code Quality | Folder structure enforces layers; service pattern applied uniformly | ✅ PASS |
| II. Testing Standards | Test file per route group defined; `jest.config.js` with in-memory DB | ✅ PASS |
| III. UX Consistency | Shared `Layout.jsx`, `StatusMessage.jsx`, design tokens in `tailwind.config.js` | ✅ PASS |
| IV. Performance | Indexes listed in data-model.md; pagination default 20; Axios caching hooks | ✅ PASS |
| V. Security | httpOnly+sameSite+secure cookie; bcrypt rounds=12; validator on every route | ✅ PASS |
| VI. Scalability | `examType` field in Marks; `isDeleted` on Students/Announcements; stateless Express | ✅ PASS |
| VII. UI Animation | `animationVariants.js` utility; AnimatePresence on Student routes; reduced-motion check | ✅ PASS |

**All gates pass. Plan ready for `/speckit.tasks` execution.**
