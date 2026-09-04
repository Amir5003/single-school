# School Management System

A multi-school SaaS platform for managing students, teachers, classes, timetables, attendance, exams, fees, homework, and announcements. Each school gets its own slug-scoped portal with custom branding. Five role-based dashboards: Super-Admin / School-Admin / Teacher / Student / Parent — with JWT authentication, refresh tokens, and password-reset via email.

---

## Architecture Overview

```
                          ┌─────────────────────────────────────────┐
                          │            MongoDB Atlas                 │
                          │  School · User · Student · Teacher       │
                          │  Class · Timetable · Attendance · Marks  │
                          │  Exam · Result · SubjectSubmission        │
                          │  Fee · FeeConfig · Homework               │
                          │  Announcement · Notification              │
                          │  ParentStudentLink · PasswordResetToken   │
                          └──────────────────┬──────────────────────┘
                                             │ Mongoose 9
                          ┌──────────────────▼──────────────────────┐
                          │          Express 5 (Node.js 20)          │
                          │  schoolScope middleware → tenant isolation│
                          │  slugCache (LRU) → fast slug resolution   │
                          │  feeOverdueJob (node-cron, daily 01:00)  │
                          │  Cloudinary → logos + homework files     │
                          │  Nodemailer → password-reset emails      │
                          └──────────────────┬──────────────────────┘
                                             │ REST API /api/v1
                          ┌──────────────────▼──────────────────────┐
                          │   React 19 + Vite 8 (SPA on Vercel)     │
                          │   Redux Toolkit · React Router 7         │
                          │   Framer Motion · Tailwind CSS           │
                          │   jsPDF → client-side report card PDFs   │
                          └─────────────────────────────────────────┘
```

### Multi-School Tenancy

Every school has a unique **slug** (e.g. `greenvalley`). All school-scoped URLs follow the pattern `/schools/:slug/…`. The `schoolScope` middleware resolves the JWT's embedded `schoolId` to a live School document and rejects requests to inactive schools. The `slugCache` (LRU) avoids a DB round-trip on every public request.

### Role Hierarchy

| Role | Scope | Description |
|------|-------|-------------|
| `super-admin` | Platform-wide | Manages all schools; no schoolId in token |
| `school-admin` | Single school | Full CRUD for their school's data |
| `teacher` | Single school | Attendance, marks, announcements, homework, exam submissions |
| `student` | Single school | Read-only view of own profile, results, fees, etc. |
| `parent` | Single school | Read-only view of linked children's data |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 LTS |
| Backend | Express 5.x, Mongoose 9.x (MongoDB) |
| Auth | JWT access token (httpOnly cookie, 15 min) + refresh token (httpOnly cookie, 7 d), bcryptjs (rounds = 12) |
| Validation | express-validator 7.x |
| File storage | Cloudinary (school logos, homework attachments) via Multer |
| Email | Nodemailer + Gmail SMTP (password-reset flow) |
| Scheduler | node-cron (daily fee-overdue job) |
| Rate limiting | express-rate-limit (forgot-password: 5 req / 15 min) |
| Frontend | React 19 + Vite 8, Redux Toolkit 2.x, React Router 7 |
| Styling | Tailwind CSS 3.x |
| Animation | Framer Motion 12.x |
| PDF | jsPDF + jspdf-autotable (client-side report cards) |
| Testing | Jest 29 + Supertest + mongodb-memory-server (backend), Vitest 1 + RTL (frontend) |
| Database | MongoDB Atlas (M0 free tier) |
| Deploy | Render (backend) + Vercel (frontend) |

---

## Features

### Platform (Super-Admin)
- List, activate, and deactivate tenant schools
- View pending school-admin registration requests and approve/reject them
- Platform-level analytics

### School Onboarding
- Self-service school registration with real-time slug availability check
- Newly registered schools start as inactive; a super-admin activates them

