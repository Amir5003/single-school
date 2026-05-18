const request = require('supertest');
const app = require('../../src/app');
const {
  createSchool,
  createSchoolAdmin,
  createTeacher,
  createStudent,
  getAuthCookies,
} = require('../helpers');
const Fee = require('../../src/models/Fee.model');
const Student = require('../../src/models/Student.model');
const Class = require('../../src/models/Class.model');

let school, adminCookie, studentCookie, studentId, studentDoc;

beforeEach(async () => {
  school = await createSchool();

  const admin = await createSchoolAdmin(school._id);
  adminCookie = getAuthCookies(admin);

  // Create a class and student
  const cls = await Class.create({
    schoolId: school._id,
    name: 'ClassA',
    grade: '5',
    section: 'A',
    academicYear: '2024-2025',
  });

  const { user: studentUser, student } = await createStudent(school._id, cls._id);
  studentDoc = student;
  studentId = student._id;
  studentCookie = getAuthCookies(studentUser);
});

// ── Create Fee (Admin) ────────────────────────────────────────────────────────

describe('POST /api/v1/admin/fees', () => {
  it('201 — admin creates a fee for a student', async () => {
    const res = await request(app)
      .post('/api/v1/admin/fees')
      .set('Cookie', adminCookie)
      .send({
        studentId: studentId.toString(),
        amount: 500,
        description: 'Term 1 tuition',
        dueDate: '2025-12-31',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.fee.status).toBe('pending');
    expect(res.body.data.fee.amount).toBe(500);
  });

  it('422 — missing amount is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/admin/fees')
      .set('Cookie', adminCookie)
      .send({ studentId: studentId.toString(), description: 'Test', dueDate: '2025-12-31' });

    expect(res.statusCode).toBe(422);
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await request(app).post('/api/v1/admin/fees').send({});
    expect(res.statusCode).toBe(401);
  });
});

// ── List Fees (Admin) ─────────────────────────────────────────────────────────

describe('GET /api/v1/admin/fees', () => {
  it('200 — admin can list fees with pagination', async () => {
    await Fee.create({
      schoolId: school._id,
      studentId,
      amount: 200,
      description: 'Test fee',
      dueDate: new Date('2025-12-01'),
    });

    const res = await request(app)
      .get('/api/v1/admin/fees')
      .set('Cookie', adminCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.fees.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data).toHaveProperty('total');
  });

  it('200 — admin can filter fees by status', async () => {
    await Fee.create({
      schoolId: school._id,
      studentId,
      amount: 300,
      description: 'Overdue fee',
      dueDate: new Date('2020-01-01'),
      status: 'overdue',
    });

    const res = await request(app)
      .get('/api/v1/admin/fees?status=overdue')
      .set('Cookie', adminCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.fees.every((f) => f.status === 'overdue')).toBe(true);
  });
});

// ── Mark Paid (Admin) ─────────────────────────────────────────────────────────

describe('PATCH /api/v1/admin/fees/:id/pay', () => {
  it('200 — marks a pending fee as paid', async () => {
    const fee = await Fee.create({
      schoolId: school._id,
      studentId,
      amount: 400,
      description: 'Test fee',
      dueDate: new Date('2025-12-01'),
    });

    const res = await request(app)
      .patch(`/api/v1/admin/fees/${fee._id}/pay`)
      .set('Cookie', adminCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.fee.status).toBe('paid');
    expect(res.body.data.fee.paidAt).toBeDefined();
  });

  it('404 — trying to pay an already-paid fee fails', async () => {
    const fee = await Fee.create({
      schoolId: school._id,
      studentId,
      amount: 400,
      description: 'Test fee',
      dueDate: new Date('2025-12-01'),
      status: 'paid',
      paidAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/v1/admin/fees/${fee._id}/pay`)
      .set('Cookie', adminCookie);

    expect(res.statusCode).toBe(404);
  });
});

// ── Student Views Own Fees ────────────────────────────────────────────────────

describe('GET /api/v1/student/fees', () => {
  it('200 — student sees only their own fees', async () => {
    await Fee.create({
      schoolId: school._id,
      studentId,
      amount: 150,
      description: 'Lab fee',
      dueDate: new Date('2025-11-01'),
    });

    const res = await request(app)
      .get('/api/v1/student/fees')
      .set('Cookie', studentCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.fees.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.fees.every((f) => f.studentId.toString() === studentId.toString())).toBe(true);
  });
});

// ── Overdue Transition (cron simulation) ─────────────────────────────────────

describe('fee.service.transitionOverdue', () => {
  it('transitions past-due pending fees to overdue', async () => {
    await Fee.create({
      schoolId: school._id,
      studentId,
      amount: 100,
      description: 'Past due fee',
      dueDate: new Date('2020-01-01'), // past date
      status: 'pending',
    });

    const feeService = require('../../src/services/fee.service');
    const count = await feeService.transitionOverdue(school._id);
    expect(count).toBeGreaterThanOrEqual(1);

    const updated = await Fee.findOne({ schoolId: school._id, status: 'overdue' });
    expect(updated).not.toBeNull();
  });

  it('does not transition fees from other schools', async () => {
    const otherSchool = await createSchool();
    const otherCls = await Class.create({
      schoolId: otherSchool._id,
      name: 'ClassB',
      grade: '5',
      section: 'B',
      academicYear: '2024-2025',
    });
    const { student: otherStudent } = await createStudent(otherSchool._id, otherCls._id);

    await Fee.create({
      schoolId: otherSchool._id,
      studentId: otherStudent._id,
      amount: 100,
      description: 'Other school fee',
      dueDate: new Date('2020-01-01'),
      status: 'pending',
    });

    const feeService = require('../../src/services/fee.service');
    // Run for our school only
    await feeService.transitionOverdue(school._id);

    // Other school's fee should still be pending
    const fee = await Fee.findOne({ schoolId: otherSchool._id });
    expect(fee.status).toBe('pending');
  });
});
