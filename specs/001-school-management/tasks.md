# Tasks: School Management System

**Feature Branch**: `001-school-management`
**Date**: 2026-04-07
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **API**: [contracts/api.md](./contracts/api.md)
**Total Tasks**: 119 | **Parallelizable**: 47 | **Phases**: 9

## Task Format

```text
- [ ] T### [P] [US#]  Description — exact/file/path
```

- `[P]` = Can run in parallel with other `[P]` tasks in the same phase (different files, no unresolved deps)
- `[US#]` = User story label — **required** in story phases; **omitted** in Setup / Foundational / Polish phases

---

## Phase 1: Setup

**Goal**: Both dev servers running, MongoDB wired up, testing infrastructure ready
**Independent Test**: `npm run dev` starts both servers; `curl http://localhost:5000/api/v1/public/announcements` returns `{"success":true,"data":[]}`

- [x] T001 Create monorepo root: `backend/` and `frontend/` directories, root `package.json` with `concurrently` dev script, `.gitignore` covering `node_modules`, `.env`, `dist/` — `package.json`
- [x] T002 [P] Bootstrap backend: `cd backend && npm init -y`; install `express mongoose dotenv cors cookie-parser morgan express-validator jsonwebtoken bcryptjs`; install dev deps `nodemon jest supertest mongodb-memory-server@latest` — `backend/package.json`
- [x] T003 [P] Bootstrap frontend: `npm create vite@latest frontend -- --template react`; install `axios react-router-dom @reduxjs/toolkit react-redux framer-motion` — `frontend/package.json`
- [x] T004 Configure Tailwind CSS: install `tailwindcss postcss autoprefixer`; run `npx tailwindcss init -p`; set `content: ['./index.html','./src/**/*.{js,jsx}']` in config; add `@tailwind` base/components/utilities directives — `frontend/tailwind.config.js` and `frontend/src/index.css`
- [x] T005 Create MongoDB connection module: export `connectDB()` using `mongoose.connect()`; handle connection errors with `process.exit(1)`; log success without printing URI — `backend/src/config/db.js`
- [x] T006 [P] Create env validation module: check required vars `PORT MONGO_URI JWT_SECRET JWT_EXPIRES_IN` on startup; throw if any missing; export validated constants — `backend/src/config/env.js` and `backend/.env.example`
- [x] T007 [P] Create frontend env file documenting `VITE_API_URL=http://localhost:5000/api/v1` — `frontend/.env.example`
- [x] T008 Create shared utility classes: `ApiResponse(statusCode, data, message)` and `ApiError(statusCode, message)` extending `Error` — `backend/src/utils/ApiResponse.js` and `backend/src/utils/ApiError.js`
- [x] T009 Create structured logger that rejects credential fields (`password`, `token`); wraps `console` with timestamp prefix — `backend/src/utils/logger.js`
- [x] T010 Create global error handler middleware: catches `ApiError` instances (return their statusCode); catches generic Error (return 500); always returns `ApiResponse` envelope — `backend/src/middleware/errorHandler.js`
- [x] T011 Create Express app factory: configure `cors({ origin, credentials:true })`, `cookie-parser`, `morgan('dev')`, `express.json()`; mount `errorHandler` last; export `app` without calling `.listen()` — `backend/src/app.js`
- [x] T012 Create server entry point: import `connectDB` + `app`; call `connectDB()` then `app.listen(PORT)`; no business logic here — `backend/server.js`; create Jest config with `testEnvironment: 'node'`, `--runInBand`, global setup file using `mongodb-memory-server` connect/disconnect hooks — `backend/jest.config.js` and `backend/tests/setup.js`

---

## Phase 2: Foundational — Authentication

**Story Goal (US5)**: All three roles can register, log in, and are redirected to their own dashboard. Unauthenticated and wrong-role requests are rejected.
**Independent Test**: Register admin → login → `GET /api/v1/auth/me` returns admin → logout → same request returns 401; Teacher login → `GET /api/v1/admin/students` → 403; Student login → `GET /api/v1/teacher/attendance` → 403.

### Backend

- [x] T013 Create User Mongoose schema: fields `name` (required), `email` (unique, lowercase), `password` (required, excluded from `toJSON` via `transform`), `role` (enum: admin/teacher/student), `phone`, `isActive` (default true); add bcrypt `pre('save')` hook hashing password when modified (rounds=12); `timestamps: true` — `backend/src/models/User.model.js`
- [x] T014 Create auth validators using `express-validator`: `body('email').isEmail().normalizeEmail()`; password regex `(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}`; `role` in enum; `name` required — `backend/src/validators/auth.validator.js`
- [x] T015 Create auth service: `register(data)` — create User, throw `ApiError(409)` on duplicate email; `login(email, password)` — find user, `bcrypt.compare()`, sign JWT `{id, role}` with `JWT_SECRET` and `JWT_EXPIRES_IN`; throw `ApiError(401)` on mismatch; `getMe(userId)` — find by `_id`, exclude `password` — `backend/src/services/auth.service.js`
- [x] T016 [P] Create `authenticate` middleware: read `req.cookies.token`; `jwt.verify()` with `JWT_SECRET`; attach `req.user = { _id, role }`; return `ApiError(401)` if missing, expired, or invalid — `backend/src/middleware/authenticate.js`
- [x] T017 [P] Create `authorize` middleware factory: export `authorize(...roles)` returning middleware that checks `req.user.role` is in `roles`; return `ApiError(403)` if not — `backend/src/middleware/authorize.js`
- [x] T018 Create `validate` middleware: run `validationResult(req)`; if errors, return 422 with `{ success:false, errors: [ {field, msg} ] }` — `backend/src/middleware/validate.js`
- [x] T019 Create auth controller: `register` and `login` handlers set `httpOnly: true, sameSite: 'strict', secure: NODE_ENV==='production'` cookie named `token`; `logout` clears cookie; `getMe` returns current user; all delegate to `auth.service.js`, wrapped in try/catch — `backend/src/controllers/auth.controller.js`
- [x] T020 Create auth routes: `POST /register`, `POST /login`, `POST /logout`, `GET /me`; apply validator chains + `validate` middleware on mutating routes; mount in `app.js` under `/api/v1/auth` — `backend/src/routes/auth.routes.js`
- [x] T021 Write auth integration tests: register → 201; duplicate email → 409; invalid email → 422; bad password format → 422; login success + cookie present → 200; wrong password → 401; `/me` with valid cookie → 200; `/me` without cookie → 401; admin route with teacher token → 403; teacher route with student token → 403 — `backend/tests/integration/auth.test.js`

