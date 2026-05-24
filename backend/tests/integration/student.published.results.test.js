const request = require('supertest');
const app = require('../../src/app');
const {
  createSchool,
  createSchoolAdmin,
  createStudent,
  getAuthCookies,
} = require('../helpers');
const Class = require('../../src/models/Class.model');
const Exam = require('../../src/models/Exam.model');
const Result = require('../../src/models/Result.model');

describe('Student Published Results Gating', () => {
  let school, adminUser, adminCookies, studentUser, studentCookies, cls, student;

  beforeEach(async () => {
    school = await createSchool();
    adminUser = await createSchoolAdmin(school._id);
    adminCookies = getAuthCookies(adminUser);
    cls = await Class.create({
      schoolId: school._id,
      name: '8A',
      grade: '8',
      section: 'A',
      academicYear: '2024-25',
    });
    const s = await createStudent(school._id, cls._id);
    studentUser = s.user;
    student = s.student;
    studentCookies = getAuthCookies(studentUser);
  });

  describe('Pre-publish visibility', () => {
    it('404 — student cannot see a result for a draft/active exam', async () => {
      const exam = await Exam.create({
        schoolId: school._id,
        classId: cls._id,
        name: 'Mid-Term',
        year: 2026,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100 }],
        state: 'active',
      });
      await Result.create({
        schoolId: school._id,
        examId: exam._id,
        studentId: student._id,
        marks: [{ subject: 'Math', marksObtained: 70 }],
        overallPercentage: 70,
        published: false,
      });

      const res = await request(app)
        .get(`/api/v1/student/results?examId=${exam._id}`)
        .set('Cookie', studentCookies);
      expect(res.status).toBe(404);
    });

    it('200 — student sees result once exam is published', async () => {
      const exam = await Exam.create({
        schoolId: school._id,
        classId: cls._id,
        name: 'Mid-Term',
        year: 2026,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100 }],
        state: 'published',
        publishedAt: new Date(),
      });
      await Result.create({
        schoolId: school._id,
        examId: exam._id,
        studentId: student._id,
        marks: [{ subject: 'Math', marksObtained: 80 }],
        overallPercentage: 80,
        published: true,
      });

      const res = await request(app)
        .get(`/api/v1/student/results?examId=${exam._id}`)
        .set('Cookie', studentCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.marks[0].marksObtained).toBe(80);
    });
  });

  describe('Year filter', () => {
    it('only returns years with at least one published exam', async () => {
      await Exam.create({
        schoolId: school._id,
        classId: cls._id,
        name: 'Old Active',
        year: 2025,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100 }],
        state: 'active',
      });
      await Exam.create({
        schoolId: school._id,
        classId: cls._id,
        name: 'New Published',
        year: 2026,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100 }],
        state: 'published',
        publishedAt: new Date(),
      });
      const res = await request(app)
        .get('/api/v1/student/exams/years')
        .set('Cookie', studentCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.years).toContain(2026);
      expect(res.body.data.years).not.toContain(2025);
    });
  });

  describe('Report card payload', () => {
    it('200 — returns school+student+exam+marks payload', async () => {
      const exam = await Exam.create({
        schoolId: school._id,
        classId: cls._id,
        name: 'Mid-Term',
        year: 2026,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100, passMark: 35 }],
        state: 'published',
        publishedAt: new Date(),
      });
      await Result.create({
        schoolId: school._id,
        examId: exam._id,
        studentId: student._id,
        marks: [{ subject: 'Math', marksObtained: 88 }],
        overallPercentage: 88,
        published: true,
      });
      const res = await request(app)
        .get(`/api/v1/student/results/${exam._id}/report-card`)
        .set('Cookie', studentCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.school.name).toBeDefined();
      expect(res.body.data.student.enrollmentId).toBe(student.enrollmentId);
      expect(res.body.data.marks).toHaveLength(1);
      expect(res.body.data.marks[0].passed).toBe(true);
      expect(res.body.data.percentage).toBe(88);
      expect(res.body.data.passed).toBe(true);
    });

    it('404 — report card not available for unpublished exam', async () => {
      const exam = await Exam.create({
        schoolId: school._id,
        classId: cls._id,
        name: 'Active Exam',
        year: 2026,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100 }],
        state: 'active',
      });
      const res = await request(app)
        .get(`/api/v1/student/results/${exam._id}/report-card`)
        .set('Cookie', studentCookies);
      expect(res.status).toBe(404);
    });
  });

  describe('Cross-tenant isolation', () => {
    it('404 — student in school A cannot read school B published result', async () => {
      const schoolB = await createSchool();
      const clsB = await Class.create({
        schoolId: schoolB._id,
        name: '8B',
        grade: '8',
        section: 'B',
        academicYear: '2024-25',
      });
      const sB = await createStudent(schoolB._id, clsB._id);
      const examB = await Exam.create({
        schoolId: schoolB._id,
        classId: clsB._id,
        name: 'B Exam',
        year: 2026,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100 }],
        state: 'published',
        publishedAt: new Date(),
      });
      await Result.create({
        schoolId: schoolB._id,
        examId: examB._id,
        studentId: sB.student._id,
        marks: [{ subject: 'Math', marksObtained: 50 }],
        overallPercentage: 50,
        published: true,
      });
      const res = await request(app)
        .get(`/api/v1/student/results?examId=${examB._id}`)
        .set('Cookie', studentCookies); // school A student
      expect([403, 404]).toContain(res.status);
    });
  });
});