### School Administration (School-Admin)
- **Students**: CRUD, assign to classes
- **Teachers**: CRUD, assign to classes
- **Classes**: CRUD, assign teacher, bulk-assign students
- **Timetable**: create, update, delete entries per class
- **Announcements**: create, edit, delete school-wide announcements
- **User Approvals**: approve or reject pending teacher/student/parent registrations
- **Fees**: create fee records, manage fee configs (class-level templates), bulk-generate fees, mark paid, update status
- **Exams**: create exams with subjects; lifecycle state machine (draft → active → locked → published); per-exam dashboard; manage teacher subject-submissions
- **Results**: upsert results per student per exam; per-exam result report
- **School Branding**: update primary/secondary colour, tagline, address, contact, upload logo to Cloudinary
- **Notifications**: send in-app notifications to users

### Teacher Dashboard
- View assigned classes and their students
- Mark and view attendance
- Record and view marks
- Exam subject submissions: list assigned exams, enter marks as a draft, submit for admin review
- Create, edit, delete announcements (scoped to their school)
- Create homework with optional file attachment (Cloudinary); delete homework
- View in-app notifications
- Change password

### Student Dashboard
- View own profile, class timetable, attendance summary
- View marks and published exam results
- Download report card as a PDF (client-side jsPDF)
- View school announcements
- View assigned homework
- View fee status
- View in-app notifications
- Change password

### Parent Portal
- Link to one or more children in the same school
- View each child's attendance, marks, fees, homework, and notifications

### Auth & Security
- Register / Login / Logout
- JWT access token (15 min, httpOnly cookie) + JWT refresh token (7 d, httpOnly cookie)
- `/auth/refresh` silently reissues access tokens
- Forgot-password email (rate-limited) + token-based reset
- Authenticated change-password for teachers and students
- School-scope guard rejects inactive schools on every request

### Background Jobs
- **feeOverdueJob**: daily cron at 01:00 — transitions fee records from `pending` to `overdue` across all active schools

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 9
- MongoDB Atlas cluster **or** local MongoDB instance
- Gmail App Password (for password-reset emails)
- Cloudinary account (for logos and homework attachments in production)

---

## Local Setup

### 1. Clone and install root deps

```bash
git clone https://github.com/<your-org>/school-management.git
cd school-management
npm install          # installs concurrently for the root dev script
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env   # fill in real values (see env vars table below)
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL
```

### 4. Run both servers

```bash
# From the repo root:
npm run dev
# Backend  → http://localhost:5000
# Frontend → http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | HTTP port for Express server | `5000` |
| `MONGO_URI` | Yes | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/school_mgmt` |
| `JWT_SECRET` | Yes | Secret for signing access JWTs (min 32 chars) | `long_random_string_here` |
| `JWT_EXPIRES_IN` | Yes | Access token expiry | `15m` |
| `REFRESH_TOKEN_SECRET` | Yes | Separate secret for refresh JWTs | `another_long_random_string` |
| `REFRESH_TOKEN_EXPIRES_IN` | No | Refresh token expiry (default `7d`) | `7d` |
| `NODE_ENV` | No | `development` \| `production` \| `test` | `development` |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed frontend origins | `http://localhost:5173` |
| `FRONTEND_URL` | No | Base URL used in password-reset email links | `http://localhost:5173` |
| `SMTP_HOST` | No | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | No | SMTP port | `587` |
| `SMTP_USER` | No | SMTP username / Gmail address | `you@gmail.com` |
| `SMTP_PASS` | No | Gmail App Password (16-char) | `abcd efgh ijkl mnop` |
| `SMTP_FROM` | No | Sender address shown in emails | `you@gmail.com` |
| `CLOUDINARY_CLOUD_NAME` | Prod only | Cloudinary cloud name | `my-cloud` |
| `CLOUDINARY_API_KEY` | Prod only | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Prod only | Cloudinary API secret | `aBcDeFgHiJkLmNoPqRsTuVwXyZ` |
| `SUPER_ADMIN_EMAIL` | Seed only | Email for seeding the super-admin user | `superadmin@example.com` |
| `SUPER_ADMIN_PASSWORD` | Seed only | Password for the seeded super-admin | `SuperAdmin123!` |
| `SEED_SCHOOL_ID` | Seed only | MongoDB ObjectId of the seed school | `665f…` |