### Frontend

- [x] T022 Create Axios instance: `baseURL` from `import.meta.env.VITE_API_URL`; `withCredentials: true`; response interceptor — on 401 dispatch `clearCredentials` and redirect to `/login` — `frontend/src/api/axiosInstance.js`
- [x] T023 Create Redux store and `authSlice`: state `{ user: null, role: null, isAuthenticated: false }`; actions `setCredentials({ user, role })` and `clearCredentials()`; persist to `sessionStorage` via `redux-persist` or manual `subscribe`; export typed selectors — `frontend/src/redux/store.js` and `frontend/src/redux/slices/authSlice.js`
- [x] T024 Create `uiSlice`: state `{ loading: false, toast: { message: '', type: '' } }`; actions `setLoading(bool)`, `showToast({ message, type })`, `clearToast()`; toast auto-clears after 3s via `setTimeout` in component — `frontend/src/redux/slices/uiSlice.js`
- [x] T025 Create auth API functions: `loginUser(data)`, `registerUser(data)`, `logoutUser()`, `getCurrentUser()` — all call `axiosInstance` and return `response.data` — `frontend/src/api/auth.api.js`
- [x] T026 Create Login page: Tailwind-styled form with email + password fields; submit calls `loginUser()`; on success dispatch `setCredentials` and `useNavigate` to `/{role}/dashboard`; show inline error on 401; show field errors on 422; disable submit during loading — `frontend/src/pages/Login.jsx`
- [x] T027 Create `ProtectedRoute` component: reads `isAuthenticated` and `role` from Redux; if not authenticated redirect to `/login`; if wrong `allowedRole` prop redirect to own dashboard; render `children` if authorized — `frontend/src/components/common/ProtectedRoute.jsx`
- [x] T028 [P] Create `Layout.jsx` shell: renders `<Navbar>` + `<Sidebar>` + `<main className="...">{ children }</main>`; accepts `role` prop and passes to Sidebar for navigation items — `frontend/src/components/common/Layout.jsx`
- [x] T029 [P] Create `Navbar.jsx` and `Sidebar.jsx`: Navbar shows school name + user display name + logout button (calls `logoutUser()` then `clearCredentials`); Sidebar shows role-appropriate nav links using `<NavLink>` with Tailwind active class — `frontend/src/components/common/Navbar.jsx` and `frontend/src/components/common/Sidebar.jsx`
- [x] T030 Set up React Router 6 routes in `App.jsx`: public routes `/` and `/login`; role-guarded nested routes `/admin/*`, `/teacher/*`, `/student/*` each wrapped in `<ProtectedRoute>`; wrap student `<Routes>` in `<AnimatePresence mode="wait">` for page transitions; add `<Route path="*" element={<NotFound />}>` — `frontend/src/App.jsx`

---

## Phase 3: User Story 1 — Admin Student Management

**Story Goal**: Admin registers students with full details, views paginated list with search, edits records, and soft-deletes; data persists across sessions.
**Independent Test**: Admin creates student (name, email, enrollmentId STU-001, DOB, address) → appears in list → edit phone → refresh → change persisted → delete → list no longer shows student → DB has `isDeleted:true` → marks/attendance records preserved for archived student.

### Backend

- [x] T031 [US1] Create Student Mongoose schema: `userId` (ref User, unique), `enrollmentId` (required, unique, uppercase), `dateOfBirth` (required Date), `address` (String 300), `classId` (ref Class, nullable), `isDeleted` (default false), `deletedAt` (Date); indexes: `{enrollmentId:1}` unique, `{classId:1}`, `{isDeleted:1}`; `timestamps:true` — `backend/src/models/Student.model.js`
- [x] T032 [US1] Create student validators: `enrollmentId` alphanumeric uppercase pattern; `dateOfBirth` valid ISO date; `email` format; `password` regex (create only); `name` required; all fields optional on PATCH — `backend/src/validators/student.validator.js`
- [x] T033 [US1] Create student service: `createStudent(data)` — create `User` (role: student) + `Student` in session/transaction; throw `ApiError(409)` on duplicate `enrollmentId` or `email`; `listStudents({ page, limit, search })` — paginate with `{isDeleted:false}` base filter + regex `{$or:[{enrollmentId},{name}]}`; populate `userId classId`; `getStudent(id)` — 404 if isDeleted; `updateStudent(id, data)` — partial update via `$set`; `softDeleteStudent(id)` — check existing `Attendance` or `Marks` docs, throw `ApiError(400)` with warning if found; else set `isDeleted:true, deletedAt:new Date()` and `User.isActive:false` — `backend/src/services/student.service.js`
- [x] T034 [US1] Create admin student controller: thin handlers `createStudent`, `listStudents`, `getStudent`, `updateStudent`, `deleteStudent`; each calls service, wraps in `try/catch`, returns `ApiResponse` — `backend/src/controllers/admin/student.controller.js`
- [x] T035 [US1] Mount student CRUD in admin routes: `GET /students`, `POST /students`, `GET /students/:id`, `PUT /students/:id`, `DELETE /students/:id`; all behind `[authenticate, authorize('admin')]`; create/update routes add validator + `validate` middleware; mount admin router in `app.js` under `/api/v1/admin` — `backend/src/routes/admin.routes.js`
- [x] T036 [US1] Write student management integration tests: create → 201 with student doc; duplicate `enrollmentId` → 409; duplicate email → 409; missing required field → 422; list → 200 paginated 20/page; search by name → filtered results; search by enrollmentId → filtered; get by id → 200 populated; get deleted → 404; update phone → persists; soft delete → 200, isDeleted confirmed; re-create after delete with same enrollmentId → 409; delete student with attendance → 400 with warning; access without token → 401; teacher token → 403 — `backend/tests/integration/admin.students.test.js`

### Frontend

