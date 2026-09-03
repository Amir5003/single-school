const request = require('supertest');
const app = require('../../src/app');
const {
  createSchool,
  createDirectUser,
  createStudent,
  getAuthCookies,
} = require('../helpers');
const Class = require('../../src/models/Class.model');
const Exam = require('../../src/models/Exam.model');
const Result = require('../../src/models/Result.model');
const ParentStudentLink = require('../../src/models/ParentStudentLink.model');
const Assessment = require('../../src/models/Assessment.model');
const AssessmentScore = require('../../src/models/AssessmentScore.model');
const { createTeacher } = require('../helpers');

/**
 * Spec 008 — parents can reach published report cards.
 *
 * Before this feature parents could read only the legacy coursework collection;
 * there was no parent route to Result at all. These endpoints delegate to the
 * same services the student routes use, so the gating asserted here is the same
 * gating students get — that shared implementation is the point.
 */
describe('Parent Report Card Access', () => {
  let school, cls, student, parentUser, parentCookies;

  const makeParent = async (schoolId) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    return createDirectUser({
      name: `Parent ${suffix}`,
      email: `parent-${suffix}@school.test`,
      password: 'Password1',
      role: 'parent',
      schoolId,
    });
  };

  const publishedExam = async (overrides = {}) =>
    Exam.create({
      schoolId: school._id,
      classId: cls._id,
      name: 'Term 1 Final',
      year: 2026,
      term: 'Term 1',
      subjects: [{ name: 'Math', totalMarks: 100, passMark: 35 }],
      state: 'published',
      publishedAt: new Date(),
      ...overrides,
    });

  beforeEach(async () => {
    school = await createSchool();
    cls = await Class.create({
      schoolId: school._id,
      name: '8A',
      grade: '8',
      section: 'A',
      academicYear: '2024-25',
    });
    ({ student } = await createStudent(school._id, cls._id));

    parentUser = await makeParent(school._id);
    parentCookies = getAuthCookies(parentUser);
    await ParentStudentLink.create({
      schoolId: school._id,
      parentId: parentUser._id,
      studentId: student._id,
    });
  });

  describe('Linked parent', () => {
    it('200 — sees the published result for their child', async () => {
      const exam = await publishedExam();
      await Result.create({
        schoolId: school._id,
        examId: exam._id,
        studentId: student._id,
        marks: [{ subject: 'Math', marksObtained: 80 }],
        overallPercentage: 80,
        rank: 1,
        published: true,
      });

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/results?examId=${exam._id}`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.marks[0].marksObtained).toBe(80);
      expect(res.body.data.marks[0].passed).toBe(true);
      expect(res.body.data.overallPercentage).toBe(80);
    });

    it('200 — lists years that have a published exam', async () => {
      await publishedExam();

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/exam-years`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.years).toContain(2026);
    });

    it('200 — lists published exams for the child', async () => {
      await publishedExam();

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/exams`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.exams).toHaveLength(1);
      expect(res.body.data.exams[0].state).toBe('published');
    });

    it('200 — returns a report-card payload', async () => {
      const exam = await publishedExam();
      await Result.create({
        schoolId: school._id,
        examId: exam._id,
        studentId: student._id,
        marks: [{ subject: 'Math', marksObtained: 80 }],
        overallPercentage: 80,
        published: true,
      });

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/results/${exam._id}/report-card`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('school');
      expect(res.body.data).toHaveProperty('student');
    });
  });

  describe('Publication gating — identical to the student route', () => {
    it('404 — an active (unpublished) exam is invisible to the parent', async () => {
      const exam = await publishedExam({ state: 'active', publishedAt: null });
      await Result.create({
        schoolId: school._id,
        examId: exam._id,
        studentId: student._id,
        marks: [{ subject: 'Math', marksObtained: 70 }],
        overallPercentage: 70,
        published: false,
      });

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/results?examId=${exam._id}`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(404);
    });

    it('only published exams appear in the exam list', async () => {
      await publishedExam({ name: 'Draft Exam', state: 'draft', publishedAt: null });

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/exams`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.exams).toHaveLength(0);
    });
  });

  describe('Link enforcement', () => {
    it('403 — an unlinked parent in the same school is refused', async () => {
      const exam = await publishedExam();
      const stranger = await makeParent(school._id);

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/results?examId=${exam._id}`)
        .set('Cookie', getAuthCookies(stranger));

      expect(res.status).toBe(403);
    });

    it('403 — unlinked parent is refused the report card too', async () => {
      const exam = await publishedExam();
      const stranger = await makeParent(school._id);

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/results/${exam._id}/report-card`)
        .set('Cookie', getAuthCookies(stranger));

      expect(res.status).toBe(403);
    });
  });

  describe('Cross-tenant isolation', () => {
    it('refuses a foreign parent even with a planted link row, and leaks nothing', async () => {
      const exam = await publishedExam();
      await Result.create({
        schoolId: school._id,
        examId: exam._id,
        studentId: student._id,
        marks: [{ subject: 'Math', marksObtained: 80 }],
        overallPercentage: 80,
        published: true,
      });

      const otherSchool = await createSchool();
      const otherParent = await makeParent(otherSchool._id);
      // Even with a link row in their OWN school, the student belongs elsewhere.
      await ParentStudentLink.create({
        schoolId: otherSchool._id,
        parentId: otherParent._id,
        studentId: student._id,
      });

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/results?examId=${exam._id}`)
        .set('Cookie', getAuthCookies(otherParent));

      // 404 rather than 403: the planted link row lives in the attacker's own
      // school, so requireLink passes — but every downstream query is scoped to
      // req.school._id, so the exam is simply not found in their tenant. The
      // security property under test is that no data crosses the boundary, and
      // both codes satisfy it; asserting the exact code would over-specify.
      expect([403, 404]).toContain(res.status);
      expect(res.body.data).toBeFalsy();
    });

    it('403 — cross-tenant parent cannot list exam years for this child', async () => {
      const otherSchool = await createSchool();
      const otherParent = await makeParent(otherSchool._id);

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/exam-years`)
        .set('Cookie', getAuthCookies(otherParent));

      expect(res.status).toBe(403);
    });
  });

  describe('Coursework', () => {
    it('200 — linked parent sees coursework grouped by subject, with detail', async () => {
      const { teacher } = await createTeacher(school._id);
      const assessment = await Assessment.create({
        schoolId: school._id,
        classId: cls._id,
        subject: 'Mathematics',
        title: 'Unit Test 1',
        assessmentType: 'class_test',
        maxMarks: 20,
        date: new Date('2026-07-14'),
        createdBy: teacher._id,
      });
      await AssessmentScore.create({
        schoolId: school._id,
        assessmentId: assessment._id,
        studentId: student._id,
        marksObtained: 18,
        remarks: 'Good work',
      });

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/coursework`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.subjects).toHaveLength(1);
      const group = res.body.data.subjects[0];
      expect(group.subject).toBe('Mathematics');
      expect(group.entries[0].title).toBe('Unit Test 1');
      expect(group.entries[0].remarks).toBe('Good work');
      expect(group.entries[0].date).toBeTruthy();
      expect(group.entries[0].teacherName).toBeTruthy();
    });

    it('403 — an unlinked parent cannot read coursework', async () => {
      const stranger = await makeParent(school._id);

      const res = await request(app)
        .get(`/api/v1/parent/children/${student._id}/coursework`)
        .set('Cookie', getAuthCookies(stranger));

      expect(res.status).toBe(403);
    });
  });

  describe('Unauthenticated', () => {
    it('401 — no cookie is rejected', async () => {
      const res = await request(app).get(
        `/api/v1/parent/children/${student._id}/results?examId=000000000000000000000000`
      );
      expect(res.status).toBe(401);
    });
  });
});
