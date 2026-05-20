# Data Model: School Portal Identity & Student/Teacher UX Overhaul

**Feature**: `004-school-portal-ux`  
**Date**: 2026-05-18  
**Source**: research.md (R-001 through R-011)

---

## 1. Modified: `User` Model

**File**: `backend/src/models/User.model.js`

**Changes**: Add two fields to the existing `userSchema`.

```js
// ADD to userSchema fields:
mustChangePassword: {
  type: Boolean,
  default: false,
},
passwordResetExpiry: {
  // Kept on User for quick expiry check without a join; PasswordResetToken holds the hash.
  // This field is null when no reset is pending.
  type: Date,
  default: null,
},
```

**Indexes**: No new indexes — existing `{ schoolId: 1, role: 1 }` compound index is sufficient.

**State transitions**:
```
CREATED BY ADMIN         mustChangePassword = true
    │
    ▼
FIRST LOGIN              mustChangePassword = true  → frontend redirects to /change-password
    │
    ▼ PUT /student/password (or /teacher/password)
PASSWORD CHANGED         mustChangePassword = false
    │
    ▼
NORMAL SESSION           mustChangePassword = false (no redirect)
```

---

## 2. New: `PasswordResetToken` Model

**File**: `backend/src/models/PasswordResetToken.model.js`

```js
{
  userId:     ObjectId (ref: 'User'), required, indexed
  tokenHash:  String, required           // SHA-256 of the raw token sent via email
  expiresAt:  Date, required             // now + 1 hour
  used:       Boolean, default: false
}
```

**Indexes**:
- `{ expiresAt: 1 }` — TTL index with `expireAfterSeconds: 0` for automatic document cleanup.
- `{ userId: 1 }` — for looking up active tokens per user.
- `{ tokenHash: 1 }` — for fast lookup during reset verification.

**Tenant scope**: This model is NOT school-scoped. It is user-scoped. A `PasswordResetToken` belongs to a `User` which in turn belongs to a `School`. No `schoolId` field is needed — the `userId` reference provides sufficient isolation. Password reset links are generated with a raw token sent in the email, never the hash.

**Lifecycle**:
```
POST /auth/forgot-password    → create PasswordResetToken(userId, tokenHash, expiresAt)
                              → email user reset URL

POST /auth/reset-password     → find by tokenHash, check !used && !expired
                              → mark used=true, update User.password
                              → MongoDB TTL cleans up expired docs automatically
```

---

## 3. New: `Exam` Model

**File**: `backend/src/models/Exam.model.js`

```js
{
  schoolId:  ObjectId (ref: 'School'), required, indexed
  classId:   ObjectId (ref: 'Class'), required, indexed   // exam is for a specific class
  name:      String, required, trim                       // e.g. "Mid-Term Examination 2024"
  year:      Number, required                              // e.g. 2024
  term:      String, enum: ['Term 1', 'Term 2', 'Term 3', 'Final'], required
  subjects:  [
    {
      name:       String, required, trim         // e.g. "Mathematics"
      totalMarks: Number, required, min: 1       // maximum score for this subject
      passMark:   Number, default: null          // null → system uses global threshold (35%)
    }
  ]
  publishedAt: Date, default: null               // null = draft; set to Date.now when published
  isDeleted:   Boolean, default: false           // soft delete
}
timestamps: true
```

**Indexes**:
- `{ schoolId: 1, classId: 1, year: -1, term: 1 }` — primary compound index; supports the year/term filter query.
- `{ schoolId: 1, year: -1 }` — for the years dropdown query (`GET /exams/years`).
- `{ schoolId: 1, isDeleted: 1 }` — for listing active exams.

**Validation rules**:
- `subjects` array must have at least 1 element.
- `totalMarks` must be ≥ 1.
- `year` must be between 2000 and 2100 (reasonable bounds for a school app).
- Duplicate `(schoolId, classId, name, year, term)` combination is rejected (unique compound).

---

## 4. New: `Result` Model

**File**: `backend/src/models/Result.model.js`

```js
{
  schoolId:          ObjectId (ref: 'School'), required, indexed
  examId:            ObjectId (ref: 'Exam'),   required, indexed
  studentId:         ObjectId (ref: 'Student'), required, indexed
  marks: [
    {
      subject:         String, required    // must match a subject name in linked Exam
      marksObtained:   Number, required, min: 0
    }
  ]
  overallPercentage: Number, default: null  // computed before save; null until calculated
  rank:              Number, default: null  // optional; set when admin/teacher publishes ranks
  isDeleted:         Boolean, default: false
}
timestamps: true
```