- [x] T037 [P] [US1] Create `StudentForm.jsx`: controlled Tailwind form — fields: name, email, password (create only), phone, enrollmentId, dateOfBirth, address; client-side `required` + pattern checks; shows 422 field errors from API response mapped to each field; accept `initialData`, `onSubmit`, `loading` props; edit mode hides password field — `frontend/src/components/admin/StudentForm.jsx`
- [x] T038 [P] [US1] Create `Pagination.jsx`: prev/next buttons + current page / totalPages display; `disabled` state on bounds; props: `page`, `totalPages`, `onPageChange` — `frontend/src/components/common/Pagination.jsx`
- [x] T039 [P] [US1] Create `ConfirmModal.jsx`: centered modal overlay; `message` prop as confirmation text; `onConfirm` and `onClose` callbacks; ESC key and outside-click close — `frontend/src/components/common/ConfirmModal.jsx`
- [x] T040 [US1] Create `StudentsPage.jsx`: fetch students with `page` + `search` query params; render table (name, enrollmentId, class, created date, actions); search input with 300ms debounce; `Pagination` component; open `StudentForm` in modal for create/edit; `ConfirmModal` for delete; show `StatusMessage` on success/error — `frontend/src/pages/admin/StudentsPage.jsx`
- [x] T041 [P] [US1] Create admin API functions for students: `getStudents({ page, limit, search })`, `getStudent(id)`, `createStudent(data)`, `updateStudent(id, data)`, `deleteStudent(id)` using `axiosInstance` — `frontend/src/api/admin.api.js`
- [x] T042 [US1] Create `AdminDashboard.jsx`: parallel-fetch summary counts (students, teachers, classes) from API; render Tailwind stat cards with icon + count + label; render quick-action nav buttons to sub-modules — `frontend/src/pages/admin/AdminDashboard.jsx`

---

## Phase 4: User Story 4 — Admin Classes, Teachers & Timetable

**Story Goal**: Admin creates classes, registers teachers, assigns teachers to classes with subjects, builds weekly timetable; system blocks conflicting periods.
**Independent Test**: Admin creates Class "5-A" → creates Teacher "Mr Ahmed" with employeeId TCH-001 → assigns Mr Ahmed to 5-A for Mathematics → creates timetable entry Mon 08:00-09:00 → attempts Mon 08:30-09:30 for same class → 409 conflict → adds Mon 09:00-10:00 → 201 success → teacher logs in → sees Grade 5-A under assigned classes.

### Backend

- [x] T043 [P] [US4] Create Teacher Mongoose schema: `userId` (ref User, unique), `employeeId` (required, unique, uppercase); index `{employeeId:1}` unique; `timestamps:true` — `backend/src/models/Teacher.model.js`
- [x] T044 [P] [US4] Create Class Mongoose schema: `name` (required), `grade` (required), `section` (required, uppercase, max 5); compound unique index `{grade:1, section:1}`; `timestamps:true` — `backend/src/models/Class.model.js`
- [x] T045 [P] [US4] Create ClassTeacher Mongoose schema: `classId` (ref Class, required), `teacherId` (ref Teacher, required), `subject` (required, trim); compound unique index `{classId:1, teacherId:1, subject:1}`; `timestamps:true` — `backend/src/models/ClassTeacher.model.js`
- [x] T046 [P] [US4] Create Timetable Mongoose schema: `classId` (ref Class, required), `teacherId` (ref Teacher, required), `subject` (required), `day` (enum: Monday–Saturday, required), `startTime` (HH:MM regex, required), `endTime` (HH:MM regex, required); index `{classId:1, day:1}`; `timestamps:true` — `backend/src/models/Timetable.model.js`
- [x] T047 [US4] Create teacher service: `createTeacher(data)` — create User (role:teacher) + Teacher; throw ApiError(409) on duplicate `employeeId`/`email`; `listTeachers()` — populate `userId`, include ClassTeacher count; `getTeacher(id)` with classes; `updateTeacher(id, data)`; `deleteTeacher(id)` — block if ClassTeacher records exist; `assignToClass(teacherId, classId, subject)` — upsert ClassTeacher, throw 409 on duplicate — `backend/src/services/teacher.service.js`
- [x] T048 [US4] Create class service: `createClass(data)` — throw 409 on duplicate `{grade, section}`; `listClasses()` — include student count and teacher count via aggregation; `getClass(id)` — populate students + teachers; `updateClass(id, data)`; `deleteClass(id)` — block if students assigned; `assignStudents(classId, studentIds)` — bulk `Student.updateMany({ _id: {$in:studentIds} }, { $set: { classId } })` — `backend/src/services/class.service.js`
- [x] T049 [US4] Create timetable service with conflict detection: `createEntry(data)` — query existing entries with same `classId + day` where `!(new.endTime <= existing.startTime || new.startTime >= existing.endTime)`; also query same `teacherId + day` for teacher double-booking; throw ApiError(409) with conflict details if found; insert entry; `listByClass(classId)` — populate teacher name; `updateEntry(id, data)` — re-run conflict check excluding self; `deleteEntry(id)` — `backend/src/services/timetable.service.js`
- [x] T050 [US4] Create admin teacher, class, and timetable controllers: thin HTTP handlers delegating to respective services; wrap in try/catch; return ApiResponse — `backend/src/controllers/admin/teacher.controller.js`, `backend/src/controllers/admin/class.controller.js`, `backend/src/controllers/admin/timetable.controller.js`
- [x] T051 [US4] Mount teacher, class, timetable routes in admin router: `GET POST /teachers`, `GET PUT DELETE /teachers/:id`, `POST /teachers/:id/assign-class`; `GET POST /classes`, `GET PUT DELETE /classes/:id`, `POST /classes/:id/assign-teacher`, `POST /classes/:id/assign-students`; `GET POST /timetable`, `PUT DELETE /timetable/:id`; all with `[authenticate, authorize('admin')]` — `backend/src/routes/admin.routes.js`
- [x] T052 [P] [US4] Write teacher + class integration tests: create teacher → 201; duplicate employeeId → 409; list teachers → 200; assign teacher to class → 201; duplicate assignment same subject → 409; create class → 201; duplicate grade+section → 409; assign students bulk → 200; students reflect classId — `backend/tests/integration/admin.teachers.test.js` and `backend/tests/integration/admin.classes.test.js`
- [x] T053 [P] [US4] Write timetable integration tests: create entry → 201; overlapping class time slot → 409; overlapping teacher time slot → 409; non-overlapping same class different day → 201; update with conflict (exclude self) → 409 vs 200; delete entry → 204 — `backend/tests/integration/admin.timetable.test.js`

### Frontend

