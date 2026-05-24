const mongoose = require('mongoose');
const SubjectSubmission = require('../models/SubjectSubmission.model');
const Exam = require('../models/Exam.model');
const Student = require('../models/Student.model');
const Teacher = require('../models/Teacher.model');
const ApiError = require('../utils/ApiError');

const ACTIVE_EXAM_STATES = ['active'];
const EDITABLE_SUBMISSION_STATES = ['pending', 'draft'];

/**
 * Verify the submission is owned by the given teacher within this school.
 */
const assertAssigned = (submission, teacherId) => {
  if (
    !submission.assignedTeacherId ||
    submission.assignedTeacherId.toString() !== teacherId.toString()
  ) {
    throw new ApiError(403, 'You are not assigned to this subject');
  }
};

/**
 * Load a submission by id within the school, throwing if not found.
 */
const _load = async (schoolId, submissionId) => {
  const sub = await SubjectSubmission.findOne({ _id: submissionId, schoolId });
  if (!sub) throw new ApiError(404, 'Submission not found');
  return sub;
};

/**
 * List exams where the teacher has at least one assigned submission.
 */
const listForTeacher = async (schoolId, teacherId) => {
  const submissions = await SubjectSubmission.find({
    schoolId,
    assignedTeacherId: teacherId,
  })
    .populate({
      path: 'examId',
      populate: { path: 'classId', select: 'name grade section' },
    })
    .lean();

  // Group submissions by exam
  const examMap = new Map();
  for (const sub of submissions) {
    if (!sub.examId || sub.examId.isDeleted) continue;
    const examId = sub.examId._id.toString();
    if (!examMap.has(examId)) {
      examMap.set(examId, {
        ...sub.examId,
        mySubmissions: [],
      });
    }
    examMap.get(examId).mySubmissions.push({
      _id: sub._id,
      subject: sub.subject,
      state: sub.state,
      totalMarks: sub.totalMarks,
      lastSavedAt: sub.lastSavedAt,
      submittedAt: sub.submittedAt,
    });
  }

  return Array.from(examMap.values()).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return (a.term || '').localeCompare(b.term || '');
  });
};

/**
 * List the teacher's submissions for a specific exam.
 */
const listMyForExam = async (schoolId, teacherId, examId) => {
  const submissions = await SubjectSubmission.find({
    schoolId,
    examId,
    assignedTeacherId: teacherId,
  }).lean();
  return submissions;
};

/**
 * Get a single submission for the teacher, with the student roster.
 */
const getForTeacher = async (schoolId, submissionId, teacherId) => {
  const submission = await _load(schoolId, submissionId);
  assertAssigned(submission, teacherId);

  const exam = await Exam.findOne({
    _id: submission.examId,
    schoolId,
    isDeleted: false,
  })
    .populate('classId', 'name grade section')
    .lean();
  if (!exam) throw new ApiError(404, 'Exam not found');

  const students = await Student.find({
    schoolId,
    classId: submission.classId,
    isDeleted: false,
  })
    .populate('userId', 'name email')
    .sort({ enrollmentId: 1 })
    .lean();

  const roster = students.map((s) => ({
    _id: s._id,
    enrollmentId: s.enrollmentId,
    name: s.userId?.name || 'Student',
  }));

  return { submission, exam, students: roster };
};

/**
 * Save draft marks. Validates assignment, exam state, and per-subject totals.
 */
const saveDraft = async (schoolId, submissionId, teacherId, userId, marks) => {
  const submission = await _load(schoolId, submissionId);
  assertAssigned(submission, teacherId);

  if (!EDITABLE_SUBMISSION_STATES.includes(submission.state)) {
    throw new ApiError(409, 'This submission is no longer editable');
  }

  const exam = await Exam.findOne({
    _id: submission.examId,
    schoolId,
    isDeleted: false,
  });
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (!ACTIVE_EXAM_STATES.includes(exam.state)) {
    throw new ApiError(409, 'Exam is locked — marks entry closed');
  }

  // Validate every mark against totalMarks
  for (const m of marks || []) {
    if (typeof m.marksObtained !== 'number' || m.marksObtained < 0) {
      throw new ApiError(400, 'marksObtained must be a non-negative number');
    }
    if (m.marksObtained > submission.totalMarks) {
      throw new ApiError(
        400,
        `marksObtained (${m.marksObtained}) exceeds totalMarks (${submission.totalMarks}) for subject "${submission.subject}"`
      );
    }
  }

  submission.marks = (marks || []).map((m) => ({
    studentId: m.studentId,
    marksObtained: Number(m.marksObtained),
  }));
  submission.state = 'draft';
  submission.lastSavedAt = new Date();
  await submission.save();
  return submission;
};

