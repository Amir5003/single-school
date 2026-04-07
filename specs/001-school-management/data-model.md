# Data Model: School Management System

**Feature**: `001-school-management`  
**Phase**: 1 — Design & Contracts  
**Date**: 2026-04-07  
**Database**: MongoDB Atlas via Mongoose 8.x  

---

## Collection Overview

| Collection | Model File | Purpose |
|------------|------------|---------|
| `users` | `User.model.js` | Authentication base for all roles |
| `students` | `Student.model.js` | Student profile + class assignment |
| `teachers` | `Teacher.model.js` | Teacher profile + specialization |
| `classes` | `Class.model.js` | Class/section definitions |
| `class_teachers` | `ClassTeacher.model.js` | Teacher-class-subject many-to-many join |
| `timetable` | `Timetable.model.js` | Class schedule entries |
| `attendance` | `Attendance.model.js` | Daily per-student attendance records |
| `marks` | `Marks.model.js` | Subject-wise marks per student |
| `announcements` | `Announcement.model.js` | Teacher-posted announcements |

---

## Schema Definitions

### 1. User (`users` collection)

**File**: `backend/src/models/User.model.js`

```js
{
  _id:       ObjectId (auto)
  name:      String, required, trim, maxLength: 100
  email:     String, required, unique, lowercase, trim
  password:  String, required           // bcrypt hash; never returned in queries
  role:      String, enum: ['admin', 'teacher', 'student'], required
  phone:     String, trim, maxLength: 15
  isActive:  Boolean, default: true
  createdAt: Date (timestamps: true)
  updatedAt: Date (timestamps: true)
}
```

**Indexes**: `{ email: 1 }` unique  
**Pre-save hook**: Hash password with bcrypt (rounds=12) if modified  
**Virtual**: No password field in `.toJSON()` (via `transform`)  
**Notes**: `isActive: false` used for suspended accounts (future admin action)

---

### 2. Student (`students` collection)

**File**: `backend/src/models/Student.model.js`

```js
{
  _id:          ObjectId (auto)
  userId:       ObjectId, ref: 'User', required, unique   // links to auth record
  enrollmentId: String, required, unique, trim, uppercase
  dateOfBirth:  Date, required
  address:      String, trim, maxLength: 300
  classId:      ObjectId, ref: 'Class'                   // null until assigned
  isDeleted:    Boolean, default: false                  // soft delete
  deletedAt:    Date                                     // set on soft delete
  createdAt:    Date (timestamps: true)
  updatedAt:    Date (timestamps: true)
}
```

**Indexes**:
- `{ enrollmentId: 1 }` unique
- `{ classId: 1 }` (frequent list-by-class queries)
- `{ isDeleted: 1 }` (all queries filter `isDeleted: false`)

**State transitions**:
- Active → Deleted: set `isDeleted: true`, `deletedAt: now`; User.isActive → false
- Blocked deletion if `Attendance` or `Marks` records exist; show admin warning

---

### 3. Teacher (`teachers` collection)

**File**: `backend/src/models/Teacher.model.js`

```js
{
  _id:                  ObjectId (auto)
  userId:               ObjectId, ref: 'User', required, unique
  employeeId:           String, required, unique, trim, uppercase
  subjectSpecialization: String, required, trim, maxLength: 100
  createdAt:            Date (timestamps: true)
  updatedAt:            Date (timestamps: true)
}
```

**Indexes**: `{ employeeId: 1 }` unique  
**Notes**: Full profile data (name, email, phone) lives in linked `User` document. Teacher profile populated via `populate('userId', 'name email phone')`.

---

### 4. Class (`classes` collection)

**File**: `backend/src/models/Class.model.js`

```js
{
  _id:       ObjectId (auto)
  name:      String, required, trim                      // e.g., "Grade 5 - A"
  grade:     String, required, trim                      // e.g., "5"
  section:   String, required, trim, uppercase, maxLength: 5  // e.g., "A"
  createdAt: Date (timestamps: true)
  updatedAt: Date (timestamps: true)
}
```

**Indexes**: `{ grade: 1, section: 1 }` unique compound (prevent duplicate class definitions)  
**Notes**: Student assignment is stored on `Student.classId`, not as an array here. This avoids unbounded array growth.

---

### 5. ClassTeacher (`class_teachers` collection)

**File**: `backend/src/models/ClassTeacher.model.js`

```js
{
  _id:       ObjectId (auto)
  classId:   ObjectId, ref: 'Class', required
  teacherId: ObjectId, ref: 'Teacher', required
  subject:   String, required, trim                      // e.g., "Mathematics"
  createdAt: Date (timestamps: true)
  updatedAt: Date (timestamps: true)
}
```

**Indexes**: `{ classId: 1, teacherId: 1, subject: 1 }` unique compound  
**Purpose**: Resolves Teacher ↔ Class many-to-many; teacher sees classes via `ClassTeacher.find({ teacherId })`.  
**Prevents**: Same teacher assigned to same class for same subject twice (FR-016)

