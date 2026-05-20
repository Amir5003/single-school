const request = require('supertest');
const app = require('../../src/app');
const { createSchool, createSchoolAdmin, createStudent, getAuthCookies } = require('../helpers');
const Class = require('../../src/models/Class.model');
const Exam = require('../../src/models/Exam.model');
const Result = require('../../src/models/Result.model');
const User = require('../../src/models/User.model');

describe('Student Results API', () => {
  let school, adminUser, adminCookies, studentUser, studentCookies, cls, exam, student;

  beforeEach(async () => {
    school = await createSchool();
    adminUser = await createSchoolAdmin(school._id);
    adminCookies = getAuthCookies(adminUser);
    cls = await Class.create({ schoolId: school._id, name: 'Class 9A', grade: '9', section: 'A', academicYear: '2024-25' });
    const s = await createStudent(school._id, cls._id);
    studentUser = s.user;
    student = s.student;
    studentCookies = getAuthCookies(studentUser);

    exam = await Exam.create({
      schoolId: school._id,
      classId: cls._id,
      name: 'Term 1 2024',
      year: 2024,
      term: 'Term 1',
      subjects: [{ name: 'Math', totalMarks: 100 }, { name: 'Science', totalMarks: 80 }],
      publishedAt: new Date(),
    });

    // Insert a result
    await Result.create({
      schoolId: school._id,
      examId: exam._id,
      studentId: student._id,
      marks: [{ subject: 'Math', marksObtained: 72 }, { subject: 'Science', marksObtained: 60 }],
      overallPercentage: 72.5,
    });
  });

  // ── Exam years ───────────────────────────────────────────────────────────────
  describe('GET /api/v1/student/exams/years', () => {
    it('200 — returns years for school', async () => {
      const res = await request(app)
        .get('/api/v1/student/exams/years')
        .set('Cookie', studentCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.years).toContain(2024);
    });
  });

  // ── Student exam list ────────────────────────────────────────────────────────
  describe('GET /api/v1/student/exams', () => {
    it('200 — returns exams for student class', async () => {
      const res = await request(app)
        .get('/api/v1/student/exams?year=2024')
        .set('Cookie', studentCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.exams.length).toBeGreaterThan(0);
    });
  });

  // ── Student result ───────────────────────────────────────────────────────────
  describe('GET /api/v1/student/results', () => {
    it('200 — returns result with pass/fail for own exam', async () => {
      const res = await request(app)
        .get(`/api/v1/student/results?examId=${exam._id}`)
        .set('Cookie', studentCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.marks).toBeDefined();
      expect(res.body.data.marks[0]).toHaveProperty('passed');
    });

    it('404 — no result for non-existent exam ID', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .get(`/api/v1/student/results?examId=${fakeId}`)
        .set('Cookie', studentCookies);
      expect(res.status).toBe(404);
    });
  });

  // ── Cross-tenant isolation ───────────────────────────────────────────────────
  describe('Cross-tenant isolation', () => {
    it('404 — student from school A cannot get years from school B', async () => {
      const schoolB = await createSchool();
      const clsB = await Class.create({ schoolId: schoolB._id, name: 'Class 1', grade: '1', section: 'A', academicYear: '2024-25' });
      await Exam.create({ schoolId: schoolB._id, classId: clsB._id, name: 'B Exam', year: 2025, term: 'Term 1', subjects: [{ name: 'Math', totalMarks: 100 }] });

      // school A student cookie — schoolId in JWT differs from exam's schoolId
      const res = await request(app)
        .get('/api/v1/student/exams/years')
        .set('Cookie', studentCookies); // school A cookie

      // School B's exams should NOT appear in school A student's years response
      expect(res.status).toBe(200);
      const years = res.body.data.years;
      expect(years).not.toContain(2025);
    });

    it('404 — student from school A cannot read school B exam result', async () => {
      const schoolB = await createSchool();
      const clsB = await Class.create({ schoolId: schoolB._id, name: 'Class 1', grade: '1', section: 'A', academicYear: '2024-25' });
      const examB = await Exam.create({ schoolId: schoolB._id, classId: clsB._id, name: 'B Exam', year: 2025, term: 'Term 1', subjects: [{ name: 'Math', totalMarks: 100 }] });

      const res = await request(app)
        .get(`/api/v1/student/results?examId=${examB._id}`)
        .set('Cookie', studentCookies);
      expect([403, 404]).toContain(res.status);
    });
  });
});
