const request = require('supertest');
const app = require('../../src/app');
const { createDirectUser, createSchool, createSchoolAdmin } = require('../helpers');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Admin User',
  email: 'admin@school.test',
  password: 'Admin@1234',
};

let testSchool;

/** Used only for the RBAC 403 check — registered directly as 'teacher' role user. */
const TEACHER_RBAC = {
  name: 'Teacher RBAC',
  email: 'rteacher@school.test',
  password: 'Teacher@1234',
  role: 'teacher',
};

const TEACHER_BASE = {
  name: 'Mr Ahsan Ahmed',
  email: 'ahsan@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-001',
};

const CLASS_BASE = {
  name: 'Class 10A',
  grade: '10',
  section: 'A',
  academicYear: '2024-2025',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const registerUser = (data) =>
  request(app).post('/api/v1/auth/register').send(data);

const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { res, cookie: res.headers['set-cookie'] };
};

const getAdminCookie = async () => {
  testSchool = await createSchool();
  await createSchoolAdmin(testSchool._id, { email: ADMIN.email, password: ADMIN.password, name: ADMIN.name });
  const { cookie } = await loginUser(ADMIN.email, ADMIN.password);
  return cookie;
};

const createTeacher = (cookie, data = TEACHER_BASE) =>
  request(app).post('/api/v1/admin/teachers').set('Cookie', cookie).send(data);

const createClass = (cookie, data = CLASS_BASE) =>
  request(app).post('/api/v1/admin/classes').set('Cookie', cookie).send(data);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/teachers — create', () => {
  let cookie;

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('201 — creates teacher with User + Teacher docs', async () => {
    const res = await createTeacher(cookie);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.teacher.employeeId).toBe('TCH-001');
    expect(res.body.data.user.role).toBe('teacher');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('409 — duplicate employeeId is rejected', async () => {
    await createTeacher(cookie);
    const res = await createTeacher(cookie, {
      ...TEACHER_BASE,
      email: 'other@school.test',
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('409 — duplicate email is rejected', async () => {
    await createTeacher(cookie);
    const res = await createTeacher(cookie, {
      ...TEACHER_BASE,
      employeeId: 'TCH-002',
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('422 — missing name', async () => {
    const { name: _n, ...noName } = TEACHER_BASE;
    const res = await createTeacher(cookie, noName);
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('422 — missing employeeId', async () => {
    const { employeeId: _e, ...noId } = TEACHER_BASE;
    const res = await createTeacher(cookie, noId);
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'employeeId' })])
    );
  });
});

describe('GET /api/v1/admin/teachers — list', () => {
  let cookie;

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('200 — returns list with classCount field', async () => {
    await createTeacher(cookie);
    const res = await request(app)
      .get('/api/v1/admin/teachers')
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.teachers).toHaveLength(1);
    expect(res.body.data.teachers[0]).toHaveProperty('classCount', 0);
  });
});

describe('GET /api/v1/admin/teachers/:id — get by id', () => {
  let cookie;
  let teacherId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const res = await createTeacher(cookie);
    teacherId = res.body.data.teacher._id;
  });

  it('200 — returns populated teacher with userId and assignments', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/teachers/${teacherId}`)
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.teacher._id).toBe(teacherId);
    expect(res.body.data.teacher.userId).toHaveProperty('name', 'Mr Ahsan Ahmed');
    expect(res.body.data.teacher.userId.password).toBeUndefined();
    expect(res.body.data.assignments).toHaveLength(0);
  });

  it('404 — unknown id returns 404', async () => {
    const res = await request(app)
      .get('/api/v1/admin/teachers/507f1f77bcf86cd799439011')
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /api/v1/admin/teachers/:id — update', () => {
  let cookie;
  let teacherId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const res = await createTeacher(cookie);
    teacherId = res.body.data.teacher._id;
  });

  it('200 — updating employeeId persists', async () => {
    const updateRes = await request(app)
      .put(`/api/v1/admin/teachers/${teacherId}`)
      .set('Cookie', cookie)
      .send({ employeeId: 'TCH-999' });
    expect(updateRes.statusCode).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/admin/teachers/${teacherId}`)
      .set('Cookie', cookie);
    expect(getRes.body.data.teacher.employeeId).toBe('TCH-999');
  });
});

describe('POST /api/v1/admin/teachers/:id/assign-class', () => {
  let cookie;
  let teacherId;
  let classId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const tRes = await createTeacher(cookie);
    teacherId = tRes.body.data.teacher._id;
    const cRes = await createClass(cookie);
    classId = cRes.body.data.class._id;
  });

  it('201 — assigns teacher to class', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Mathematics' });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignment.subject).toBe('Mathematics');
  });

  it('409 — same teacher, class, and subject is rejected', async () => {
    await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Mathematics' });

    const res = await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Mathematics' });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('201 — same teacher, same class, different subject succeeds', async () => {
    await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Mathematics' });

    const res = await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Physics' });
    expect(res.statusCode).toBe(201);
  });

  it('classCount increments in teacher list after assignment', async () => {
    await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Mathematics' });

    const listRes = await request(app)
      .get('/api/v1/admin/teachers')
      .set('Cookie', cookie);
    expect(listRes.body.data.teachers[0].classCount).toBe(1);
  });

  it('assignments appear in GET /:id response', async () => {
    await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Mathematics' });

    const res = await request(app)
      .get(`/api/v1/admin/teachers/${teacherId}`)
      .set('Cookie', cookie);
    expect(res.body.data.assignments).toHaveLength(1);
    expect(res.body.data.assignments[0].subject).toBe('Mathematics');
  });
});

describe('DELETE /api/v1/admin/teachers/:id', () => {
  let cookie;
  let teacherId;
  let classId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const tRes = await createTeacher(cookie);
    teacherId = tRes.body.data.teacher._id;
    const cRes = await createClass(cookie);
    classId = cRes.body.data.class._id;
  });

  it('200 — deletes teacher when no class assignments exist', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/teachers/${teacherId}`)
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('400 — delete blocked when teacher has class assignments', async () => {
    await request(app)
      .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
      .set('Cookie', cookie)
      .send({ classId, subject: 'Mathematics' });

    const res = await request(app)
      .delete(`/api/v1/admin/teachers/${teacherId}`)
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Authentication & RBAC guards', () => {
  it('401 — list teachers without token', async () => {
    const res = await request(app).get('/api/v1/admin/teachers');
    expect(res.statusCode).toBe(401);
  });

  it('403 — teacher role cannot access admin teachers endpoint', async () => {
    await createDirectUser(TEACHER_RBAC);
    const { cookie } = await loginUser(TEACHER_RBAC.email, TEACHER_RBAC.password);
    const res = await request(app)
      .get('/api/v1/admin/teachers')
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(403);
  });
});
