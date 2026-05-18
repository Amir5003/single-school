# API Contracts: Multi-School SaaS Platform

**Feature**: `003-multi-school-saas`  
**Phase**: 1 — Design & Contracts  
**Date**: 2026-05-17  
**Base URL**: `https://<backend-host>/api/v1`  
**Auth**: JWT stored in `httpOnly` cookie named `token`; refresh token in `httpOnly` cookie named `refreshToken`  
**Content-Type**: `application/json` for all JSON requests; `multipart/form-data` for file uploads

---

## Standard Response Envelopes

### Success
```json
{ "success": true, "message": "Human readable message", "data": { ... } }
```

### Success (Paginated List)
```json
{
  "success": true,
  "message": "Students fetched",
  "data": { "items": [...], "total": 84, "page": 1, "limit": 20, "totalPages": 5 }
}
```

### Error
```json
{
  "success": false,
  "message": "Human readable error",
  "errors": [ { "field": "slug", "msg": "Slug already taken" } ]
}
```

## HTTP Status Conventions

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (delete) |
| 400 | Bad Request |
| 401 | Unauthenticated |
| 403 | Forbidden (wrong role or wrong school) |
| 404 | Not Found |
| 409 | Conflict (slug taken, duplicate) |
| 422 | Validation Error |
| 500 | Server Error |

---

## Middleware Chain Notation

Routes below use shorthand for middleware:
- **`[pub]`** — No auth required; `slugToSchool` may resolve school context from URL
- **`[auth]`** — `authenticate` → `schoolScope` (attaches `req.schoolId` from JWT)
- **`[sa]`** — `authenticate` → `authorize('super-admin')` (no schoolScope)
- **`[admin]`** — `[auth]` → `authorize('school-admin')`
- **`[teacher]`** — `[auth]` → `authorize('teacher')`
- **`[student]`** — `[auth]` → `authorize('student')`
- **`[parent]`** — `[auth]` → `authorize('parent')`
- **`[admin|teacher]`** — `[auth]` → `authorize('school-admin', 'teacher')`

---

## 1. Platform Onboarding — Public

### GET /api/v1/onboarding/slug-check?slug=:slug
Check if a slug is available.

**Auth**: `[pub]`  
**Query**: `slug` (string)  
**Response 200**:
```json
{ "success": true, "message": "Slug available", "data": { "available": true } }
```
**Response 409**:
```json
{ "success": false, "message": "Slug already taken", "data": { "available": false, "suggestions": ["sunrise-academy-2", "sunrise-academy-bih"] } }
```

---

### POST /api/v1/onboarding/register
Create a new school and its first admin user atomically.

**Auth**: `[pub]`  
**Body**:
```json
{
  "schoolName": "Sunrise Academy",
  "slug": "sunrise-academy",
  "adminName": "Ravi Kumar",
  "adminEmail": "ravi@sunriseacademy.in",
  "adminPassword": "Secret@123",
  "contactNumber": "9876543210"
}
```
**Response 201**:
```json
{
  "success": true,
  "message": "School registered successfully",
  "data": {
    "school": { "_id": "...", "name": "Sunrise Academy", "slug": "sunrise-academy", "plan": "free" },
    "admin": { "_id": "...", "name": "Ravi Kumar", "email": "ravi@sunriseacademy.in", "role": "school-admin" }
  }
}
```
**Errors**: 409 slug taken, 422 validation, 400 malformed body

---

## 2. Auth — All Roles

### POST /api/v1/auth/login
Login for any role (super-admin, school-admin, teacher, student, parent).

