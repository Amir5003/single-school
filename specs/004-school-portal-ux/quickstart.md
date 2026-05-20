# Quickstart: School Portal Identity & Student/Teacher UX Overhaul

**Feature**: `004-school-portal-ux`  
**Branch**: `004-school-portal-ux`  
**Date**: 2026-05-18

---

## Prerequisites

- Node.js 20 LTS (`node -v` → `v20.x.x`)
- MongoDB Atlas M0 (or local mongo for dev)
- An SMTP account (Gmail app-password, or use `ethereal.email` for local dev — auto-generates a test account)

---

## 1. Install New Dependency

```bash
cd backend
npm install nodemailer
```

---

## 2. Environment Variables

Add the following to `backend/.env`:

```env
# Email (NodeMailer)
SMTP_HOST=smtp.gmail.com      # or smtp.ethereal.email for dev
SMTP_PORT=587
SMTP_USER=yourname@gmail.com  # or ethereal username
SMTP_PASS=your_app_password   # or ethereal password
SMTP_FROM="SchoolMS <noreply@schoolms.dev>"

# Password reset link base (used to construct the email URL)
FRONTEND_URL=http://localhost:5173   # or https://your-vercel-app.vercel.app
```

> **Ethereal.email dev tip**: Run `node -e "const n=require('nodemailer'); n.createTestAccount().then(a=>console.log(a))"` once to get free ephemeral credentials. Sent emails appear at `https://ethereal.email/messages`.

---

## 3. Run Dev Servers

```bash
# From repo root (runs both servers via concurrently):
npm run dev

# Or individually:
cd backend && npm run dev    # http://localhost:3000
cd frontend && npm run dev   # http://localhost:5173
```

---

## 4. End-to-End Test Flow (Happy Path)

### 4a. Password Reset Flow

```
1. As school-admin, create a student account via POST /api/v1/admin/students
   (new: backend auto-generates temp password, emails it, sets mustChangePassword=true)

2. Open your email (or Ethereal inbox) → note the temporary password

3. POST /api/v1/auth/login  {"email": "student@school.com", "password": "<temp>"}
   → response.data.user.mustChangePassword === true

4. Frontend redirects to /schools/<slug>/change-password

5. PUT /api/v1/auth/change-password  {"currentPassword": "<temp>", "newPassword": "NewP@ss99"}
   → 200 OK → user.mustChangePassword === false

6. User is now on their dashboard
```

### 4b. Dynamic Marks Flow

```
1. As school-admin, POST /api/v1/admin/exams
   {"name":"Mid-Term 2024","year":2024,"term":"Term 1","classId":"<id>","subjects":[...]}

2. PUT /api/v1/admin/exams/<examId>/results
   {"results":[{"studentId":"<id>","marks":[{"subject":"Mathematics","marksObtained":85},...]}]}

3. As student, GET /api/v1/student/exams/years → [2024]
   GET /api/v1/student/exams?year=2024 → [{"term":"Term 1",...}]
   GET /api/v1/student/results?examId=<id> → result cards

4. In the UI: navigate to My Results → select 2024 → select Term 1 → see subject cards
```

### 4c. Login Modal Flow

```
1. Open the app while logged out.
2. Click "My Profile" in the navbar.
3. A modal overlay appears (URL does NOT change).
4. Log in → modal closes → you are on the same page.
Or:
4. Press Escape / click backdrop → modal closes, still on same page.
```

### 4d. School Branding Flow

```
1. Navigate to /schools/greenwood-high/login
2. School name and logo appear BEFORE logging in (loaded by SchoolContextLoader)
3. After login, sidebar header shows school logo/name, buttons use school primaryColor
```

---

## 5. Run Tests

```bash
# Backend (all tests — expected: 259 existing + new exam/result/password-reset tests)
cd backend && npm test -- --runInBand --forceExit

# Run only new tests for this feature
cd backend && npx jest --testPathPattern="exam|result|password" --runInBand --forceExit

# Frontend component tests
cd frontend && npm test
```

---

## 6. Key Files Changed / Created

**Backend new files**:
- `src/config/mailer.js`
- `src/services/email.service.js`
- `src/models/PasswordResetToken.model.js`
- `src/models/Exam.model.js`
- `src/models/Result.model.js`
- `src/services/exam.service.js`
- `src/services/result.service.js`
- `src/services/passwordReset.service.js`
- `src/validators/exam.validator.js`
- `src/validators/result.validator.js`
- `src/controllers/exam.controller.js`
- `src/controllers/result.controller.js`
- `tests/integration/admin.exams.test.js`
- `tests/integration/student.results.test.js`
- `tests/integration/password.reset.test.js`

**Backend modified files**:
- `src/models/User.model.js` — add `mustChangePassword`, `passwordResetExpiry`
- `src/services/school.service.js` — strip `isActive` from public config
- `src/services/auth.service.js` — include `mustChangePassword` in login response
- `src/services/student.service.js` — admin creates student with temp password + email
- `src/services/teacher.service.js` — admin creates teacher with temp password + email
- `src/routes/auth.routes.js` — forgot-password, reset-password, change-password routes
- `src/routes/admin.routes.js` — exam + results routes
- `src/routes/student.routes.js` — years, exams, results, change-password routes
- `src/routes/teacher.routes.js` — change-password route

**Frontend new files**:
- `src/components/common/LoginModal.jsx`
- `src/pages/admin/ExamsPage.jsx`
- `src/pages/admin/ResultEntryPage.jsx`
- `src/pages/student/ResultsPage.jsx` (replaces/extends `MarksPage.jsx` for exam results)
- `src/pages/ChangePassword.jsx`
- `src/api/exam.api.js`
- `src/api/result.api.js`

**Frontend modified files**:
- `src/redux/slices/uiSlice.js` — loginModal state
- `src/components/common/EmptyState.jsx` — enhanced props
- `src/components/common/Navbar.jsx` — dispatch openLoginModal on profile click; show school name
- `src/components/common/Sidebar.jsx` — school logo/name in header
- `src/components/common/ProtectedRoute.jsx` — dispatch openLoginModal instead of navigate('/login')
- `src/pages/Login.jsx` — localStorage.setItem after login; read mustChangePassword flag
- `src/pages/Home.jsx` — redirect to lastSchoolSlug on root visit
- `src/App.jsx` — new routes (change-password, exams, results, modal render)
- `src/pages/student/StudentDashboard.jsx` — greeting banner + school branding stat cards
- `src/pages/teacher/TeacherDashboard.jsx` — greeting banner + school branding stat cards