- [x] T054 [P] [US4] Create `TeacherForm.jsx` and `TeachersPage.jsx`: form fields name, email, password, phone, employeeId; teachers table with name, employeeId, assigned-class count; class-assignment inline dropdown (classId + subject); CRUD via admin API; add teacher API functions `getTeachers()`, `createTeacher()`, `updateTeacher()`, `deleteTeacher()`, `assignTeacherToClass()` to `admin.api.js` — `frontend/src/components/admin/TeacherForm.jsx` and `frontend/src/pages/admin/TeachersPage.jsx`
- [x] T055 [P] [US4] Create `ClassForm.jsx` and `ClassesPage.jsx`: form fields name, grade, section; classes grid cards with student/teacher counts; student assignment UI (multi-select dropdown); teacher-subject assignment badge list; add class API functions `getClasses()`, `createClass()`, `updateClass()`, `deleteClass()`, `assignStudents()` to `admin.api.js` — `frontend/src/components/admin/ClassForm.jsx` and `frontend/src/pages/admin/ClassesPage.jsx`
- [x] T056 [US4] Create `TimetableForm.jsx` and `TimetablePage.jsx`: weekly grid display (days as rows, period slots as columns) rendered from API data; form overlay to add period (class, teacher, subject, day, startTime, endTime); display 409 conflict error inline; delete button on each period card; add timetable API functions `getTimetable(classId)`, `createTimetableEntry()`, `updateTimetableEntry()`, `deleteTimetableEntry()` to `admin.api.js` — `frontend/src/components/admin/TimetableForm.jsx` and `frontend/src/pages/admin/TimetablePage.jsx`

---

## Phase 5: User Story 2 — Teacher Attendance & Marks

**Story Goal**: Teacher sees assigned classes, marks bulk attendance (Present/Absent/Leave) per student per day, and records subject-wise marks; all validation enforced; records persist.
**Independent Test**: Teacher logs in → sees Grade 5-A under assigned classes → opens attendance for today → marks 3 Present, 1 Absent, 1 Leave → saves → refreshes → same statuses loaded → attempts tomorrow → blocked; opens Marks → Mathematics → enters 87 for student A → saves → re-opens → 87 persisted; enters 101 → 422 error.

### Backend

- [x] T057 [P] [US2] Create Attendance Mongoose schema: `studentId` (ref Student, required), `classId` (ref Class, required), `date` (Date, required — store UTC midnight), `status` (enum: Present/Absent/Leave, required), `markedBy` (ref Teacher, required); compound unique index `{studentId:1, date:1}` (prevents double-mark FR-026); indexes `{classId:1, date:1}`, `{studentId:1}`; `timestamps:true` — `backend/src/models/Attendance.model.js`
- [x] T058 [P] [US2] Create Marks Mongoose schema: `studentId` (ref Student), `classId` (ref Class), `subject` (required, trim), `examType` (enum: midterm/final/quiz/assignment, default: 'final'), `marksObtained` (Number, min:0, max:100, required), `maxMarks` (Number, default:100); compound unique index `{studentId:1, subject:1, classId:1, examType:1}`; index `{studentId:1}`; `timestamps:true` — `backend/src/models/Marks.model.js`
- [x] T059 [P] [US2] Create Announcement Mongoose schema: `title` (required, max 200), `content` (required, max 2000), `teacherId` (ref Teacher, required), `isDeleted` (default false), `publishedAt` (default Date.now); indexes `{publishedAt:-1}`, `{isDeleted:1}`; `timestamps:true` — `backend/src/models/Announcement.model.js`
- [x] T060 [US2] Create attendance service: `markBulkAttendance(classId, date, records, teacherId)` — parse date to UTC midnight; throw ApiError(400) if date > today; verify `ClassTeacher.exists({ classId, teacherId })`, throw 403 if not; `bulkWrite` upsert each `{studentId, date}` → `{$set: {status, markedBy}}`; return `{ saved: n }`; `getAttendanceByClassDate(classId, date, teacherId)` — verify class assignment, return records with student names — `backend/src/services/attendance.service.js`
- [x] T061 [US2] Create marks service: `upsertMark({ studentId, classId, subject, examType, marksObtained }, teacherId)` — verify `ClassTeacher.exists({ classId, teacherId })`; validate `marksObtained` 0–100; `findOneAndUpdate({studentId, subject, classId, examType}, data, {upsert:true, new:true})`; `getMarksByClass(classId, subject, teacherId)` — populate student name — `backend/src/services/marks.service.js`
- [x] T062 [US2] Create announcement service: `createAnnouncement(teacherId, data)`; `getTeacherAnnouncements(teacherId)` sorted by `publishedAt:-1`; `updateAnnouncement(id, teacherId, data)` — verify ownership or ApiError(403); `softDeleteAnnouncement(id, teacherId)` — verify ownership; `getAllActiveAnnouncements(limit)` — filter `isDeleted:false` — `backend/src/services/announcement.service.js`
- [x] T063 [US2] Create teacher controllers: `attendance.controller.js` handlers for `POST /attendance`, `GET /attendance`; `marks.controller.js` handlers for `POST /marks`, `GET /marks`; `announcement.controller.js` handlers for CRUD — `backend/src/controllers/teacher/attendance.controller.js`, `backend/src/controllers/teacher/marks.controller.js`, `backend/src/controllers/teacher/announcement.controller.js`
- [x] T064 [US2] Create teacher routes: `GET /classes`, `GET /classes/:classId/students`; `POST /attendance`, `GET /attendance`; `POST /marks`, `GET /marks`; `POST /announcements`, `GET /announcements`, `PUT /announcements/:id`, `DELETE /announcements/:id`; all behind `[authenticate, authorize('teacher')]`; mount in `app.js` under `/api/v1/teacher` — `backend/src/routes/teacher.routes.js`
- [x] T065 [P] [US2] Write attendance integration tests: bulk mark → 200, records persisted; future date → 400; duplicate date → upsert (not 409, updated); teacher not assigned to class → 403; P/A/L values stored correctly; verify `markedBy` is teacher ID — `backend/tests/integration/teacher.attendance.test.js`
- [x] T066 [P] [US2] Write marks integration tests: upsert creates new record → 201; upsert updates existing (same student+subject+class+examType) → 200; `marksObtained: -1` → 422; `marksObtained: 101` → 422; teacher not assigned to class → 403; announcement CRUD: create → 201; update own → 200; delete own → 204; update other teacher's → 403 — `backend/tests/integration/teacher.marks.test.js`

### Frontend

