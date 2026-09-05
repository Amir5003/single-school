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

  it('201 — a missing enrollmentId is allocated by the server', async () => {
    const { enrollmentId: _e, ...noId } = STUDENT_BASE;
    const res = await createStudent(cookie, noId);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.student.enrollmentId).toMatch(/^\d{2}-\d{6}$/);
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
   * Neither create call passes a classId, so both students start unassigned
   * and the assignment goes through the dedicated assign-students endpoint.
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

describe('POST /api/v1/admin/students — class assignment', () => {
  let cookie;

  const makeClass = (ck, overrides = {}) =>
    request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', ck)
      .send({ name: 'Grade 5', grade: '5', section: 'A', academicYear: '2024-2025', ...overrides });

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('201 — assigns the student to the class in the same request', async () => {
    const cls = await makeClass(cookie);
    const classId = cls.body.data.class._id;

    const res = await createStudent(cookie, { ...STUDENT_BASE, classId });
    expect(res.statusCode).toBe(201);
    expect(String(res.body.data.student.classId)).toBe(classId);

    // ...and it shows up under the class filter without a second call
    const list = await getStudents(cookie, `?classId=${classId}`);
    expect(list.body.data.students).toHaveLength(1);
  });

  it('201 — a student can still be created with no class (school has none yet)', async () => {
    const res = await createStudent(cookie, STUDENT_BASE);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.student.classId).toBeNull();
  });

  it('404 — a class from another school is rejected', async () => {
    // A class owned by a different tenant must never be assignable.
    const otherSchool = await createSchool({ slug: `other-${Date.now()}` });
    await createSchoolAdmin(otherSchool._id, {
      email: 'other-admin@school.test',
      password: 'Admin@1234',
      name: 'Other Admin',
    });
    const { cookie: otherCookie } = await loginUser('other-admin@school.test', 'Admin@1234');
    const foreign = await makeClass(otherCookie);
    const foreignClassId = foreign.body.data.class._id;

    const res = await createStudent(cookie, { ...STUDENT_BASE, classId: foreignClassId });
    expect(res.statusCode).toBe(404);

    // The failed create must not have left a User behind.
    const list = await getStudents(cookie);
    expect(list.body.data.students).toHaveLength(0);
  });

  it('422 — a malformed classId is rejected', async () => {
    const res = await createStudent(cookie, { ...STUDENT_BASE, classId: 'not-an-id' });
    expect(res.statusCode).toBe(422);
  });

  it('200 — PUT can move a student to another class and unassign them', async () => {
    const clsA = await makeClass(cookie);
    const clsB = await makeClass(cookie, { name: 'Grade 6', grade: '6', section: 'B' });
    const created = await createStudent(cookie, {
      ...STUDENT_BASE,
      classId: clsA.body.data.class._id,
    });
    const studentId = created.body.data.student._id;

    const moved = await request(app)
      .put(`/api/v1/admin/students/${studentId}`)
      .set('Cookie', cookie)
      .send({ classId: clsB.body.data.class._id });
    expect(moved.statusCode).toBe(200);
    expect(String(moved.body.data.student.classId._id)).toBe(clsB.body.data.class._id);

    const cleared = await request(app)
      .put(`/api/v1/admin/students/${studentId}`)
      .set('Cookie', cookie)
      .send({ classId: '' });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.data.student.classId).toBeNull();
  });
});

describe('POST /api/v1/admin/students — server-allocated enrollment ID', () => {
  let cookie;
  const YY = String(new Date().getFullYear()).slice(-2);

  // The admin form never sends an enrollmentId — the server allocates it.
  const createWithoutId = (ck, overrides = {}) => {
    const { enrollmentId, ...rest } = STUDENT_BASE;
    return createStudent(ck, { ...rest, ...overrides });
  };

  beforeEach(async () => {
    cookie = await getAdminCookie();
  });

  it('201 — first student of the year is allocated YY-000001', async () => {
    const res = await createWithoutId(cookie);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.student.enrollmentId).toBe(`${YY}-000001`);
  });

  it('201 — the next student increments', async () => {
    await createWithoutId(cookie);
    const res = await createWithoutId(cookie, {
      name: 'Bob Jones',
      email: 'bob@school.test',
    });
    expect(res.body.data.student.enrollmentId).toBe(`${YY}-000002`);
  });

  it('201 — a deleted student\'s number is retired, never re-issued', async () => {
    const first = await createWithoutId(cookie);
    expect(first.body.data.student.enrollmentId).toBe(`${YY}-000001`);
    await deleteStudentById(cookie, first.body.data.student._id);

    // The head-count is back to zero, but 000001 still belongs to the
    // soft-deleted row and would collide on the unique index.
    const second = await createWithoutId(cookie, {
      name: 'Bob Jones',
      email: 'bob@school.test',
    });
    expect(second.body.data.student.enrollmentId).toBe(`${YY}-000002`);
  });

  it('201 — legacy IDs in another format do not disturb the sequence', async () => {
    await createStudent(cookie, { ...STUDENT_BASE, enrollmentId: '26G5121' });
    const res = await createWithoutId(cookie, {
      name: 'Bob Jones',
      email: 'bob@school.test',
    });
    expect(res.body.data.student.enrollmentId).toBe(`${YY}-000001`);
  });

  it('201 — an explicitly supplied ID is still honoured (import path)', async () => {
    const res = await createStudent(cookie, { ...STUDENT_BASE, enrollmentId: 'LEGACY-42' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.student.enrollmentId).toBe('LEGACY-42');
  });

  it('409 — a supplied ID that is already taken still conflicts', async () => {
    await createStudent(cookie, STUDENT_BASE);
    const res = await createStudent(cookie, {
      ...STUDENT_BASE,
      email: 'bob@school.test',
    });
    expect(res.statusCode).toBe(409);
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
