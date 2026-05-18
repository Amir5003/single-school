# Data Model: Multi-School SaaS Platform

**Feature**: `003-multi-school-saas`  
**Phase**: 1 — Design  
**Date**: 2026-05-17  
**Status**: Complete  
**Depends on**: research.md (Decision 1, 2, 6)

---

## Overview

The data model converts from single-tenant to multi-tenant. The fundamental change is:
- A new top-level `School` entity is the tenant anchor.
- Every tenant-scoped collection gains a required `schoolId` field with compound indexes.
- `User` gains `schoolId` and two new roles (`super-admin`, `parent`).
- Three new collections: `Fee`, `Homework`, `Notification`.
- One new junction collection: `ParentStudentLink`.
- One migration utility collection: `_migrations`.

---

## Entity: School *(new)*

**Purpose**: Top-level tenant entity. One document per school.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | Auto-generated |
| `name` | String | required, trim, maxlength 200 | "Sunrise Academy" |
| `slug` | String | required, unique, lowercase, match `/^[a-z0-9-]{3,50}$/` | "sunrise-academy" |
| `slugLockedAt` | Date | default null | Set on first non-admin login; slug becomes immutable |
| `plan` | String | enum: `free\|standard\|premium`, default `free` | Subscription tier |
| `isActive` | Boolean | default true | Deactivated by super-admin to suspend all logins |
| `branding` | Object (embedded) | — | See Branding sub-schema below |
| `createdAt` | Date | auto | — |
| `updatedAt` | Date | auto | — |

**Branding sub-schema** (embedded in School):

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `logoUrl` | String | default null | Cloudinary URL |
| `primaryColor` | String | match `/^#[0-9A-Fa-f]{6}$/`, default `#1a56db` | Hex colour |
| `secondaryColor` | String | match `/^#[0-9A-Fa-f]{6}$/`, default `#7c3aed` | Hex colour |
| `tagline` | String | maxlength 200, default null | "Excellence in Education" |
| `address` | String | maxlength 500, default null | — |
| `contactNumber` | String | trim, default null | — |

**Indexes**:
```js
schoolSchema.index({ slug: 1 }, { unique: true });
schoolSchema.index({ isActive: 1 });
schoolSchema.index({ plan: 1 });
```

**State transitions**:
- `isActive`: `true → false` (super-admin deactivation), `false → true` (super-admin reactivation)
- `slugLockedAt`: `null → Date` (one-way; never reverted)

**Validation rules**:
- Slug format: `/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/` (no leading/trailing hyphens)
- Slug uniqueness checked at both validator layer (real-time check endpoint) and DB unique index
- `primaryColor` / `secondaryColor` must be valid 6-digit hex codes if provided

---

## Entity: User *(modified)*

**Purpose**: Authentication and identity for all platform users. Extended for multi-tenancy.

**Changes from v1**: Added `schoolId`, expanded `role` enum to 5 values, added `refreshTokenHash`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `name` | String | required, trim | — |
| `email` | String | required, unique at platform level, lowercase | Email is platform-unique (not per-school) |
| `password` | String | required, bcrypt rounds=12 | Never returned in responses |
| `role` | String | enum: `super-admin\|school-admin\|teacher\|student\|parent` | — |
| `schoolId` | ObjectId ref `School` | required for all roles except `super-admin`, null for super-admin | — |
| `phone` | String | trim, default null | — |
| `isActive` | Boolean | default true | — |
| `approvalStatus` | String | enum: `pending\|approved\|rejected`, default `approved` | For teacher/student self-registration flows |
| `refreshTokenHash` | String | default null | bcrypt hash of the current refresh token |
| `createdAt` | Date | auto | — |
| `updatedAt` | Date | auto | — |

**Indexes**:
```js
userSchema.index({ email: 1 }, { unique: true });           // existing
userSchema.index({ schoolId: 1, role: 1 });                 // NEW: list users by school + role
userSchema.index({ schoolId: 1, isActive: 1 });             // NEW: active user checks
```

