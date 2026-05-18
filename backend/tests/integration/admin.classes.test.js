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

const TEACHER_RBAC = {
  name: 'Teacher RBAC',
  email: 'rteacher@school.test',
  password: 'Teacher@1234',
  role: 'teacher',
};

const CLASS_BASE = {
  name: 'Class 10A',
  grade: '10',
  section: 'A',
  academicYear: '2024-2025',
};

const STUDENT_BASE = {
  name: 'Alice Smith',
  email: 'alice@school.test',
  password: 'Alice@1234',
  enrollmentId: 'STU-001',
  dateOfBirth: '2010-05-15',
};

const TEACHER_BASE = {
  name: 'Mr Ahmed',
  email: 'ahmed@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-001',
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

const createClass = (cookie, data = CLASS_BASE) =>
  request(app).post('/api/v1/admin/classes').set('Cookie', cookie).send(data);

const createStudent = (cookie, data = STUDENT_BASE) =>
  request(app).post('/api/v1/admin/students').set('Cookie', cookie).send(data);

const createTeacher = (cookie, data = TEACHER_BASE) =>
  request(app).post('/api/v1/admin/teachers').set('Cookie', cookie).send(data);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/classes — create', () => {
  let cookie;

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('201 — creates class document', async () => {
    const res = await createClass(cookie);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.class.grade).toBe('10');
    expect(res.body.data.class.section).toBe('A'); // normalised to uppercase
    expect(res.body.data.class.name).toBe('Class 10A');
  });

  it('409 — duplicate grade + section is rejected', async () => {
    await createClass(cookie);
    const res = await createClass(cookie, { ...CLASS_BASE, name: 'Other 10A' });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('201 — same grade different section succeeds', async () => {
    await createClass(cookie);
    const res = await createClass(cookie, {
      name: 'Class 10B',
      grade: '10',
      section: 'B',
      academicYear: '2024-2025',
    });
    expect(res.statusCode).toBe(201);
  });

  it('422 — missing grade', async () => {
    const { grade: _g, ...noGrade } = CLASS_BASE;
    const res = await createClass(cookie, noGrade);
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'grade' })])
    );
  });

  it('422 — missing section', async () => {
    const { section: _s, ...noSection } = CLASS_BASE;
    const res = await createClass(cookie, noSection);
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'section' })])
    );
  });
});

describe('GET /api/v1/admin/classes — list', () => {
  let cookie;

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('200 — returns list with studentCount and teacherCount', async () => {
    await createClass(cookie);
    const res = await request(app)
      .get('/api/v1/admin/classes')
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.classes).toHaveLength(1);
    expect(res.body.data.classes[0]).toHaveProperty('studentCount', 0);
    expect(res.body.data.classes[0]).toHaveProperty('teacherCount', 0);
  });
});

describe('GET /api/v1/admin/classes/:id — get by id', () => {
  let cookie;
  let classId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const res = await createClass(cookie);
    classId = res.body.data.class._id;
  });

  it('200 — returns class with empty students and assignments arrays', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/classes/${classId}`)
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.class._id).toBe(classId);
    expect(res.body.data.students).toHaveLength(0);
    expect(res.body.data.assignments).toHaveLength(0);
  });

  it('404 — unknown id returns 404', async () => {
    const res = await request(app)
      .get('/api/v1/admin/classes/507f1f77bcf86cd799439011')
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /api/v1/admin/classes/:id — update', () => {
  let cookie;
  let classId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const res = await createClass(cookie);
    classId = res.body.data.class._id;
  });

  it('200 — updating name persists', async () => {
    const updateRes = await request(app)
      .put(`/api/v1/admin/classes/${classId}`)
      .set('Cookie', cookie)
      .send({ name: 'Mathematics Group' });
    expect(updateRes.statusCode).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/admin/classes/${classId}`)
      .set('Cookie', cookie);
    expect(getRes.body.data.class.name).toBe('Mathematics Group');
  });
});