---

### 6. Timetable (`timetable` collection)

**File**: `backend/src/models/Timetable.model.js`

```js
{
  _id:         ObjectId (auto)
  classId:     ObjectId, ref: 'Class', required
  teacherId:   ObjectId, ref: 'Teacher', required
  subject:     String, required, trim
  day:         String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required
  startTime:   String, required, match: /^([01]\d|2[0-3]):[0-5]\d$/  // HH:MM 24-hour
  endTime:     String, required, match: /^([01]\d|2[0-3]):[0-5]\d$/
  createdAt:   Date (timestamps: true)
  updatedAt:   Date (timestamps: true)
}
```

**Indexes**: `{ classId: 1, day: 1 }` (list-by-class-per-day queries)  
**Conflict validation** (in `timetable.service.js`, not schema):
```
Find any doc where: classId == new.classId AND day == new.day
  AND NOT (new.endTime <= existing.startTime OR new.startTime >= existing.endTime)
If found → throw ConflictError("Timetable conflict: [existing entry details]")
Also check teacherId + day for teacher scheduling conflicts.
```

---

### 7. Attendance (`attendance` collection)

**File**: `backend/src/models/Attendance.model.js`

```js
{
  _id:       ObjectId (auto)
  studentId: ObjectId, ref: 'Student', required
  classId:   ObjectId, ref: 'Class', required
  date:      Date, required                              // stored as UTC midnight
  status:    String, enum: ['Present', 'Absent', 'Leave'], required
  markedBy:  ObjectId, ref: 'Teacher', required         // audit trail
  createdAt: Date (timestamps: true)
  updatedAt: Date (timestamps: true)
}
```

**Indexes**:
- `{ studentId: 1, date: 1 }` unique compound — prevents double-marking (FR-026)
- `{ classId: 1, date: 1 }` — teacher bulk-fetch for class on a date
- `{ studentId: 1 }` — student attendance history queries

**Business rules** (enforced in `attendance.service.js`):
- `date > today` → throw `ValidationError("Cannot mark attendance for future dates")` (FR-025)
- Upsert with `updateOne({ studentId, date }, { $set: status }, { upsert: true })` for idempotent re-marking

---

### 8. Marks (`marks` collection)

**File**: `backend/src/models/Marks.model.js`

```js
{
  _id:           ObjectId (auto)
  studentId:     ObjectId, ref: 'Student', required
  classId:       ObjectId, ref: 'Class', required
  subject:       String, required, trim
  examType:      String, enum: ['midterm','final','quiz','assignment'], default: 'final'
  marksObtained: Number, required, min: 0, max: 100
  maxMarks:      Number, default: 100                  // extensible for custom scales
  createdAt:     Date (timestamps: true)
  updatedAt:     Date (timestamps: true)
}
```

**Indexes**:
- `{ studentId: 1, subject: 1, classId: 1, examType: 1 }` unique compound (FR-016 equivalent for marks)
- `{ studentId: 1 }` — student marks history

**Notes**: `examType` field added for future exam module extensibility (Principle VI). Default `'final'` preserves v1 behavior.

---

### 9. Announcement (`announcements` collection)

**File**: `backend/src/models/Announcement.model.js`

```js
{
  _id:         ObjectId (auto)
  title:       String, required, trim, maxLength: 200
  content:     String, required, trim, maxLength: 2000
  teacherId:   ObjectId, ref: 'Teacher', required
  isDeleted:   Boolean, default: false                  // soft delete
  publishedAt: Date, default: Date.now
  createdAt:   Date (timestamps: true)
  updatedAt:   Date (timestamps: true)
}
```

**Indexes**: `{ publishedAt: -1 }` (chronological listing); `{ isDeleted: 1 }`

---

## Entity Relationship Summary

```
User (1) ─────── (1) Student ─── (many) Attendance
                          └───── (many) Marks
                          └──── (1) Class ──── (many) ClassTeacher ──── (many) Teacher
                                        └──── (many) Timetable

User (1) ─────── (1) Teacher ─── (many) ClassTeacher
                           └──── (many) Timetable
                           └──── (many) Announcement
```

## Scalability Notes (Principle VI)

| Future Feature | Schema Ready? | Extension Path |
|----------------|--------------|---------------|
| Fees Module | ✅ | Add `fees` collection with `studentId` + `classId` + academic year |
| Full Exam Module | ✅ | `examType` field on Marks already exists; add `Exam` collection for exam metadata |
| Academic Year Tracking | ✅ | Add `academicYear` field to Class; filter all queries by year |
| Multi-school (SaaS) | ⚠️ | Would require `schoolId` field on all documents; not in v1 scope |
| Notifications | ✅ | Add `Notification` collection with `userId`, `type`, `read`; attach to Announcement events |