**Validation rules**:
- `schoolId` MUST be provided for all roles except `super-admin`
- `schoolId` MUST NOT be provided for `super-admin`
- Email uniqueness is enforced globally, not per-school (prevents same email in two schools)

---

## Entity: Student *(modified)*

**Purpose**: Student profile linked to a User account.

**Changes from v1**: Added `schoolId`. `enrollmentId` uniqueness scoped to school (not globally unique). 

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `userId` | ObjectId ref `User` | required, unique | — |
| `schoolId` | ObjectId ref `School` | **required** | NEW |
| `enrollmentId` | String | required, uppercase, trim | Unique within school (compound index) |
| `dateOfBirth` | Date | required | — |
| `address` | String | maxlength 300, default null | — |
| `classId` | ObjectId ref `Class` | default null | — |
| `isDeleted` | Boolean | default false | Soft delete |
| `deletedAt` | Date | default null | Soft delete timestamp |

**Indexes**:
```js
studentSchema.index({ schoolId: 1, classId: 1 });                        // list students by class
studentSchema.index({ schoolId: 1, isDeleted: 1 });                      // filter deleted
studentSchema.index({ schoolId: 1, enrollmentId: 1 }, { unique: true }); // per-school unique enrollment
```

*Remove old global `enrollmentId` unique index (replaced by compound).*

---

## Entity: Teacher *(modified)*

**Purpose**: Teacher profile linked to a User account.

**Changes from v1**: Added `schoolId`. `employeeId` uniqueness scoped to school.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `userId` | ObjectId ref `User` | required, unique | — |
| `schoolId` | ObjectId ref `School` | **required** | NEW |
| `employeeId` | String | required, uppercase, trim | Unique within school (compound index) |
| `specialization` | String | trim, default null | — |
| `isDeleted` | Boolean | default false | — |
| `deletedAt` | Date | default null | — |

**Indexes**:
```js
teacherSchema.index({ schoolId: 1, isDeleted: 1 });
teacherSchema.index({ schoolId: 1, employeeId: 1 }, { unique: true });
```

---

## Entity: Class *(modified)*

**Purpose**: A class/section within a school.

**Changes from v1**: Added `schoolId`. Class name uniqueness scoped to school.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `schoolId` | ObjectId ref `School` | **required** | NEW |
| `name` | String | required, trim | "Class 10-A" |
| `academicYear` | String | required | "2025-2026" |
| `isDeleted` | Boolean | default false | — |

**Indexes**:
```js
classSchema.index({ schoolId: 1, academicYear: 1 });
classSchema.index({ schoolId: 1, name: 1, academicYear: 1 }, { unique: true });
```

---

## Entity: Attendance *(modified)*

**Changes from v1**: Added `schoolId` to compound indexes.

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId ref `School` | **required**, NEW |
| `studentId` | ObjectId ref `Student` | required |
| `classId` | ObjectId ref `Class` | required |
| `date` | Date | required |
| `status` | String | enum: `Present\|Absent\|Leave` |
| `markedBy` | ObjectId ref `Teacher` | required |

**Indexes**:
```js
attendanceSchema.index({ schoolId: 1, studentId: 1, date: 1 }, { unique: true }); // prevent double-mark
attendanceSchema.index({ schoolId: 1, classId: 1, date: 1 });                     // bulk fetch
```

---

## Entity: Marks *(modified)*

**Changes from v1**: Added `schoolId`.

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId ref `School` | **required**, NEW |
| `studentId` | ObjectId ref `Student` | required |
| `classId` | ObjectId ref `Class` | required |
| `subject` | String | required |
| `examType` | String | enum values |
| `marksObtained` | Number | required |
| `totalMarks` | Number | required |
| `academicYear` | String | required |

