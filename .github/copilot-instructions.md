# School Management System — Development Guidelines

Auto-generated from feature plan `001-school-management`. Last updated: 2026-04-07

## Active Technologies

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4.x
- **ODM**: Mongoose 8.x (MongoDB)
- **Auth**: JWT (jsonwebtoken 9.x) in httpOnly cookies, bcryptjs (rounds=12)
- **Validation**: express-validator 7.x
- **Testing**: Jest 29 + Supertest 7 + mongodb-memory-server

### Frontend
- **Build Tool**: Vite 5 + React 18
- **Routing**: React Router 6 (declarative routes with `<Routes>`)
- **State**: Redux Toolkit 2.x (`authSlice` + `uiSlice`); component-local state for forms
- **HTTP Client**: Axios 1.x with `withCredentials: true` (cookie auth)
- **Styling**: Tailwind CSS 3.x — utility-first, custom design tokens in `tailwind.config.js`
- **Animations**: Framer Motion 11.x — `motion.div`, `AnimatePresence`, `variants`
- **Testing**: Vitest 1 + React Testing Library 14

### Deployment
- **Frontend**: Vercel (auto-deploy from `frontend/` directory)
- **Backend**: Render (Node.js Web Service)
- **Database**: MongoDB Atlas

## Project Structure

```text
school-management/
├── backend/
│   ├── src/
│   │   ├── config/         # db.js, env.js
│   │   ├── models/         # Mongoose schemas
│   │   ├── validators/     # express-validator chains per entity
│   │   ├── middleware/     # authenticate.js, authorize.js, validate.js, errorHandler.js
│   │   ├── services/       # Business logic (DB access lives here only)
│   │   ├── controllers/    # HTTP request/response; delegates to services
│   │   ├── routes/         # auth, admin, teacher, student, public
│   │   └── utils/          # ApiResponse, ApiError, logger
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   └── server.js
└── frontend/
    ├── src/
    │   ├── api/            # axiosInstance + per-role API functions
    │   ├── components/
    │   │   ├── common/     # Layout, Navbar, ProtectedRoute, modals
    │   │   ├── admin/      # Admin-specific form components
    │   │   ├── teacher/    # Teacher-specific components
    │   │   └── student/    # Student cards (ALL animated with Framer Motion)
    │   ├── pages/          # Route-level page components by role
    │   ├── redux/          # store.js + slices/
    │   ├── hooks/          # useAuth, useApi
    │   └── utils/          # formatDate, calculatePercentage, animationVariants
    └── vite.config.js
```

## Commands

```bash
# Backend
cd backend && npm run dev          # Dev server (nodemon)
cd backend && npm test             # All tests
cd backend && npm test -- --coverage   # Coverage report

# Frontend
cd frontend && npm run dev         # Vite dev server (:5173)
cd frontend && npm run build       # Production build
cd frontend && npm test            # Vitest component tests

# Both servers together (from root)
npm run dev
```

## Code Style

### Backend (JavaScript / Node.js)
- **Naming**: camelCase for variables/functions, PascalCase for classes/models, SCREAMING_SNAKE_CASE for env constants
- **Route handler pattern**: Controller calls service; controller never imports models directly
- **Error handling**: Throw `ApiError` in services; `errorHandler.js` middleware catches all
- **Async pattern**: `async/await` everywhere; wrap route handlers with try/catch or `asyncHandler` utility
- **Response format**: Always use `ApiResponse` wrapper: `{ success, message, data }`

### Frontend (React / JSX)
- **Naming**: PascalCase for components, camelCase for hooks/utilities, kebab-case for CSS classes
- **Component pattern**: Functional components only; no class components
- **State**: Keep state as local as possible; lift only when needed; Redux only for auth + UI global state
- **API calls**: All `axios` calls go through `/api/*.api.js` functions — no inline `axios.get()` in components
- **Animation**: Student module components MUST use `motion.div` with variants from `animationVariants.js`; check `prefers-reduced-motion`

### Security Non-Negotiables
- `bcryptjs` rounds = 12 (never lower)
- JWT cookie: `httpOnly: true, sameSite: 'none', secure: true` in production
- All protected routes: `authenticate` + `authorize(role)` middleware — no exceptions
- Never log `req.body.password` or any credential fields
- Input sanitize via `express-validator` on every mutation endpoint

## Recent Changes

### 001-school-management (2026-04-07)
**Added**:
- Complete backend architecture: models, validators, services, controllers, routes, middleware
- 9 MongoDB collections: users, students, teachers, classes, class_teachers, timetable, attendance, marks, announcements
- JWT auth system with httpOnly cookies and RBAC (admin/teacher/student)
- Full REST API: `/api/v1/auth/*`, `/api/v1/admin/*`, `/api/v1/teacher/*`, `/api/v1/student/*`, `/api/v1/public/*`
- React SPA with Vite 5, role-based protected routing
- Admin dashboard: student/teacher/class/timetable management
- Teacher dashboard: attendance marking (bulk), marks entry (upsert), announcements
- Student dashboard: profile, timetable, attendance summary, marks (all Framer Motion animated)
- `animationVariants.js`: `fadeInUp`, `staggerContainer`, `slideInRight`, `scaleIn` variants
- Deployment: Vercel (frontend) + Render (backend) + MongoDB Atlas

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