**Auth**: `[pub]`  
**Body**:
```json
{ "email": "ravi@sunriseacademy.in", "password": "Secret@123" }
```
**Response 200** (sets `token` + `refreshToken` httpOnly cookies):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "_id": "...", "name": "Ravi Kumar", "role": "school-admin", "schoolId": "..." }
  }
}
```
**Errors**: 401 invalid credentials, 403 school deactivated (`"School account is suspended"`)

---

### POST /api/v1/auth/logout
Clear auth cookies.

**Auth**: `[auth]`  
**Response 200**: `{ "success": true, "message": "Logged out" }`

---

### POST /api/v1/auth/refresh
Refresh access token using refresh token cookie.

**Auth**: `[pub]` (reads `refreshToken` cookie)  
**Response 200**: Sets new `token` cookie; returns `{ "success": true, "message": "Token refreshed" }`  
**Errors**: 401 if refresh token invalid or expired

---

### GET /api/v1/auth/me
Get current user profile.

**Auth**: `[auth]`  
**Response 200**:
```json
{
  "success": true, "message": "User profile",
  "data": { "_id": "...", "name": "...", "email": "...", "role": "...", "schoolId": "..." }
}
```

---

## 3. Public School Routes (no auth required)

### GET /api/v1/schools/:slug/config
Get school branding config. Used by frontend to load school theme before login.

**Auth**: `[pub]` + `slugToSchool`  
**Response 200**:
```json
{
  "success": true, "message": "School config",
  "data": {
    "name": "Sunrise Academy",
    "slug": "sunrise-academy",
    "branding": {
      "logoUrl": "https://res.cloudinary.com/...",
      "primaryColor": "#1a56db",
      "secondaryColor": "#7c3aed",
      "tagline": "Excellence in Education",
      "address": "Patna, Bihar",
      "contactNumber": "9876543210"
    }
  }
}
```
**Errors**: 404 school not found, 403 school inactive (returns `"School account is suspended"`)

---

### GET /api/v1/schools/:slug/timetable?classId=:classId
Get public timetable for a class. No auth required.

**Auth**: `[pub]` + `slugToSchool`  
**Query**: `classId` (required)  
**Response 200**: Timetable array scoped to that school's class.

---

### GET /api/v1/schools/:slug/announcements
Get public announcements for a school (targetRole=all).

**Auth**: `[pub]` + `slugToSchool`  
**Query**: `page`, `limit`  
**Response 200**: Paginated announcements list.

---

## 4. School Admin Routes

All routes require `[admin]` middleware. All data implicitly scoped to `req.schoolId`.

### School Branding

#### PATCH /api/v1/admin/school/branding
Update school branding. Logo upload via Cloudinary.

**Auth**: `[admin]`  
**Body** (`multipart/form-data`): `logo` (file, optional), `primaryColor`, `secondaryColor`, `tagline`, `address`, `contactNumber`  
**Response 200**: Updated school branding object.

---

### Student Management

#### GET /api/v1/admin/students
List all students in the school.

**Auth**: `[admin]`  
**Query**: `page`, `limit`, `classId`, `search` (name/enrollmentId), `isDeleted`  
**Response 200**: Paginated student list.

#### POST /api/v1/admin/students
Create a student (creates User + Student records atomically).

**Auth**: `[admin]`  
**Body**: `name`, `email`, `password`, `enrollmentId`, `dateOfBirth`, `classId` (optional), `phone`, `address`  
**Response 201**: Created student object.

#### GET /api/v1/admin/students/:id
Get single student with profile.

**Auth**: `[admin]`  
**Response 200**: Student + User data merged.

#### PUT /api/v1/admin/students/:id
Update student profile.

**Auth**: `[admin]`  
**Response 200**: Updated student.

#### DELETE /api/v1/admin/students/:id
Soft-delete a student.

**Auth**: `[admin]`  
**Response 204**

---

### Teacher Management

Same pattern as students under `/api/v1/admin/teachers`.

#### GET /api/v1/admin/teachers
#### POST /api/v1/admin/teachers
#### GET /api/v1/admin/teachers/:id
#### PUT /api/v1/admin/teachers/:id
#### DELETE /api/v1/admin/teachers/:id

---

### Class Management

#### GET /api/v1/admin/classes
#### POST /api/v1/admin/classes
**Body**: `name`, `academicYear`

#### PUT /api/v1/admin/classes/:id
#### DELETE /api/v1/admin/classes/:id

---

### Class-Teacher Assignment

#### POST /api/v1/admin/classes/:classId/teachers
Assign a teacher to a class for a subject.

**Body**: `teacherId`, `subject`

#### DELETE /api/v1/admin/classes/:classId/teachers/:teacherId

---

### Timetable Management

#### GET /api/v1/admin/timetable?classId=:classId
#### POST /api/v1/admin/timetable
**Body**: `classId`, `day`, `periods: [{ subject, teacherId, startTime, endTime }]`

#### PUT /api/v1/admin/timetable/:id
#### DELETE /api/v1/admin/timetable/:id

---

### Fee Management

#### GET /api/v1/admin/fees?studentId=:id&status=pending
List fees for the school.

**Auth**: `[admin]`  
**Query**: `studentId`, `status`, `page`, `limit`  
**Response 200**: Paginated fee list.

#### POST /api/v1/admin/fees
Create a fee record.

**Body**:
```json
{ "studentId": "...", "amount": 5000, "description": "Tuition Fee - June 2026", "dueDate": "2026-06-30" }
```
**Response 201**: Created fee.

#### PATCH /api/v1/admin/fees/:id/pay
Mark a fee as paid.

**Auth**: `[admin]`  
**Response 200**: `{ "status": "paid", "paidAt": "..." }`

---

### Notifications

#### POST /api/v1/admin/notifications
Send a notification to a target role.

**Auth**: `[admin]`  
**Body**: `targetRole` (all|teacher|student|parent), `title`, `body`  
**Response 201**: Created notification.

#### GET /api/v1/admin/notifications
List notifications sent from this school.

**Auth**: `[admin]`  
**Response 200**: Paginated list.

---

### Parent Management

#### POST /api/v1/admin/parents
Create a parent user and optionally link to a student.

**Auth**: `[admin]`  
**Body**: `name`, `email`, `password`, `phone`, `studentIds: [...]`  
**Response 201**: Created parent with links.

#### POST /api/v1/admin/parents/:parentId/link
Link a parent to a student.

**Body**: `{ "studentId": "..." }`  
**Response 201**: Created link.

#### DELETE /api/v1/admin/parents/:parentId/link/:studentId
Remove a parent-student link.

**Response 204**

---

## 5. Teacher Routes

All require `[teacher]` middleware. Scoped to `req.schoolId`.

### GET /api/v1/teacher/profile
Get own teacher profile.

### GET /api/v1/teacher/classes
Get classes assigned to the teacher.

### GET /api/v1/teacher/classes/:classId/students
List students in a class.

### POST /api/v1/teacher/attendance
Mark bulk attendance.

**Body**:
```json
{
  "classId": "...",
  "date": "2026-05-17",
  "records": [
    { "studentId": "...", "status": "Present" },
    { "studentId": "...", "status": "Absent" }
  ]
}
```
**Response 200**: `{ "marked": 30, "skipped": 0 }`

### GET /api/v1/teacher/attendance?classId=:id&date=:date
Get attendance for a class on a date.

### POST /api/v1/teacher/marks
Upsert marks for a student.

**Body**: `studentId`, `classId`, `subject`, `examType`, `marksObtained`, `totalMarks`, `academicYear`

### GET /api/v1/teacher/marks?classId=:id&examType=:type
Get marks for a class by exam type.

### POST /api/v1/teacher/homework
Post homework for a class.

**Body** (`multipart/form-data`): `classId`, `title`, `description`, `dueDate`, `attachments[]` (files)  
**Response 201**: Created homework.

### GET /api/v1/teacher/homework?classId=:id
List homework for a class.

### DELETE /api/v1/teacher/homework/:id
Soft-delete homework.

### POST /api/v1/teacher/notifications
Send notification (teacher can send to students in their class).

**Body**: `targetRole` (student only), `classId`, `title`, `body`

---

## 6. Student Routes

All require `[student]` middleware. Scoped to `req.schoolId` and `req.user._id`.

### GET /api/v1/student/profile
Own profile.

### GET /api/v1/student/timetable
Own class timetable.

### GET /api/v1/student/attendance?month=:YYYY-MM
Own attendance summary.

### GET /api/v1/student/marks?examType=:type&academicYear=:year
Own marks.

### GET /api/v1/student/homework?classId=:id
Homework for own class.

### GET /api/v1/student/fees
Own fee records.

### GET /api/v1/student/notifications
Notifications targeted to the student role in their school.

### PATCH /api/v1/student/notifications/:id/read
Mark a notification as read.

---

## 7. Parent Routes

All require `[parent]` middleware. Scoped to `req.schoolId` and linked students only.

### GET /api/v1/parent/children
List linked students with basic profile.

**Response 200**:
```json
{
  "success": true, "message": "Children fetched",
  "data": [ { "studentId": "...", "name": "Ankit Kumar", "class": "10-A", "enrollmentId": "STU001" } ]
}
```

### GET /api/v1/parent/children/:studentId/attendance?month=:YYYY-MM
Attendance for a linked child. Returns 403 if `studentId` not in parent's links.

### GET /api/v1/parent/children/:studentId/marks?examType=:type
Marks for a linked child.

### GET /api/v1/parent/children/:studentId/fees
Fee records for a linked child.

### GET /api/v1/parent/notifications
Notifications targeted to the parent role in their school.

### PATCH /api/v1/parent/notifications/:id/read

---

## 8. Super-Admin Platform Routes

All require `[sa]` middleware. No `schoolId` scoping. Prefix: `/api/v1/platform/`.

### GET /api/v1/platform/schools
List all schools.

**Query**: `page`, `limit`, `plan`, `isActive`, `search` (name/slug)  
**Response 200**: Paginated school list.

### POST /api/v1/platform/schools
Create a school manually (admin-initiated onboarding).

### GET /api/v1/platform/schools/:schoolId
Get a single school with stats (user count, student count, plan).

### PATCH /api/v1/platform/schools/:schoolId
Update school metadata (name, plan, isActive).

**Body** (any subset): `name`, `plan`, `isActive`  
**Response 200**: Updated school.

### DELETE /api/v1/platform/schools/:schoolId
Permanently delete a school and all its data.

> ⚠️ **Destructive** — requires confirmation header `X-Confirm-Delete: yes`. Cascades to all tenant-scoped collections.

### GET /api/v1/platform/analytics
Cross-school aggregated analytics.

**Response 200**:
```json
{
  "success": true, "message": "Platform analytics",
  "data": {
    "totalSchools": 42,
    "activeSchools": 40,
    "totalStudents": 8320,
    "totalTeachers": 640,
    "planBreakdown": { "free": 20, "standard": 15, "premium": 7 }
  }
}
```
*No individual student/marks data returned.*

### GET /api/v1/platform/schools/:schoolId/users
List users within a specific school (for support purposes).

**Response 200**: User list (name, email, role, isActive — NO passwords).

---

## 9. Slug Availability — Real-Time (Debounced Frontend Call)

### GET /api/v1/onboarding/slug-check?slug=:slug

*(Already documented in Section 1 — duplicated for reference)*

---

## Summary: Route Count

| Group | Routes |
|-------|--------|
| Onboarding | 2 |
| Auth | 4 |
| Public School | 3 |
| School Admin | ~20 |
| Teacher | ~10 |
| Student | ~7 |
| Parent | ~6 |
| Super-Admin Platform | 7 |
| **Total** | **~59** |
