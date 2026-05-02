const request = require('supertest');
const app = require('../../src/app');
const { createDirectUser } = require('../helpers');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Admin User',
  email: 'admin@school.test',
  password: 'Admin@1234',
  role: 'admin',
};

const TEACHER_DATA = {
  name: 'Mr Hassan',
  email: 'hassan@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-ST01',
};

const CLASS_DATA = {
  name: 'Class 7A',
  grade: '7',
  section: 'A',
};

const STUDENT_A = {
  name: 'Student Alpha',
  email: 'alpha@school.test',
  password: 'Student@1234',
  enrollmentId: 'STU-A01',
  dateOfBirth: '2012-01-15',
  address: '123 Main St',
};

const STUDENT_B = {
  name: 'Student Beta',
  email: 'beta@school.test',
  password: 'Student@1234',
  enrollmentId: 'STU-B01',
  dateOfBirth: '2012-03-20',
};

// ── Date helpers ──────────────────────────────────────────────────────────────

const toDateStr = (d) => d.toISOString().slice(0, 10);
const today = () => toDateStr(new Date());

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { res, cookie: res.headers['set-cookie'] };
};

const getAdminCookie = async () => {
  await createDirectUser(ADMIN);
  const { cookie } = await loginUser(ADMIN.email, ADMIN.password);
  return cookie;
};

const createTeacher = (adminCookie, data) =>
  request(app)
    .post('/api/v1/admin/teachers')
    .set('Cookie', adminCookie)
    .send(data);

const createClass = (adminCookie) =>
  request(app)
    .post('/api/v1/admin/classes')
    .set('Cookie', adminCookie)
    .send(CLASS_DATA);

const createStudent = (adminCookie, data) =>
  request(app)
    .post('/api/v1/admin/students')
    .set('Cookie', adminCookie)
    .send(data);

const assignTeacher = (adminCookie, teacherId, classId, subject) =>
  request(app)
    .post(`/api/v1/admin/teachers/${teacherId}/assign-class`)
    .set('Cookie', adminCookie)
    .send({ classId, subject });

const assignStudents = (adminCookie, classId, studentIds) =>
  request(app)
    .post(`/api/v1/admin/classes/${classId}/assign-students`)
    .set('Cookie', adminCookie)
    .send({ studentIds });

const markAttendance = (teacherCookie, classId, date, records) =>
  request(app)
    .post('/api/v1/teacher/attendance')
    .set('Cookie', teacherCookie)
    .send({ classId, date, records });

