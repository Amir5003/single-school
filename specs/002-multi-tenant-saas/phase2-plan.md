# Phase 2 Plan: Multi-Tenant SaaS Architecture

**Status**: Deferred — ready to implement when decided  
**Created**: 2026-05-02  
**Depends on**: Phase 1 (001-school-management) fully deployed  

---

## Why Multi-Tenant

Running one deployment per school is unscalable:

| Cost Item | Single-tenant (per school) | Multi-tenant (shared) |
|-----------|---------------------------|----------------------|
| Render hosting | $7/mo × N | $7/mo flat |
| MongoDB Atlas | Free cluster × N | One M10 cluster (~$57/mo) |
| Domains / subdomains | $10–15/yr × N | `*.yourapp.com` wildcard |
| Your maintenance overhead | N deployments to update per release | One deploy |
| Break-even | Cheaper below ~3 schools | Cheaper at 4+ schools |

---

## Architecture Decision: Subdomain-based Tenant Resolution

Each school gets a subdomain:

```
springfield.yourapp.com    →  Springfield High
greenwood.yourapp.com      →  Greenwood Academy
riverdale.yourapp.com      →  Riverdale School
```

### Why subdomain, not path slug?

| Approach | URL example | Frontend route changes | Notes |
|----------|------------|----------------------|-------|
| Path slug | `/springfield/admin/students` | **Every route changes** | High migration cost |
| Subdomain | `springfield.yourapp.com/admin/students` | **Zero route changes** | Subdomain resolved once at app load |
| Subdomain ✅ | — | Existing routes stay identical | Recommended |

The subdomain is resolved **once** on app startup via:
```
GET /public/school?slug=springfield
→ { schoolId, name, logo, primaryColor, ... }
```

This `schoolId` is stored in React context. The JWT the backend issues contains `{ id, role, schoolId }`. Every subsequent query is automatically scoped — **no slug needed in any route or API call**.

---

## Who Provisions a New School?

**Decision required before implementation:**

### Option A — Operator-provisioned (recommended to start)
You (the platform operator) create each school via a seed script or a super-admin panel. Schools cannot self-signup.

- Simpler — no public onboarding flow
- You control quality (no spam schools)
- Good for up to ~50 schools before you need automation

### Option B — Self-serve onboarding
A public `/onboard` page where a school admin fills in school name, slug, their own admin email. You review and activate.

- Adds a school registration + activation flow
- Needs email verification for the school admin account
- Better for scale (100+ schools)

**Recommendation**: Start with Option A. Add Option B in Phase 3.

---

## What Needs to Change

### Backend Changes

#### 1. New `SchoolConfig` model

```js
{
  slug: String,          // unique, URL-safe: "springfield-high"
  name: String,          // "Springfield High School"
  logo: String,          // URL to logo image (stored in cloud storage)
  tagline: String,       // "Excellence in Education since 1952"
  primaryColor: String,  // hex: "#4F46E5" — used for theming
  address: String,
  phone: String,
  email: String,
  isActive: Boolean,     // operator can suspend a school
  createdAt, updatedAt
}
```

#### 2. Add `schoolId` to all existing models

Every model gets:
```js
schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolConfig', required: true, index: true }
```

Affected models (9 total):
- `User.model.js`
- `Student.model.js`
- `Teacher.model.js`
- `Class.model.js`
- `ClassTeacher.model.js`
- `Timetable.model.js`
- `Attendance.model.js`
- `Marks.model.js`
- `Announcement.model.js`

#### 3. Auth: `schoolId` in JWT

`auth.service.js` → `register()` and `login()` receive `schoolId` and embed it in the JWT payload:
```js
jwt.sign({ id, role, schoolId }, JWT_SECRET, { expiresIn })
```

`authenticate.js` middleware → attaches `req.user.schoolId` from the verified token.

#### 4. All service queries get `schoolId` scoped

Every `Model.find()`, `Model.findById()`, `Model.create()` gets the school filter added:
```js
// Before
Student.find({ isDeleted: false })

// After
Student.find({ schoolId: req.user.schoolId, isDeleted: false })
```

#### 5. New public endpoint

```
GET /api/v1/public/school?slug=springfield-high
→ { schoolId, name, logo, tagline, primaryColor, address, phone, email }
```

Used by the frontend on startup to resolve the school from the subdomain.

#### 6. New admin endpoints (school settings)

```
GET  /api/v1/admin/school/config        — get own school config
PUT  /api/v1/admin/school/config        — update name, tagline, contact info, colors
POST /api/v1/admin/school/logo          — upload logo (multipart)
```