describe('POST /api/v1/admin/classes/:id/assign-teacher', () => {
  let cookie;
  let classId;
  let teacherId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const cRes = await createClass(cookie);
    classId = cRes.body.data.class._id;
    const tRes = await createTeacher(cookie);
    teacherId = tRes.body.data.teacher._id;
  });

  it('201 — assigns teacher to class', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/classes/${classId}/assign-teacher`)
      .set('Cookie', cookie)
      .send({ teacherId, subject: 'Mathematics' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.assignment.subject).toBe('Mathematics');
  });

  it('teacherCount increments in list after assignment', async () => {
    await request(app)
      .post(`/api/v1/admin/classes/${classId}/assign-teacher`)
      .set('Cookie', cookie)
      .send({ teacherId, subject: 'Mathematics' });

    const listRes = await request(app)
      .get('/api/v1/admin/classes')
      .set('Cookie', cookie);
    expect(listRes.body.data.classes[0].teacherCount).toBe(1);
  });
});

describe('POST /api/v1/admin/classes/:id/assign-students', () => {
  let cookie;
  let classId;
  let studentId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const cRes = await createClass(cookie);
    classId = cRes.body.data.class._id;
    const sRes = await createStudent(cookie);
    studentId = sRes.body.data.student._id;
  });

  it('200 — assigns students; studentCount reflects in list', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/classes/${classId}/assign-students`)
      .set('Cookie', cookie)
      .send({ studentIds: [studentId] });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.modifiedCount).toBe(1);

    const listRes = await request(app)
      .get('/api/v1/admin/classes')
      .set('Cookie', cookie);
    expect(listRes.body.data.classes[0].studentCount).toBe(1);
  });

  it('students appear in class GET detail after assignment', async () => {
    await request(app)
      .post(`/api/v1/admin/classes/${classId}/assign-students`)
      .set('Cookie', cookie)
      .send({ studentIds: [studentId] });

    const res = await request(app)
      .get(`/api/v1/admin/classes/${classId}`)
      .set('Cookie', cookie);
    expect(res.body.data.students).toHaveLength(1);
  });

  it('422 — empty studentIds array is rejected', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/classes/${classId}/assign-students`)
      .set('Cookie', cookie)
      .send({ studentIds: [] });
    expect(res.statusCode).toBe(422);
  });
});

describe('DELETE /api/v1/admin/classes/:id', () => {
  let cookie;
  let classId;
  let studentId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const cRes = await createClass(cookie);
    classId = cRes.body.data.class._id;
    const sRes = await createStudent(cookie);
    studentId = sRes.body.data.student._id;
  });

  it('200 — deletes class with no active students', async () => {
    // Different class — no students
    const freshRes = await createClass(cookie, {
      name: 'Empty Class',
      grade: '11',
      section: 'B',
      academicYear: '2024-2025',
    });
    const freshId = freshRes.body.data.class._id;

    const res = await request(app)
      .delete(`/api/v1/admin/classes/${freshId}`)
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('400 — delete blocked when active students are assigned', async () => {
    await request(app)
      .post(`/api/v1/admin/classes/${classId}/assign-students`)
      .set('Cookie', cookie)
      .send({ studentIds: [studentId] });

    const res = await request(app)
      .delete(`/api/v1/admin/classes/${classId}`)
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Authentication & RBAC guards', () => {
  it('401 — list classes without token', async () => {
    const res = await request(app).get('/api/v1/admin/classes');
    expect(res.statusCode).toBe(401);
  });

  it('403 — teacher role cannot access admin classes endpoint', async () => {
    await createDirectUser(TEACHER_RBAC);
    const { cookie } = await loginUser(TEACHER_RBAC.email, TEACHER_RBAC.password);
    const res = await request(app)
      .get('/api/v1/admin/classes')
      .set('Cookie', cookie);
    expect(res.statusCode).toBe(403);
  });
});
