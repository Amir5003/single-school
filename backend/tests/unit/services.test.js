/**
 * Unit tests for attendance.service.js and marks.service.js edge cases.
 * Relies on the in-memory MongoDB replica set started in tests/setup.js.
 */

const mongoose = require('mongoose');
const ApiError = require('../../src/utils/ApiError');

// Seed helpers
const User = require('../../src/models/User.model');
const School = require('../../src/models/School.model');
const Student = require('../../src/models/Student.model');
const Teacher = require('../../src/models/Teacher.model');
const Class = require('../../src/models/Class.model');
const ClassTeacher = require('../../src/models/ClassTeacher.model');
const Attendance = require('../../src/models/Attendance.model');
const Marks = require('../../src/models/Marks.model');

const { markBulkAttendance } = require('../../src/services/attendance.service');
const { upsertMark } = require('../../src/services/marks.service');

// ── Fixtures ─────────────────────────────────────────────────────────────────

let schoolId, classId, teacherId, studentId;

beforeEach(async () => {
  // School (required by multi-tenant models)
  const school = await School.create({
    name: 'Unit Test School',
    slug: `unit-test-${Math.random().toString(36).slice(2, 8)}`,
    isActive: true,
    plan: 'free',
    slugLockedAt: new Date(),
  });
  schoolId = school._id;

  // Teacher user + Teacher document
  const teacherUser = await User.create({
    name: 'Mr Test',
    email: `teacher-${Date.now()}@unit.test`,
    password: 'Passw0rd!',
    role: 'teacher',
    schoolId,
  });
  const teacher = await Teacher.create({
    userId: teacherUser._id,
    schoolId,
    employeeId: 'UNIT001',
  });
  teacherId = teacher._id;

  // Class
  const cls = await Class.create({ schoolId, name: 'Unit Class', grade: '9', section: 'U', academicYear: '2024-2025' });
  classId = cls._id;

  // ClassTeacher assignment
  await ClassTeacher.create({ classId, teacherId, schoolId, subject: 'Math' });

  // Student user + Student document
  const studentUser = await User.create({
    name: 'Student One',
    email: `student-${Date.now()}@unit.test`,
    password: 'Passw0rd!',
    role: 'student',
    schoolId,
  });
  const student = await Student.create({
    userId: studentUser._id,
    schoolId,
    enrollmentId: 'UNIT-S001',
    dateOfBirth: new Date('2010-01-01'),
    classId,
  });
  studentId = student._id;
});

// ── Attendance service edge cases ─────────────────────────────────────────────

describe('attendance.service — markBulkAttendance', () => {
  it('throws ApiError(400) for an invalid date string', async () => {
    await expect(
      markBulkAttendance(classId, 'not-a-date', [{ studentId, status: 'Present' }], teacherId, schoolId)
    ).rejects.toMatchObject({ statusCode: 400, message: 'Invalid date' });
  });

  it('throws ApiError(400) for a future date', async () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await expect(
      markBulkAttendance(classId, tomorrow, [{ studentId, status: 'Present' }], teacherId, schoolId)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ApiError(403) when teacher is not assigned to the class', async () => {
    // Create another teacher NOT assigned to classId
    const otherUser = await User.create({
      name: 'Other',
      email: `other-${Date.now()}@unit.test`,
      password: 'Passw0rd!',
      role: 'teacher',
      schoolId,
    });
    const otherTeacher = await Teacher.create({ userId: otherUser._id, schoolId, employeeId: 'OTHER01' });
    await expect(
      markBulkAttendance(classId, new Date(), [{ studentId, status: 'Present' }], otherTeacher._id, schoolId)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws ApiError(400) for an empty records array', async () => {
    await expect(
      markBulkAttendance(classId, new Date(), [], teacherId, schoolId)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('saves records and returns { saved } count', async () => {
    const result = await markBulkAttendance(
      classId,
      new Date(),
      [{ studentId, status: 'Present' }],
      teacherId,
      schoolId
    );
    expect(result).toHaveProperty('saved');
    expect(typeof result.saved).toBe('number');
    const saved = await Attendance.countDocuments({ classId });
    expect(saved).toBe(1);
  });

  it('upserts (does not duplicate) on second call for same date', async () => {
    const today = new Date();
    await markBulkAttendance(classId, today, [{ studentId, status: 'Present' }], teacherId, schoolId);
    await markBulkAttendance(classId, today, [{ studentId, status: 'Absent' }], teacherId, schoolId);
    const docs = await Attendance.find({ classId });
    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe('Absent');
  });
});

// ── Marks service edge cases ──────────────────────────────────────────────────

describe('marks.service — upsertMark', () => {
  it('throws ApiError(403) when teacher is not assigned to the class', async () => {
    const otherUser = await User.create({
      name: 'Other2',
      email: `other2-${Date.now()}@unit.test`,
      password: 'Passw0rd!',
      role: 'teacher',
      schoolId,
    });
    const otherTeacher = await Teacher.create({ userId: otherUser._id, schoolId, employeeId: 'OTHER02' });
    await expect(
      upsertMark(
        { studentId, classId, subject: 'Math', examType: 'final', marksObtained: 80 },
        otherTeacher._id,
        schoolId
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates a new mark record', async () => {
    const mark = await upsertMark(
      { studentId, classId, subject: 'Math', examType: 'final', marksObtained: 85 },
      teacherId,
      schoolId
    );
    expect(mark.marksObtained).toBe(85);
    const count = await Marks.countDocuments({ studentId, classId });
    expect(count).toBe(1);
  });

  it('updates an existing mark record (upsert)', async () => {
    await upsertMark(
      { studentId, classId, subject: 'Math', examType: 'final', marksObtained: 70 },
      teacherId,
      schoolId
    );
    const updated = await upsertMark(
      { studentId, classId, subject: 'Math', examType: 'final', marksObtained: 90 },
      teacherId,
      schoolId
    );
    expect(updated.marksObtained).toBe(90);
    const count = await Marks.countDocuments({ studentId, classId, subject: 'Math' });
    expect(count).toBe(1); // still only one doc
  });

  it('rejects marksObtained above 100 via schema validator', async () => {
    await expect(
      upsertMark(
        { studentId, classId, subject: 'Math', examType: 'final', marksObtained: 101 },
        teacherId,
        schoolId
      )
    ).rejects.toBeDefined();
  });

  it('rejects negative marksObtained via schema validator', async () => {
    await expect(
      upsertMark(
        { studentId, classId, subject: 'Math', examType: 'final', marksObtained: -1 },
        teacherId,
        schoolId
      )
    ).rejects.toBeDefined();
  });

  it('defaults examType to "final" when not provided', async () => {
    const mark = await upsertMark(
      { studentId, classId, subject: 'Science', marksObtained: 75 },
      teacherId,
      schoolId
    );
    expect(mark.examType).toBe('final');
  });
});
