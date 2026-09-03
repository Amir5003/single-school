# Data Model: Coursework & Report Cards

**Branch**: `008-coursework-report-cards` | **Date**: 2026-08-30

Exactly **one** collection changes. Everything else in the assessment domain is untouched, deliberately.

---

## 1. `Marks` (modified — existing model)

File: `backend/src/models/Marks.model.js`

### Current shape

```js
examType: {
  type: String,
  enum: ['midterm', 'final', 'quiz', 'assignment'],
  default: 'final',
},
marksObtained: {
  type: Number,
  required: [true, 'Marks obtained is required'],
  min: [0, 'Marks cannot be less than 0'],
  max: [100, 'Marks cannot exceed 100'],   // ← contradicts a settable maxMarks
},
maxMarks: { type: Number, default: 100 },
```

### Target shape

| Field | Change | Detail |
|-------|--------|--------|
| `schoolId` | unchanged | ObjectId ref `School`, required. Tenant scope. |
| `studentId` | unchanged | ObjectId ref `Student`, required. |
| `classId` | unchanged | ObjectId ref `Class`, required. |
| `subject` | unchanged | String, required, trimmed. Still free text — no `Subject` entity exists anywhere in this codebase. |
| `examType` | **renamed → `assessmentType`** | See below. |
| `assessmentType` | **new name, narrowed enum** | `String`, enum `['class_test','quiz','assignment','project','practical']`, default `'class_test'`. |
| `marksObtained` | **validator changed** | `Number`, required, `min: 0`. The fixed `max: 100` is replaced by a cross-field validator asserting `marksObtained <= this.maxMarks`. |
| `maxMarks` | unchanged | `Number`, default `100`. |
| `createdAt` / `updatedAt` | unchanged | Mongoose timestamps. |

### Why the enum narrows

`midterm` and `final` name the same events the `Exam` module governs. Leaving them reachable means a teacher can record term-exam marks outside the publish workflow. Removing them from the schema — not merely from the dropdown — is what closes the hole, because the API must reject them regardless of which client calls it.

`project` and `practical` are added because they are ordinary formative assessments, and because their presence makes the `max: 100` defect reachable in normal use (a practical scored out of 150), which is why FR-004 is bundled into this feature rather than deferred.

### Why `marksObtained` needs a cross-field validator

Mongoose's `max` is a static ceiling; it cannot reference a sibling path. The check must be a custom validator whose `this` is the document:

```js
marksObtained: {
  type: Number,
  required: [true, 'Marks obtained is required'],
  min: [0, 'Marks cannot be less than 0'],
  validate: {
    validator: function (v) {
      // `this` is the doc on save; on findOneAndUpdate it is the query — see caveat below.
      const ceiling = this.maxMarks ?? this.get?.('maxMarks') ?? 100;
      return v <= ceiling;
    },
    message: 'marksObtained cannot exceed maxMarks',
  },
},
```

> **Caveat that must be handled in the service, not the schema.** `marks.service.upsertMark` uses `findOneAndUpdate(..., { upsert: true, runValidators: true })`. Under an update, a custom validator's `this` is the **Query**, not the document, so sibling paths are not reliably reachable. The service already receives both `marksObtained` and `maxMarks` in the same call, so the authoritative check belongs there — validate `marksObtained <= (maxMarks ?? 100)` in `upsertMark` and throw `ApiError(400, ...)`. The schema validator is a second line of defence for direct `.save()` paths and test fixtures. Task T-B2 covers this.

### Indexes

| Index | Change |
|-------|--------|
| `(schoolId, studentId, subject, classId, assessmentType)` **unique** | Renamed field. Preserves current upsert-in-place semantics. |
| `(schoolId, studentId, assessmentType, subject)` | Renamed field. |
| `(schoolId, classId, assessmentType)` | Renamed field. |

All three stay `schoolId`-leading per Constitution Principle VIII, so uniqueness remains per-tenant.

---