> Generate App Passwords at <https://myaccount.google.com/apppasswords> (requires 2FA on your Google account).

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Base URL for backend API | `http://localhost:5000/api/v1` |

---

## Running Tests

```bash
# Backend — Jest + Supertest + mongodb-memory-server
cd backend && npm test

# With coverage report
cd backend && npm run test:coverage

# Frontend — Vitest + React Testing Library
cd frontend && npm test
```

---

## API Reference

### Base URL

```
/api/v1
```

### Route Groups

| Prefix | Auth | Role | Description |
|--------|------|------|-------------|
| `GET /api/v1/health` | No | — | Health check |
| `/api/v1/auth/*` | Partial | — | Register, login, logout, refresh, me, forgot/reset/change password |
| `/api/v1/public/*` | No | — | Announcements, school config by slug, public timetable |
| `/api/v1/onboarding/*` | No | — | School slug check + self-registration |
| `/api/v1/platform/*` | Yes | `super-admin` | Schools CRUD, registration approvals, analytics |
| `/api/v1/admin/*` | Yes | `school-admin` | Full CRUD for school data (students, teachers, classes, timetable, fees, exams, results, branding, notifications) |
| `/api/v1/teacher/*` | Yes | `teacher` | Attendance, marks, announcements, homework, exam submissions, notifications |
| `/api/v1/student/*` | Yes | `student` | Profile, timetable, attendance, marks, results, report card, fees, homework, notifications |
| `/api/v1/parent/*` | Yes | `parent` | Children list; per-child attendance, marks, fees, homework, notifications |

### Notable Endpoints

```
# Auth
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/auth/forgot-password      (rate-limited: 5 / 15 min)
POST   /api/v1/auth/reset-password
PUT    /api/v1/auth/change-password      (student | teacher)

# Public
GET    /api/v1/public/announcements
GET    /api/v1/public/schools/:slug/config
GET    /api/v1/public/schools/:slug/timetable?classId=

# Onboarding
GET    /api/v1/onboarding/slug-check?slug=
POST   /api/v1/onboarding/register

# Platform (super-admin)
GET    /api/v1/platform/schools
GET    /api/v1/platform/schools/:id
PATCH  /api/v1/platform/schools/:id/activate
PATCH  /api/v1/platform/schools/:id/deactivate
GET    /api/v1/platform/analytics
GET    /api/v1/platform/pending-registrations
PATCH  /api/v1/platform/registrations/:userId/approve
PATCH  /api/v1/platform/registrations/:userId/reject

# Admin — Exams & Lifecycle
GET    /api/v1/admin/exams
POST   /api/v1/admin/exams
GET    /api/v1/admin/exams/:examId
PUT    /api/v1/admin/exams/:examId
DELETE /api/v1/admin/exams/:examId
GET    /api/v1/admin/exams/:examId/results
PUT    /api/v1/admin/exams/:examId/results
POST   /api/v1/admin/exams/:examId/activate
POST   /api/v1/admin/exams/:examId/publish
POST   /api/v1/admin/exams/:examId/revert-to-draft
GET    /api/v1/admin/exams/:examId/dashboard
POST   /api/v1/admin/exams/:examId/submissions/:submissionId/reopen
POST   /api/v1/admin/exams/:examId/submissions/:submissionId/reassign

# Admin — Fees
POST   /api/v1/admin/fees
GET    /api/v1/admin/fees
PATCH  /api/v1/admin/fees/:id/pay
PATCH  /api/v1/admin/fees/:id/status
GET    /api/v1/admin/fee-configs
POST   /api/v1/admin/fee-configs
PATCH  /api/v1/admin/fee-configs/:id
DELETE /api/v1/admin/fee-configs/:id
POST   /api/v1/admin/fee-configs/:id/generate

# Admin — School branding
PATCH  /api/v1/admin/school/branding
POST   /api/v1/admin/school/logo          (multipart/form-data)

# Teacher — Exam submissions
GET    /api/v1/teacher/exams
GET    /api/v1/teacher/exams/:examId/submissions
GET    /api/v1/teacher/submissions/:id
PUT    /api/v1/teacher/submissions/:id/marks
POST   /api/v1/teacher/submissions/:id/submit

# Teacher — Homework
POST   /api/v1/teacher/homework           (multipart/form-data)
GET    /api/v1/teacher/homework
DELETE /api/v1/teacher/homework/:id

# Student — Exams & results
GET    /api/v1/student/exams/years
GET    /api/v1/student/exams
GET    /api/v1/student/results?examId=
GET    /api/v1/student/results/:examId/report-card

# Parent
GET    /api/v1/parent/children
GET    /api/v1/parent/children/:studentId/attendance
GET    /api/v1/parent/children/:studentId/marks
GET    /api/v1/parent/children/:studentId/fees
GET    /api/v1/parent/children/:studentId/homework
GET    /api/v1/parent/children/:studentId/notifications
```

