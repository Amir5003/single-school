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

describe('Teacher Subject Submission API', () => {
  let school, adminUser, adminCookies, cls;
  let teacher1User, teacher1, teacher1Cookies;
  let teacher2User, teacher2, teacher2Cookies;
  let student, exam, mathSub, englishSub;

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
    const t1 = await createTeacher(school._id);
    const t2 = await createTeacher(school._id);
    teacher1User = t1.user;
    teacher1 = t1.teacher;
    teacher1Cookies = getAuthCookies(teacher1User);
    teacher2User = t2.user;
    teacher2 = t2.teacher;
    teacher2Cookies = getAuthCookies(teacher2User);
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

    exam = await Exam.create({
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
    await request(app)
      .post(`/api/v1/admin/exams/${exam._id}/activate`)
      .set('Cookie', adminCookies);
    mathSub = await SubjectSubmission.findOne({ examId: exam._id, subject: 'Math' });
    englishSub = await SubjectSubmission.findOne({ examId: exam._id, subject: 'English' });
  });

  describe('GET /teacher/exams', () => {
    it('200 — teacher1 sees the exam with their Math submission only', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/exams')
        .set('Cookie', teacher1Cookies);
      expect(res.status).toBe(200);
      expect(res.body.data.exams).toHaveLength(1);
      const e = res.body.data.exams[0];
      expect(e.mySubmissions).toHaveLength(1);
      expect(e.mySubmissions[0].subject).toBe('Math');
    });
  });

  describe('GET /teacher/submissions/:id', () => {
    it('200 — teacher1 can read their own Math submission', async () => {
      const res = await request(app)
        .get(`/api/v1/teacher/submissions/${mathSub._id}`)
        .set('Cookie', teacher1Cookies);
      expect(res.status).toBe(200);
      expect(res.body.data.submission.subject).toBe('Math');
      expect(res.body.data.students.length).toBeGreaterThan(0);
    });

    it('403 — teacher1 cannot read teacher2 English submission', async () => {
      const res = await request(app)
        .get(`/api/v1/teacher/submissions/${englishSub._id}`)
        .set('Cookie', teacher1Cookies);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /teacher/submissions/:id/marks', () => {
    it('200 — teacher1 saves draft marks for Math', async () => {
      const res = await request(app)
        .put(`/api/v1/teacher/submissions/${mathSub._id}/marks`)
        .set('Cookie', teacher1Cookies)
        .send({ marks: [{ studentId: student._id.toString(), marksObtained: 88 }] });
      expect(res.status).toBe(200);
      const after = await SubjectSubmission.findById(mathSub._id);
      expect(after.state).toBe('draft');
      expect(after.marks).toHaveLength(1);
      expect(after.marks[0].marksObtained).toBe(88);
    });

    it('400 — rejects marks > totalMarks', async () => {
      const res = await request(app)
        .put(`/api/v1/teacher/submissions/${mathSub._id}/marks`)
        .set('Cookie', teacher1Cookies)
        .send({ marks: [{ studentId: student._id.toString(), marksObtained: 150 }] });
      expect(res.status).toBe(400);
    });

    it('403 — teacher1 cannot write to teacher2 submission', async () => {
      const res = await request(app)
        .put(`/api/v1/teacher/submissions/${englishSub._id}/marks`)
        .set('Cookie', teacher1Cookies)
        .send({ marks: [{ studentId: student._id.toString(), marksObtained: 60 }] });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /teacher/submissions/:id/submit', () => {
    it('200 — moves draft→submitted; subsequent edit returns 409', async () => {
      await request(app)
        .put(`/api/v1/teacher/submissions/${mathSub._id}/marks`)
        .set('Cookie', teacher1Cookies)
        .send({ marks: [{ studentId: student._id.toString(), marksObtained: 88 }] });

      const res = await request(app)
        .post(`/api/v1/teacher/submissions/${mathSub._id}/submit`)
        .set('Cookie', teacher1Cookies);
      expect(res.status).toBe(200);
      const after = await SubjectSubmission.findById(mathSub._id);
      expect(after.state).toBe('submitted');

      const editRes = await request(app)
        .put(`/api/v1/teacher/submissions/${mathSub._id}/marks`)
        .set('Cookie', teacher1Cookies)
        .send({ marks: [{ studentId: student._id.toString(), marksObtained: 90 }] });
      expect(editRes.status).toBe(409);
    });

    it('400 — cannot submit with no marks saved', async () => {
      const res = await request(app)
        .post(`/api/v1/teacher/submissions/${mathSub._id}/submit`)
        .set('Cookie', teacher1Cookies);
      expect(res.status).toBe(400);
    });
  });

  describe('Cross-tenant isolation', () => {
    it('403/404 — teacher from school A cannot access school B submission', async () => {
      const schoolB = await createSchool();
      const clsB = await Class.create({
        schoolId: schoolB._id,
        name: '8B',
        grade: '8',
        section: 'B',
        academicYear: '2024-25',
      });
      const tB = await createTeacher(schoolB._id);
      await ClassTeacher.create({
        schoolId: schoolB._id,
        classId: clsB._id,
        teacherId: tB.teacher._id,
        subject: 'Math',
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
      const adminB = await createSchoolAdmin(schoolB._id);
      await request(app)
        .post(`/api/v1/admin/exams/${examB._id}/activate`)
        .set('Cookie', getAuthCookies(adminB));
      const subB = await SubjectSubmission.findOne({ examId: examB._id });

      const res = await request(app)
        .get(`/api/v1/teacher/submissions/${subB._id}`)
        .set('Cookie', teacher1Cookies); // school A teacher
      expect([403, 404]).toContain(res.status);
    });
  });
});
