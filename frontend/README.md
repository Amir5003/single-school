# School Management — Frontend

React 19 + Vite 8 SPA for the School Management multi-tenant platform.

See the [root README](../README.md) for full project documentation, architecture, and setup instructions.

## Quick Start

```bash
cp .env.example .env   # set VITE_API_URL
npm install
npm run dev            # http://localhost:5173
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run Vitest + React Testing Library tests |
| `npm run lint` | ESLint check |

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` 19 | UI framework |
| `react-router-dom` 7 | Client-side routing (slug-scoped school routes) |
| `@reduxjs/toolkit` 2 | State management (auth, school config, UI) |
| `axios` | HTTP client with httpOnly-cookie credentials |
| `framer-motion` 12 | Page and component animations |
| `tailwindcss` 3 | Utility-first styling |
| `jspdf` + `jspdf-autotable` | Client-side report card PDF generation |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL, e.g. `http://localhost:5000/api/v1` |