---

## Data Models (Collections)

| Collection | Key Fields |
|------------|------------|
| `School` | `name`, `slug` (unique), `plan` (free/standard/premium), `isActive`, `branding` |
| `User` | `email`, `passwordHash`, `role`, `schoolId`, `isApproved` |
| `Student` | `userId`, `schoolId`, `classId`, `rollNumber`, `guardianName` |
| `Teacher` | `userId`, `schoolId`, `subjects` |
| `Class` | `schoolId`, `name`, `section`, `teacherId`, `studentIds[]` |
| `ClassTeacher` | `schoolId`, `classId`, `teacherId` |
| `Timetable` | `schoolId`, `classId`, `day`, `period`, `subject`, `teacherId` |
| `Attendance` | `schoolId`, `classId`, `date`, `records[]` (studentId + status) |
| `Assessment` (Coursework) | `schoolId`, `classId`, `subject`, `title`, `assessmentType` (class_test/quiz/assignment/project/practical), `maxMarks`, `date` (conducted), `academicYear`, `createdBy` — one row per classroom event; **never term exams** |
| `AssessmentScore` | `schoolId`, `assessmentId`, `studentId`, `marksObtained` (null when absent), `absent`, `remarks` — unique per (assessment, student) |
| `Exam` | `schoolId`, `classId`, `name`, `year`, `term`, `subjects[]`, `state` |
| `SubjectSubmission` | `schoolId`, `examId`, `classId`, `subject`, `totalMarks`, `passMark`, `assignedTeacherId`, `marks[]`, `state` (pending/draft/submitted/locked) |
| `Result` | `schoolId`, `examId`, `studentId`, `marks[]` (subject + marksObtained), `overallPercentage`, `rank`, `published` |
| `Fee` | `schoolId`, `studentId`, `amount`, `dueDate`, `status` (pending/paid/overdue/waived) |
| `FeeConfig` | `schoolId`, `classId`, `label`, `amount`, `dueDate` — template for bulk-generating fees |
| `Homework` | `schoolId`, `classId`, `teacherId`, `title`, `description`, `attachmentUrl`, `dueDate` |
| `Announcement` | `schoolId`, `authorId`, `title`, `body`, `isDeleted` |
| `Notification` | `schoolId`, `userId`, `message`, `isRead` |
| `ParentStudentLink` | `parentId`, `studentId`, `schoolId` |
| `PasswordResetToken` | `userId`, `tokenHash`, `expiresAt` |

