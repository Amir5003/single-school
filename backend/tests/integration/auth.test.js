const request = require('supertest');
const app = require('../../src/app');
const { createDirectUser } = require('../helpers');

// ── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Test Admin',
  email: 'admin@school.test',
  password: 'Admin@1234',
  role: 'admin',
};

const TEACHER = {
  name: 'Test Teacher',
  email: 'teacher@school.test',
  password: 'Teacher@1234',
  role: 'teacher',
};

const STUDENT = {
  name: 'Test Student',
  email: 'student@school.test',
  password: 'Student@1234',
  role: 'student',
};

/** Register a user and return the supertest response */
const registerUser = (data) =>
  request(app).post('/api/v1/auth/register').send(data);

/** Login and return { res, cookie } where cookie is the Set-Cookie header value */
const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  const cookie = res.headers['set-cookie'];
  return { res, cookie };
};

// ── Registration ─────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('201 — registers a new user successfully', async () => {
    const res = await registerUser(ADMIN);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(ADMIN.email);
    // password must never be returned
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('409 — duplicate email is rejected', async () => {
    await registerUser(ADMIN);
    const res = await registerUser(ADMIN);
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('422 — invalid email format', async () => {
    const res = await registerUser({ ...ADMIN, email: 'not-an-email' });
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })])
    );
  });

  it('422 — password does not meet complexity requirements', async () => {
    const res = await registerUser({ ...ADMIN, password: 'weakpassword' });
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })])
    );
  });

  it('422 — missing required name field', async () => {
    const { name: _n, ...noName } = ADMIN;
    const res = await registerUser(noName);
    expect(res.statusCode).toBe(422);
  });

  it('422 — invalid role', async () => {
    const res = await registerUser({ ...ADMIN, role: 'superuser' });
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'role' })])
    );
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await createDirectUser(ADMIN);
  });

  it('200 — login succeeds and sets httpOnly cookie', async () => {
    const { res, cookie } = await loginUser(ADMIN.email, ADMIN.password);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.password).toBeUndefined();
    expect(cookie).toBeDefined();
    expect(cookie[0]).toMatch(/token=/);
    expect(cookie[0]).toMatch(/HttpOnly/i);
  });

  it('401 — wrong password returns generic error', async () => {
    const { res } = await loginUser(ADMIN.email, 'WrongPass@99');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401 — non-existent email returns generic error', async () => {
    const { res } = await loginUser('nobody@school.test', ADMIN.password);
    expect(res.statusCode).toBe(401);
  });

  it('422 — missing email field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: ADMIN.password });
    expect(res.statusCode).toBe(422);
  });
});

// ── GET /me ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('200 — returns current user when authenticated', async () => {
    await createDirectUser(ADMIN);
    const { cookie } = await loginUser(ADMIN.email, ADMIN.password);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe(ADMIN.email);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('401 — no cookie returns 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('200 — clears the token cookie', async () => {
    await createDirectUser(ADMIN);
    const { cookie } = await loginUser(ADMIN.email, ADMIN.password);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    // After logout, /me must return 401
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', res.headers['set-cookie'] || []);
    expect(meRes.statusCode).toBe(401);
  });
});

// ── RBAC cross-role tests ────────────────────────────────────────────────────

describe('RBAC — role enforcement', () => {
  let adminCookie;
  let teacherCookie;
  let studentCookie;

  beforeEach(async () => {
    await createDirectUser(ADMIN);
    await createDirectUser(TEACHER);
    await createDirectUser(STUDENT);
    ({ cookie: adminCookie } = await loginUser(ADMIN.email, ADMIN.password));
    ({ cookie: teacherCookie } = await loginUser(TEACHER.email, TEACHER.password));
    ({ cookie: studentCookie } = await loginUser(STUDENT.email, STUDENT.password));
  });

  it('admin can access /api/v1/admin/students', async () => {
    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', adminCookie);
    expect(res.statusCode).toBe(200);
  });

  it('teacher token → 403 on admin route', async () => {
    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', teacherCookie);
    expect(res.statusCode).toBe(403);
  });

  it('student token → 403 on admin route', async () => {
    const res = await request(app)
      .get('/api/v1/admin/students')
      .set('Cookie', studentCookie);
    expect(res.statusCode).toBe(403);
  });

  it('teacher can access /api/v1/teacher/attendance', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/attendance')
      .set('Cookie', teacherCookie);
    // 404 = auth passed (no Teacher profile since registered directly, not via admin)
    // anything except 401 (no token) or 403 (wrong role) is acceptable
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
  });

  it('student token → 403 on teacher route', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/attendance')
      .set('Cookie', studentCookie);
    expect(res.statusCode).toBe(403);
  });

  it('no token → 401 on protected route', async () => {
    const res = await request(app).get('/api/v1/admin/students');
    expect(res.statusCode).toBe(401);
  });
});
