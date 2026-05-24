const Exam = require('../models/Exam.model');
const Result = require('../models/Result.model');
const SubjectSubmission = require('../models/SubjectSubmission.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const Student = require('../models/Student.model');
const ApiError = require('../utils/ApiError');

/**
 * Create a new exam for the school.
 * New exams always start in 'draft' state.
 */
const createExam = async (schoolId, data) => {
  const exam = await Exam.create({ ...data, schoolId, state: 'draft' });
  return exam;
};

/**
 * List exams for the school, with optional year and classId filters.
 * Hides exams whose state is 'draft' for non-admin callers (controlled by caller).
 */
const listExams = async (schoolId, filters = {}) => {
  const query = { schoolId, isDeleted: false };
  if (filters.year) query.year = Number(filters.year);
  if (filters.classId) query.classId = filters.classId;
  if (filters.state) query.state = filters.state;
  const exams = await Exam.find(query)
    .populate('classId', 'name grade section')
    .sort({ year: -1, term: 1 });
  return exams;
};

const getExam = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false })
    .populate('classId', 'name grade section');
  if (!exam) throw new ApiError(404, 'Exam not found');
  return exam;
};

/**
 * Update exam fields. Once any submission has moved past `pending`, subjects/year/term/classId are immutable.
 * Once exam is published, only metadata-safe fields would be editable — but for simplicity v1 just rejects all edits.
 */
const updateExam = async (schoolId, examId, data) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  if (exam.state === 'published' || exam.state === 'locked') {
    throw new ApiError(409, 'Cannot modify a published or locked exam');
  }

  const protectedFields = ['year', 'term', 'classId', 'subjects'];
  const hasProtected = protectedFields.some((f) => data[f] !== undefined);
  if (hasProtected && exam.state === 'active') {
    const hasProgress = await SubjectSubmission.exists({
      schoolId,
      examId,
      state: { $ne: 'pending' },
    });
    if (hasProgress) {
      throw new ApiError(
        409,
        'Cannot modify exam structure once marks entry has begun'
      );
    }
  }

  // Also reject based on Result existence (legacy path)
  if (hasProtected) {
    const resultCount = await Result.countDocuments({ examId, schoolId });
    if (resultCount > 0) {
      throw new ApiError(
        409,
        'Cannot modify exam structure after results have been entered'
      );
    }
  }

  Object.assign(exam, data);
  await exam.save();
  return exam;
};

/**
 * Soft-delete an exam. Rejects if it's active/published or has results.
 */
const deleteExam = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  if (exam.state === 'active' || exam.state === 'published') {
    throw new ApiError(
      409,
      `Cannot delete a ${exam.state} exam — revert it first`
    );
  }

  const resultCount = await Result.countDocuments({ examId, schoolId });
  if (resultCount > 0) {
    throw new ApiError(409, 'Cannot delete an exam that already has results');
  }

  exam.isDeleted = true;
  await exam.save();
};

/**
 * Get distinct years that have at least one PUBLISHED exam for this school.
 * Used by student-facing year dropdown.
 */
const getDistinctYears = async (schoolId) => {
  const years = await Exam.distinct('year', {
    schoolId,
    isDeleted: false,
    state: 'published',
  });
  return years.sort((a, b) => b - a);
};

/**
 * Admin-side: get all distinct years (any state).
 */
const getAllDistinctYears = async (schoolId) => {
  const years = await Exam.distinct('year', { schoolId, isDeleted: false });
  return years.sort((a, b) => b - a);
};

/**
 * Get exams for a specific student filtered by year.
 * Only returns published exams (student-facing).
 */
const getExamsForStudent = async (schoolId, studentId, year) => {
  const student = await Student.findOne({ _id: studentId, schoolId }).lean();
  if (!student) throw new ApiError(404, 'Student not found');

  const query = {
    schoolId,
    classId: student.classId,
    isDeleted: false,
    state: 'published',
  };
  if (year) query.year = Number(year);

  const exams = await Exam.find(query).sort({ year: -1, term: 1 });
  return exams;
};

/**
 * Activate a draft exam.
 *  - Creates SubjectSubmissions for every subject.
 *  - Resolves assignedTeacherId from ClassTeacher (schoolId+classId+subject).
 *  - Idempotent: if submissions already exist, returns the existing set.
 */