- [x] T067 [US2] Create `TeacherDashboard.jsx`: fetch `GET /teacher/classes`; render class cards with grade, section, subject, student count; each card has "Mark Attendance" and "Enter Marks" buttons linking to respective pages — `frontend/src/pages/teacher/TeacherDashboard.jsx`
- [x] T068 [US2] Create `AttendanceTable.jsx`: renders list of students with three toggle buttons (P/A/L) per row; tracks `{ [studentId]: status }` state; pre-fills existing status when provided; shows enrollmentId + name — `frontend/src/components/teacher/AttendanceTable.jsx`
- [x] T069 [US2] Create `AttendancePage.jsx`: class selector pre-filled from route param; date picker defaulting to today with `max={today}`; on class+date change fetch existing records; render `AttendanceTable`; "Save Attendance" button calls `POST /teacher/attendance` with all records; show `StatusMessage` on save — `frontend/src/pages/teacher/AttendancePage.jsx`
- [x] T070 [US2] Create `MarksTable.jsx`: renders students with numeric input (0–100) per row; client-side validation on blur; pre-fills existing marks; `onSubmit` receives array of `{studentId, marks}` — `frontend/src/components/teacher/MarksTable.jsx`
- [x] T071 [US2] Create `MarksPage.jsx`: subject text input + `examType` select (midterm/final/quiz/assignment); class selector; fetch existing marks on change; render `MarksTable`; save iterates students calling `POST /teacher/marks` per record; show `StatusMessage` aggregate result — `frontend/src/pages/teacher/MarksPage.jsx`
- [x] T072 [US2] Create `AnnouncementForm.jsx` and `AnnouncementsPage.jsx`: form with `title` + `content` textarea; list of own announcements with edit (inline form) and soft-delete (ConfirmModal); `StatusMessage` on all actions — `frontend/src/components/teacher/AnnouncementForm.jsx` and `frontend/src/pages/teacher/AnnouncementsPage.jsx`
- [x] T073 [P] [US2] Create teacher API functions: `getTeacherClasses()`, `getClassStudents(classId)`, `markAttendance(data)`, `getAttendance(classId, date)`, `saveMark(data)`, `getMarks(classId, subject)`, `postAnnouncement(data)`, `getAnnouncements()`, `updateAnnouncement(id, data)`, `deleteAnnouncement(id)` — `frontend/src/api/teacher.api.js`

---

## Phase 6: User Story 3 — Student Academic Dashboard

**Story Goal**: Student sees their profile, timetable (animated stagger), attendance with percentage, and marks — all with Framer Motion animations and glassmorphism Tailwind cards, respecting `prefers-reduced-motion`.
**Independent Test**: Student logs in → animated dashboard entrance at 60fps → Profile tab: `motion.div` fadeInUp shows name + class badge → Timetable: period cards stagger in with 100ms delay each → Attendance: animated ring shows 82% → Marks: subject bars animate to filled width → student cannot access any other student's data (service always uses `req.user._id`).

### Backend

- [x] T074 [US3] Add student read functions to student service: `getStudentProfile(userId)` — find Student by `userId`, populate `classId`; `getStudentTimetable(userId)` — fetch student.classId, query Timetable, populate teacher name; `getStudentAttendance(userId, month)` — filter attendance records by month, compute `{ totalDays, presentDays, absentDays, leaveDays, percentage, records }`; `getStudentMarks(userId)` — list marks, compute `overallPercentage`; `getStudentAnnouncements()` — latest 20 non-deleted sorted by publishedAt desc — `backend/src/services/student.service.js`
- [x] T075 [US3] Create student controller: handlers `getProfile`, `getTimetable`, `getAttendance` (accepts `?month=YYYY-MM`), `getMarks`, `getAnnouncements`; all scope data to `req.user._id` — no external ID params in URL or body — `backend/src/controllers/student/student.controller.js`
- [x] T076 [US3] Create student routes: `GET /profile`, `GET /timetable`, `GET /attendance`, `GET /marks`, `GET /announcements`; all behind `[authenticate, authorize('student')]`; mount in `app.js` under `/api/v1/student` — `backend/src/routes/student.routes.js`
- [x] T077 [US3] Write student data isolation integration tests: student A login → own profile 200; attempt HTTP call with student B `_id` in query → service ignores it, returns A's data; unauthenticated → 401; teacher token → 403; attendance summary with 5 present + 2 absent → percentage = 71.43; marks with 2 subjects → overallPercentage computed correctly; timetable returns empty array (not 404) when class not yet set — `backend/tests/integration/student.test.js`

### Frontend

- [x] T078 [US3] Create `animationVariants.js`: export `fadeInUp` `{hidden:{opacity:0,y:20}, visible:{opacity:1,y:0,transition:{duration:0.4}}, exit:{opacity:0,y:-10}}`; `staggerContainer` `{visible:{transition:{staggerChildren:0.1}}}`; `slideInRight` `{hidden:{opacity:0,x:50}, visible:{opacity:1,x:0}}`; `scaleIn` `{hidden:{opacity:0,scale:0.9}, visible:{opacity:1,scale:1}}`; export `getVariants(variants)` that returns `{initial:'hidden', animate:'visible', exit:'exit'}` or instant `{}` when `window.matchMedia('(prefers-reduced-motion:reduce)').matches` — `frontend/src/utils/animationVariants.js`
- [x] T079 [US3] Configure student page transitions: in `App.jsx`, wrap student route `<Routes>` inside `<AnimatePresence mode="wait">`; use `useLocation()` key on route wrapper `motion.div` so AnimatePresence triggers on each navigation — `frontend/src/App.jsx`
- [x] T080 [US3] Create student API functions: `getProfile()`, `getTimetable()`, `getAttendance(month)`, `getMarks()`, `getStudentAnnouncements()` using `axiosInstance` — `frontend/src/api/student.api.js`
- [x] T081 [P] [US3] Create `useAuth.js` hook: wraps `useSelector` to expose `{ user, role, isAuthenticated }` from authSlice — `frontend/src/hooks/useAuth.js`
- [x] T082 [P] [US3] Create `useApi.js` hook: generic `useApi(apiFn)` returning `{ data, loading, error, execute }`; calls apiFn, sets loading via `uiSlice.setLoading`, handles error state — `frontend/src/hooks/useApi.js`
- [x] T083 [P] [US3] Create utility functions: `formatDate(dateStr, format='DD MMM YYYY')` — `frontend/src/utils/formatDate.js`; `calculatePercentage(obtained, total)` returning fixed-2 decimal string — `frontend/src/utils/calculatePercentage.js`
- [x] T084 [US3] Create `ProfileCard.jsx` and `ProfilePage.jsx`: card wrapped in `motion.div` with `fadeInUp` variant from `getVariants()`; glassmorphism styling (`backdrop-blur-sm bg-white/70 rounded-2xl shadow-lg border border-white/20`); display fields: name, enrollmentId as badge, class name, date of birth (formatted), phone, address — `frontend/src/components/student/ProfileCard.jsx` and `frontend/src/pages/student/ProfilePage.jsx`
- [x] T085 [US3] Create `TimetableCard.jsx` and `TimetablePage.jsx`: day-tab filter (Mon–Sat) with animated active underline using `motion.div layoutId`; period list wrapped in `motion.ul` with `staggerContainer`; each period is `motion.li` with `fadeInUp`; card shows subject, teacher name, time range, colored subject badge — `frontend/src/components/student/TimetableCard.jsx` and `frontend/src/pages/student/TimetablePage.jsx`
- [x] T086 [US3] Create `AttendanceSummary.jsx` and `AttendancePage.jsx`: SVG donut ring where `<motion.circle>` animates `strokeDashoffset` from full to percentage on mount; summary counters (present/absent/leave/percentage) in `staggerContainer`; month selector fetching filtered records; record list with date + status badge; absent days highlighted in red — `frontend/src/components/student/AttendanceSummary.jsx` and `frontend/src/pages/student/AttendancePage.jsx`
- [x] T087 [US3] Create `MarksCard.jsx` and `MarksPage.jsx`: one card per subject with title, examType chip, score "87 / 100"; `motion.div` width-animated progress bar using `animate={{ width: percentage+'%' }}`; overall percentage in large animated counter using `useMotionValue` + `animate(countFrom, countTo)`; card list wrapped in `staggerContainer` — `frontend/src/components/student/MarksCard.jsx` and `frontend/src/pages/student/MarksPage.jsx`
- [x] T088 [US3] Create `AnnouncementCard.jsx`: card with title, content preview (clamp 3 lines), teacher name, `formatDate(publishedAt)` badge; `scaleIn` entrance variant; list wrapped in `staggerContainer` — `frontend/src/components/student/AnnouncementCard.jsx`
- [x] T089 [US3] Create `StudentDashboard.jsx`: parallel fetch profile + attendance summary + latest mark + next class today; render 4 summary cards (attendance %, latest score, next period, announcement count) as `motion.div` in `staggerContainer`; quick-nav buttons to each section; glassmorphism card styling — `frontend/src/pages/student/StudentDashboard.jsx`

