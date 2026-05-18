const request = require('supertest');
const app = require('../../src/app');
const {
  createSchool,
  createSchoolAdmin,
  createTeacher,
  createStudent,
  getAuthCookies,
} = require('../helpers');
const Homework = require('../../src/models/Homework.model');
const Class = require('../../src/models/Class.model');
const Teacher = require('../../src/models/Teacher.model');

let school, adminCookie, teacherCookie, teacherDocId, studentCookie, classId;

beforeEach(async () => {
  school = await createSchool();

  const admin = await createSchoolAdmin(school._id);
  adminCookie = getAuthCookies(admin);

  const { user: teacherUser, teacher } = await createTeacher(school._id);
  teacherCookie = getAuthCookies(teacherUser);
  teacherDocId = teacher._id;

  const cls = await Class.create({
    schoolId: school._id,
    name: 'ClassA',
    grade: '5',
    section: 'A',
    academicYear: '2024-2025',
  });
  classId = cls._id;

  const { user: studentUser } = await createStudent(school._id, classId);
  studentCookie = getAuthCookies(studentUser);
});

// ── Create Homework (Teacher) ─────────────────────────────────────────────────

describe('POST /api/v1/teacher/homework', () => {
  it('201 — teacher creates homework without attachments', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/homework')
      .set('Cookie', teacherCookie)
      .field('classId', classId.toString())
      .field('title', 'Chapter 5 Exercises')
      .field('dueDate', '2025-12-20');

    expect(res.statusCode).toBe(201);
    expect(res.body.data.homework.title).toBe('Chapter 5 Exercises');
    expect(res.body.data.homework.attachments).toHaveLength(0);
    expect(res.body.data.homework.isDeleted).toBe(false);
  });

  it('422 — missing classId is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/homework')
      .set('Cookie', teacherCookie)
      .field('title', 'Test')
      .field('dueDate', '2025-12-20');

    expect(res.statusCode).toBe(422);
  });

  it('401 — unauthenticated teacher is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/homework')
      .field('classId', classId.toString())
      .field('title', 'Test')
      .field('dueDate', '2025-12-20');

    expect(res.statusCode).toBe(401);
  });
});

// ── List Homework (Teacher) ───────────────────────────────────────────────────

describe('GET /api/v1/teacher/homework', () => {
  it('200 — returns homework for the given class', async () => {
    await Homework.create({
      schoolId: school._id,
      classId,
      teacherId: teacherDocId,
      title: 'Essay 1',
      dueDate: new Date('2025-11-01'),
    });

    const res = await request(app)
      .get(`/api/v1/teacher/homework?classId=${classId}`)
      .set('Cookie', teacherCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.homework.length).toBeGreaterThanOrEqual(1);
  });

  it('400 — missing classId query param returns error', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/homework')
      .set('Cookie', teacherCookie);

    expect(res.statusCode).toBe(400);
  });
});

// ── Delete Homework (Teacher) ─────────────────────────────────────────────────

describe('DELETE /api/v1/teacher/homework/:id', () => {
  it('200 — teacher can soft-delete own homework', async () => {
    const hw = await Homework.create({
      schoolId: school._id,
      classId,
      teacherId: teacherDocId,
      title: 'Delete me',
      dueDate: new Date('2025-11-01'),
    });

    const res = await request(app)
      .delete(`/api/v1/teacher/homework/${hw._id}`)
      .set('Cookie', teacherCookie);

    expect(res.statusCode).toBe(200);
    const updated = await Homework.findById(hw._id);
    expect(updated.isDeleted).toBe(true);
  });

  it('404 — teacher cannot delete another teacher\'s homework', async () => {
    const { user: otherTeacherUser, teacher: otherTeacher } = await createTeacher(school._id);
    const otherHw = await Homework.create({
      schoolId: school._id,
      classId,
      teacherId: otherTeacher._id,
      title: 'Not mine',
      dueDate: new Date('2025-11-01'),
    });

    const res = await request(app)
      .delete(`/api/v1/teacher/homework/${otherHw._id}`)
      .set('Cookie', teacherCookie);

    expect(res.statusCode).toBe(404);
  });
});

// ── Student Views Homework ────────────────────────────────────────────────────

describe('GET /api/v1/student/homework', () => {
  it('200 — student can see homework for their class', async () => {
    await Homework.create({
      schoolId: school._id,
      classId,
      teacherId: teacherDocId,
      title: 'Student HW',
      dueDate: new Date('2025-11-01'),
    });

    const res = await request(app)
      .get('/api/v1/student/homework')
      .set('Cookie', studentCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.homework.length).toBeGreaterThanOrEqual(1);
  });
});
