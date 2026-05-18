const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const teacherRoutes = require('./routes/teacher.routes');
const studentRoutes = require('./routes/student.routes');
const publicRoutes = require('./routes/public.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const platformRoutes = require('./routes/platform.routes');
const parentRoutes = require('./routes/parent.routes');

const app = express();

// ── Security / CORS ──────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Request parsing ──────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json());

// ── HTTP request logging (skipped in test env to keep output clean) ──────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, message: 'Server is healthy' });
});

// ── Routes ───────────────────────────────────────────────────────────────────

// ── Public / unauthenticated routes (no schoolScope) ─────────────────────────
app.use('/api/v1/onboarding', onboardingRoutes);   // School registration + slug check
app.use('/api/v1/public', publicRoutes);

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);

// ── Platform (super-admin only — NO schoolScope) ──────────────────────────────
app.use('/api/v1/platform', platformRoutes);

// ── Tenant-scoped routes (authenticate → schoolScope applied inside each router)
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/teacher', teacherRoutes);
app.use('/api/v1/student', studentRoutes);
app.use('/api/v1/parent', parentRoutes);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
