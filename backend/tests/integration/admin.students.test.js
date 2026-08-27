const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { createDirectUser, createSchool, createSchoolAdmin } = require('../helpers');
// Real Attendance model is registered via app; import after app to avoid race
const Attendance = require('../../src/models/Attendance.model');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Admin User',
  email: 'admin@school.test',
  password: 'Admin@1234',
};

let testSchool;

const TEACHER = {
  name: 'Teacher User',
  email: 'teacher@school.test',
  password: 'Teacher@1234',
  role: 'teacher',
};

const STUDENT_BASE = {
  name: 'Alice Smith',
  email: 'alice@school.test',
  password: 'Alice@1234',
  enrollmentId: 'STU-001',
  dateOfBirth: '2010-05-15',
  address: '123 Main St',
  phone: '5550001111',
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

const createStudent = (cookie, data = STUDENT_BASE) =>
  request(app)
    .post('/api/v1/admin/students')
    .set('Cookie', cookie)
    .send(data);

const getStudents = (cookie, query = '') =>
  request(app)
    .get(`/api/v1/admin/students${query}`)
    .set('Cookie', cookie);

const getStudentById = (cookie, id) =>
  request(app).get(`/api/v1/admin/students/${id}`).set('Cookie', cookie);

const updateStudentById = (cookie, id, data) =>
  request(app)
    .put(`/api/v1/admin/students/${id}`)
    .set('Cookie', cookie)
    .send(data);

const deleteStudentById = (cookie, id) =>
  request(app).delete(`/api/v1/admin/students/${id}`).set('Cookie', cookie);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/students — create', () => {
  let cookie;

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('201 — creates student with User + Student docs', async () => {
    const res = await createStudent(cookie);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.enrollmentId).toBe('STU-001');
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('409 — duplicate enrollmentId is rejected', async () => {
    await createStudent(cookie);
    const res = await createStudent(cookie, {
      ...STUDENT_BASE,
      email: 'other@school.test',
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('409 — duplicate email is rejected', async () => {
    await createStudent(cookie);
    const res = await createStudent(cookie, {
      ...STUDENT_BASE,
      enrollmentId: 'STU-002',
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('422 — missing required name', async () => {
    const { name: _n, ...noName } = STUDENT_BASE;
    const res = await createStudent(cookie, noName);
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('422 — missing enrollmentId', async () => {
    const { enrollmentId: _e, ...noId } = STUDENT_BASE;
    const res = await createStudent(cookie, noId);
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'enrollmentId' })])
    );
  });

  it('422 — missing dateOfBirth', async () => {
    const { dateOfBirth: _d, ...noDob } = STUDENT_BASE;
    const res = await createStudent(cookie, noDob);
    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'dateOfBirth' })])
    );
  });
});