**Indexes**:
```js
marksSchema.index({ schoolId: 1, studentId: 1, examType: 1, subject: 1 });
marksSchema.index({ schoolId: 1, classId: 1, examType: 1 });
```

---

## Entity: Timetable *(modified)*

**Changes from v1**: Added `schoolId`.

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId ref `School` | **required**, NEW |
| `classId` | ObjectId ref `Class` | required |
| `day` | String | enum: Mon–Sun |
| `periods` | Array | `[{ subject, teacherId, startTime, endTime }]` |

**Indexes**:
```js
timetableSchema.index({ schoolId: 1, classId: 1, day: 1 }, { unique: true });
```

---

## Entity: Announcement *(modified)*

**Changes from v1**: Added `schoolId`.

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId ref `School` | **required**, NEW |
| `title` | String | required |
| `body` | String | required |
| `postedBy` | ObjectId ref `User` | required |
| `targetRole` | String | enum: `all\|teacher\|student\|parent` |

**Indexes**:
```js
announcementSchema.index({ schoolId: 1, createdAt: -1 });
announcementSchema.index({ schoolId: 1, targetRole: 1 });
```

---

## Entity: ClassTeacher *(modified)*

**Changes from v1**: Added `schoolId`.

| Field | Type | Notes |
|-------|------|-------|
| `schoolId` | ObjectId ref `School` | **required**, NEW |
| `classId` | ObjectId ref `Class` | required |
| `teacherId` | ObjectId ref `Teacher` | required |
| `subject` | String | required |

**Indexes**:
```js
classTeacherSchema.index({ schoolId: 1, classId: 1, teacherId: 1 });
classTeacherSchema.index({ schoolId: 1, teacherId: 1 });
```

---

## Entity: ParentStudentLink *(new)*

**Purpose**: Links a parent user to one or more students within the same school. Enables parent access to child records.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `schoolId` | ObjectId ref `School` | required | Must match both parent and student school |
| `parentId` | ObjectId ref `User` | required | User with role=parent |
| `studentId` | ObjectId ref `Student` | required | — |
| `createdAt` | Date | auto | — |

**Indexes**:
```js
parentStudentLinkSchema.index({ schoolId: 1, parentId: 1 });
parentStudentLinkSchema.index({ schoolId: 1, studentId: 1 });
parentStudentLinkSchema.index({ parentId: 1, studentId: 1 }, { unique: true }); // one link per parent-student pair
```

**Validation rules**:
- On create: validate that `parent.schoolId === studentSchool.schoolId` (cross-school link rejected)
- A parent can have multiple links (multiple children), but each link is unique per `(parentId, studentId)` pair

---

## Entity: Fee *(new)*

**Purpose**: Fee record per student within a school. Manually managed by school-admin.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `schoolId` | ObjectId ref `School` | required | — |
| `studentId` | ObjectId ref `Student` | required | — |
| `amount` | Number | required, min 0 | In INR (or school currency) |
| `description` | String | required, maxlength 300 | "Tuition Fee - June 2026" |
| `dueDate` | Date | required | — |
| `status` | String | enum: `pending\|paid\|overdue`, default `pending` | `overdue` set by daily cron |
| `paidAt` | Date | default null | Set when status → `paid` |
| `createdAt` | Date | auto | — |
| `updatedAt` | Date | auto | — |

**Indexes**:
```js
feeSchema.index({ schoolId: 1, studentId: 1, status: 1 });
feeSchema.index({ schoolId: 1, dueDate: 1, status: 1 }); // cron overdue scan
```

**State transitions**:
- `pending → paid` (school-admin marks paid)
- `pending → overdue` (daily cron when `dueDate < today && status === 'pending'`)
- `overdue → paid` (school-admin marks paid even if overdue)
- `paid → *` NOT allowed (paid fees are final)

---

## Entity: Homework *(new)*