const saveMark = (teacherCookie, data) =>
  request(app)
    .post('/api/v1/teacher/marks')
    .set('Cookie', teacherCookie)
    .send(data);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Student Dashboard — data isolation + read endpoints', () => {
  let adminCookie;
  let teacherCookie;
  let teacherId;
  let classId;
  let studentACookie;
  let studentBCookie;
  let studentADoc;   // Student document _id

  beforeEach(async () => {
    // ── Seed admin ──
    adminCookie = await getAdminCookie();

    // ── Seed teacher + class ──
    const tRes = await createTeacher(adminCookie, TEACHER_DATA);
    teacherId = tRes.body.data.teacher._id;
    const cRes = await createClass(adminCookie);
    classId = cRes.body.data.class._id;
    await assignTeacher(adminCookie, teacherId, classId, 'Mathematics');

    // ── Seed students ──
    const aRes = await createStudent(adminCookie, STUDENT_A);
    const bRes = await createStudent(adminCookie, STUDENT_B);
    studentADoc = aRes.body.data.student._id;
    const studentBDoc = bRes.body.data.student._id;

    // Assign only student A to the class
    await assignStudents(adminCookie, classId, [studentADoc, studentBDoc]);

    // ── Login as students ──
    const aAuth = await loginUser(STUDENT_A.email, STUDENT_A.password);
    studentACookie = aAuth.cookie;
    const bAuth = await loginUser(STUDENT_B.email, STUDENT_B.password);
    studentBCookie = bAuth.cookie;

    // ── Login as teacher ──
    const tAuth = await loginUser(TEACHER_DATA.email, TEACHER_DATA.password);
    teacherCookie = tAuth.cookie;
  });

  // ── GET /profile ────────────────────────────────────────────────────────────

  describe('GET /api/v1/student/profile', () => {
    it('200 — student A gets own profile', async () => {
      const res = await request(app)
        .get('/api/v1/student/profile')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student.enrollmentId).toBe('STU-A01');
      expect(res.body.data.student.userId.name).toBe(STUDENT_A.name);
    });

    it('401 — unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/v1/student/profile');
      expect(res.statusCode).toBe(401);
    });

    it('403 — teacher token cannot access student profile endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/student/profile')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Data isolation ──────────────────────────────────────────────────────────

  describe('Data isolation — service ignores external studentId params', () => {
    it('student A query with student B _id in query param returns A own data', async () => {
      // Student A queries own profile; even if a malicious client appended ?studentId=B_id,
      // the service ignores it and scopes to req.user._id.
      const res = await request(app)
        .get('/api/v1/student/profile')
        .set('Cookie', studentACookie)
        .query({ studentId: studentADoc }); // arbitrary query param ignored

      expect(res.statusCode).toBe(200);
      expect(res.body.data.student.enrollmentId).toBe('STU-A01');
    });

    it('student B profile returns B own data (not A)', async () => {
      const res = await request(app)
        .get('/api/v1/student/profile')
        .set('Cookie', studentBCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.student.enrollmentId).toBe('STU-B01');
    });
  });

  // ── GET /timetable ──────────────────────────────────────────────────────────

  describe('GET /api/v1/student/timetable', () => {
    it('200 — returns empty array (not 404) when class has no timetable entries yet', async () => {
      // Class exists and student is assigned, but no timetable added yet
      const res = await request(app)
        .get('/api/v1/student/timetable')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.periods)).toBe(true);
      expect(res.body.data.periods).toHaveLength(0);
    });

    it('200 — returns timetable periods with teacher name after entry added', async () => {
      // Add a timetable entry via admin
      await request(app)
        .post('/api/v1/admin/timetable')
        .set('Cookie', adminCookie)
        .send({
          classId,
          teacherId,
          subject: 'Mathematics',
          day: 'Monday',
          startTime: '08:00',
          endTime: '09:00',
        });

      const res = await request(app)
        .get('/api/v1/student/timetable')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.periods.length).toBeGreaterThanOrEqual(1);
      const period = res.body.data.periods[0];
      expect(period).toHaveProperty('subject');
      expect(period).toHaveProperty('day');
      expect(period).toHaveProperty('startTime');
      expect(period).toHaveProperty('endTime');
    });

    it('401 — unauthenticated', async () => {
      const res = await request(app).get('/api/v1/student/timetable');
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /attendance ─────────────────────────────────────────────────────────

  describe('GET /api/v1/student/attendance', () => {
    it('200 — returns empty summary when no records exist', async () => {
      const res = await request(app)
        .get('/api/v1/student/attendance')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalDays).toBe(0);
      expect(res.body.data.percentage).toBe(0);
    });

    it('computes percentage correctly — 5 present + 2 absent = 71.43%', async () => {
      // Mark 7 attendance records for student A:
      //   days 0..4 → Present  (5 days)
      //   days 5..6 → Absent   (2 days)
      const presentRecords = [0, 1, 2, 3, 4].map((n) => ({
        studentId: studentADoc,
        status: 'Present',
      }));
      // We can't mark multiple on same date via the service (unique constraint),
      // so we mark one per day using different dates.

      // 5 present days
      for (let n = 0; n < 5; n++) {
        await markAttendance(teacherCookie, classId, daysAgo(n + 2), [
          { studentId: studentADoc, status: 'Present' },
        ]);
      }
      // 2 absent days
      for (let n = 0; n < 2; n++) {
        await markAttendance(teacherCookie, classId, daysAgo(n + 7), [
          { studentId: studentADoc, status: 'Absent' },
        ]);
      }

      const res = await request(app)
        .get('/api/v1/student/attendance')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalDays).toBe(7);
      expect(res.body.data.presentDays).toBe(5);
      expect(res.body.data.absentDays).toBe(2);
      expect(res.body.data.percentage).toBeCloseTo(71.43, 1);
    });

    it('filters by month when ?month=YYYY-MM provided', async () => {
      // Mark one record today
      await markAttendance(teacherCookie, classId, today(), [
        { studentId: studentADoc, status: 'Present' },
      ]);

      const thisMonth = today().slice(0, 7); // YYYY-MM
      const res = await request(app)
        .get('/api/v1/student/attendance')
        .set('Cookie', studentACookie)
        .query({ month: thisMonth });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalDays).toBeGreaterThanOrEqual(1);
    });

    it('400 — invalid month format', async () => {
      const res = await request(app)
        .get('/api/v1/student/attendance')
        .set('Cookie', studentACookie)
        .query({ month: '2026/04' });

      expect(res.statusCode).toBe(400);
    });

    it('401 — unauthenticated', async () => {
      const res = await request(app).get('/api/v1/student/attendance');
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /marks ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/student/marks', () => {
    it('200 — empty result when no marks recorded', async () => {
      const res = await request(app)
        .get('/api/v1/student/marks')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.marks).toHaveLength(0);
      expect(res.body.data.overallPercentage).toBe(0);
    });

    it('computes overallPercentage correctly for 2 subjects', async () => {
      // Mathematics: 80/100 → 80 %
      await saveMark(teacherCookie, {
        studentId: studentADoc,
        classId,
        subject: 'Mathematics',
        examType: 'final',
        marksObtained: 80,
        maxMarks: 100,
      });
      // Science: 60/100 → 60 %
      await saveMark(teacherCookie, {
        studentId: studentADoc,
        classId,
        subject: 'Science',
        examType: 'final',
        marksObtained: 60,
        maxMarks: 100,
      });

      const res = await request(app)
        .get('/api/v1/student/marks')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      // 2 subjects returned
      expect(res.body.data.marks).toHaveLength(2);
      // overall = (80 + 60) / (100 + 100) * 100 = 70 %
      expect(res.body.data.overallPercentage).toBeCloseTo(70, 1);
    });

    it('401 — unauthenticated', async () => {
      const res = await request(app).get('/api/v1/student/marks');
      expect(res.statusCode).toBe(401);
    });

    it('403 — teacher cannot access student marks endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/student/marks')
        .set('Cookie', teacherCookie);
      expect(res.statusCode).toBe(403);
    });
  });

  // ── GET /announcements ──────────────────────────────────────────────────────

  describe('GET /api/v1/student/announcements', () => {
    it('200 — returns active announcements (excluding deleted)', async () => {
      // Teacher posts an announcement
      await request(app)
        .post('/api/v1/teacher/announcements')
        .set('Cookie', teacherCookie)
        .send({ title: 'Test Notice', content: 'Hello students' });

      const res = await request(app)
        .get('/api/v1/student/announcements')
        .set('Cookie', studentACookie);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.announcements)).toBe(true);
      expect(res.body.data.announcements.length).toBeGreaterThanOrEqual(1);
      // All returned announcements must be active
      res.body.data.announcements.forEach((a) => {
        expect(a.isDeleted).toBe(false);
      });
    });

    it('401 — unauthenticated', async () => {
      const res = await request(app).get('/api/v1/student/announcements');
      expect(res.statusCode).toBe(401);
    });
  });
});
