const request = require('supertest');
const app = require('../../src/app');
const {
  createSchool,
  createSchoolAdmin,
  createTeacher,
  createStudent,
  getAuthCookies,
} = require('../helpers');
const Notification = require('../../src/models/Notification.model');

let school, adminUser, adminCookie, teacherUser, teacherCookie, studentUser, studentCookie;

beforeEach(async () => {
  school = await createSchool();

  adminUser = await createSchoolAdmin(school._id);
  adminCookie = getAuthCookies(adminUser);

  const { user: tu } = await createTeacher(school._id);
  teacherUser = tu;
  teacherCookie = getAuthCookies(tu);

  const Class = require('../../src/models/Class.model');
  const cls = await Class.create({
    schoolId: school._id,
    name: 'ClassA',
    grade: '5',
    section: 'A',
    academicYear: '2024-2025',
  });

  const { user: su } = await createStudent(school._id, cls._id);
  studentUser = su;
  studentCookie = getAuthCookies(su);
});

// ── Send Notification (Admin) ─────────────────────────────────────────────────

describe('POST /api/v1/admin/notifications', () => {
  it('201 — admin sends notification to student role', async () => {
    const res = await request(app)
      .post('/api/v1/admin/notifications')
      .set('Cookie', adminCookie)
      .send({ targetRole: 'student', title: 'Exam Notice', body: 'Exams start Monday.' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.notification.targetRole).toBe('student');
    expect(res.body.data.notification.title).toBe('Exam Notice');
  });

  it('201 — admin sends notification to all roles', async () => {
    const res = await request(app)
      .post('/api/v1/admin/notifications')
      .set('Cookie', adminCookie)
      .send({ targetRole: 'all', title: 'Holiday Notice', body: 'School closed Friday.' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.notification.targetRole).toBe('all');
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/admin/notifications')
      .send({ targetRole: 'all', title: 'Test', body: 'Test' });

    expect(res.statusCode).toBe(401);
  });
});

// ── List Notifications (Student) ──────────────────────────────────────────────

describe('GET /api/v1/student/notifications', () => {
  it('200 — student receives own-role notifications and "all" notifications', async () => {
    await Notification.create([
      {
        schoolId: school._id,
        senderId: adminUser._id,
        targetRole: 'student',
        title: 'For Students',
        body: 'Hello students',
      },
      {
        schoolId: school._id,
        senderId: adminUser._id,
        targetRole: 'all',
        title: 'For Everyone',
        body: 'Hello everyone',
      },
      {
        schoolId: school._id,
        senderId: adminUser._id,
        targetRole: 'teacher',
        title: 'For Teachers',
        body: 'Hello teachers',
      },
    ]);

    const res = await request(app)
      .get('/api/v1/student/notifications')
      .set('Cookie', studentCookie);

    expect(res.statusCode).toBe(200);
    const roles = res.body.data.notifications.map((n) => n.targetRole);
    // Student should see 'student' and 'all' but NOT 'teacher'
    expect(roles).toContain('student');
    expect(roles).toContain('all');
    expect(roles).not.toContain('teacher');
  });
});

// ── Mark Read (Student) ───────────────────────────────────────────────────────

describe('PATCH /api/v1/student/notifications/:id/read', () => {
  it('200 — marks notification as read (idempotent)', async () => {
    const notif = await Notification.create({
      schoolId: school._id,
      senderId: adminUser._id,
      targetRole: 'student',
      title: 'Read Test',
      body: 'Mark me read',
    });

    // First mark
    const res1 = await request(app)
      .patch(`/api/v1/student/notifications/${notif._id}/read`)
      .set('Cookie', studentCookie);

    expect(res1.statusCode).toBe(200);
    expect(res1.body.data.notification.readBy).toContain(studentUser._id.toString());

    // Second mark (idempotent — readBy should not have duplicate)
    const res2 = await request(app)
      .patch(`/api/v1/student/notifications/${notif._id}/read`)
      .set('Cookie', studentCookie);

    expect(res2.statusCode).toBe(200);
    const readBy = res2.body.data.notification.readBy;
    const occurrences = readBy.filter((id) => id === studentUser._id.toString()).length;
    expect(occurrences).toBe(1);
  });
});

// ── Teacher Notifications ─────────────────────────────────────────────────────

describe('GET /api/v1/teacher/notifications', () => {
  it('200 — teacher sees teacher and "all" notifications', async () => {
    await Notification.create([
      {
        schoolId: school._id,
        senderId: adminUser._id,
        targetRole: 'teacher',
        title: 'Teacher Notice',
        body: 'For teachers',
      },
      {
        schoolId: school._id,
        senderId: adminUser._id,
        targetRole: 'all',
        title: 'All Notice',
        body: 'For all',
      },
    ]);

    const res = await request(app)
      .get('/api/v1/teacher/notifications')
      .set('Cookie', teacherCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(2);
    const roles = res.body.data.notifications.map((n) => n.targetRole);
    expect(roles).toContain('teacher');
    expect(roles).toContain('all');
  });
});