#### 7. Super-admin provisioning (Option A)

A protected `POST /api/v1/superadmin/schools` endpoint + seed script to create a new school and its first admin user. The super-admin role is a 4th role added to the `User` model.

---

### Frontend Changes

#### 1. School context — resolve on startup

`src/context/SchoolContext.jsx`:
```jsx
// On mount: read subdomain → fetch school config → store in context
const slug = window.location.hostname.split('.')[0]; // "springfield"
// Fallback for local dev:
// const slug = new URLSearchParams(window.location.search).get('school') ?? 'demo';
const config = await axios.get(`/public/school?slug=${slug}`);
```

#### 2. Dynamic home page + login branding

Home page and Login page read from `SchoolContext`:
- School name replaces "School Management"
- Logo shown in navbar and login card
- Primary color applied as CSS variable (`--color-primary`) for Tailwind

#### 3. Admin settings page

New page: `frontend/src/pages/admin/SchoolSettingsPage.jsx`
- Form to update name, tagline, address, phone, email
- Color picker for primaryColor
- Logo upload

#### 4. All other pages — zero changes needed

Because schoolId is in the JWT/cookie, no existing page or API call needs updating.

---

## Infrastructure

### Vercel (frontend)
- Vercel **Pro** ($20/mo) supports wildcard domains: `*.yourapp.com`
- Each school gets a CNAME: `springfield.yourapp.com → cname.vercel-dns.com`
- One Vercel project, one deploy, infinite subdomains

### Render (backend)
- No change — one service, one deploy

### MongoDB Atlas
- Upgrade from M0 (free) to **M10** (~$57/mo) to support multiple schools with real data volumes
- Consider Atlas App Services for automated backups per-school

### Storage for logos
- **Cloudinary** free tier (25GB) is sufficient for logo images
- Or AWS S3 + CloudFront if you want full control
- Add `multer` + Cloudinary SDK to backend

---

## Migration Strategy for Existing Data

If you have live data from Phase 1, migration is a one-time script:

```js
// scripts/migrate-add-school-id.js
const schoolId = '<your-school-ObjectId>';
const models = [User, Student, Teacher, Class, ...];
for (const Model of models) {
  await Model.updateMany({ schoolId: { $exists: false } }, { $set: { schoolId } });
}
```

Run once after deploying Phase 2, before going live.

---

## Task Estimate

| Area | Tasks | Est. Hours |
|------|-------|-----------|
| `SchoolConfig` model + public endpoint | 2 | 2h |
| Add `schoolId` to 9 models | 9 | 2h |
| Service query scoping (9 services) | 9 | 4h |
| Auth: schoolId in JWT + middleware | 2 | 1h |
| Admin school settings API | 3 | 2h |
| Super-admin provisioning script | 1 | 1h |
| Frontend: SchoolContext + subdomain resolution | 2 | 2h |
| Dynamic home + login branding | 2 | 2h |
| Admin settings page (UI) | 1 | 2h |
| Logo upload (Cloudinary integration) | 2 | 2h |
| Update existing tests for schoolId | ~20 | 4h |
| Migration script | 1 | 1h |
| **Total** | **~54 tasks** | **~25h (~3 days)** |

---

## Open Decisions (resolve before starting)

1. **Who provisions schools?** Operator-only (seed script) or self-serve onboarding page?
2. **Logo storage?** Cloudinary (easier) or AWS S3 (more control)?
3. **Custom domains per school?** (`springfield-high.com` pointing to `springfield.yourapp.com`) — needs Vercel Pro + per-school DNS setup
4. **Pricing model?** Free tier / paid tiers per school? (affects whether you need subscription management like Stripe)
5. **What happens to the current demo deployment?** Keep as `demo.yourapp.com` or migrate the one real school?

---

## Recommended Sequence When Ready

```
Phase 2a — Backend foundation
  → SchoolConfig model + public endpoint
  → Add schoolId to all models + services
  → JWT + middleware update
  → Migration script

Phase 2b — Frontend wiring
  → SchoolContext + subdomain resolution
  → Dynamic home + login page
  → Dev fallback (?school=slug query param)

Phase 2c — Admin tooling
  → Admin school settings page
  → Logo upload
  → Super-admin provisioning

Phase 2d — Infrastructure
  → Vercel Pro wildcard domain
  → Atlas M10 upgrade
  → Cloudinary setup
  → Smoke test with 2 schools simultaneously
```

---

*Revisit this document when Phase 1 is fully deployed and you have your first paying school.*