**Indexes**:
- `{ schoolId: 1, examId: 1, studentId: 1 }` — unique compound index (one result per student per exam).
- `{ schoolId: 1, studentId: 1, examId: 1 }` — for student's "my results" queries.
- `{ schoolId: 1, examId: 1 }` — for admin's "results for exam" queries.

**Virtual / computed field**: `overallPercentage` is stored (not purely virtual) to enable sorting by rank without recomputing on every query. It is calculated in the `pre('save')` hook:

```
overallPercentage = sum(marksObtained) / sum(totalMarks from linked Exam.subjects) × 100
```

**Pass/fail per subject** (not stored on model — computed at read time in the service layer):
```
subject pass = marksObtained >= (subject.passMark ?? GLOBAL_PASS_THRESHOLD)
GLOBAL_PASS_THRESHOLD = 35 (% of totalMarks)
```

**Validation**:
- `marksObtained` for each subject must not exceed `totalMarks` of the corresponding subject in the linked `Exam` document. This is validated at the service layer (not schema level) since it requires the `Exam` document.

---

## 5. New: `mailer.js` Config

**File**: `backend/src/config/mailer.js`

```js
// Singleton nodemailer transporter — configured via env vars
{
  SMTP_HOST:  process.env.SMTP_HOST
  SMTP_PORT:  Number(process.env.SMTP_PORT) || 587
  SMTP_USER:  process.env.SMTP_USER
  SMTP_PASS:  process.env.SMTP_PASS
  SMTP_FROM:  process.env.SMTP_FROM  // e.g. "SchoolMS <noreply@schoolms.dev>"
}
```

Throws a startup warning (not an error) if SMTP variables are missing — allows dev mode without email.

---

## 6. Changed: `school.service.js` — Strip `isActive` from Public Response

**File**: `backend/src/services/school.service.js`

**Change**: `getSchoolConfigBySlug` currently returns `{ name, slug, isActive, branding }`. Remove `isActive` from the return value. Only `name`, `slug`, and `branding` are public.

**Rationale** (from R-007): `isActive` is operational metadata; exposing it allows scrapers to enumerate which schools are active/suspended.

---

## 7. Redux: `uiSlice` — Add Login Modal State

**File**: `frontend/src/redux/slices/uiSlice.js`

**Add to `initialState`**:
```js
loginModal: {
  isOpen: false,
  redirectTo: null,   // string path or null
}
```

**Add reducers**:
```js
openLoginModal: (state, action) => {
  state.loginModal.isOpen = true;
  state.loginModal.redirectTo = action.payload?.redirectTo ?? null;
},
closeLoginModal: (state) => {
  state.loginModal.isOpen = false;
  state.loginModal.redirectTo = null;
},
```

**Add selectors**:
```js
export const selectLoginModal = (state) => state.ui.loginModal;
```

---

## 8. Enhanced: `EmptyState` Component

**File**: `frontend/src/components/common/EmptyState.jsx`

**Current**: Takes only `message` prop.

**Enhanced signature**: `{ icon, title, message }` — all optional with safe defaults.

- `icon`: React element (e.g. `<CalendarIcon />`). If omitted, show the current default SVG.
- `title`: Bold heading line above the message. If omitted, no heading shown (backward compat).
- `message`: Sub-text (existing prop, same default: `'No data available yet'`).

**Backward compatibility**: All existing call sites pass only `message` — the enhanced component is a strict superset.

---

## 9. Frontend: `localStorage` Slug Persistence

**New key**: `lastSchoolSlug`  
**Set**: In `Login.jsx` and `LoginModal.jsx` after a successful login that returns a non-null `schoolSlug`.  
**Read**: In the root `/` route handler in `App.jsx` — if set, redirect to `/schools/${lastSchoolSlug}/login`.  
**Clear**: On logout (`clearCredentials` action) — call `localStorage.removeItem('lastSchoolSlug')`.

---

## Entity Relationship Summary

```
School ──┬── Exam ──── Result ─── Student (User)
         │     └── classId ──── Class
         ├── User (mustChangePassword)
         │     └── PasswordResetToken
         ├── Student (existing)
         ├── Teacher (existing)
         ├── Marks (existing — unchanged)
         └── [other existing collections]
```

**New collections**: `exams`, `results`, `passwordresettokens`  
**Modified documents**: `users` (2 new fields), `school.service.js` (strip `isActive`)  
**Modified Redux**: `uiSlice` (loginModal state)  
**Modified Component**: `EmptyState.jsx` (enhanced props)