> **Coursework vs. Report Cards.** Two separate assessment concepts, deliberately not merged:
> **Coursework** (`Assessment` + `AssessmentScore`) is formative — class tests, quizzes, assignments,
> projects, practicals. A teacher creates a titled, dated assessment, then enters a mark, an optional
> remark and an absent flag per student. Visible to the student and parent immediately, no admin step.
> **Report Cards** (`Exam` → `SubjectSubmission` → `Result`) are summative — term exams entered by
> teachers, gated on every subject being submitted, then published by an admin, which is what makes
> them visible and computes ranks. A teacher cannot record a term exam through Coursework.
> See `specs/008-coursework-report-cards/` and `specs/009-coursework-assessments/`.

---

## Project Structure

```
school-management/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # Mongoose connection
│   │   │   ├── env.js             # Env var validation + export
│   │   │   ├── cloudinary.js      # Cloudinary SDK config
│   │   │   └── mailer.js          # Nodemailer transporter
│   │   ├── models/                # 17 Mongoose schemas (see Data Models)
│   │   ├── validators/            # express-validator chains per resource
│   │   ├── middleware/
│   │   │   ├── authenticate.js    # JWT access-token verification
│   │   │   ├── authorize.js       # Role-based guard
│   │   │   ├── schoolScope.js     # Resolves schoolId → School doc (tenant isolation)
│   │   │   ├── slugToSchool.js    # Resolves :slug → School doc (public routes)
│   │   │   ├── uploadMiddleware.js# Multer + Cloudinary storage
│   │   │   ├── validate.js        # express-validator error collector
│   │   │   └── errorHandler.js    # Global error handler
│   │   ├── services/              # Business logic layer (one file per domain)
│   │   ├── controllers/
│   │   │   ├── admin/             # student, teacher, class, timetable, exam, result, branding, announcement, user
│   │   │   ├── teacher/           # attendance, marks, announcement, subjectSubmission
│   │   │   ├── student/           # student (profile, timetable, attendance, marks, announcements)
│   │   │   ├── auth.controller.js
│   │   │   ├── fee.controller.js
│   │   │   ├── feeConfig.controller.js
│   │   │   ├── homework.controller.js
│   │   │   ├── notification.controller.js
│   │   │   ├── onboarding.controller.js
│   │   │   ├── parent.controller.js
│   │   │   ├── passwordReset.controller.js
│   │   │   └── platform.controller.js
│   │   ├── routes/                # auth, admin, teacher, student, parent, public, onboarding, platform
│   │   ├── jobs/
│   │   │   └── feeOverdueJob.js   # node-cron: daily fee overdue transition
│   │   └── utils/                 # ApiResponse, ApiError, logger
│   ├── tests/
│   │   ├── unit/                  # utils + service edge-case tests
│   │   └── integration/           # full HTTP flow tests per role
│   └── server.js
└── frontend/
    ├── src/
    │   ├── api/                   # axiosInstance + per-domain API functions
    │   │   └── (admin, auth, exam, fee, homework, notification, onboarding,
    │   │       parent, platform, result, school, student, subjectSubmission, teacher)
    │   ├── components/
    │   │   ├── common/            # Layout, Navbar, Sidebar, ProtectedRoute, SchoolBrandingProvider…
    │   │   ├── admin/             # BrandingForm, ClassForm, FeeManagementTable, StudentForm, TeacherForm, TimetableForm
    │   │   ├── teacher/           # AnnouncementForm, AttendanceTable, HomeworkForm, MarksTable
    │   │   └── student/           # AnnouncementCard, AttendanceSummary, FeesCard, HomeworkCard,
    │   │                          #   MarksCard, NotificationsPanel, ProfileCard, TimetableCard
    │   ├── pages/
    │   │   ├── admin/             # Dashboard, Students, Teachers, Classes, Timetable,
    │   │   │                      #   Exams, ExamDashboard, ResultEntry, Fees, PendingUsers, SchoolSettings
    │   │   ├── teacher/           # Dashboard, Attendance, Marks, MyExams, SubmissionEntry, Announcements
    │   │   ├── student/           # Dashboard, Profile, Timetable, Attendance, Marks, Results, Announcements
    │   │   ├── parent/            # ParentDashboard, ChildDetail
    │   │   └── platform/          # SchoolsList, SchoolDetail, PendingRegistrations
    │   ├── redux/
    │   │   ├── store.js
    │   │   ├── slices/authSlice.js
    │   │   ├── slices/schoolSlice.js   # stores current school config + branding
    │   │   └── slices/uiSlice.js
    │   ├── hooks/                 # useAuth, useApi, useSchoolBranding
    │   └── utils/
    │       ├── animationVariants.js
    │       ├── calculatePercentage.js
    │       ├── formatDate.js
    │       └── reportCardPdf.js   # jsPDF report-card generator
    └── vite.config.js
```