/**
 * Transition to submitted.
 */
const submit = async (schoolId, submissionId, teacherId, userId) => {
  const submission = await _load(schoolId, submissionId);
  assertAssigned(submission, teacherId);

  if (submission.state === 'submitted' || submission.state === 'locked') {
    throw new ApiError(409, 'Submission is already submitted or locked');
  }

  const exam = await Exam.findOne({
    _id: submission.examId,
    schoolId,
    isDeleted: false,
  });
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (!ACTIVE_EXAM_STATES.includes(exam.state)) {
    throw new ApiError(409, 'Exam is locked — marks entry closed');
  }

  if (!submission.marks || submission.marks.length === 0) {
    throw new ApiError(400, 'Cannot submit empty marks — save a draft first');
  }

  submission.state = 'submitted';
  submission.submittedAt = new Date();
  submission.submittedBy = userId;
  await submission.save();
  return submission;
};

/**
 * Admin re-opens a submitted submission for further edits.
 */
const reopenForAdmin = async (schoolId, examId, submissionId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (exam.state === 'published') {
    throw new ApiError(409, 'Exam already published — cannot reopen submissions');
  }

  const submission = await SubjectSubmission.findOne({
    _id: submissionId,
    examId,
    schoolId,
  });
  if (!submission) throw new ApiError(404, 'Submission not found');
  if (submission.state !== 'submitted') {
    throw new ApiError(409, 'Only submitted submissions can be re-opened');
  }

  submission.state = 'draft';
  submission.submittedAt = null;
  submission.submittedBy = null;
  await submission.save();
  return submission;
};

/**
 * Admin reassigns the teacher for a submission (marks preserved).
 */
const reassignTeacher = async (schoolId, examId, submissionId, teacherId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (exam.state === 'published') {
    throw new ApiError(409, 'Exam already published — cannot reassign');
  }

  const teacher = await Teacher.findOne({ _id: teacherId, schoolId });
  if (!teacher) throw new ApiError(404, 'Teacher not found in this school');

  const submission = await SubjectSubmission.findOne({
    _id: submissionId,
    examId,
    schoolId,
  });
  if (!submission) throw new ApiError(404, 'Submission not found');

  submission.assignedTeacherId = teacherId;
  await submission.save();
  return submission;
};

/**
 * Admin dashboard: counts + per-subject rows for an exam.
 */
const getDashboard = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false })
    .populate('classId', 'name grade section')
    .lean();
  if (!exam) throw new ApiError(404, 'Exam not found');

  const submissions = await SubjectSubmission.find({ schoolId, examId })
    .populate({
      path: 'assignedTeacherId',
      select: 'userId employeeId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ subject: 1 })
    .lean();

  const stats = {
    totalSubjects: submissions.length,
    submittedCount: 0,
    draftCount: 0,
    pendingCount: 0,
    lockedCount: 0,
    unassignedCount: 0,
    completionPercentage: 0,
  };

  for (const s of submissions) {
    if (s.state === 'submitted') stats.submittedCount += 1;
    else if (s.state === 'draft') stats.draftCount += 1;
    else if (s.state === 'locked') stats.lockedCount += 1;
    else stats.pendingCount += 1;
    if (!s.assignedTeacherId) stats.unassignedCount += 1;
  }

  if (stats.totalSubjects > 0) {
    stats.completionPercentage = Math.round(
      ((stats.submittedCount + stats.lockedCount) / stats.totalSubjects) * 100
    );
  }

  const rows = submissions.map((s) => ({
    _id: s._id,
    subject: s.subject,
    totalMarks: s.totalMarks,
    passMark: s.passMark,
    state: s.state,
    lastSavedAt: s.lastSavedAt,
    submittedAt: s.submittedAt,
    assignedTeacher: s.assignedTeacherId
      ? {
          _id: s.assignedTeacherId._id,
          employeeId: s.assignedTeacherId.employeeId,
          name: s.assignedTeacherId.userId?.name || 'Teacher',
        }
      : null,
    marksCount: s.marks?.length || 0,
  }));

  return { exam, stats, submissions: rows };
};

module.exports = {
  listForTeacher,
  listMyForExam,
  getForTeacher,
  saveDraft,
  submit,
  reopenForAdmin,
  reassignTeacher,
  getDashboard,
  assertAssigned,
};