---

## Phase 7: User Story 6 — Home Page & Announcements

**Story Goal**: Public Home page shows school info and latest announcements without login. Admin can manage all announcements.
**Independent Test**: Load `/` without cookie → school info visible, latest 5 announcements shown → `GET /api/v1/public/announcements` returns data without auth; admin login → announcements management page lists all with edit/delete.

### Backend

- [x] T090 [US6] Create public routes: `GET /announcements` — no auth middleware; call `announcement.service.getAllActiveAnnouncements(5)`, populate teacher name; mount in `app.js` under `/api/v1/public` — `backend/src/routes/public.routes.js`
- [x] T091 [US6] Add admin announcement management to admin routes: `GET /admin/announcements`, `PUT /admin/announcements/:id`, `DELETE /admin/announcements/:id` with `[authenticate, authorize('admin')]`; admin can edit/delete any announcement (no ownership check) — `backend/src/routes/admin.routes.js`

### Frontend

- [x] T092 [P] [US6] Create `Home.jsx`: hero section (school name + tagline + login CTA button); contact info section; public announcements feed (`useEffect` fetching `GET /api/v1/public/announcements`); no authentication check required; Tailwind responsive layout; link to `/login` — `frontend/src/pages/Home.jsx`
- [x] T093 [P] [US6] Create `NotFound.jsx`: clean 404 page with illustration placeholder, "Page Not Found" heading, "Go Home" button — `frontend/src/pages/NotFound.jsx`

---

## Phase 8: Polish & Deployment

**Goal**: All async operations have feedback; production deployed on Vercel + Render + Atlas; README complete; smoke test passes.
**Independent Test**: Kill backend server → frontend shows `ErrorBoundary` fallback instead of blank crash → restart backend → data loads behind `LoadingSpinner` → empty state shown when no marks/attendance → all three dashboards work on production URLs with cross-origin cookie auth.

- [x] T094 Create `ErrorBoundary.jsx` React class component: catch render errors in `componentDidCatch`; display friendly "Something went wrong — Refresh page" UI; wrap `AdminDashboard`, `TeacherDashboard`, `StudentDashboard` roots in ErrorBoundary — `frontend/src/components/common/ErrorBoundary.jsx`
- [x] T095 [P] Create `LoadingSpinner.jsx` animated SVG spinner for full-page loading (centered, 60px); create `SkeletonCard.jsx` placeholder for student dashboard cards (3 grey animated-pulse blocks) — `frontend/src/components/common/LoadingSpinner.jsx` and `frontend/src/components/common/SkeletonCard.jsx`
- [x] T096 [P] Create `EmptyState.jsx`: SVG icon + configurable `message` prop; default "No data available yet"; used in student marks/attendance when records empty ("Marks not yet available", "No attendance records") — `frontend/src/components/common/EmptyState.jsx`
- [x] T097 [P] Create `StatusMessage.jsx`: success/error/info bar reading `uiSlice.toast`; auto-dispatch `clearToast` after 3s via `useEffect`; green/red/blue Tailwind color variants — `frontend/src/components/common/StatusMessage.jsx`
- [x] T098 Complete backend test suite: run `npm test -- --coverage`; identify service/utility files below 70% threshold; add unit tests in `backend/tests/unit/services/` for `attendance.service.js` and `marks.service.js` edge case functions; add unit tests for `ApiError`, `ApiResponse` utils — `backend/tests/unit/`
- [x] T099 [P] Write frontend component tests: `Login.test.jsx` — renders form, fills inputs, submits, mock `loginUser` returns success, verifies navigation; `ProtectedRoute.test.jsx` — renders login redirect for unauthenticated; `StudentDashboard.test.jsx` — renders 4 summary cards with mocked API data — `frontend/src/` tests
- [x] T100 [P] Write student animation tests: verify `animationVariants.js` returns instant variants when `prefers-reduced-motion` is mocked to true; verify `calculatePercentage` edge cases (0/0, 100/100) — `frontend/src/utils/animationVariants.test.js` and `frontend/src/utils/calculatePercentage.test.js`
- [ ] T101 Setup MongoDB Atlas: create M0 free cluster; create DB user `school_app` with `readWrite` on `school_mgmt` DB; add `0.0.0.0/0` Network Access entry; copy `mongodb+srv://` connection string for Render env var
- [ ] T102 Deploy backend: create Render Web Service from GitHub repo; set Root Directory `backend`; Build Command `npm install`; Start Command `node server.js`; add env vars (`MONGO_URI`, `JWT_SECRET=<32+char random>`, `JWT_EXPIRES_IN=7d`, `NODE_ENV=production`, `ALLOWED_ORIGINS=https://<vercel-url>.vercel.app`); confirm `/api/v1/public/announcements` responds on live URL
- [ ] T103 Deploy frontend: import repo on Vercel; set Root Directory to `frontend`; Framework Preset: Vite; add env var `VITE_API_URL=https://<render-name>.onrender.com/api/v1`; confirm build passes and home page loads on Vercel URL
- [x] T104 Configure production cookie: update `auth.controller.js` to set `{ secure: true, sameSite: 'none' }` when `NODE_ENV === 'production'` and `{ secure: false, sameSite: 'strict' }` in development — `backend/src/controllers/auth.controller.js`
- [x] T105 Configure production CORS: read `ALLOWED_ORIGINS` from env, split on comma, pass as `origin: originsArray` to `cors()` with `credentials: true` — `backend/src/app.js`
- [x] T106 Write `README.md`: project description, tech stack table, prerequisites, local setup steps, env vars table for both projects, deployment links section, test credentials for all three roles, API base URL reference — `README.md`
- [ ] T107 Smoke test production: register admin at production URL → create teacher + student + class → teacher login → mark attendance + enter marks → student login → verify dashboard shows data → logout → unauthenticated access returns 401; record any issues as follow-up

