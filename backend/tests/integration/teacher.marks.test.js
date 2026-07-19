const request = require('supertest');
const app = require('../../src/app');
const { createDirectUser, createSchool, createSchoolAdmin, setKnownPassword } = require('../helpers');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Admin User',
  email: 'admin@school.test',
  password: 'Admin@1234',
};

let testSchool;

const TEACHER_DATA = {
  name: 'Mr Bilal',
  email: 'bilal@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-099',
};

const TEACHER2_DATA = {
  name: 'Ms Nadia',
  email: 'nadia@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-100',
};

const CLASS_DATA = {
  name: 'Class 6A',
  grade: '6',
  section: 'A',
  academicYear: '2024-2025',
};

const STUDENT_DATA = {
  name: 'Student Alpha',
  email: 'alpha@school.test',
  password: 'Student@1234',
  enrollmentId: 'STU-999',
  dateOfBirth: '2012-05-10',
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

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

// ── Setup helpers ─────────────────────────────────────────────────────────────

const bootstrapTeacherScenario = async () => {
  const adminCookie = await getAdminCookie();

  const tRes = await request(app)
    .post('/api/v1/admin/teachers')
    .set('Cookie', adminCookie)
    .send(TEACHER_DATA);
  const teacherId = tRes.body.data.teacher._id;

  const cRes = await request(app)
    .post('/api/v1/admin/classes')
    .set('Cookie', adminCookie)
    .send(CLASS_DATA);
  const classId = cRes.body.data.class._id;

  await request(app)
    .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
    .set('Cookie', adminCookie)
    .send({ classId, subject: 'Science' });

  const sRes = await request(app)
    .post('/api/v1/admin/students')
    .set('Cookie', adminCookie)
    .send(STUDENT_DATA);
  const studentId = sRes.body.data.student._id;

  await request(app)
    .post(`/api/v1/admin/classes/${classId}/assign-students`)
    .set('Cookie', adminCookie)
    .send({ studentIds: [studentId] });

  // API-created teachers get a random emailed temp password — set a known one
  await setKnownPassword(TEACHER_DATA.email, TEACHER_DATA.password);
  const { cookie: teacherCookie } = await loginUser(TEACHER_DATA.email, TEACHER_DATA.password);

  return { adminCookie, teacherCookie, teacherId, classId, studentId };
};

// ── Marks tests ───────────────────────────────────────────────────────────────

describe('Teacher Marks', () => {
  let adminCookie;
  let teacherCookie;
  let classId;
  let studentId;

  beforeEach(async () => {
    ({ adminCookie, teacherCookie, classId, studentId } =
      await bootstrapTeacherScenario());
  });

  const markPayload = (overrides = {}) => ({
    studentId,
    classId,
    subject: 'Science',
    examType: 'final',
    marksObtained: 87,
    ...overrides,
  });

  // ── POST /api/v1/teacher/marks ────────────────────────────────────────────

  describe('POST /api/v1/teacher/marks — upsert', () => {
    it('200 — creates a new mark record', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .send(markPayload());

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mark.marksObtained).toBe(87);
    });

    it('200 — upserts existing record (same student + subject + class + examType)', async () => {
      // Create
      await request(app)
        .post('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .send(markPayload({ marksObtained: 70 }));

      // Update
      const res = await request(app)
        .post('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .send(markPayload({ marksObtained: 90 }));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.mark.marksObtained).toBe(90);
    });

    it('422 — marksObtained below 0 is rejected', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .send(markPayload({ marksObtained: -1 }));

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('422 — marksObtained above 100 is rejected', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .send(markPayload({ marksObtained: 101 }));

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('403 — teacher not assigned to class is rejected', async () => {
      // Create second teacher (not assigned)
      await request(app)
        .post('/api/v1/admin/teachers')
        .set('Cookie', adminCookie)
        .send(TEACHER2_DATA);
      await setKnownPassword(TEACHER2_DATA.email, TEACHER2_DATA.password);
      const { cookie: t2Cookie } = await loginUser(TEACHER2_DATA.email, TEACHER2_DATA.password);

      const res = await request(app)
        .post('/api/v1/teacher/marks')
        .set('Cookie', t2Cookie)
        .send(markPayload());

      expect(res.statusCode).toBe(403);
    });

    it('401 — unauthenticated request is rejected', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/marks')
        .send(markPayload());

      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/teacher/marks ─────────────────────────────────────────────

  describe('GET /api/v1/teacher/marks', () => {
    it('200 — returns marks for class + subject', async () => {
      await request(app)
        .post('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .send(markPayload({ marksObtained: 75 }));

      const res = await request(app)
        .get('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .query({ classId, subject: 'Science' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.marks).toHaveLength(1);
      expect(res.body.data.marks[0].marksObtained).toBe(75);
    });

    it('200 — returns empty array when no marks exist for subject', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/marks')
        .set('Cookie', teacherCookie)
        .query({ classId, subject: 'History' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.marks).toHaveLength(0);
    });
  });
});

// ── Announcements tests ───────────────────────────────────────────────────────

describe('Teacher Announcements', () => {
  let teacherCookie;
  let teacher2Cookie;

  beforeEach(async () => {
    let adminCookie;
    ({ teacherCookie, adminCookie } = await bootstrapTeacherScenario());

    // Create a second teacher for ownership tests — reuse admin cookie from bootstrap
    await request(app)
      .post('/api/v1/admin/teachers')
      .set('Cookie', adminCookie)
      .send(TEACHER2_DATA);
    await setKnownPassword(TEACHER2_DATA.email, TEACHER2_DATA.password);
    const { cookie } = await loginUser(TEACHER2_DATA.email, TEACHER2_DATA.password);
    teacher2Cookie = cookie;
  });

  const createAnn = (cookie, data = { title: 'Test', content: 'Hello world.' }) =>
    request(app)
      .post('/api/v1/teacher/announcements')
      .set('Cookie', cookie)
      .send(data);

  // ── POST /api/v1/teacher/announcements ───────────────────────────────────

  describe('POST /api/v1/teacher/announcements — create', () => {
    it('201 — creates announcement successfully', async () => {
      const res = await createAnn(teacherCookie);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.announcement.title).toBe('Test');
    });

    it('401 — unauthenticated request is rejected', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/announcements')
        .send({ title: 'Test', content: 'Hello.' });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/teacher/announcements ────────────────────────────────────

  describe('GET /api/v1/teacher/announcements', () => {
    it('200 — returns own announcements', async () => {
      await createAnn(teacherCookie, { title: 'First', content: 'Content A' });
      await createAnn(teacherCookie, { title: 'Second', content: 'Content B' });

      const res = await request(app)
        .get('/api/v1/teacher/announcements')
        .set('Cookie', teacherCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.announcements.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── PUT /api/v1/teacher/announcements/:id ─────────────────────────────────

  describe('PUT /api/v1/teacher/announcements/:id — update', () => {
    it('200 — teacher can update own announcement', async () => {
      const createRes = await createAnn(teacherCookie, {
        title: 'Before',
        content: 'Old content',
      });
      const id = createRes.body.data.announcement._id;

      const res = await request(app)
        .put(`/api/v1/teacher/announcements/${id}`)
        .set('Cookie', teacherCookie)
        .send({ title: 'After', content: 'New content' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.announcement.title).toBe('After');
    });

    it('403 — teacher cannot update another teacher\'s announcement', async () => {
      const createRes = await createAnn(teacherCookie);
      const id = createRes.body.data.announcement._id;

      const res = await request(app)
        .put(`/api/v1/teacher/announcements/${id}`)
        .set('Cookie', teacher2Cookie)
        .send({ title: 'Hijacked' });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── DELETE /api/v1/teacher/announcements/:id ──────────────────────────────

  describe('DELETE /api/v1/teacher/announcements/:id — soft delete', () => {
    it('204 — teacher can soft-delete own announcement', async () => {
      const createRes = await createAnn(teacherCookie);
      const id = createRes.body.data.announcement._id;

      const res = await request(app)
        .delete(`/api/v1/teacher/announcements/${id}`)
        .set('Cookie', teacherCookie);

      expect(res.statusCode).toBe(204);

      // Confirm it still appears in own list (isDeleted=true, not purged)
      const listRes = await request(app)
        .get('/api/v1/teacher/announcements')
        .set('Cookie', teacherCookie);
      const ann = listRes.body.data.announcements.find((a) => a._id === id);
      expect(ann).toBeDefined();
      expect(ann.isDeleted).toBe(true);
    });

    it('403 — teacher cannot delete another teacher\'s announcement', async () => {
      const createRes = await createAnn(teacherCookie);
      const id = createRes.body.data.announcement._id;

      const res = await request(app)
        .delete(`/api/v1/teacher/announcements/${id}`)
        .set('Cookie', teacher2Cookie);

      expect(res.statusCode).toBe(403);
    });
  });
});
