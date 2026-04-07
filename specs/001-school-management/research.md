# Research: School Management System

**Feature**: `001-school-management`  
**Phase**: 0 — Technology Decisions & Best Practices  
**Date**: 2026-04-07  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Node.js Version

**Decision**: Node.js 20 LTS  
**Rationale**: LTS release with long-term support until April 2026. Provides built-in `fetch`, stable V8 engine, and is the standard on Render's Node.js runtime. Node 18 LTS is EOL in April 2025.  
**Alternatives considered**:
- Node 22: Too new, limited Render support at time of writing
- Node 18 LTS: Reaching EOL; upgrade would be required mid-project

---

## Decision 2: Vite vs Create React App

**Decision**: Vite 5  
**Rationale**: User explicitly specified Vite. Additionally: Vite uses native ES modules for near-instant HMR, build times ~10x faster than CRA, and it is the recommended tooling since React team deprecated CRA. Vercel deployment is natively well-supported.  
**Alternatives considered**:
- Create React App: Deprecated by React team; webpack-based slow rebuilds; no ESM
- Next.js: Overkill for SPA; SSR unnecessary for authenticated role dashboards

---

## Decision 3: State Management — Redux Toolkit vs Context API

**Decision**: Redux Toolkit (RTK) 2.x  
**Rationale**: Constitution (v1.1.0) explicitly specifies Redux for state management. RTK reduces boilerplate significantly vs plain Redux. For this app scope (3 roles, ~10 pages, shared auth state), RTK `createSlice` for `authSlice` and `uiSlice` is appropriate. DevTools integration helps debugging across Admin/Teacher/Student flows.  
**Alternatives considered**:
- React Context + useReducer: Acceptable for smaller apps but Constitution mandates Redux; also lacks dev tools
- Zustand: Lighter but not Constitution-aligned

**Scope limitation**: Only `authSlice` (user/role/isAuthenticated) and `uiSlice` (loading/toast) managed globally. Most data fetched per-component via Axios hooks to avoid over-engineering.

---

## Decision 4: JWT Token Storage — httpOnly Cookie vs localStorage

**Decision**: httpOnly + sameSite=strict cookie in development; httpOnly + sameSite=none + secure on production  
**Rationale**: Constitution Principle V mandates JWT in "secure httpOnly cookies". httpOnly prevents XSS token theft (JavaScript cannot access cookie). sameSite=strict prevents CSRF. Production requires sameSite=none + secure=true because Vercel (frontend) and Render (backend) are cross-origin.  
**Alternatives considered**:
- localStorage: Vulnerable to XSS attacks; explicitly rejected by Constitution Principle V
- Memory (variable): Lost on page refresh; requires silent refresh endpoint; unnecessary complexity for v1
- sessionStorage: Same XSS risk as localStorage

---

## Decision 5: Input Validation Library

**Decision**: `express-validator` 7.x  
**Rationale**: Tightly integrated with Express; chain-based validators colocate validation rules with routes; supports `sanitize` methods preventing XSS. Well-maintained, widely used. Compatible with the `validate.js` middleware pattern in the plan.  
**Alternatives considered**:
- Joi: Excellent schema validation but requires additional adapter to work with Express middleware pattern; heavier bundle
- Zod: Excellent but designed for TypeScript-first; extra setup for plain JS Node backend
- Manual validation: Error-prone; does not constitute "input validation at API level" per Principle II

---

## Decision 6: Animation Library — Framer Motion vs React Spring

**Decision**: Framer Motion 11.x  
**Rationale**: Constitution Principle VII mentions "Framer Motion or React Spring". Framer Motion has:
- Simpler declarative API (`motion.div`, `AnimatePresence`, `variants`)
- Built-in `useReducedMotion` hook for accessibility compliance
- Better TypeScript/JSX ergonomics for per-component animation control
- Larger community, more examples for glassmorphism + card entrance patterns needed for Student module  
**Alternatives considered**:
- React Spring: More performance-focused but imperative API; steeper learning curve for UI designers leveraging Framer's layout animations

---

## Decision 7: Frontend UI Library — Tailwind Only vs Component Library

