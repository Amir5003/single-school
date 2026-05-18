# Quickstart: Multi-School SaaS Platform

**Feature**: `003-multi-school-saas`  
**Date**: 2026-05-17  
**Prerequisites**: Node.js 20 LTS, MongoDB Atlas URI (or local mongod), Cloudinary account

---

## 1. Environment Setup

### Backend — `.env`
```bash
# Copy from backend/.env.example
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/school-saas
JWT_SECRET=<random-256-bit-hex>
JWT_REFRESH_SECRET=<different-random-256-bit-hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Cloudinary (for logo + homework attachment uploads)
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Super Admin seed (used by seed script only)
SUPER_ADMIN_EMAIL=superadmin@platform.com
SUPER_ADMIN_PASSWORD=SuperSecret@123
```

### Frontend — `.env`
```bash
VITE_API_BASE_URL=http://localhost:5000
```

---

## 2. Install & Run

```bash
# Install
cd backend && npm install
cd ../frontend && npm install

# Both servers together (from repo root)
npm run dev
```

---

## 3. One-Time: Run Migration (existing data → multi-tenant)

> **Required only when upgrading from the single-school v1 deployment.**  
> Safe to skip for fresh installs.

```bash
cd backend
node scripts/migrate-to-multitenant.js
```

The script will:
1. Create a "Seed School" document (`slug: seed-school`)
2. Bulk-update all existing collection documents with `schoolId: <seedSchoolId>`
3. Create the old admin as a `school-admin` re-scoped to the seed school
4. Record the migration in `_migrations` collection (idempotent — safe to re-run)

---

## 4. Seed Super-Admin

```bash
cd backend
node scripts/seed-super-admin.js
```

Creates a `super-admin` user (no `schoolId`) using the `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` env vars. Safe to re-run (no-op if already exists).

---

## 5. Onboard a New School (Self-Service Flow)

1. Open **http://localhost:5173** → click "Register Your School"
2. Fill: School Name, Slug (real-time availability check), Admin Name, Email, Password
3. Submit → school + admin user created atomically
4. You're redirected to the school admin dashboard at `/schools/<slug>/admin`

**Via API**:
```bash
# Check slug availability
curl "http://localhost:5000/api/v1/onboarding/slug-check?slug=sunrise-academy"

# Register school
curl -X POST http://localhost:5000/api/v1/onboarding/register \
  -H "Content-Type: application/json" \
  -d '{ "schoolName": "Sunrise Academy", "slug": "sunrise-academy", "adminName": "Ravi Kumar", "adminEmail": "ravi@sunrise.in", "adminPassword": "Secret@123", "contactNumber": "9876543210" }'
```

---

## 6. Key Development Notes

### Middleware Chain (strict order)
Every authenticated non-public route MUST use: `authenticate → schoolScope → authorize(role)`

```js
// Example route setup:
router.get('/students', authenticate, schoolScope, authorize('school-admin'), getStudents);
```

### Public Routes (slug-resolved)
Public school routes use `slugToSchool` to resolve slug → schoolId for DB queries:

```js
router.get('/schools/:slug/config', slugToSchool, getSchoolConfig);
```

### schoolScope Middleware
- Reads `req.user.schoolId` (from JWT)
- Looks up school in DB (LRU-cached, 5-min TTL)
- Validates `school.isActive === true`
- Sets `req.schoolId = req.user.schoolId`
- Rejects with 403 if school inactive or not found

### Always Filter by schoolId in Services
```js
// ✅ Correct
const students = await Student.find({ schoolId: req.schoolId, classId });

// ❌ Never do this — cross-tenant leak risk
const students = await Student.find({ classId });
```

### LRU Cache Invalidation
Call `schoolCache.del('slug:' + school.slug)` whenever a School document is updated (branding, isActive, etc.).

---

## 7. Testing Key Flows

### Cross-Tenant Isolation Test
```bash
cd backend
npm test -- --testPathPattern="cross-tenant"
```

### RBAC Tests
```bash
npm test -- --testPathPattern="rbac"
```

### All Integration Tests
```bash
npm test
```

---

## 8. Frontend School Context

The React frontend reads school context from the URL path:

```js
// In App.jsx or a SchoolContextProvider
const { slug } = useParams(); // from /schools/:slug/*
// Fetch branding on mount:
const { data } = await axios.get(`/api/v1/schools/${slug}/config`);
// Apply CSS custom properties:
document.documentElement.style.setProperty('--color-primary', data.branding.primaryColor);
```

---

## 9. Super-Admin Access

Login with super-admin credentials → redirected to `/platform/dashboard` (separate protected route).  
Super-admin JWT has no `schoolId` and bypasses `schoolScope` middleware.

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "superadmin@platform.com", "password": "SuperSecret@123" }'
```
