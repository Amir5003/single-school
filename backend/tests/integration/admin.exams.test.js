const request = require('supertest');
const app = require('../../src/app');
const { createSchool, createSchoolAdmin, createStudent, getAuthCookies } = require('../helpers');
const Class = require('../../src/models/Class.model');
const Exam = require('../../src/models/Exam.model');
const Result = require('../../src/models/Result.model');

describe('Admin Exams API', () => {
  let school, adminUser, adminCookies, cls;

  beforeEach(async () => {
    school = await createSchool();
    adminUser = await createSchoolAdmin(school._id);
    adminCookies = getAuthCookies(adminUser);
    cls = await Class.create({ schoolId: school._id, name: 'Class 10A', grade: '10', section: 'A', academicYear: '2024-25' });
  });

  // ── Create exam ──────────────────────────────────────────────────────────────
  describe('POST /api/v1/admin/exams', () => {
    it('201 — creates exam with valid body', async () => {
      const res = await request(app)
        .post('/api/v1/admin/exams')
        .set('Cookie', adminCookies)
        .send({
          name: 'Term 1 Exam',
          year: 2024,
          term: 'Term 1',
          classId: cls._id.toString(),
          subjects: [{ name: 'Math', totalMarks: 100 }, { name: 'Science', totalMarks: 80 }],
        });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ name: 'Term 1 Exam', year: 2024, term: 'Term 1' });
    });

    it('422 — validation error on missing name', async () => {
      const res = await request(app)
        .post('/api/v1/admin/exams')
        .set('Cookie', adminCookies)
        .send({ year: 2024, term: 'Term 1', classId: cls._id.toString(), subjects: [{ name: 'Math', totalMarks: 100 }] });
      expect(res.status).toBe(422);
    });

    it('422 — validation error on invalid term', async () => {
      const res = await request(app)
        .post('/api/v1/admin/exams')
        .set('Cookie', adminCookies)
        .send({ name: 'Exam', year: 2024, term: 'Invalid', classId: cls._id.toString(), subjects: [{ name: 'Math', totalMarks: 100 }] });
      expect(res.status).toBe(422);
    });
  });

  // ── List exams ───────────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/exams', () => {
    it('200 — lists exams for school', async () => {
      await Exam.create({ schoolId: school._id, classId: cls._id, name: 'Mid-Year', year: 2024, term: 'Mid-Year', subjects: [{ name: 'Math', totalMarks: 100 }] });
      const res = await request(app)
        .get('/api/v1/admin/exams')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.exams.length).toBeGreaterThan(0);
    });

    it('200 — filters by year', async () => {
      await Exam.create({ schoolId: school._id, classId: cls._id, name: 'Exam 2023', year: 2023, term: 'Term 1', subjects: [{ name: 'Math', totalMarks: 100 }] });
      await Exam.create({ schoolId: school._id, classId: cls._id, name: 'Exam 2024', year: 2024, term: 'Term 2', subjects: [{ name: 'Math', totalMarks: 100 }] });
      const res = await request(app)
        .get('/api/v1/admin/exams?year=2023')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.exams.every((e) => e.year === 2023)).toBe(true);
    });
  });

  // ── Bulk upsert results ──────────────────────────────────────────────────────
  describe('PUT /api/v1/admin/exams/:examId/results', () => {
    let exam, student;

    beforeEach(async () => {
      exam = await Exam.create({ schoolId: school._id, classId: cls._id, name: 'Final', year: 2024, term: 'Final', subjects: [{ name: 'Math', totalMarks: 100 }] });
      const s = await createStudent(school._id, cls._id);
      student = s.student;
    });

    it('200 — upserts valid results', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/exams/${exam._id}/results`)
        .set('Cookie', adminCookies)
        .send([{ studentId: student._id.toString(), marks: [{ subject: 'Math', marksObtained: 75 }] }]);
      expect(res.status).toBe(200);
    });

    it('400 — rejects marks exceeding totalMarks', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/exams/${exam._id}/results`)
        .set('Cookie', adminCookies)
        .send([{ studentId: student._id.toString(), marks: [{ subject: 'Math', marksObtained: 150 }] }]);
      expect(res.status).toBe(400);
    });
  });

  // ── Soft delete ──────────────────────────────────────────────────────────────
  describe('DELETE /api/v1/admin/exams/:examId', () => {
    it('200 — soft-deletes an exam with no results', async () => {
      const exam = await Exam.create({ schoolId: school._id, classId: cls._id, name: 'To Delete', year: 2024, term: 'Term 3', subjects: [{ name: 'Math', totalMarks: 100 }] });
      const res = await request(app)
        .delete(`/api/v1/admin/exams/${exam._id}`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      const updated = await Exam.findById(exam._id);
      expect(updated.isDeleted).toBe(true);
    });

    it('409 — cannot delete exam that has results', async () => {
      const s = await createStudent(school._id, cls._id);
      const exam = await Exam.create({ schoolId: school._id, classId: cls._id, name: 'Has Results', year: 2024, term: 'Term 1', subjects: [{ name: 'Math', totalMarks: 100 }] });
      await Result.create({ schoolId: school._id, examId: exam._id, studentId: s.student._id, marks: [{ subject: 'Math', marksObtained: 70 }], overallPercentage: 70 });
      const res = await request(app)
        .delete(`/api/v1/admin/exams/${exam._id}`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(409);
    });
  });

  // ── Cross-tenant isolation ───────────────────────────────────────────────────
  describe('Cross-tenant isolation', () => {
    it('403/404 — school A admin cannot read school B exams', async () => {
      const schoolB = await createSchool();
      const clsB = await Class.create({ schoolId: schoolB._id, name: 'Class 1A', grade: '1', section: 'A', academicYear: '2024-25' });
      const examB = await Exam.create({ schoolId: schoolB._id, classId: clsB._id, name: 'School B Exam', year: 2024, term: 'Term 1', subjects: [{ name: 'Math', totalMarks: 100 }] });

      const res = await request(app)
        .get(`/api/v1/admin/exams/${examB._id}`)
        .set('Cookie', adminCookies); // school A's admin cookie
      expect([403, 404]).toContain(res.status);
    });

    it('403/404 — school A admin cannot upsert into school B exam', async () => {
      const schoolB = await createSchool();
      const clsB = await Class.create({ schoolId: schoolB._id, name: 'Class 1A', grade: '1', section: 'A', academicYear: '2024-25' });
      const examB = await Exam.create({ schoolId: schoolB._id, classId: clsB._id, name: 'B Exam', year: 2024, term: 'Term 1', subjects: [{ name: 'Math', totalMarks: 100 }] });

      const s = await createStudent(schoolB._id, clsB._id);
      const res = await request(app)
        .put(`/api/v1/admin/exams/${examB._id}/results`)
        .set('Cookie', adminCookies)
        .send([{ studentId: s.student._id.toString(), marks: [{ subject: 'Math', marksObtained: 60 }] }]);
      expect([403, 404]).toContain(res.status);
    });
  });
});
