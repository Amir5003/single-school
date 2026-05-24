const request = require('supertest');
const app = require('../../src/app');
const {
  createSchool,
  createSchoolAdmin,
  createTeacher,
  createStudent,
  getAuthCookies,
} = require('../helpers');
const Class = require('../../src/models/Class.model');
const Exam = require('../../src/models/Exam.model');
const ClassTeacher = require('../../src/models/ClassTeacher.model');
const SubjectSubmission = require('../../src/models/SubjectSubmission.model');
const Result = require('../../src/models/Result.model');

describe('Admin Exam Lifecycle API', () => {
  let school, adminUser, adminCookies, cls, teacher1, teacher2, student;

  beforeEach(async () => {
    school = await createSchool();
    adminUser = await createSchoolAdmin(school._id);
    adminCookies = getAuthCookies(adminUser);
    cls = await Class.create({
      schoolId: school._id,
      name: 'Class 8A',
      grade: '8',
      section: 'A',
      academicYear: '2024-25',
    });
    const t1 = await createTeacher(school._id);
    const t2 = await createTeacher(school._id);
    teacher1 = t1.teacher;
    teacher2 = t2.teacher;
    await ClassTeacher.create({
      schoolId: school._id,
      classId: cls._id,
      teacherId: teacher1._id,
      subject: 'Math',
    });
    await ClassTeacher.create({
      schoolId: school._id,
      classId: cls._id,
      teacherId: teacher2._id,
      subject: 'English',
    });
    const s = await createStudent(school._id, cls._id);
    student = s.student;
  });

  const makeDraftExam = () =>
    Exam.create({
      schoolId: school._id,
      classId: cls._id,
      name: 'Mid-Term',
      year: 2026,
      term: 'Term 1',
      subjects: [
        { name: 'Math', totalMarks: 100 },
        { name: 'English', totalMarks: 100 },
      ],
      state: 'draft',
    });

  describe('POST /admin/exams/:examId/activate', () => {
    it('200 — activates a draft exam and creates SubjectSubmissions', async () => {
      const exam = await makeDraftExam();
      const res = await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      const submissions = await SubjectSubmission.find({ examId: exam._id });
      expect(submissions).toHaveLength(2);
      // Math submission → teacher1, English submission → teacher2
      const math = submissions.find((s) => s.subject === 'Math');
      const english = submissions.find((s) => s.subject === 'English');
      expect(math.assignedTeacherId.toString()).toBe(teacher1._id.toString());
      expect(english.assignedTeacherId.toString()).toBe(teacher2._id.toString());
      const updatedExam = await Exam.findById(exam._id);
      expect(updatedExam.state).toBe('active');
    });

    it('200 — activate is idempotent', async () => {
      const exam = await makeDraftExam();
      await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);
      const res = await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      const submissions = await SubjectSubmission.find({ examId: exam._id });
      expect(submissions).toHaveLength(2);
    });
  });

  describe('POST /admin/exams/:examId/publish', () => {
    it('409 — blocked when not all subjects are submitted', async () => {
      const exam = await makeDraftExam();
      await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);

      const res = await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/publish`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(409);
      expect(res.body.blocking).toBeDefined();
    });

    it('200 — publishes when all submissions submitted; creates Result documents', async () => {
      const exam = await makeDraftExam();
      await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);
      const submissions = await SubjectSubmission.find({ examId: exam._id });
      // Manually mark as submitted with marks
      for (const sub of submissions) {
        sub.state = 'submitted';
        sub.marks = [{ studentId: student._id, marksObtained: 80 }];
        sub.submittedAt = new Date();
        await sub.save();
      }

      const res = await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/publish`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      const updatedExam = await Exam.findById(exam._id);
      expect(updatedExam.state).toBe('published');
      expect(updatedExam.publishedAt).toBeTruthy();
      const result = await Result.findOne({ examId: exam._id, studentId: student._id });
      expect(result).toBeTruthy();
      expect(result.published).toBe(true);
      expect(result.overallPercentage).toBe(80);
    });

    it('409 — cannot publish twice', async () => {
      const exam = await makeDraftExam();
      await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);
      const submissions = await SubjectSubmission.find({ examId: exam._id });
      for (const sub of submissions) {
        sub.state = 'submitted';
        sub.marks = [{ studentId: student._id, marksObtained: 50 }];
        await sub.save();
      }
      await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/publish`)
        .set('Cookie', adminCookies);
      const res = await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/publish`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(409);
    });
  });

  describe('GET /admin/exams/:examId/dashboard', () => {
    it('200 — returns counts and per-subject rows', async () => {
      const exam = await makeDraftExam();
      await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);
      const res = await request(app)
        .get(`/api/v1/admin/exams/${exam._id}/dashboard`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.stats.totalSubjects).toBe(2);
      expect(res.body.data.stats.pendingCount).toBe(2);
      expect(res.body.data.stats.completionPercentage).toBe(0);
      expect(res.body.data.submissions).toHaveLength(2);
    });
  });

  describe('POST /admin/exams/:examId/submissions/:submissionId/reopen', () => {
    it('200 — moves submitted back to draft', async () => {
      const exam = await makeDraftExam();
      await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/activate`)
        .set('Cookie', adminCookies);
      const sub = await SubjectSubmission.findOne({ examId: exam._id });
      sub.state = 'submitted';
      sub.marks = [{ studentId: student._id, marksObtained: 70 }];
      sub.submittedAt = new Date();
      await sub.save();

      const res = await request(app)
        .post(`/api/v1/admin/exams/${exam._id}/submissions/${sub._id}/reopen`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      const after = await SubjectSubmission.findById(sub._id);
      expect(after.state).toBe('draft');
    });
  });

  describe('Cross-tenant isolation', () => {
    it('404 — admin in school A cannot activate exam in school B', async () => {
      const schoolB = await createSchool();
      const clsB = await Class.create({
        schoolId: schoolB._id,
        name: 'Class 1B',
        grade: '1',
        section: 'B',
        academicYear: '2024-25',
      });
      const examB = await Exam.create({
        schoolId: schoolB._id,
        classId: clsB._id,
        name: 'B Exam',
        year: 2026,
        term: 'Term 1',
        subjects: [{ name: 'Math', totalMarks: 100 }],
        state: 'draft',
      });
      const res = await request(app)
        .post(`/api/v1/admin/exams/${examB._id}/activate`)
        .set('Cookie', adminCookies);
      expect([403, 404]).toContain(res.status);
    });
  });
});
