# Research: Multi-School SaaS Platform

**Feature**: `003-multi-school-saas`  
**Phase**: 0 — Technology Decisions & Best Practices  
**Date**: 2026-05-17  
**Status**: Complete — all NEEDS CLARIFICATION resolved  
**Input**: Unknowns extracted from Technical Context during plan phase

---

## Decision 1: Multi-Tenancy Strategy — Shared DB vs Per-Tenant DB

**Decision**: Shared database with `schoolId` field on every tenant-scoped collection.

**Rationale**: The project targets up to ~100–500 schools (SC-006). At this scale, a shared MongoDB Atlas cluster with per-document `schoolId` is the canonical approach. It avoids:
- Dynamic Mongoose connection pooling (not natively supported without significant custom work)
- Per-tenant Atlas cluster cost (prohibitive for low-cost Bihar market)
- Operational overhead of managing N independent databases

Compound indexes `(schoolId, <lookup field>)` keep query performance O(log n) per tenant. MongoDB's document-level access patterns already make cross-tenant reads impossible when queries always include `schoolId`.

**Alternatives considered**:
- Per-tenant database (separate DB per school): Best isolation but requires dynamic connection management, Atlas M10+ per school, and complex backup policies. Rejected — operational cost too high and Mongoose doesn't support this pattern cleanly.
- Schema-per-tenant (like PostgreSQL): Not applicable to MongoDB.
- Per-tenant collection prefix (`schoolSlug_students`): Anti-pattern in Mongoose; breaks indexing, schema validation, and aggregations. Rejected.

---

## Decision 2: JWT Tenant Context — Embed schoolId vs Lookup Per Request

**Decision**: Embed `schoolId` (ObjectId as string) in the JWT payload at login time. Add a lightweight `schoolIsActive` check in `schoolScope` middleware using an indexed DB lookup (cached with in-memory LRU for 5 minutes).