const activateExam = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  if (exam.state === 'published' || exam.state === 'locked') {
    throw new ApiError(409, `Exam is already ${exam.state}`);
  }

  // Idempotency: if submissions already exist, just ensure state is 'active' and return.
  const existing = await SubjectSubmission.find({ schoolId, examId });
  if (existing.length > 0) {
    if (exam.state !== 'active') {
      exam.state = 'active';
      await exam.save();
    }
    return { exam, submissions: existing };
  }

  if (!exam.subjects || exam.subjects.length === 0) {
    throw new ApiError(400, 'Cannot activate an exam with no subjects');
  }

  // Resolve ClassTeacher assignments
  const assignments = await ClassTeacher.find({
    schoolId,
    classId: exam.classId,
  }).lean();
  const assignMap = new Map();
  for (const a of assignments) {
    assignMap.set(a.subject, a.teacherId);
  }

  // Create one submission per subject
  const docs = exam.subjects.map((sub) => ({
    schoolId,
    examId,
    classId: exam.classId,
    subject: sub.name,
    totalMarks: sub.totalMarks,
    passMark: sub.passMark ?? null,
    assignedTeacherId: assignMap.get(sub.name) || null,
    state: 'pending',
    marks: [],
  }));

  const submissions = await SubjectSubmission.insertMany(docs);

  exam.state = 'active';
  await exam.save();
  return { exam, submissions };
};

/**
 * Revert an active exam back to draft. Destroys all SubjectSubmissions.
 * Only allowed when no submission has been submitted (data-loss guard).
 */
const revertToDraft = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (exam.state !== 'active') {
    throw new ApiError(409, 'Only an active exam can be reverted to draft');
  }

  const hasProgress = await SubjectSubmission.exists({
    schoolId,
    examId,
    state: { $in: ['submitted', 'locked'] },
  });
  if (hasProgress) {
    throw new ApiError(
      409,
      'Cannot revert — one or more subjects are already submitted'
    );
  }

  await SubjectSubmission.deleteMany({ schoolId, examId });
  exam.state = 'draft';
  await exam.save();
  return exam;
};

/**
 * Publish an active exam.
 *  - Asserts every SubjectSubmission is 'submitted'.
 *  - Aggregates marks across submissions into per-student Result docs (published=true).
 *  - Locks every SubjectSubmission, sets exam.state=published.
 */
const publishExam = async (schoolId, examId, publishedByUserId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (exam.state === 'published') {
    throw new ApiError(409, 'Exam already published');
  }
  if (exam.state !== 'active') {
    throw new ApiError(409, 'Only an active exam can be published');
  }

  const submissions = await SubjectSubmission.find({ schoolId, examId });
  if (submissions.length === 0) {
    throw new ApiError(409, 'No submissions exist for this exam');
  }

  const blocking = submissions
    .filter((s) => s.state !== 'submitted')
    .map((s) => ({ subject: s.subject, state: s.state }));
  if (blocking.length > 0) {
    const err = new ApiError(
      409,
      `Publish blocked — ${blocking.length} subject(s) not yet submitted`
    );
    err.blocking = blocking;
    throw err;
  }

  // Group marks per student
  const subjectMetaByName = {};
  for (const sub of exam.subjects) {
    subjectMetaByName[sub.name] = {
      totalMarks: sub.totalMarks,
      passMark: sub.passMark,
    };
  }

  const perStudent = new Map(); // studentId -> { marks: [...], totalObtained, totalMax }

  for (const submission of submissions) {
    const meta = subjectMetaByName[submission.subject] || {
      totalMarks: submission.totalMarks,
      passMark: submission.passMark,
    };
    for (const entry of submission.marks) {
      const sidStr = entry.studentId.toString();
      if (!perStudent.has(sidStr)) {
        perStudent.set(sidStr, {
          studentId: entry.studentId,
          marks: [],
          obtained: 0,
          total: 0,
        });
      }
      const bucket = perStudent.get(sidStr);
      bucket.marks.push({
        subject: submission.subject,
        marksObtained: entry.marksObtained,
      });
      bucket.obtained += entry.marksObtained;
      bucket.total += meta.totalMarks;
    }
  }

  // Build bulk write ops for Result upsert
  const ops = Array.from(perStudent.values()).map((b) => {
    const overallPercentage =
      b.total > 0
        ? parseFloat(((b.obtained / b.total) * 100).toFixed(2))
        : 0;
    return {
      updateOne: {
        filter: { schoolId, examId, studentId: b.studentId },
        update: {
          $set: {
            schoolId,
            examId,
            studentId: b.studentId,
            marks: b.marks,
            overallPercentage,
            published: true,
          },
        },
        upsert: true,
      },
    };
  });

  if (ops.length > 0) {
    await Result.bulkWrite(ops);
  }

  // Lock all submissions
  await SubjectSubmission.updateMany(
    { schoolId, examId },
    { $set: { state: 'locked' } }
  );

  // Recompute ranks (descending overallPercentage, dense rank with ties)
  const allResults = await Result.find({
    schoolId,
    examId,
    isDeleted: false,
  })
    .sort({ overallPercentage: -1 })
    .lean();

  let prevPct = null;
  let prevRank = 0;
  const rankOps = allResults.map((r, i) => {
    let rank;
    if (prevPct !== null && r.overallPercentage === prevPct) {
      rank = prevRank;
    } else {
      rank = i + 1;
      prevRank = rank;
      prevPct = r.overallPercentage;
    }
    return {
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { rank } },
      },
    };
  });
  if (rankOps.length > 0) await Result.bulkWrite(rankOps);

  exam.state = 'published';
  exam.publishedAt = new Date();
  exam.publishedBy = publishedByUserId || null;
  await exam.save();

  return { exam, resultsCreated: ops.length };
};