**Decision**: Tailwind CSS 3.x only (no component library)  
**Rationale**: User specified "minimal libraries" and "basic UI library if needed". Constitution specifies Tailwind. For this project, Tailwind utility classes + custom components in React (`Button`, `Input`, `Card`) provide full design control with zero bloat. A component library (e.g., shadcn/ui, MUI) would add bundle weight and override friction.  
**Implementation**: Custom design tokens in `tailwind.config.js` (primary, secondary, accent colors; spacing scale); shared `StatusMessage`, `LoadingSpinner`, `ConfirmModal` components in `components/common/`.  
**Alternatives considered**:
- shadcn/ui: Clean but adds Radix UI dependencies; requires Tailwind anyway; overkill for scoped project
- MUI: Heavy; opinionated; fights Tailwind; not minimal
- Headless UI: Only solves accessibility for dropdowns/modals; would still need Tailwind everywhere

---

## Decision 8: Backend Deployment — Render vs Railway

**Decision**: Render  
**Rationale**: User specified "Render or Railway". Render provides:
- Free tier with 512MB RAM, 0.1 CPU (sufficient for v1 with ≤500 users)
- Auto-deploy from GitHub; zero-config Node.js detection
- Environment variables management in dashboard
- Built-in health check URL
- Better documentation for Node.js deployments  
**Alternatives considered**:
- Railway: Also excellent; slightly more complex pricing model; limited free tier recently changed

---

## Decision 9: Password Hashing — bcryptjs Rounds

**Decision**: bcryptjs 2.x with cost factor = 12  
**Rationale**: Cost factor 12 results in ~250ms hash time on modern hardware — sufficient to deter brute force while not degrading login UX. Factor 10 (default) is considered too low for 2026; factor 14+ adds unnecessary latency.  
**Alternatives considered**:
- argon2: More secure algorithm but native module compilation issues on Render; bcrypt is well-established and sufficient
- crypto (built-in): PBKDF2 requires manual salt/iteration tuning; bcrypt is battle-tested

---

## Decision 10: Test Database Strategy

**Decision**: `mongodb-memory-server` for all automated tests  
**Rationale**: In-memory MongoDB spins up a real Mongo instance per test suite; tests run without external dependencies; database is clean between test files; CI-compatible without hardcoded connection strings.  
**Alternatives considered**:
- Test MongoDB Atlas cluster: Network latency; state leaks between test runs; incurs cost
- Mock/stub Mongoose: Does not test actual query logic; misses index conflicts and validation hooks

---

## Decision 11: Timetable Conflict Detection Strategy

**Decision**: Service-layer conflict check before insert  
**Rationale**: Before creating a timetable entry, `timetable.service.js` queries: find any existing entry for the same `classId + day` where time ranges overlap. Also check if `teacherId + day + overlapping time` exists (teacher in two places). Return conflict error before database write.  
**Implementation**:
```
overlapping = existing.startTime < newEntry.endTime && existing.endTime > newEntry.startTime
```  
**Alternatives considered**:
- MongoDB `$jsonSchema` validator: Cannot express time-overlap logic; only field-level validation
- Unique compound index: Cannot encode range overlaps as a unique constraint

---

## Decision 12: Student Data Isolation Strategy

**Decision**: `req.user._id` used as query filter for all Student routes  
**Rationale**: Every Student endpoint filters by `req.user._id` (or `studentId` derived from it). Student cannot supply a different `studentId` to access others' data. This is enforced at the service layer, not just the controller.  
**Implementation**: `student.service.js` functions all accept `userId` parameter and populate `studentId` from it internally. No route accepts a raw `studentId` from request body for read endpoints.  
**Alternatives considered**:
- Middleware-level filter: Less explicit; easy to bypass if middleware is skipped accidentally

---

## All NEEDS CLARIFICATION Items: Resolved

| Item | Resolution |
|------|------------|
| Auth token storage mechanism | httpOnly cookie (see Decision 4) |
| Frontend build tool | Vite 5 (user specified) |
| Animation library choice | Framer Motion 11.x (see Decision 6) |
| Input validation approach | express-validator at route level (see Decision 5) |
| Deployment target | Render (backend), Vercel (frontend) — user specified |
| Test DB strategy | mongodb-memory-server (see Decision 10) |
| State management library | Redux Toolkit (Constitution-specified) |
| Password hashing | bcryptjs rounds=12 (see Decision 9) |
| Timetable conflict logic | Service-layer range check (see Decision 11) |
| Student data isolation | req.user-based filtering at service layer (see Decision 12) |
