const mongoose = require('mongoose');
const Assessment = require('../models/Assessment.model');
const AssessmentScore = require('../models/AssessmentScore.model');
const ClassTeacher = require('../models/ClassTeacher.model');
const Class = require('../models/Class.model');
const Student = require('../models/Student.model');
const ApiError = require('../utils/ApiError');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify the teacher is assigned to the given class within the school.
 * Mirrors the guard the flat coursework service used.
 */
const assertAssigned = async (classId, teacherId, schoolId) => {
  const assigned = await ClassTeacher.exists({ schoolId, classId, teacherId });
  if (!assigned) {
    throw new ApiError(403, 'You are not assigned to this class');
  }
};

/**
 * Load an assessment scoped to the school, or throw 404.
 */
const loadAssessment = async (schoolId, assessmentId) => {
  if (!mongoose.isValidObjectId(assessmentId)) {
    throw new ApiError(404, 'Assessment not found');
  }
  const assessment = await Assessment.findOne({
    _id: assessmentId,
    schoolId,
    isDeleted: false,
  });
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  return assessment;
};

/**
 * Mean percentage across a set of scores, ignoring absentees.
 * Absent students are excluded rather than counted as zero.
 */
const averagePercentage = (scores, maxMarks) => {
  const scored = scores.filter((s) => !s.absent && typeof s.marksObtained === 'number');
  if (scored.length === 0 || !maxMarks) return null;
  const total = scored.reduce((sum, s) => sum + s.marksObtained, 0);
  return parseFloat(((total / (scored.length * maxMarks)) * 100).toFixed(2));
};

// ── Teacher-facing ───────────────────────────────────────────────────────────

/**
 * Create a coursework assessment. academicYear is denormalised from the class.
 */
const createAssessment = async (schoolId, teacherId, data) => {
  const { classId, subject, title, assessmentType, maxMarks, date } = data;

  await assertAssigned(classId, teacherId, schoolId);

  const cls = await Class.findOne({ schoolId, _id: classId }).lean();
  if (!cls) throw new ApiError(404, 'Class not found');

  return Assessment.create({
    schoolId,
    classId,
    subject: subject.trim(),
    title: title.trim(),
    assessmentType,
    maxMarks,
    date: date || Date.now(),
    academicYear: cls.academicYear ?? null,
    createdBy: teacherId,
  });
};

/**
 * List a teacher's assessments, newest first, with how many scores are entered.
 */