---

---

## Phase 9: User Story 7 — Self-Registration with Admin Approval Workflow

**Story Goal (US7)**: Students and teachers can self-register via a public `/register` page; their accounts start as "pending" and require admin approval before login is allowed. Admins have a "Pending Approvals" page in their dashboard to approve or reject registrations. Admin self-registrations are also placed in pending state.
**Independent Test**: Student self-registers (name, email, password, role=student) → 201 created with `approvalStatus:'pending'`; login attempt → 403 "Account pending admin approval"; Admin logs in → navigates to Pending Approvals → sees the student; Admin approves → student login → 200 + JWT cookie; Admin rejects a second pending user → that user's login → 403 "Account has been rejected"; teacher token on `/admin/users/pending` → 403.

### Setup Fix

- [x] T108 Fix local dev CORS: rename `CLIENT_ORIGIN=http://localhost:5173` → `ALLOWED_ORIGINS=http://localhost:5173` in `backend/.env` so `app.js`'s `ALLOWED_ORIGINS` env read resolves correctly in local dev — `backend/.env`

### Backend

- [x] T109 [US7] Add `approvalStatus` field to `User.model.js`: `approvalStatus: { type: String, enum: ['pending','approved','rejected'], default: 'approved' }` — default `'approved'` preserves admin-panel-created users; update `isActive` default to remain `true`; export updated model — `backend/src/models/User.model.js`
- [x] T110 [US7] Update `auth.service.js`: `register(data)` explicitly sets `{ approvalStatus: 'pending', isActive: false }` on `User.create()` so all self-registrations start pending; `login(email, password)` after finding user checks approval — throw `ApiError(403, 'Account pending admin approval')` when `approvalStatus === 'pending'`; throw `ApiError(403, 'Account has been rejected by admin')` when `approvalStatus === 'rejected'`; keep existing 401 for unknown email — `backend/src/services/auth.service.js`
- [x] T111 Create `tests/helpers.js` with `createDirectUser(data)` helper: `bcrypt.hash(data.password, 12)` then `User.create({ ...data, password: hashed, approvalStatus: 'approved', isActive: true })`; update ALL existing test `beforeEach` blocks that do `await registerUser(ADMIN)` followed by `await loginUser()` to instead use `await createDirectUser(ADMIN)` then `await loginUser()` — `backend/tests/helpers.js`, `backend/tests/integration/auth.test.js`, `backend/tests/integration/admin.students.test.js`, `backend/tests/integration/admin.teachers.test.js`, `backend/tests/integration/admin.classes.test.js`, `backend/tests/integration/admin.timetable.test.js`, `backend/tests/integration/teacher.attendance.test.js`, `backend/tests/integration/teacher.marks.test.js`, `backend/tests/integration/student.test.js`
- [x] T112 [P] [US7] Create admin user service: `getPendingUsers()` — `User.find({ approvalStatus: 'pending' }).select('-password').sort({ createdAt: -1 })`; `approveUser(id)` — `User.findByIdAndUpdate(id, { approvalStatus: 'approved', isActive: true }, { new: true })`, throw `ApiError(404, 'User not found')` if null; `rejectUser(id)` — `User.findByIdAndUpdate(id, { approvalStatus: 'rejected', isActive: false }, { new: true })`, throw `ApiError(404)` if null — `backend/src/services/user.service.js`
- [x] T113 [US7] Create admin user controller: `listPendingUsers` → calls `userService.getPendingUsers()`, returns `ApiResponse(200, { users }, 'Pending users retrieved')`; `approveUser` → calls `userService.approveUser(req.params.id)`, returns `ApiResponse(200, { user }, 'User approved')`; `rejectUser` → calls `userService.rejectUser(req.params.id)`, returns `ApiResponse(200, { user }, 'User rejected')`; all wrapped in try/catch — `backend/src/controllers/admin/user.controller.js`
- [x] T114 [US7] Add user approval routes to admin router: `GET /users/pending`, `PUT /users/:id/approve`, `PUT /users/:id/reject`; all behind existing `[authenticate, authorize('admin')]`; import and wire `listPendingUsers`, `approveUser`, `rejectUser` from `user.controller.js` — `backend/src/routes/admin.routes.js`
- [x] T115 [P] [US7] Write approval integration tests: self-register → 201 with `approvalStatus:'pending'`; login immediately after → 403; admin fetches `GET /admin/users/pending` → 200 array containing new user; admin `PUT /admin/users/:id/approve` → 200; login after approval → 200 + Set-Cookie; self-register second user → admin `PUT /admin/users/:id/reject` → 200; rejected login → 403; teacher token on `/admin/users/pending` → 403; invalid id on approve → 404 — `backend/tests/integration/auth.approval.test.js`

### Frontend

