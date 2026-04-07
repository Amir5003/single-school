# API Contracts: School Management System

**Feature**: `001-school-management`  
**Phase**: 1 — Design & Contracts  
**Date**: 2026-04-07  
**Base URL**: `https://<backend-host>/api/v1`  
**Auth**: JWT stored in `httpOnly` cookie named `token`  
**Content-Type**: `application/json` for all requests and responses

---

## Standard Response Envelopes

### Success
```json
{
  "success": true,
  "message": "Human readable message",
  "data": { ... }
}
```

### Success (Paginated List)
```json
{
  "success": true,
  "message": "Students fetched",
  "data": {
    "items": [ ... ],
    "total": 84,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Error
```json
{
  "success": false,
  "message": "Human readable error",
  "errors": [ { "field": "email", "msg": "Must be a valid email" } ]
}
```

---

## HTTP Status Code Conventions

| Code | Meaning |
|------|---------|
| 200 | OK — read/update success |
| 201 | Created — new resource created |
| 204 | No Content — delete success |
| 400 | Bad Request — malformed body |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — authenticated but wrong role |
| 404 | Not Found — resource doesn't exist |
| 409 | Conflict — duplicate resource or schedule conflict |
| 422 | Unprocessable Entity — validation error (field-level errors in `errors[]`) |
| 500 | Internal Server Error |

---

## Auth Routes — Public

### POST /api/v1/auth/register
Register a new account.

**Auth**: None  
**Body**:
```json
{
  "name": "Jane Smith",
  "email": "jane@school.edu",
  "password": "Secret@123",
  "role": "student",
  "phone": "9876543210"
}
```
**Validation**: email format; password ≥8 chars, 1 uppercase, 1 digit, 1 special; role in `[admin, teacher, student]`  
**Response 201**:
```json
{ "success": true, "message": "Account created", "data": { "_id": "...", "role": "student", "name": "Jane Smith" } }
```
**Errors**: 409 if email already exists; 422 on validation failure

---

### POST /api/v1/auth/login
Authenticate and set JWT cookie.

**Auth**: None  
**Body**: `{ "email": "jane@school.edu", "password": "Secret@123" }`  
**Response 200**: Sets `httpOnly, sameSite, secure` cookie `token`
```json
{ "success": true, "message": "Login successful", "data": { "_id": "...", "role": "student", "name": "Jane Smith" } }
```
**Errors**: 401 if credentials don't match

---

### POST /api/v1/auth/logout
Clear JWT cookie.

**Auth**: Required  
**Response 200**: Clears cookie
```json
{ "success": true, "message": "Logged out" }
```

---

### GET /api/v1/auth/me
Return current authenticated user (no password).

**Auth**: Required  
**Response 200**: `{ "success": true, "data": { "_id", "name", "email", "role" } }`

---

## Admin Routes — Role: `admin`

All routes require `authenticate + authorize('admin')` middleware.

### Students

#### GET /api/v1/admin/students
Paginated, searchable student list.

**Query params**: `page` (default 1), `limit` (default 20), `search` (name or enrollmentId)  
**Response 200**: Paginated list; students populated with `userId.name, userId.email, classId.name`

#### POST /api/v1/admin/students
Create student and linked user account.

**Body**:
```json
{
  "name": "Ali Hassan",
  "email": "ali@student.edu",
  "password": "Temp@1234",
  "phone": "9001234567",
  "enrollmentId": "STU-2026-001",
  "dateOfBirth": "2010-05-15",
  "address": "123 Main Street, City"
}
```
**Response 201**: Created student document  
**Errors**: 409 if `enrollmentId` or `email` exists; 422 on validation

#### GET /api/v1/admin/students/:id
Get single student with full profile.

**Response 200**: Student + populated User + Class  
**Errors**: 404 if not found or isDeleted

#### PUT /api/v1/admin/students/:id
Update student fields (partial update).

**Body**: Any subset of student fields (name, phone, address, enrollmentId, dateOfBirth, classId)  
**Response 200**: Updated document  
**Errors**: 404; 409 on duplicate enrollmentId

#### DELETE /api/v1/admin/students/:id
Soft-delete student.

**Response 200**: `{ "success": true, "message": "Student archived" }`  
**Errors**: 400 if student has active marks/attendance (prompt to archive instead); 404

---

### Teachers

#### GET /api/v1/admin/teachers
List all teachers with assigned classes.

**Response 200**: Teachers populated with `userId.name, userId.email` and `classTeachers[]`

#### POST /api/v1/admin/teachers
Create teacher and linked user account.

**Body**:
```json
{
  "name": "Mr. Ahmed",
  "email": "ahmed@teacher.edu",
  "password": "Teach@456",
  "phone": "9112233445",
  "employeeId": "TCH-001",
  "subjectSpecialization": "Mathematics"
}
```
**Response 201**: Created teacher  
**Errors**: 409 if `employeeId` or `email` exists

#### GET /api/v1/admin/teachers/:id
Single teacher with assigned classes list.

#### PUT /api/v1/admin/teachers/:id
Update teacher profile.

#### DELETE /api/v1/admin/teachers/:id
Delete teacher (hard delete; protected if ClassTeacher records exist).

**Response 204**  
**Errors**: 400 if teacher has class assignments; 404

---

### Classes

#### GET /api/v1/admin/classes
List all classes with teacher + student counts.

#### POST /api/v1/admin/classes
Create a class.

**Body**: `{ "name": "Grade 5 - A", "grade": "5", "section": "A" }`  
**Response 201**  
**Errors**: 409 if grade+section combination already exists

#### GET /api/v1/admin/classes/:id
Single class with students and teachers.

#### PUT /api/v1/admin/classes/:id
Update class.

#### DELETE /api/v1/admin/classes/:id
Delete class.

**Errors**: 400 if students are assigned to class; 404

#### POST /api/v1/admin/classes/:id/assign-teacher
Assign a teacher to the class for a subject.

**Body**: `{ "teacherId": "...", "subject": "Mathematics" }`  
**Response 201**: ClassTeacher record  
**Errors**: 409 if same teacher+class+subject already assigned; 404 if class/teacher not found

#### POST /api/v1/admin/classes/:id/assign-students
Assign students to this class (bulk).

**Body**: `{ "studentIds": ["id1", "id2"] }`  
**Response 200**: Count of updated students

---

### Timetable

#### GET /api/v1/admin/timetable
List all timetable entries.

**Query params**: `classId` (filter by class)  
**Response 200**: Entries populated with `classId.name, teacherId.userId.name, subject, day, startTime, endTime`

#### POST /api/v1/admin/timetable
Create a timetable entry.

**Body**:
```json
{
  "classId": "...",
  "teacherId": "...",
  "subject": "Mathematics",
  "day": "Monday",
  "startTime": "08:00",
  "endTime": "09:00"
}
```
**Response 201**: Created entry  
**Errors**: 409 on time conflict (class or teacher double-booked); 422 on validation

#### PUT /api/v1/admin/timetable/:id
Update a timetable entry.

**Response 200**  
**Errors**: 409 on conflict; 404

#### DELETE /api/v1/admin/timetable/:id
Delete a timetable entry.

**Response 204**: Deleted  
**Errors**: 404

---

## Teacher Routes — Role: `teacher`

All routes require `authenticate + authorize('teacher')` middleware.

### GET /api/v1/teacher/classes
Get all classes assigned to the authenticated teacher.

**Response 200**: Array of `{ classId, className, subject }` from ClassTeacher records

---

### GET /api/v1/teacher/classes/:classId/students
Get all active students in a specific class (must be assigned teacher for this class).

**Response 200**: Students list  
**Errors**: 403 if teacher not assigned to this class; 404

---

### POST /api/v1/teacher/attendance
Mark bulk attendance for a class on a date.

**Body**:
```json
{
  "classId": "...",
  "date": "2026-04-07",
  "records": [
    { "studentId": "...", "status": "Present" },
    { "studentId": "...", "status": "Absent" },
    { "studentId": "...", "status": "Leave" }
  ]
}
```
**Response 200**: `{ "success": true, "message": "Attendance saved for 28 students" }`  
**Errors**: 400 if date is in future; 403 if teacher not assigned; 422 on status enum violation

---

### GET /api/v1/teacher/attendance
View attendance records.

**Query params**: `classId` (required), `date` (YYYY-MM-DD, default today)  
**Response 200**: Array of attendance records for that class+date

---

### POST /api/v1/teacher/marks
Add or update marks for a student.

**Body**:
```json
{
  "studentId": "...",
  "classId": "...",
  "subject": "Mathematics",
  "examType": "midterm",
  "marksObtained": 87
}
```
**Response 201**: Created or updated marks document (upsert)  
**Errors**: 422 if `marksObtained` < 0 or > 100; 403 if teacher not assigned to this class

---

### GET /api/v1/teacher/marks
View marks entered by this teacher.

**Query params**: `classId` (required), `subject` (optional)  
**Response 200**: Array of marks with student name populated

---

### Announcements (Teacher)

#### POST /api/v1/teacher/announcements
Post a new announcement.

**Body**: `{ "title": "Holiday Notice", "content": "School closed on April 14." }`  
**Response 201**

#### GET /api/v1/teacher/announcements
List announcements posted by this teacher.

**Response 200**: Array sorted by `publishedAt` desc

#### PUT /api/v1/teacher/announcements/:id
Edit own announcement (title or content).

**Errors**: 403 if not owner; 404

#### DELETE /api/v1/teacher/announcements/:id
Soft-delete own announcement.

**Response 204**  
**Errors**: 403 if not owner; 404

---

## Student Routes — Role: `student`

All routes require `authenticate + authorize('student')` middleware. All data scoped to `req.user._id` — no `studentId` accepted in URL or body for read operations.

### GET /api/v1/student/profile
Return the authenticated student's profile.

**Response 200**:
```json
{
  "success": true,
  "data": {
    "name": "Ali Hassan",
    "email": "ali@student.edu",
    "phone": "...",
    "enrollmentId": "STU-2026-001",
    "dateOfBirth": "2010-05-15",
    "address": "...",
    "class": { "_id": "...", "name": "Grade 5 - A", "grade": "5", "section": "A" }
  }
}
```

---

### GET /api/v1/student/timetable
Return the timetable for the student's assigned class.

**Response 200**:
```json
{
  "success": true,
  "data": [
    { "day": "Monday", "subject": "Mathematics", "teacher": "Mr. Ahmed", "startTime": "08:00", "endTime": "09:00" }
  ]
}
```
**Errors**: 404 if student not assigned to a class yet

---

### GET /api/v1/student/attendance
Return attendance records and summary.

**Query params**: `month` (YYYY-MM, optional — defaults to current month)  
**Response 200**:
```json
{
  "success": true,
  "data": {
    "summary": { "totalDays": 22, "presentDays": 18, "absentDays": 3, "leaveDays": 1, "percentage": 81.82 },
    "records": [
      { "date": "2026-04-07", "status": "Present" }
    ]
  }
}
```

---

### GET /api/v1/student/marks
Return subject-wise marks.

**Response 200**:
```json
{
  "success": true,
  "data": {
    "subjects": [
      { "subject": "Mathematics", "examType": "midterm", "marksObtained": 87, "maxMarks": 100 },
      { "subject": "Science", "examType": "midterm", "marksObtained": 91, "maxMarks": 100 }
    ],
    "overallPercentage": 89.0
  }
}
```
**If no marks recorded**: `{ "subjects": [], "message": "Marks not yet available" }`

---

### GET /api/v1/student/announcements
Return all active announcements.

**Response 200**: Array sorted by `publishedAt` desc; max 20

---

## Public Routes — No Auth Required

### GET /api/v1/public/announcements
Latest announcements for the Home page.

**Query params**: `limit` (default 5, max 10)  
**Response 200**: Array of `{ title, content, teacher: { name }, publishedAt }`

---

## CORS Configuration

```
Allowed Origins: https://<vercel-app>.vercel.app, http://localhost:5173
Allowed Methods: GET, POST, PUT, DELETE, OPTIONS
Allowed Headers: Content-Type
Credentials: true   ← required for cookie-based auth
```