---

## URL Structure (Frontend)

```
/                              → Platform home (public)
/login                         → Global login (redirects to school login)
/register                      → Global register
/onboarding                    → New school self-registration
/forgot-password               → Password reset request
/reset-password?token=…        → Password reset confirmation
/school-not-found              → 404 for unknown slugs

/platform/schools              → Super-admin: all schools list
/platform/schools/:id          → Super-admin: school detail
/platform/pending              → Super-admin: pending registrations

/schools/:slug                 → School public landing page
/schools/:slug/login           → School-scoped login
/schools/:slug/change-password → Authenticated password change

/schools/:slug/admin/dashboard
/schools/:slug/admin/students
/schools/:slug/admin/teachers
/schools/:slug/admin/classes
/schools/:slug/admin/timetable
/schools/:slug/admin/exams
/schools/:slug/admin/exams/:examId/results
/schools/:slug/admin/exams/:examId/dashboard
/schools/:slug/admin/fees
/schools/:slug/admin/pending-approvals
/schools/:slug/admin/settings

/schools/:slug/teacher/dashboard
/schools/:slug/teacher/attendance
/schools/:slug/teacher/marks
/schools/:slug/teacher/my-exams
/schools/:slug/teacher/submissions/:submissionId
/schools/:slug/teacher/announcements

/schools/:slug/student/dashboard
/schools/:slug/student/profile
/schools/:slug/student/timetable
/schools/:slug/student/attendance
/schools/:slug/student/marks
/schools/:slug/student/results
/schools/:slug/student/announcements

/schools/:slug/parent/dashboard
/schools/:slug/parent/children/:studentId
```

---

## Deployment

### MongoDB Atlas

1. Create an M0 free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a DB user with `readWrite` on database `school_mgmt`
3. Add `0.0.0.0/0` to Network Access
4. Copy the `mongodb+srv://` URI for `MONGO_URI`

### Backend — Render

1. Import repo → **New Web Service**
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Set env vars: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN=15m`, `REFRESH_TOKEN_SECRET`, `NODE_ENV=production`, `ALLOWED_ORIGINS=https://<your-vercel-url>.vercel.app`, `FRONTEND_URL=https://<your-vercel-url>.vercel.app`, all `CLOUDINARY_*`, all `SMTP_*`

### Frontend — Vercel

1. Import repo → **New Project**
2. Root Directory: `frontend`
3. Framework Preset: **Vite**
4. Add env var: `VITE_API_URL=https://<your-render-name>.onrender.com/api/v1`
5. Confirm build passes and home page loads

### Seeding a Super-Admin

Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `.env`, then run:

```bash
cd backend && node scripts/seedSuperAdmin.js
```

---

## Test Credentials

> Create these accounts via `POST /api/v1/auth/register` or seed scripts after activating a school.

| Role | Email | Password |
|------|-------|----------|
| Super-Admin | superadmin@example.com | SuperAdmin123! |
| School-Admin | admin@school.test | Admin1234! |
| Teacher | teacher@school.test | Teacher1234! |
| Student | student@school.test | Student1234! |
| Parent | parent@school.test | Parent1234! |