**Purpose**: Homework assignments posted by teachers for a class.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `schoolId` | ObjectId ref `School` | required | — |
| `classId` | ObjectId ref `Class` | required | — |
| `teacherId` | ObjectId ref `Teacher` | required | — |
| `title` | String | required, maxlength 200 | — |
| `description` | String | maxlength 2000, default null | — |
| `dueDate` | Date | required | — |
| `attachments` | Array | `[{ url, publicId, filename }]` | Cloudinary references |
| `isDeleted` | Boolean | default false | Soft delete |
| `createdAt` | Date | auto | — |
| `updatedAt` | Date | auto | — |

**Indexes**:
```js
homeworkSchema.index({ schoolId: 1, classId: 1, dueDate: -1 });
homeworkSchema.index({ schoolId: 1, teacherId: 1 });
```

---

## Entity: Notification *(new)*

**Purpose**: In-platform notifications sent by school-admin or teacher to targeted roles within a school.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | PK | — |
| `schoolId` | ObjectId ref `School` | required | — |
| `senderId` | ObjectId ref `User` | required | school-admin or teacher |
| `targetRole` | String | enum: `all\|teacher\|student\|parent`, required | — |
| `title` | String | required, maxlength 200 | — |
| `body` | String | required, maxlength 2000 | — |
| `readBy` | Array of ObjectId | default [] | Users who have read this notification |
| `createdAt` | Date | auto | — |

**Indexes**:
```js
notificationSchema.index({ schoolId: 1, targetRole: 1, createdAt: -1 });
notificationSchema.index({ schoolId: 1, createdAt: -1 });
```

---

## Entity: _migrations *(utility — new)*

**Purpose**: Tracks which migration scripts have been applied. Used by `migrate-to-multitenant.js`.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `name` | String | e.g., `"001-add-school-id-to-all-collections"` |
| `appliedAt` | Date | When migration ran |

**Index**: `{ name: 1 }` unique.

---

## Entity Relationship Summary

```
School (1) ─────────────────────────────────────────────────────┐
  │                                                              │
  ├── User (N) [role: school-admin, teacher, student, parent]   │
  │    ├── Teacher (1:1 with User where role=teacher)           │
  │    ├── Student (1:1 with User where role=student)           │
  │    └── Parent  (1:N via ParentStudentLink → Student)        │
  │                                                              │
  ├── Class (N)                                                  │
  │    ├── ClassTeacher (N) → Teacher                           │
  │    ├── Timetable (N, one per day)                           │
  │    ├── Attendance (N) → Student                             │
  │    ├── Marks (N) → Student                                  │
  │    └── Homework (N) → Teacher                               │
  │                                                              │
  ├── Fee (N) → Student                                         │
  ├── Announcement (N)                                          │
  └── Notification (N)                                          │
                                                                 │
User (super-admin, no schoolId) ────────────────────────────────┘
  └── manages Schools via /api/v1/platform/ routes
```

---

## Migration Delta: schoolId Addition

All existing collections need `schoolId` added. The migration script (`scripts/migrate-to-multitenant.js`) will:

| Collection | Operation |
|------------|-----------|
| `users` | `{ $set: { schoolId: seedSchoolId } }` for all non-super-admin |
| `students` | `{ $set: { schoolId: seedSchoolId } }` for all |
| `teachers` | `{ $set: { schoolId: seedSchoolId } }` for all |
| `classes` | `{ $set: { schoolId: seedSchoolId } }` for all |
| `classteachers` | `{ $set: { schoolId: seedSchoolId } }` for all |
| `timetables` | `{ $set: { schoolId: seedSchoolId } }` for all |
| `attendances` | `{ $set: { schoolId: seedSchoolId } }` for all |
| `marks` | `{ $set: { schoolId: seedSchoolId } }` for all |
| `announcements` | `{ $set: { schoolId: seedSchoolId } }` for all |

After migration, update unique indexes: drop old global `enrollmentId` unique index on `students`, create new compound `(schoolId, enrollmentId)` unique index.