/**
 * Build a self-contained payload for the student PDF report card.
 */
const buildReportCardPayload = async (schoolId, studentId, examId) => {
  const School = require('../models/School.model');

  const [exam, school, student, result] = await Promise.all([
    Exam.findOne({ _id: examId, schoolId, isDeleted: false }).lean(),
    School.findById(schoolId).lean(),
    Student.findOne({ _id: studentId, schoolId })
      .populate('userId', 'name email')
      .populate('classId', 'name grade section')
      .lean(),
    Result.findOne({
      schoolId,
      examId,
      studentId,
      isDeleted: false,
    }).lean(),
  ]);

  if (!exam || exam.state !== 'published') {
    throw new ApiError(404, 'No published result');
  }
  if (!result || result.published === false) {
    throw new ApiError(404, 'No published result');
  }
  if (!school) throw new ApiError(404, 'School not found');
  if (!student) throw new ApiError(404, 'Student not found');

  // Decorate marks with totals + pass/fail
  const subjectMeta = {};
  for (const s of exam.subjects) {
    subjectMeta[s.name] = {
      totalMarks: s.totalMarks,
      passMark: s.passMark ?? Math.ceil(s.totalMarks * 0.35),
    };
  }

  let totalObtained = 0;
  let totalMax = 0;
  let overallPassed = true;
  const marks = (result.marks || []).map((m) => {
    const meta = subjectMeta[m.subject] || { totalMarks: 100, passMark: 35 };
    const passed = m.marksObtained >= meta.passMark;
    if (!passed) overallPassed = false;
    totalObtained += m.marksObtained;
    totalMax += meta.totalMarks;
    return {
      subject: m.subject,
      marksObtained: m.marksObtained,
      totalMarks: meta.totalMarks,
      passMark: meta.passMark,
      passed,
    };
  });

  const percentage =
    totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : 0;

  return {
    school: {
      name: school.name,
      logoUrl: school.branding?.logoUrl || null,
      address: school.branding?.address || null,
      contactNumber: school.branding?.contactNumber || null,
      primaryColor: school.branding?.primaryColor || '#1a73e8',
      tagline: school.branding?.tagline || null,
    },
    student: {
      _id: student._id,
      name: student.userId?.name || 'Student',
      enrollmentId: student.enrollmentId,
      class: student.classId
        ? `${student.classId.name || ''}${
            student.classId.section ? ' ' + student.classId.section : ''
          }`.trim()
        : null,
    },
    exam: {
      _id: exam._id,
      name: exam.name,
      term: exam.term,
      year: exam.year,
      publishedAt: exam.publishedAt,
    },
    marks,
    totals: { obtained: totalObtained, total: totalMax },
    percentage,
    passed: overallPassed,
    rank: result.rank ?? null,
    generatedAt: new Date(),
  };
};

module.exports = {
  createExam,
  listExams,
  getExam,
  updateExam,
  deleteExam,
  getDistinctYears,
  getAllDistinctYears,
  getExamsForStudent,
  activateExam,
  revertToDraft,
  publishExam,
  buildReportCardPayload,
};