- [x] T116 [US7] Create `Register.jsx` public page: Tailwind form (name, email, password, role dropdown with options student/teacher/admin); submit calls `registerUser()` from `auth.api.js`; on success display `"Account created! Awaiting admin approval before you can log in."` (all roles, no auto-login); on 409 show "Email already registered"; on 422 map field errors; `motion.div` with `fadeInUp` variant on card entrance; link "Already have an account? Sign in" to `/login` — `frontend/src/pages/Register.jsx`
- [x] T117 [P] [US7] Add approval functions to `admin.api.js`: `getPendingUsers()` → `axiosInstance.get('/admin/users/pending').then(r => r.data)`; `approveUser(id)` → `axiosInstance.put('/admin/users/${id}/approve').then(r => r.data)`; `rejectUser(id)` → `axiosInstance.put('/admin/users/${id}/reject').then(r => r.data)` — `frontend/src/api/admin.api.js`
- [x] T118 [US7] Create `PendingUsersPage.jsx`: `useEffect` fetches `getPendingUsers()` on mount; render table columns: Name, Email, Role, Registered; each row has "Approve" (green) and "Reject" (red) buttons; on action call respective API function, re-fetch list, dispatch `showToast`; show `LoadingSpinner` while fetching; show `EmptyState` when list is empty — `frontend/src/pages/admin/PendingUsersPage.jsx`
- [x] T119 [US7] Wire up UI changes: (1) `App.jsx` — add `<Route path="/register" element={<Register />} />` in public routes, add `<Route path="pending-approvals" element={<PendingUsersPage />} />` inside admin `<Routes>`; (2) `Login.jsx` — add `else if (status === 403) { setError(err.response?.data?.message || 'Account pending admin approval.'); }` branch in catch; add "Don't have an account? Register" link (`<Link to="/register">`) below the form; (3) `Sidebar.jsx` — add `{ label: 'Pending Approvals', to: '/admin/pending-approvals' }` entry to `NAV_ITEMS.admin` array — `frontend/src/App.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/components/common/Sidebar.jsx`

---

## Dependency Graph

```
Phase 1: Setup
   │
   ▼
Phase 2: Foundational (US5 Auth) ◄─── ALL phases depend on this
   │
   ├──▶ Phase 3 (US1: Admin Students)       MVP increment ends here
   │         │
   │         ▼
   │    Phase 4 (US4: Admin Classes/Teachers/Timetable)
   │         │
   │         ▼
   │    Phase 5 (US2: Teacher Attendance/Marks)
   │         │
   │         ▼
   │    Phase 6 (US3: Student Dashboard)
   │
   ├──▶ Phase 7 (US6: Home + Public Announcements)   ← relatively independent
   │         │
   │         ▼
   │    Phase 8: Polish + Deployment  ◄─── requires all phases complete
   │
   └──▶ Phase 9 (US7: Self-Registration + Approval Workflow)
             ├── T108: Fix .env (CORS) — independent, do first
             ├── T109–T115: Backend changes (depend on Phase 2 User model)
             └── T116–T119: Frontend changes (depend on Phase 2 Login page)
```

**Dependency notes**:
- US4 (P2 in spec priority) must be implemented before US2 (P1) because teachers need class assignments to mark attendance
- US3 (P1) requires both US2 (marks/attendance data) and US4 (timetable data)
- US6 home page is relatively independent — only requires auth + announcements from US2
- US7 self-registration is an extension of the auth phase and can be added independently; T111 (test helpers) must precede T115 (new approval tests)

---

## Parallel Execution Examples

### Phase 1
```
T002 (backend init)   ║  T003 (frontend init)
T006 (backend env)    ║  T007 (frontend env)
```

### Phase 2 — Auth (backend and frontend tracks run in parallel)
```
Backend:  T013 → T014 → T015 → T016║T017 → T018 → T019 → T020 → T021
Frontend: T022 → T023 → T024       →       T025 → T026 → T027║T028║T029 → T030
```

### Phase 4 — Models (all 4 create different files)
```
T043║T044║T045║T046   (4 model files simultaneously)
T052║T053             (2 test files simultaneously)
T054║T055             (2 form+page pairs simultaneously)
```

### Phase 5 — Teacher (models in parallel, then services sequentially)
```
T057║T058║T059         (3 model files simultaneously)
T065║T066              (2 test files simultaneously)
```

### Phase 6 — Student utilities (before component work)
```
T081║T082║T083         (3 utility/hook files simultaneously)
```

### Phase 8 — Polish (all independent)
```
T095║T096║T097         (3 common component files simultaneously)
T099║T100              (2 test file groups simultaneously)
```

### Phase 9 — Registration + Approval (backend and frontend in parallel after T109–T111)
```
T108                   (CORS .env fix — do first, independent)
T109 → T110 → T111     (model → service → test helpers, must be sequential)
T112║T115              (user service + approval tests, both depend on T110+T111)
T113 → T114            (controller → routes, sequential)
T117║T118              (admin.api.js + PendingUsersPage, independent files)
T119                   (App.jsx + Login.jsx + Sidebar.jsx wiring, final step)
```

---

## Implementation Strategy

**MVP** (Phases 1 + 2 + 3): Working authentication and admin student management. Demonstrates login system, RBAC, and full student CRUD with pagination. Deployable and demonstrable independently.

**Increment 2** (Phase 4): Admin can build school structure (classes, teachers, timetable). Assigns teachers; conflict detection verified.

**Increment 3** (Phase 5): Teachers operational — can mark live attendance and record grades daily.

**Increment 4** (Phase 6): Students have fully animated modern dashboard. End-to-end flow from admin → teacher → student verified.

**Increment 5** (Phases 7 + 8): Home page, deployment, documentation; system live on production URLs.

**Increment 6** (Phase 9): Open self-registration with admin approval gate. Students and teachers can sign up; admin reviews and approves registrations from dashboard. Addresses local CORS issue as well.

---

## Summary

| Phase | Story | Tasks | Parallel | Est. Days |
|-------|-------|-------|----------|-----------|
| 1 — Setup | — | 12 | 4 | 2d |
| 2 — Foundational | US5 Auth | 19 | 5 | 3d |
| 3 — Admin Students | US1 (P1) | 12 | 5 | 3d |
| 4 — Admin Classes/Timetable | US4 (P2*) | 14 | 8 | 3d |
| 5 — Teacher | US2 (P1) | 17 | 6 | 3d |
| 6 — Student | US3 (P1) | 16 | 5 | 3d |
| 7 — Home Page | US6 (P2) | 4 | 2 | 1d |
| 8 — Polish/Deploy | — | 14 | 6 | 2d |
| **Total** | | **108** | **41** | **~20d** |

> *US4 is P2 in spec priority but implemented before US2/US3 due to data dependency (classes must exist before attendance can be marked).
