const request = require('supertest');
const app = require('../../src/app');
const { createDirectUser, createSchool, createSchoolAdmin } = require('../helpers');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Admin User',
  email: 'admin@school.test',
  password: 'Admin@1234',
};

// schoolId is injected in beforeAll after a test school is created
let testSchoolId;

const PENDING_STUDENT = () => ({
  name: 'Pending Student',
  email: `pending.student.${Date.now()}@school.test`,
  password: 'Student@1234',
  role: 'student',
  schoolId: testSchoolId,
});

const PENDING_TEACHER = () => ({
  name: 'Pending Teacher',
  email: `pending.teacher.${Date.now()}@school.test`,
  password: 'Teacher@1234',
  role: 'teacher',
  schoolId: testSchoolId,
});

const TEACHER_RBAC = {
  name: 'Teacher RBAC',
  email: 'rteacher@school.test',
  password: 'Teacher@1234',
  role: 'teacher',
  // schoolId injected at runtime — will be set after beforeAll runs
  get schoolId() { return testSchoolId; },
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const registerSelf = (data) =>
  request(app).post('/api/v1/auth/register').send(data);

const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { res, cookie: res.headers['set-cookie'] };
};

const getAdminCookie = async () => {
  const school = await createSchool();
  await createSchoolAdmin(school._id, { email: ADMIN.email, password: ADMIN.password, name: ADMIN.name });
  const { cookie } = await loginUser(ADMIN.email, ADMIN.password);
  return cookie;
};

beforeAll(async () => {
  const school = await createSchool({ name: 'Approval Test School', slug: `approval-test-${Date.now()}` });
  testSchoolId = school._id.toString();
});

// ── Self-registration creates pending account ─────────────────────────────────

describe('POST /api/v1/auth/register — self-registration creates pending accounts', () => {
  it('201 — self-registration succeeds with approvalStatus:pending', async () => {
    const student = PENDING_STUDENT();
    const res = await registerSelf(student);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.approvalStatus).toBe('pending');
    expect(res.body.data.user.isActive).toBe(false);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('403 — pending user cannot log in', async () => {
    const student = PENDING_STUDENT();
    await registerSelf(student);
    const { res } = await loginUser(student.email, student.password);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/pending/i);
  });

  it('403 — rejected user cannot log in', async () => {
    const student = PENDING_STUDENT();
    const regRes = await registerSelf(student);
    const userId = regRes.body.data.user._id;
    const adminCookie = await getAdminCookie();

    await request(app)
      .put(`/api/v1/admin/users/${userId}/reject`)
      .set('Cookie', adminCookie);

    const { res } = await loginUser(student.email, student.password);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/rejected/i);
  });
});

// ── Admin: list pending users ─────────────────────────────────────────────────

describe('GET /api/v1/admin/users/pending', () => {
  let adminCookie;

  beforeEach(async () => {
    adminCookie = await getAdminCookie();
  });

  it('200 — returns pending users array', async () => {
    await registerSelf(PENDING_STUDENT());
    await registerSelf(PENDING_TEACHER());

    const res = await request(app)
      .get('/api/v1/admin/users/pending')
      .set('Cookie', adminCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
    // should not expose passwords
    res.body.data.users.forEach((u) => {
      expect(u.password).toBeUndefined();
    });
  });

  it('200 — returns empty array when no pending users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users/pending')
      .set('Cookie', adminCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.users).toHaveLength(0);
  });

  it('403 — teacher token cannot access pending users list', async () => {
    await createDirectUser(TEACHER_RBAC);
    const { cookie } = await loginUser(TEACHER_RBAC.email, TEACHER_RBAC.password);

    const res = await request(app)
      .get('/api/v1/admin/users/pending')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/admin/users/pending');
    expect(res.statusCode).toBe(401);
  });
});

// ── Admin: approve user ───────────────────────────────────────────────────────

describe('PUT /api/v1/admin/users/:id/approve', () => {
  let adminCookie;

  beforeEach(async () => {
    adminCookie = await getAdminCookie();
  });

  it('200 — approves pending user; user can then log in', async () => {
    const student = PENDING_STUDENT();
    const regRes = await registerSelf(student);
    const userId = regRes.body.data.user._id;

    const approveRes = await request(app)
      .put(`/api/v1/admin/users/${userId}/approve`)
      .set('Cookie', adminCookie);

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.body.data.user.approvalStatus).toBe('approved');
    expect(approveRes.body.data.user.isActive).toBe(true);

    // User should now be able to log in
    const { res: loginRes, cookie } = await loginUser(student.email, student.password);
    expect(loginRes.statusCode).toBe(200);
    expect(cookie).toBeDefined();
  });

  it('404 — approve non-existent user id', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .put(`/api/v1/admin/users/${fakeId}/approve`)
      .set('Cookie', adminCookie);
    expect(res.statusCode).toBe(404);
  });
});

// ── Admin: reject user ────────────────────────────────────────────────────────

describe('PUT /api/v1/admin/users/:id/reject', () => {
  let adminCookie;

  beforeEach(async () => {
    adminCookie = await getAdminCookie();
  });

  it('200 — rejects pending user; login returns 403', async () => {
    const student = PENDING_STUDENT();
    const regRes = await registerSelf(student);
    const userId = regRes.body.data.user._id;

    const rejectRes = await request(app)
      .put(`/api/v1/admin/users/${userId}/reject`)
      .set('Cookie', adminCookie);

    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.body.data.user.approvalStatus).toBe('rejected');
    expect(rejectRes.body.data.user.isActive).toBe(false);

    const { res: loginRes } = await loginUser(student.email, student.password);
    expect(loginRes.statusCode).toBe(403);
  });

  it('404 — reject non-existent user id', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .put(`/api/v1/admin/users/${fakeId}/reject`)
      .set('Cookie', adminCookie);
    expect(res.statusCode).toBe(404);
  });
});
