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

// ── Coursework assessment tests ───────────────────────────────────────────────

describe('Teacher Coursework Assessments', () => {
  let adminCookie;
  let teacherCookie;
  let classId;
  let studentId;

  beforeEach(async () => {
    ({ adminCookie, teacherCookie, classId, studentId } =
      await bootstrapTeacherScenario());
  });

  const createAssessment = (overrides = {}) =>
    request(app)
      .post('/api/v1/teacher/assessments')
      .set('Cookie', teacherCookie)
      .send({
        classId,
        subject: 'Science',
        title: 'Unit Test 1',
        assessmentType: 'class_test',
        maxMarks: 20,
        ...overrides,
      });

  describe('POST /api/v1/teacher/assessments', () => {
    it('201 — creates an assessment with title, date and author', async () => {
      const res = await createAssessment();

      expect(res.statusCode).toBe(201);
      expect(res.body.data.assessment.title).toBe('Unit Test 1');
      expect(res.body.data.assessment.maxMarks).toBe(20);
      expect(res.body.data.assessment.date).toBeTruthy();
      expect(res.body.data.assessment.createdBy).toBeTruthy();
    });

    it('422 — title is required', async () => {
      const res = await createAssessment({ title: '' });
      expect(res.statusCode).toBe(422);
    });

    it('422 — maxMarks must be at least 1', async () => {
      const res = await createAssessment({ maxMarks: 0 });
      expect(res.statusCode).toBe(422);
    });

    // Governance guard — term exams belong to the Exam → Report Card pipeline,
    // which gates visibility on an admin publish. DO NOT DELETE.
    it.each(['final', 'midterm'])(
      '422 — assessmentType "%s" is rejected (exam types are not coursework)',
      async (bannedType) => {
        const res = await createAssessment({ assessmentType: bannedType });
        expect(res.statusCode).toBe(422);
      }
    );

    it('403 — a teacher not assigned to the class is rejected', async () => {
      await request(app)
        .post('/api/v1/admin/teachers')
        .set('Cookie', adminCookie)
        .send(TEACHER2_DATA);
      await setKnownPassword(TEACHER2_DATA.email, TEACHER2_DATA.password);
      const { cookie: otherCookie } = await loginUser(
        TEACHER2_DATA.email,
        TEACHER2_DATA.password
      );

      const res = await request(app)
        .post('/api/v1/teacher/assessments')
        .set('Cookie', otherCookie)
        .send({
          classId,
          subject: 'Science',
          title: 'Sneaky Test',
          maxMarks: 10,
        });

      expect(res.statusCode).toBe(403);
    });

    it('allows two assessments of the same type in one subject', async () => {
      // The defect the flat model had: its unique key was
      // (student, subject, class, type), so the second class test overwrote the first.
      const first = await createAssessment({ title: 'Unit Test 1' });
      const second = await createAssessment({ title: 'Unit Test 2' });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(first.body.data.assessment._id).not.toBe(second.body.data.assessment._id);
    });
  });

  describe('PUT /api/v1/teacher/assessments/:id/scores', () => {
    it('200 — saves scores, remarks and absences', async () => {
      const created = await createAssessment();
      const id = created.body.data.assessment._id;

      const res = await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({
          scores: [{ studentId, marksObtained: 18, remarks: 'Good work' }],
        });

      expect(res.statusCode).toBe(200);
      const row = res.body.data.students.find((r) => r.studentId === String(studentId));
      expect(row.marksObtained).toBe(18);
      expect(row.remarks).toBe('Good work');
      expect(res.body.data.classAverage).toBeCloseTo(90, 1);
    });

    it('200 — an absent student stores no mark and is excluded from the average', async () => {
      const created = await createAssessment();
      const id = created.body.data.assessment._id;

      const res = await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({ scores: [{ studentId, absent: true }] });

      expect(res.statusCode).toBe(200);
      const row = res.body.data.students.find((r) => r.studentId === String(studentId));
      expect(row.absent).toBe(true);
      expect(row.marksObtained).toBeNull();
      // Only student was absent, so there is nothing to average.
      expect(res.body.data.classAverage).toBeNull();
    });

    it('422 — a score above maxMarks is rejected', async () => {
      const created = await createAssessment({ maxMarks: 20 });
      const id = created.body.data.assessment._id;

      const res = await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({ scores: [{ studentId, marksObtained: 21 }] });

      expect(res.statusCode).toBe(422);
    });

    it('200 — a project scored out of 150 is accepted', async () => {
      const created = await createAssessment({
        title: 'Model Project',
        assessmentType: 'project',
        maxMarks: 150,
      });
      const id = created.body.data.assessment._id;

      const res = await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({ scores: [{ studentId, marksObtained: 128 }] });

      expect(res.statusCode).toBe(200);
      const row = res.body.data.students.find((r) => r.studentId === String(studentId));
      expect(row.marksObtained).toBe(128);
    });

    it('re-saving updates in place rather than duplicating', async () => {
      const created = await createAssessment();
      const id = created.body.data.assessment._id;

      await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({ scores: [{ studentId, marksObtained: 12 }] });

      const res = await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({ scores: [{ studentId, marksObtained: 19 }] });

      const rows = res.body.data.students.filter((r) => r.studentId === String(studentId));
      expect(rows).toHaveLength(1);
      expect(rows[0].marksObtained).toBe(19);
    });
  });

  describe('GET /api/v1/teacher/assessments', () => {
    it('200 — lists own assessments with how many scores are entered', async () => {
      const created = await createAssessment();
      const id = created.body.data.assessment._id;
      await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({ scores: [{ studentId, marksObtained: 15 }] });

      const res = await request(app)
        .get('/api/v1/teacher/assessments')
        .query({ classId })
        .set('Cookie', teacherCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.assessments).toHaveLength(1);
      expect(res.body.data.assessments[0].scoresEntered).toBe(1);
    });

    it('401 — unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/v1/teacher/assessments');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/teacher/assessments/:id', () => {
    it('200 — correcting the title fixes it for every student at once', async () => {
      const created = await createAssessment({ title: 'Unit Tst 1' });
      const id = created.body.data.assessment._id;

      const res = await request(app)
        .put(`/api/v1/teacher/assessments/${id}`)
        .set('Cookie', teacherCookie)
        .send({ title: 'Unit Test 1' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.assessment.title).toBe('Unit Test 1');
    });

    it('422 — cannot lower maxMarks below a score already recorded', async () => {
      const created = await createAssessment({ maxMarks: 20 });
      const id = created.body.data.assessment._id;
      await request(app)
        .put(`/api/v1/teacher/assessments/${id}/scores`)
        .set('Cookie', teacherCookie)
        .send({ scores: [{ studentId, marksObtained: 18 }] });

      const res = await request(app)
        .put(`/api/v1/teacher/assessments/${id}`)
        .set('Cookie', teacherCookie)
        .send({ maxMarks: 10 });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('DELETE /api/v1/teacher/assessments/:id', () => {
    it('204 — soft-deletes and removes it from the list', async () => {
      const created = await createAssessment();
      const id = created.body.data.assessment._id;

      const del = await request(app)
        .delete(`/api/v1/teacher/assessments/${id}`)
        .set('Cookie', teacherCookie);
      expect(del.statusCode).toBe(204);

      const res = await request(app)
        .get('/api/v1/teacher/assessments')
        .set('Cookie', teacherCookie);
      expect(res.body.data.assessments).toHaveLength(0);
    });
  });
});

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
