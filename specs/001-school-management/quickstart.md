# Quickstart: School Management System

**Feature**: `001-school-management`  
**Date**: 2026-04-07  
**Stack**: Node.js 20 + Express + MongoDB | React 18 + Vite 5 + Tailwind CSS + Framer Motion

---

## Prerequisites

| Tool | Min Version | Install |
|------|-------------|---------|
| Node.js | 20.x LTS | [nodejs.org](https://nodejs.org) |
| npm | 10.x | Bundled with Node 20 |
| MongoDB | Atlas account | [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas) or local `mongod` |
| Git | any | [git-scm.com](https://git-scm.com) |

---

## 1. Clone & Root Setup

```bash
git clone <repo-url> school-management
cd school-management
```

---

## 2. Backend Setup

```bash
cd backend
npm install
```

Install dependencies:
```
express, mongoose, dotenv, cors, cookie-parser, morgan,
express-validator, jsonwebtoken, bcryptjs, mongodb-memory-server
```

### Backend Environment Variables

Copy example and fill in values:
```bash
cp .env.example .env
```

`backend/.env.example`:
```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/school_mgmt?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d

# CORS — comma-separated frontend origins
ALLOWED_ORIGINS=http://localhost:5173
```

### Start Backend Dev Server

```bash
npm run dev
```

Expected output:
```
[server] Connected to MongoDB
[server] Server running on port 5000
```

### Run Backend Tests

```bash
npm test                    # all tests
npm test -- --coverage      # with coverage report (target ≥70%)
npm test auth.test          # single test file
```

---

## 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Install dependencies:
```
axios, react-router-dom, @reduxjs/toolkit, react-redux,
framer-motion, tailwindcss, postcss, autoprefixer
```

### Frontend Environment Variables

```bash
cp .env.example .env
```

`frontend/.env.example`:
```env
VITE_API_URL=http://localhost:5000/api/v1
```

### Initialize Tailwind CSS

If setting up fresh (already done in repo):
```bash
npx tailwindcss init -p
```

Verify `tailwind.config.js` content field includes:
```js
content: ['./index.html', './src/**/*.{js,jsx}']
```

Verify `src/index.css` contains:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Start Frontend Dev Server

```bash
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

---

## 4. First Run Verification

1. Open [http://localhost:5173](http://localhost:5173) — should see Home page
2. Backend health check: `curl http://localhost:5000/api/v1/public/announcements` → `{ "success": true, "data": [] }`
3. Register as Admin:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/register \
   -H "Content-Type: application/json" \
   -d '{ "name":"Admin User","email":"admin@school.edu","password":"Admin@123","role":"admin" }'
   ```
4. Login from the UI at `http://localhost:5173/login`

---

## 5. Project Scripts Reference

### Backend (`backend/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `nodemon server.js` | Dev server with hot-reload |
| `start` | `node server.js` | Production server |
| `test` | `jest --runInBand` | Run all tests sequentially |
| `test:coverage` | `jest --coverage` | Test + coverage report |
| `lint` | `eslint src/` | ESLint check |

### Frontend (`frontend/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Dev server at :5173 |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build |
| `test` | `vitest` | Run component tests |
| `lint` | `eslint src/` | ESLint check |

---

## 6. Running Both Servers Together

From project root, open two terminals:

**Terminal 1** (backend):
```bash
cd backend && npm run dev
```

**Terminal 2** (frontend):
```bash
cd frontend && npm run dev
```

Or install `concurrently` at root and add:
```json
"scripts": {
  "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\""
}
```
Then: `npm run dev` from root.

---

## 7. Default Roles & Test Accounts

After registration, you can log in with any of these seeded roles:

| Role | Example Email | Dashboard Route |
|------|--------------|----------------|
| Admin | admin@school.edu | `/admin/dashboard` |
| Teacher | teacher@school.edu | `/teacher/dashboard` |
| Student | student@school.edu | `/student/dashboard` |

> Passwords must follow: ≥8 chars, 1 uppercase, 1 digit, 1 special char (e.g., `Admin@123`)

---

## 8. Deployment

### MongoDB Atlas

1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create DB user: Database Access → Add New Database User
3. Whitelist IP: Network Access → Add IP Address → `0.0.0.0/0` for Render (or use static IP)
4. Get connection string: Clusters → Connect → Compass/Application

### Backend → Render

1. Push to GitHub
2. New Web Service on [render.com](https://render.com)
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Environment: Set all vars from `.env.example` (use production Mongo URI + strong JWT secret)
6. Note the service URL: `https://school-mgmt-backend.onrender.com`

### Frontend → Vercel

1. Import `frontend/` directory from GitHub at [vercel.com](https://vercel.com)
2. Framework: Vite (auto-detected)
3. Set env var: `VITE_API_URL=https://school-mgmt-backend.onrender.com/api/v1`
4. Deploy

### Production Cookie Configuration

On production, update `auth.controller.js` cookie options:
```js
res.cookie('token', token, {
  httpOnly: true,
  secure: true,           // HTTPS only
  sameSite: 'none',       // cross-origin Vercel ↔ Render
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
})
```

---

## 9. Key File Reference

| File | Purpose |
|------|---------|
| `backend/src/app.js` | Express app factory — add middleware, mount routes |
| `backend/src/config/db.js` | Mongoose connection logic |
| `backend/src/middleware/authenticate.js` | JWT verification |
| `backend/src/middleware/authorize.js` | Role guard factory |
| `frontend/src/api/axiosInstance.js` | Base Axios config — `withCredentials: true` |
| `frontend/src/redux/slices/authSlice.js` | User/role state |
| `frontend/src/components/common/ProtectedRoute.jsx` | Role-based route guard |
| `frontend/src/utils/animationVariants.js` | Reusable Framer Motion variants |

---

## 10. Troubleshooting

| Problem | Solution |
|---------|---------|
| Cookie not sent to backend | Ensure `axiosInstance.js` has `withCredentials: true` |
| CORS error in browser | Verify `ALLOWED_ORIGINS` in backend `.env` matches Vite port |
| MongoDB connection failed | Check Atlas IP whitelist; verify `MONGO_URI` format |
| 401 on all requests after login | Check `sameSite: 'none'` + `secure: true` in production cookie config |
| Framer Motion animations not smooth | Ensure no `overflow: hidden` on parent; check GPU compositing |
| Vite env var undefined | Must prefix with `VITE_`; restart dev server after `.env` changes |