const listAssessmentsForTeacher = async (schoolId, teacherId, filters = {}) => {
  const query = { schoolId, createdBy: teacherId, isDeleted: false };
  if (filters.classId) query.classId = filters.classId;
  if (filters.subject) query.subject = filters.subject;

  const assessments = await Assessment.find(query)
    .populate('classId', 'name grade section')
    .sort({ date: -1 })
    .lean();

  if (assessments.length === 0) return [];

  const counts = await AssessmentScore.aggregate([
    { $match: { schoolId, assessmentId: { $in: assessments.map((a) => a._id) } } },
    { $group: { _id: '$assessmentId', entered: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.entered]));

  return assessments.map((a) => ({ ...a, scoresEntered: byId.get(String(a._id)) ?? 0 }));
};

/**
 * One assessment plus a row per student in the class — students without a score
 * yet come back with nulls so the teacher sees the full roster.
 */
const getAssessmentWithScores = async (schoolId, assessmentId, teacherId) => {
  const assessment = await loadAssessment(schoolId, assessmentId);
  await assertAssigned(assessment.classId, teacherId, schoolId);

  const [students, scores] = await Promise.all([
    Student.find({ schoolId, classId: assessment.classId, isDeleted: false })
      .populate('userId', 'name')
      .select('enrollmentId userId')
      .lean(),
    AssessmentScore.find({ schoolId, assessmentId: assessment._id }).lean(),
  ]);

  const byStudent = new Map(scores.map((s) => [String(s.studentId), s]));

  const rows = students.map((student) => {
    const score = byStudent.get(String(student._id));
    return {
      studentId: student._id,
      name: student.userId?.name ?? 'Unknown',
      enrollmentId: student.enrollmentId,
      marksObtained: score?.marksObtained ?? null,
      absent: score?.absent ?? false,
      remarks: score?.remarks ?? '',
    };
  });

  return {
    assessment,
    students: rows,
    classAverage: averagePercentage(scores, assessment.maxMarks),
  };
};

/**
 * Bulk upsert scores for one assessment. Validates every row before writing any,
 * so a single bad mark cannot leave the class half-saved.
 */
const saveScores = async (schoolId, assessmentId, teacherId, scores) => {
  const assessment = await loadAssessment(schoolId, assessmentId);
  await assertAssigned(assessment.classId, teacherId, schoolId);

  for (const row of scores) {
    if (row.absent) continue;
    if (row.marksObtained === null || row.marksObtained === undefined) continue;
    if (row.marksObtained < 0) {
      throw new ApiError(422, 'marksObtained cannot be negative');
    }
    if (row.marksObtained > assessment.maxMarks) {
      throw new ApiError(
        422,
        `marksObtained (${row.marksObtained}) exceeds maxMarks (${assessment.maxMarks})`
      );
    }
  }

  const ops = scores.map((row) => ({
    updateOne: {
      filter: { schoolId, assessmentId: assessment._id, studentId: row.studentId },
      update: {
        $set: {
          schoolId,
          assessmentId: assessment._id,
          studentId: row.studentId,
          marksObtained: row.absent ? null : row.marksObtained ?? null,
          absent: Boolean(row.absent),
          remarks: row.remarks?.trim() ?? '',
        },
      },
      upsert: true,
    },
  }));

  if (ops.length) await AssessmentScore.bulkWrite(ops);

  return getAssessmentWithScores(schoolId, assessmentId, teacherId);
};

/**
 * Edit the shared facts. Because they live on one document, correcting a title
 * or date fixes it for every student at once.
 */
const updateAssessment = async (schoolId, assessmentId, teacherId, data) => {
  const assessment = await loadAssessment(schoolId, assessmentId);
  await assertAssigned(assessment.classId, teacherId, schoolId);

  const allowed = ['title', 'subject', 'assessmentType', 'maxMarks', 'date'];
  for (const key of allowed) {
    if (data[key] !== undefined) assessment[key] = data[key];
  }

  // Lowering maxMarks below an already-entered score would make the record
  // self-contradictory, so refuse rather than silently clamp.
  if (data.maxMarks !== undefined) {
    const highest = await AssessmentScore.findOne({ schoolId, assessmentId: assessment._id })
      .sort({ marksObtained: -1 })
      .lean();
    if (highest?.marksObtained > data.maxMarks) {
      throw new ApiError(
        422,
        `Cannot set maxMarks to ${data.maxMarks} — a recorded score of ${highest.marksObtained} already exceeds it`
      );
    }
  }

  await assessment.save();
  return assessment;
};

/**
 * Soft-delete an assessment and hard-delete its scores.
 */
const deleteAssessment = async (schoolId, assessmentId, teacherId) => {
  const assessment = await loadAssessment(schoolId, assessmentId);
  await assertAssigned(assessment.classId, teacherId, schoolId);

  assessment.isDeleted = true;
  await assessment.save();
  await AssessmentScore.deleteMany({ schoolId, assessmentId: assessment._id });

  return { deleted: true };
};

// ── Student / parent facing ──────────────────────────────────────────────────

/**
 * A student's coursework, grouped by subject and newest-first inside each group.
 *
 * Each entry carries what makes it identifiable — title, date, teacher, type —
 * plus the class average so the student can see where they stand. Absences are
 * excluded from both the student's own average and the class average.
 */
const getStudentCoursework = async (schoolId, studentId, filters = {}) => {
  const scores = await AssessmentScore.find({ schoolId, studentId })
    .populate({
      path: 'assessmentId',
      match: { isDeleted: false },
      populate: { path: 'createdBy', select: 'userId', populate: { path: 'userId', select: 'name' } },
    })
    .lean();

  // populate+match leaves nulls where the assessment was deleted.
  let rows = scores.filter((s) => s.assessmentId);

  if (filters.academicYear) {
    rows = rows.filter((s) => s.assessmentId.academicYear === filters.academicYear);
  }

  const assessmentIds = rows.map((s) => s.assessmentId._id);
  const peers = assessmentIds.length
    ? await AssessmentScore.aggregate([
        {
          $match: {
            schoolId,
            assessmentId: { $in: assessmentIds },
            absent: false,
            marksObtained: { $ne: null },
          },
        },
        {
          $group: {
            _id: '$assessmentId',
            total: { $sum: '$marksObtained' },
            count: { $sum: 1 },
          },
        },
      ])
    : [];
  const peerById = new Map(peers.map((p) => [String(p._id), p]));

  const groups = new Map();
  for (const score of rows) {
    const a = score.assessmentId;
    const peer = peerById.get(String(a._id));
    const classAverage =
      peer && a.maxMarks ? parseFloat(((peer.total / (peer.count * a.maxMarks)) * 100).toFixed(2)) : null;

    const entry = {
      _id: score._id,
      assessmentId: a._id,
      title: a.title,
      subject: a.subject,
      assessmentType: a.assessmentType,
      maxMarks: a.maxMarks,
      date: a.date,
      academicYear: a.academicYear,
      teacherName: a.createdBy?.userId?.name ?? null,
      marksObtained: score.marksObtained,
      absent: score.absent,
      remarks: score.remarks,
      percentage:
        !score.absent && typeof score.marksObtained === 'number' && a.maxMarks
          ? parseFloat(((score.marksObtained / a.maxMarks) * 100).toFixed(2))
          : null,
      classAverage,
    };

    if (!groups.has(a.subject)) groups.set(a.subject, []);
    groups.get(a.subject).push(entry);
  }

  const subjects = [...groups.entries()]
    .map(([subject, entries]) => {
      entries.sort((a, b) => new Date(b.date) - new Date(a.date));
      const counted = entries.filter((e) => e.percentage !== null);
      const average = counted.length
        ? parseFloat(
            (counted.reduce((sum, e) => sum + e.percentage, 0) / counted.length).toFixed(2)
          )
        : null;
      return { subject, average, count: entries.length, entries };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const allCounted = subjects.flatMap((s) => s.entries).filter((e) => e.percentage !== null);
  const overallPercentage = allCounted.length
    ? parseFloat(
        (allCounted.reduce((sum, e) => sum + e.percentage, 0) / allCounted.length).toFixed(2)
      )
    : 0;

  return { subjects, overallPercentage, totalCount: rows.length };
};

module.exports = {
  createAssessment,
  listAssessmentsForTeacher,
  getAssessmentWithScores,
  saveScores,
  updateAssessment,
  deleteAssessment,
  getStudentCoursework,
};