describe('GET /api/v1/admin/students — list', () => {
  let cookie;

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('200 — returns paginated list (default 20/page)', async () => {
    await createStudent(cookie);
    const res = await getStudents(cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.students).toHaveLength(1);
    expect(res.body.data.limit).toBe(20);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.totalPages).toBe(1);
  });

  it('200 — search by name returns filtered results', async () => {
    await createStudent(cookie);
    await createStudent(cookie, {
      ...STUDENT_BASE,
      name: 'Bob Jones',
      email: 'bob@school.test',
      enrollmentId: 'STU-002',
    });

    const res = await getStudents(cookie, '?search=Alice');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.students).toHaveLength(1);
    expect(res.body.data.students[0].userId.name).toBe('Alice Smith');
  });

  it('200 — search by enrollmentId returns filtered results', async () => {
    await createStudent(cookie);
    await createStudent(cookie, {
      ...STUDENT_BASE,
      name: 'Bob Jones',
      email: 'bob@school.test',
      enrollmentId: 'STU-002',
    });

    const res = await getStudents(cookie, '?search=STU-001');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.students).toHaveLength(1);
    expect(res.body.data.students[0].enrollmentId).toBe('STU-001');
  });

  // ── classId filter ─────────────────────────────────────────────────────────
  // Filtering runs server-side because the list is paginated.

  /**
   * Create a class with STU-001 assigned to it and STU-002 left unassigned.
   * POST /students ignores a classId in the body, so the assignment goes
   * through the dedicated assign-students endpoint.
   */
  const seedClassAndStudents = async (ck) => {
    const clsRes = await request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', ck)
      .send({ name: 'Grade 5', grade: '5', section: 'A', academicYear: '2024-2025' });
    const classId = clsRes.body.data.class._id;

    const assigned = await createStudent(ck, STUDENT_BASE);
    await createStudent(ck, {
      ...STUDENT_BASE,
      name: 'Bob Jones',
      email: 'bob@school.test',
      enrollmentId: 'STU-002',
    });

    await request(app)
      .post(`/api/v1/admin/classes/${classId}/assign-students`)
      .set('Cookie', ck)
      .send({ studentIds: [assigned.body.data.student._id] });

    return classId;
  };

  it('200 — classId returns only students in that class', async () => {
    const classId = await seedClassAndStudents(cookie);

    const res = await getStudents(cookie, `?classId=${classId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.students).toHaveLength(1);
    expect(res.body.data.students[0].enrollmentId).toBe('STU-001');
    expect(res.body.data.total).toBe(1);
  });

  it("200 — classId=unassigned returns only students with no class", async () => {
    await seedClassAndStudents(cookie);

    const res = await getStudents(cookie, '?classId=unassigned');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.students).toHaveLength(1);
    expect(res.body.data.students[0].enrollmentId).toBe('STU-002');
  });

  it('200 — a malformed classId is ignored rather than erroring', async () => {
    await seedClassAndStudents(cookie);

    const res = await getStudents(cookie, '?classId=not-an-object-id');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(2);
  });

  it('200 — classId combines with search', async () => {
    const classId = await seedClassAndStudents(cookie);

    const match = await getStudents(cookie, `?classId=${classId}&search=Alice`);
    expect(match.body.data.students).toHaveLength(1);

    // Bob is not in the class, so the two filters together exclude him
    const noMatch = await getStudents(cookie, `?classId=${classId}&search=Bob`);
    expect(noMatch.body.data.students).toHaveLength(0);
  });
});

describe('GET /api/v1/admin/students/:id — get by id', () => {
  let cookie;
  let studentId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const res = await createStudent(cookie);
    studentId = res.body.data.student._id;
  });

  it('200 — returns populated student document', async () => {
    const res = await getStudentById(cookie, studentId);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.student._id).toBe(studentId);
    expect(res.body.data.student.userId).toHaveProperty('name', 'Alice Smith');
    expect(res.body.data.student.userId.password).toBeUndefined();
  });

  it('404 — returns 404 for soft-deleted student', async () => {
    await deleteStudentById(cookie, studentId);
    const res = await getStudentById(cookie, studentId);
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /api/v1/admin/students/:id — update', () => {
  let cookie;
  let studentId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const res = await createStudent(cookie);
    studentId = res.body.data.student._id;
  });

  it('200 — updating phone persists across GET', async () => {
    const updateRes = await updateStudentById(cookie, studentId, {
      phone: '9998887777',
    });
    expect(updateRes.statusCode).toBe(200);

    const getRes = await getStudentById(cookie, studentId);
    expect(getRes.body.data.student.userId.phone).toBe('9998887777');
  });
});

describe('DELETE /api/v1/admin/students/:id — soft delete', () => {
  let cookie;
  let studentId;

  beforeEach(async () => {
    cookie = await getAdminCookie();
    const res = await createStudent(cookie);
    studentId = res.body.data.student._id;
  });

  it('200 — soft-deletes student; isDeleted confirmed in DB', async () => {
    const res = await deleteStudentById(cookie, studentId);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify isDeleted in DB via list (should NOT appear)
    const listRes = await getStudents(cookie);
    expect(
      listRes.body.data.students.find((s) => s._id === studentId)
    ).toBeUndefined();
  });

  it('409 — re-creating with same enrollmentId after delete is blocked', async () => {
    await deleteStudentById(cookie, studentId);
    const res = await createStudent(cookie, {
      ...STUDENT_BASE,
      email: 'newstudent@school.test', // different email
    });
    expect(res.statusCode).toBe(409);
  });

  it('400 — delete blocked with warning when attendance records exist', async () => {
    // Create a real Attendance record linked to the student
    await Attendance.create({
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: new mongoose.Types.ObjectId(),
      schoolId: testSchool._id,
      date: new Date(),
      status: 'Present',
      markedBy: new mongoose.Types.ObjectId(),
    });

    const res = await deleteStudentById(cookie, studentId);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/attendance/i);
  });
});

describe('Authentication & RBAC guards', () => {
  it('401 — list students without token', async () => {
    const res = await request(app).get('/api/v1/admin/students');
    expect(res.statusCode).toBe(401);
  });

  it('403 — teacher token cannot access admin students', async () => {
    await createDirectUser(TEACHER);
    const { cookie } = await loginUser(TEACHER.email, TEACHER.password);
    const res = await getStudents(cookie);
    expect(res.statusCode).toBe(403);
  });
});
