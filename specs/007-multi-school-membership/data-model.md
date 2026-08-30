# Data Model: Multi-School Membership

**Status**: ⛔ PARKED — only implement once this is confirmed by the customer.

Authoritative reference for the collections introduced and changed by feature 007.
Grounded in the codebase as of 2026-08-30.

---

## 0. The defect this corrects

`User` currently conflates two different lifetimes in one document:

```js
{
  email, password, name, phone,   // identity  — global, one per human
  role, schoolId, approvalStatus, // membership — per school, many per human
  rejectionRemark
}
```

`email` is globally unique (`User.model.js:16`) and `schoolId` is a single ref
(`User.model.js:29-33`), so the membership half is capped at one. Splitting the document
removes the cap without touching any tenant-scoped collection.

**Already correct, and untouched:** 17 domain models carry their own `schoolId`.
`Teacher` and `Student` are *already* membership-shaped — `{ schoolId, userId }` — and
`ParentStudentLink` is already scoped with a compound index. Half of this model work
exists; it is only the indexes that need relaxing.

---

## 1. `Membership` (new)

```js
{
  _id:             ObjectId,
  userId:          ObjectId,   // ref 'User',   required
  schoolId:        ObjectId,   // ref 'School', required
  role:            'school-admin' | 'teacher' | 'student' | 'parent',
  approvalStatus:  'pending' | 'approved' | 'rejected',   // default 'pending'
  rejectionRemark: String | null,
  isActive:        Boolean,    // default true — per-school kill switch
  invitedBy:       ObjectId | null,   // ref 'User' — set when an admin created it
  joinedAt:        Date | null,       // set on acceptance, null while pending
  createdAt, updatedAt
}
```

**Indexes**

| Index | Purpose |
|---|---|
| `{ userId: 1, schoolId: 1 }` **unique** | One membership per person per school. Forbids two roles in the same school — deliberate, see spec §Out of Scope. |
| `{ schoolId: 1, approvalStatus: 1 }` | The admin approval queue (`user.service.js:11`). |
| `{ schoolId: 1, role: 1 }` | Role-scoped listings and platform analytics. |
| `{ userId: 1 }` | The login membership lookup — the hot path. |

**Note on `role`.** It moves off `User` and onto the membership because it is inherently
per-school: the same person may be a teacher at A and a parent at B. The JWT still carries
a single `role`, resolved at school-selection time.

---

## 2. `User` (changed — narrowed to identity)

```js
{
  _id:              ObjectId,
  name:             String,
  email:            String,    // unique — KEPT. This is the identity key.
  password:         String,
  phone:            String | null,
  isActive:         Boolean,   // platform-level kill switch (banned account)
  isPlatformAdmin:  Boolean,   // NEW — replaces role === 'super-admin'
  mustChangePassword: Boolean, // stays: the credential is identity-level
  refreshTokenHash: String | null,
  createdAt, updatedAt
}
```

**Removed:** `role`, `schoolId`, `approvalStatus`, `rejectionRemark` — all four move to
`Membership`.

**Two distinct `isActive` flags.** `User.isActive` means "this human is barred from the
platform". `Membership.isActive` means "this human no longer works at this school".
Conflating them is the regression described in spec US4 — deactivating one school must
never touch `User.isActive`.

**Why super-admin is not a membership.** A platform admin belongs to no school. Forcing
one in with `schoolId: null` breaks the unique compound index (Mongo treats missing keys
as equal) and every scoped query. `schoolScope.js:18-21` already special-cases the role;
`isPlatformAdmin` keeps that branch honest.

---

## 3. `Teacher` / `Student` (changed — index only)

```js
// Teacher.model.js:10-15 and Student.model.js:11-16
userId: { type: ObjectId, ref: 'User', required: true, unique: true }   // ← DROP unique
```

Replace with a compound unique:

```js
teacherSchema.index({ schoolId: 1, userId: 1 }, { unique: true });
studentSchema.index({ schoolId: 1, userId: 1 }, { unique: true });
```

Without this the second profile still fails on insert regardless of what `Membership`
says. No other field changes; both already carry `schoolId`.

---

## 4. Collections explicitly unchanged

`School`, `Class`, `ClassTeacher`, `Attendance`, `Marks`, `Exam`, `Result`,
`SubjectSubmission`, `Homework`, `Announcement`, `Notification`, `Timetable`, `Fee`,
`FeeConfig`, `ParentStudentLink`, `SubscriptionEvent`.

All already carry `schoolId` and are queried through it. The tenancy partition is correct
and this feature does not touch it.

---

## 5. Derived reads that must change

| Consumer | Today | Under memberships |
|---|---|---|
| `studentCount.service.js:25-45` | `$lookup` User, match `user.isActive` + `user.approvalStatus` | `$lookup` Membership on `{ userId, schoolId }`. **Billing depends on this** — a student active at A must not inflate B's trial count. |
| `user.service.js:11` | `User.find({ approvalStatus, schoolId })` | `Membership.find({ schoolId, approvalStatus }).populate('userId')` |
| `platform.service.js:145` | `User.find({ role: 'school-admin', approvalStatus })` | Membership query, populated for display |
| `student.service.js:130` | Name search filters `{ role, schoolId }` on User | Drop both filters — the outer `Student` query is already school-scoped |

---

## 6. Migration shape

One idempotent script, `backend/scripts/backfillMemberships.js`:

```
for each User where schoolId != null:
    upsert Membership {
      userId, schoolId,
      role:            user.role,
      approvalStatus:  user.approvalStatus,
      rejectionRemark: user.rejectionRemark,
      isActive:        user.isActive,
      joinedAt:        user.createdAt,
    }  keyed on { userId, schoolId }

for each User where role == 'super-admin':
    set isPlatformAdmin = true, create no membership
```

**Reconciliation before proceeding:** count of users with a `schoolId` must equal count of
memberships, and every approved user must have exactly one approved membership. The old
`User` fields are retained and dual-written until the read switch has soaked for a full
release — see `plan.md` §5.