## 2. Index migration — the highest-risk item in this feature

**Mongoose does not drop indexes it no longer declares.** `backend/src/config/db.js` calls `mongoose.connect(process.env.MONGO_URI)` with no options, so `autoIndex` defaults to **on**: the three new `assessmentType` indexes are created automatically on boot, and the three old `examType` indexes **remain**.

The failure this produces is not obvious and does not appear at boot:

1. The stale unique index `(schoolId, studentId, subject, classId, examType)` survives.
2. Every new document written after the rename has no `examType` path, which a MongoDB index stores as `null`.
3. A teacher saves a Quiz for a student — fine, first row.
4. The same teacher saves an Assignment for the **same student, subject and class**. The four leading fields match and both rows index `examType` as `null`.
5. **`E11000 duplicate key error`.** The save fails with an error that names a field no longer in the schema.

This is precisely the "everything worked, then suddenly it didn't" class of breakage the feature is required to avoid. There is direct precedent in this repository: `.claude/settings.local.json` still allowlists `node scripts/drop-stale-unique-indexes.js`, a script that no longer exists on disk.

### Required handling

For a **development or test** database — the expected case, since the app is pre-launch and `Marks` data is disposable:

```js
await mongoose.connection.collection('marks').drop();  // ignore NamespaceNotFound
```

Dropping the collection removes the documents and every index with them; Mongoose recreates the declared indexes on next boot. This is sanctioned by the "safe to drop" decision in `spec.md`.

For a database whose documents must be kept, drop only the obsolete indexes:

```js
const idx = await mongoose.connection.collection('marks').indexes();
for (const i of idx) {
  if (Object.keys(i.key).includes('examType')) {
    await mongoose.connection.collection('marks').dropIndex(i.name);
  }
}
```

Task T-A3 specifies `backend/scripts/drop-stale-marks-indexes.js` implementing both paths, following the idempotent `_migrations` sentinel pattern already established by `backend/scripts/migrate-to-multitenant.js`.

> **Environment variable inconsistency to avoid repeating.** `backend/src/config/db.js` reads `process.env.MONGO_URI`, while `backend/scripts/migrate-to-multitenant.js` reads `process.env.MONGODB_URI`. The new script MUST accept either — `process.env.MONGO_URI || process.env.MONGODB_URI` — and fail loudly with a clear message if neither is set, rather than connecting to a default localhost and silently doing nothing.

### Test databases

`mongodb-memory-server` builds a fresh database per run, so tests are immune to stale indexes and need no migration step. The hazard applies only to a developer's local database and to any deployed environment.

---

## 3. Models explicitly NOT changed

Stated so a reader is not left wondering, and so review can confirm the blast radius:

| Model | Status |
|---|---|
| `Exam` | **Unchanged.** No field, enum, index, or state-machine edit. |
| `SubjectSubmission` | **Unchanged.** |
| `Result` | **Unchanged.** Notably it gains no coursework field — coursework on the report card is deferred scope. |
| `ClassTeacher` | **Unchanged.** Still the source of truth for teacher↔subject↔class, used both by exam activation and by the coursework authorization check. |
| `Student`, `Class`, `ParentStudentLink` | **Unchanged.** |

FR-017 makes this a hard requirement, and FR-018 enforces it by requiring the 005 test files to pass without edits.

---

## Migration notes

- **No data backfill.** The application is pre-launch; `Marks` documents are disposable per the ratified decision. Documents carrying the old `examType` field are not migrated — the collection is dropped.
- **No read-time compatibility shim.** Unlike 005 — which needed `result.published !== false` to keep pre-005 rows visible — nothing here has to tolerate old-shaped documents, because none are being kept. A shim would leave `examType` alive in the code and violate FR-019.
- **Rollback** is `git revert` plus the same index cleanup in reverse (drop the `assessmentType` indexes and let the reverted models recreate the `examType` ones). Because no data is preserved across the change, rollback has no data-loss dimension beyond coursework rows entered after the deploy.
