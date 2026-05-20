# API Contracts: School Portal Identity & Student/Teacher UX Overhaul

**Feature**: `004-school-portal-ux`  
**Date**: 2026-05-18  
**Base URL**: `/api/v1`  
**Auth**: JWT in `httpOnly` cookie. All authenticated routes require `authenticate` middleware.  
**Tenant scope**: All non-platform routes use `authenticate → schoolScope → authorize(role)` chain.

---

## Authentication — New Endpoints

### POST `/auth/forgot-password`

**Auth**: None (public)  
**Request body**:
```json
{ "email": "student@example.com" }
```
**Response** (always 200 — don't reveal whether email exists):
```json
{ "success": true, "message": "If that email is registered, you will receive a reset link shortly." }
```
**Behaviour**:
- Looks up user by email.
- If found: creates `PasswordResetToken`, queues email with reset link.
- If not found: responds identically (no email sent). Prevents user enumeration.
- Rate limit: max 5 requests per IP per 15 minutes (express-rate-limit, keyed by IP).

---

### POST `/auth/reset-password`

**Auth**: None (public — authenticated via one-time token in request body)  
**Request body**:
```json
{
  "token": "<raw 32-byte token from email URL>",
  "newPassword": "NewP@ss123"
}
```
**Validation**: `newPassword` min 8 chars.  
**Response 200**:
```json
{ "success": true, "message": "Password reset successfully. You can now log in." }
```
**Response 400** (token invalid/expired/used):
```json
{ "success": false, "message": "This reset link is invalid or has expired." }
```

---

### PUT `/auth/change-password` *(student and teacher only)*

**Auth**: `authenticate + schoolScope + authorize(['student', 'teacher'])`  
**Request body**:
```json
{
  "currentPassword": "TempP@ss1",
  "newPassword": "MyNewSecure99!"
}
```
**Validation**: `newPassword` min 8 chars, different from `currentPassword`.  
**Response 200**:
```json
{ "success": true, "message": "Password updated successfully.", "data": null }
```
**Response 401**:
```json
{ "success": false, "message": "Current password is incorrect." }
```
**Side effect**: Clears `mustChangePassword: false` on the User document.

---

### Changed: `POST /auth/login` — Response Shape

`user` object in response now includes `mustChangePassword: Boolean` field:
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "name": "Alice Smith",
      "email": "alice@school.com",
      "role": "student",
      "schoolId": { "_id": "...", "slug": "greenwood-high", "name": "Greenwood High School" },
      "mustChangePassword": false,
      "isActive": true,
      "approvalStatus": "approved"
    }
  }
}
```

---

## Changed: Public School Info

### GET `/public/schools/:slug/config`

**Auth**: None  
**Changed**: Remove `isActive` from response. Only expose:
```json
{
  "success": true,
  "data": {
    "school": {
      "name": "Greenwood High School",
      "slug": "greenwood-high",
      "branding": {
        "logoUrl": "https://res.cloudinary.com/.../logo.png",
        "primaryColor": "#1a73e8",
        "secondaryColor": "#fbbc04",
        "tagline": "Excellence in Education",
        "address": "123 Oak Lane, Springfield",
        "contactNumber": "+1 555-0100"
      }
    }
  }
}
```

---

## Admin — New Exam Endpoints

All admin exam endpoints: `authenticate + schoolScope + authorize('school-admin')`  
`schoolId` is injected from `req.schoolId` — never from the request body.

### GET `/admin/exams`

Returns all non-deleted exams for the school.  
**Query params**: `?year=2024&classId=<id>` (optional filters)  
**Response 200**:
```json
{
  "success": true,
  "data": {
    "exams": [
      {
        "_id": "...",
        "name": "Mid-Term 2024",
        "year": 2024,
        "term": "Term 1",
        "classId": { "_id": "...", "name": "Grade 10A" },
        "subjects": [
          { "name": "Mathematics", "totalMarks": 100, "passMark": null }
        ],
        "publishedAt": null
      }
    ]
  }
}
```

---

### POST `/admin/exams`

**Request body**:
```json
{
  "name": "Mid-Term 2024",
  "year": 2024,
  "term": "Term 1",
  "classId": "<class_id>",
  "subjects": [
    { "name": "Mathematics", "totalMarks": 100 },
    { "name": "Science", "totalMarks": 100 },
    { "name": "English", "totalMarks": 100 }
  ]
}
```
**Response 201**:
```json
{ "success": true, "data": { "exam": { ...examObject } }, "message": "Exam created successfully." }
```

---

### GET `/admin/exams/:examId`

Returns a single exam with full subject list.

---

### PUT `/admin/exams/:examId`

Update exam metadata (name, subjects). Cannot change `year`, `term`, or `classId` after results are entered for it (service-layer guard).

---

### DELETE `/admin/exams/:examId`

Soft delete (sets `isDeleted: true`). Prevents deletion if results exist for the exam.

---

### GET `/admin/exams/:examId/results`

Returns all student results for a given exam (for the result entry page).  
**Response 200**:
```json
{
  "success": true,
  "data": {
    "exam": { "_id": "...", "name": "Mid-Term 2024", "subjects": [...] },
    "results": [
      {
        "studentId": { "_id": "...", "name": "Alice", "rollNumber": "G10A-01" },
        "marks": [
          { "subject": "Mathematics", "marksObtained": 85 },
          { "subject": "Science",     "marksObtained": 72 }
        ],
        "overallPercentage": 78.5,
        "rank": 3
      }
    ]
  }
}
```

---

### PUT `/admin/exams/:examId/results`

Bulk upsert results for an exam. Creates or updates all results in a single request.  
**Request body**:
```json
{
  "results": [
    {
      "studentId": "<id>",
      "marks": [
        { "subject": "Mathematics", "marksObtained": 85 },
        { "subject": "Science",     "marksObtained": 72 }
      ]
    }
  ]
}
```
**Response 200**:
```json
{ "success": true, "data": { "saved": 30 }, "message": "Results saved successfully." }
```
**Validation**: For each subject mark, `marksObtained` must be ≤ `totalMarks` of that subject in the exam. Invalid entries are rejected with field-level errors.

---

## Student — New Endpoints

All student endpoints: `authenticate + schoolScope + authorize('student')`

### GET `/student/exams/years`

Returns distinct academic years for which exams exist in the student's class/school.  
**Response 200**:
```json
{ "success": true, "data": { "years": [2024, 2023, 2022] } }
```

---

### GET `/student/exams?year=2024`

Returns all exams for the student's school in a given year.  
**Response 200**:
```json
{
  "success": true,
  "data": {
    "exams": [
      { "_id": "...", "name": "Mid-Term 2024", "year": 2024, "term": "Term 1", "publishedAt": "2024-08-15T00:00:00Z" }
    ]
  }
}
```

---

### GET `/student/results?examId=<id>`

Returns the authenticated student's result for a specific exam.  
**Response 200**:
```json
{
  "success": true,
  "data": {
    "result": {
      "examId": "...",
      "examName": "Mid-Term 2024",
      "term": "Term 1",
      "year": 2024,
      "marks": [
        { "subject": "Mathematics", "marksObtained": 85, "totalMarks": 100, "percentage": 85, "pass": true },
        { "subject": "Science",     "marksObtained": 72, "totalMarks": 100, "percentage": 72, "pass": true }
      ],
      "overallPercentage": 78.5,
      "rank": 3
    }
  }
}
```
**Response 404** (no result yet):
```json
{ "success": false, "message": "No result found for this exam." }
```

---

### PUT `/student/password` *(new)*

Same contract as `PUT /auth/change-password` — see above. Role guard is `authorize('student')`.

---

## Teacher — New Endpoint

### PUT `/teacher/password`

Same contract as `PUT /auth/change-password`. Role guard is `authorize('teacher')`.

---

## Contract Change Summary

| Method | Path | Change type | Auth |
|--------|------|-------------|------|
| POST | `/auth/forgot-password` | **New** | Public |
| POST | `/auth/reset-password` | **New** | Public (token in body) |
| PUT  | `/auth/change-password` | **New** | student \| teacher |
| GET  | `/public/schools/:slug/config` | **Modified** (remove `isActive`) | Public |
| GET  | `/admin/exams` | **New** | school-admin |
| POST | `/admin/exams` | **New** | school-admin |
| GET  | `/admin/exams/:examId` | **New** | school-admin |
| PUT  | `/admin/exams/:examId` | **New** | school-admin |
| DELETE | `/admin/exams/:examId` | **New** (soft) | school-admin |
| GET  | `/admin/exams/:examId/results` | **New** | school-admin |
| PUT  | `/admin/exams/:examId/results` | **New** (bulk upsert) | school-admin |
| GET  | `/student/exams/years` | **New** | student |
| GET  | `/student/exams` | **New** | student |
| GET  | `/student/results` | **New** | student |
| PUT  | `/student/password` | **New** | student |
| PUT  | `/teacher/password` | **New** | teacher |