**Rationale**:
- Embedding `schoolId` in the JWT eliminates a DB round-trip on every request for tenant identification — critical for <500ms response time goal (SC-006).
- The school deactivation edge case (school suspended but user has a valid token) is handled by the `schoolScope` middleware checking `school.isActive` from LRU cache (5-min TTL is acceptable — worst case, a suspended school's users retain access for 5 minutes).
- Short JWT TTL (15 minutes) + httpOnly refresh token reduces this window further.
- Super-admin JWT carries no `schoolId` and bypasses `schoolScope`, but still validated by `authenticate`.

**JWT payload shape**:
```json
{
  "id": "<userId>",
  "role": "school-admin | teacher | student | parent",
  "schoolId": "<schoolObjectId>"
}
```
Super-admin:
```json
{
  "id": "<userId>",
  "role": "super-admin"
}
```

**Alternatives considered**:
- DB lookup on every request for schoolId: Correct but adds ~5–10ms per request; unnecessary when schoolId is safely embedded in a signed JWT.
- URL-parameter schoolId (e.g., `/api/v1/schools/:schoolId/students`): Makes API surface larger, creates confusion between public slug routes and internal API routes, and opens URL-based tenant spoofing. Rejected.

---

## Decision 3: Slug Resolution Caching — Redis vs In-Memory LRU vs No Cache

**Decision**: In-memory LRU cache using `lru-cache` npm package, 5-minute TTL, max 500 entries (one per school slug).

**Rationale**: For <500 schools on a single Node process (or even a small cluster), an in-process LRU cache avoids Redis infrastructure cost and latency. The slug→schoolId mapping changes only on school creation or (theoretically) slug change — both extremely infrequent events. Cache invalidation is trivial: clear the entry on school update. The 5-minute staleness window is acceptable.

**Cache key**: `slug:<schoolSlug>` → `{ _id, name, isActive, branding }`  
**Use cases**: `slugToSchool` middleware (public routes), branding config endpoint.

**Alternatives considered**:
- Redis: Correct for horizontally scaled deployments with multiple Node processes. Overkill for v1 with a single Render instance. Can be swapped in post-v1 without changing middleware interface (wrap the same cache abstraction).
- No cache: Every public page visit triggers a MongoDB query. At low school count this is fine but adds latency under load. Rejected in favour of cheap LRU.
- Cloudflare Edge Cache for branding config: Good for branding assets, but adds complexity. Deferred to post-v1.

---

## Decision 4: Path-Based vs Subdomain Routing

**Decision**: Path-based routing (`/schools/:slug/...`) for v1 with subdomain routing (`slug.domain.com`) as an optional production deployment configuration.

**Rationale**:
- Path-based works without DNS changes, wildcard SSL certificates, or local development tunnels. It can be deployed immediately on Vercel + Render with zero infrastructure changes.
- Subdomain routing requires: wildcard DNS record (`*.yourdomain.com`), wildcard SSL certificate (Let's Encrypt or Cloudflare), and React Router configuration to read `window.location.hostname` for school context. This is non-trivial for local dev (requires ngrok or `/etc/hosts` hacks).
- Path-based and subdomain are architecturally compatible — the `slugToSchool` middleware can support both slug sources. The switch is a frontend routing config change, not a backend data model change.

**Subdomain support plan (post-v1)**:
- Nginx/Vercel rewrites to extract subdomain and pass it as `X-School-Slug` header
- React frontend reads slug from `window.location.hostname` OR `X-School-Slug` header

**Alternatives considered**:
- Subdomain only for v1: Blocks MVP timeline with DNS/SSL complexity. Rejected.
- Query parameter (`?school=sunrise-academy`): Ugly URLs, breaks bookmarks, SEO-unfriendly. Rejected.

---

## Decision 5: Image Storage for School Logos and Homework Attachments

**Decision**: Cloudinary via `multer-storage-cloudinary` plugin.

**Rationale**: Cloudinary's free tier provides 25 credits/month (~3000 transformations), 25GB storage, and CDN delivery. The Node SDK (`cloudinary` npm) + `multer-storage-cloudinary` makes upload implementation straightforward (≈10 lines per endpoint). Automatic image transformation (resize to 200×200 for logos) is built-in. No AWS credentials or bucket policies needed.

**Stored as**: URL string in the School document's `branding.logoUrl` field. Homework `attachments[]` stores `{ url, publicId, filename }` objects.

**Alternatives considered**:
- AWS S3: More flexible and scalable, but requires IAM credentials, bucket configuration, signed URL management. Overkill for v1. Swap-in path: abstract the upload service behind an `uploadService.js` facade.
- Local disk storage: Not viable on Render (ephemeral filesystem). Rejected.
- Base64 in MongoDB: Performance-killing for images. Rejected.

---

## Decision 6: Migration Strategy for Existing Single-School Data

**Decision**: One-time idempotent migration script (`backend/scripts/migrate-to-multitenant.js`) that:
1. Creates a "Seed School" document with a default slug (`seed-school`)
2. Bulk-updates all existing User, Student, Teacher, Class, ClassTeacher, Timetable, Attendance, Marks, and Announcement documents to add `schoolId: <seedSchoolId>`
3. Records completion in a `_migrations` collection to prevent re-run
4. Wraps each collection update in a MongoDB session for atomicity

**Safety**: Migration is non-destructive (adds field, never removes or overwrites). Can be re-run safely (no-op if already applied). Should be run once on staging, validated, then on production before deploying the new code.

**Alternatives considered**:
- Lazy migration (add schoolId on first access): Inconsistent data state during rollout, complex fallback logic in every service. Rejected.
- Blue/green deployment with schema migration: Overkill for a startup-phase project. Rejected.

---

## Decision 7: Parent Role — Data Access Pattern

**Decision**: Parent users are school-scoped (carry `schoolId` in JWT). A `ParentStudentLink` junction collection maps `parentId → [studentId]` within a school. Parent-scoped API endpoints query their linked students and return that data only.

**Implementation pattern**:
```
GET /api/v1/parent/children                → list of linked students
GET /api/v1/parent/children/:studentId/attendance  → attendance for one child
GET /api/v1/parent/children/:studentId/marks        → marks for one child
```
All queries validate: `link.parentId === req.user._id && link.schoolId === req.schoolId`.

**Alternatives considered**:
- Parent as a property on Student document (`guardianEmail`): Doesn't support multiple children; can't log in with parent credentials. Rejected.
- Parent shares student login: Security anti-pattern; no audit trail. Rejected.

---

## Decision 8: Fee Management Scope

**Decision**: Fee records are stored per-student per-school with status tracking (`pending`, `paid`, `overdue`). Automatic overdue transitions (based on `dueDate`) are handled by a scheduled background job using `node-cron` (runs daily). No payment gateway integration in v1 — school admins manually mark fees as paid.

**Alternatives considered**:
- Razorpay/Stripe integration: High value but adds significant payment compliance complexity. Deferred to post-v1 as constitution allows.
- Fee as a property on Student: Not flexible enough (multiple fees per student, different types). Rejected.
