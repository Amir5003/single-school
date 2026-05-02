# School Management System

A full-stack web application for managing students, teachers, classes, timetables, attendance, and marks. Three role-based dashboards (Admin / Teacher / Student) with JWT authentication and animated UI.

---

## Tech Stack

| Layer      | Technology                                               |
|------------|----------------------------------------------------------|
| Runtime    | Node.js 20 LTS                                           |
| Backend    | Express 4.x, Mongoose 8.x (MongoDB)                     |
| Auth       | JWT in httpOnly cookies, bcryptjs (rounds = 12)          |
| Validation | express-validator 7.x                                    |
| Frontend   | React 18 + Vite 5, Redux Toolkit 2.x, React Router 6    |
| Styling    | Tailwind CSS 3.x                                         |
| Animation  | Framer Motion 11.x                                       |
| Testing    | Jest 29 + Supertest (backend), Vitest 1 + RTL (frontend) |
| Database   | MongoDB Atlas (M0 free tier)                             |
| Deploy     | Render (backend) + Vercel (frontend)                     |

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 9
- MongoDB Atlas cluster **or** local MongoDB instance

---

## Local Setup

### 1. Clone and install root deps

```bash
git clone https://github.com/<your-org>/school-management.git
cd school-management
npm install          # installs concurrently for the root dev script
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env   # fill in real values (see env vars table below)
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL
```

### 4. Run both servers

```bash
# From the repo root:
npm run dev
# Backend → http://localhost:5000
# Frontend → http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable          | Description                                               | Example                                         |
|-------------------|-----------------------------------------------------------|-------------------------------------------------|
| `PORT`            | HTTP port for Express server                              | `5000`                                          |
| `MONGO_URI`       | MongoDB connection string                                 | `mongodb+srv://user:pass@cluster.mongodb.net/…` |
| `JWT_SECRET`      | Secret for signing JWTs (min 32 chars)                    | `change_me_long_random_string`                  |
| `JWT_EXPIRES_IN`  | JWT expiry duration                                       | `7d`                                            |
| `NODE_ENV`        | `development` \| `production` \| `test`                  | `production`                                    |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins          | `https://school-app.vercel.app`                 |

### Frontend (`frontend/.env`)

| Variable         | Description                        | Example                                          |
|------------------|------------------------------------|--------------------------------------------------|
| `VITE_API_URL`   | Base URL for backend API           | `https://school-backend.onrender.com/api/v1`     |

---

## Running Tests

```bash
# Backend (Jest + Supertest + mongodb-memory-server)
cd backend && npm test

# With coverage report
cd backend && npm test -- --coverage

# Frontend (Vitest + React Testing Library)
cd frontend && npm test
```

---

## Deployment

### MongoDB Atlas

1. Create an M0 free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a DB user with `readWrite` access on database `school_mgmt`
3. Add `0.0.0.0/0` to Network Access
4. Copy the `mongodb+srv://` URI for the `MONGO_URI` env var

### Backend — Render

1. Import repo at [render.com](https://render.com) → **New Web Service**
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Set env vars: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `NODE_ENV=production`, `ALLOWED_ORIGINS=https://<your-vercel-url>.vercel.app`

### Frontend — Vercel

1. Import repo at [vercel.com](https://vercel.com) → **New Project**
2. Root Directory: `frontend`
3. Framework Preset: **Vite**
4. Add env var: `VITE_API_URL=https://<your-render-name>.onrender.com/api/v1`
5. Confirm build passes and home page loads

---

## Test Credentials

> Register these accounts via `POST /api/v1/auth/register` or seed script.

| Role    | Email                  | Password      |
|---------|------------------------|---------------|
| Admin   | admin@school.test      | Admin1234!    |
| Teacher | teacher@school.test    | Teacher1234!  |
| Student | student@school.test    | Student1234!  |

---

## API Base URL

```
/api/v1
```

| Prefix              | Description              | Auth required |
|---------------------|--------------------------|---------------|
| `/auth`             | Register / Login / Me    | No (except /me) |
| `/public`           | Latest announcements     | No            |
| `/admin/*`          | Full CRUD for all data   | Admin role    |
| `/teacher/*`        | Attendance, marks, posts | Teacher role  |
| `/student/*`        | Read-only own data       | Student role  |

---

## Project Structure

```
school-management/
├── backend/
│   ├── src/
│   │   ├── config/         # db.js, env.js
│   │   ├── models/         # Mongoose schemas (9 collections)
│   │   ├── validators/     # express-validator chains
│   │   ├── middleware/     # authenticate, authorize, validate, errorHandler
│   │   ├── services/       # Business logic
│   │   ├── controllers/    # HTTP handlers (admin/, teacher/, student/, auth)
│   │   ├── routes/         # auth, admin, teacher, student, public
│   │   └── utils/          # ApiResponse, ApiError, logger
│   ├── tests/
│   │   ├── unit/           # utils + service edge-case tests
│   │   └── integration/    # full HTTP flow tests per role
│   └── server.js
└── frontend/
    ├── src/
    │   ├── api/            # axiosInstance + per-role API functions
    │   ├── components/
    │   │   ├── common/     # Layout, Navbar, ErrorBoundary, ProtectedRoute…
    │   │   ├── admin/      # Admin-specific forms
    │   │   ├── teacher/    # Teacher-specific components
    │   │   └── student/    # Animated student cards (Framer Motion)
    │   ├── pages/          # Route-level page components by role
    │   ├── redux/          # store.js + authSlice + uiSlice
    │   ├── hooks/          # useAuth, useApi
    │   └── utils/          # formatDate, calculatePercentage, animationVariants
    └── vite.config.js
```
