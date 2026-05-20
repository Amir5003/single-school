const Result = require('../models/Result.model');
const Exam = require('../models/Exam.model');
const ApiError = require('../utils/ApiError');

/**
 * Bulk upsert results for an exam.
 * Validates marksObtained <= totalMarks for each subject.
 */
const upsertResults = async (schoolId, examId, results) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  // Build a totalMarks lookup by subject name
  const subjectMap = {};
  for (const s of exam.subjects) {
    subjectMap[s.name] = s.totalMarks;
  }

  // Validate all marks before writing anything
  for (const entry of results) {
    for (const markEntry of entry.marks) {
      const total = subjectMap[markEntry.subject];
      if (total === undefined) {
        throw new ApiError(400, `Subject "${markEntry.subject}" not found in exam`);
      }
      if (markEntry.marksObtained > total) {
        throw new ApiError(
          400,
          `marksObtained (${markEntry.marksObtained}) exceeds totalMarks (${total}) for subject "${markEntry.subject}"`
        );
      }
    }
  }

  // Build bulkWrite operations
  const ops = results.map((entry) => {
    const totalMarksSum = entry.marks.reduce((acc, m) => acc + (subjectMap[m.subject] || 0), 0);
    const obtainedSum = entry.marks.reduce((acc, m) => acc + m.marksObtained, 0);
    const overallPercentage = totalMarksSum > 0 ? parseFloat(((obtainedSum / totalMarksSum) * 100).toFixed(2)) : 0;

    return {
      updateOne: {
        filter: { schoolId, examId, studentId: entry.studentId },
        update: {
          $set: {
            schoolId,
            examId,
            studentId: entry.studentId,
            marks: entry.marks,
            overallPercentage,
          },
        },
        upsert: true,
      },
    };
  });

  await Result.bulkWrite(ops);

  // Compute and update rank across all results for this exam
  await _computeRanks(schoolId, examId);
};

/**
 * Recompute ranks for all results of an exam (descending overallPercentage).
 */
const _computeRanks = async (schoolId, examId) => {
  const allResults = await Result.find({ schoolId, examId, isDeleted: false })
    .sort({ overallPercentage: -1 })
    .lean();

  const rankOps = allResults.map((r, i) => ({
    updateOne: {
      filter: { _id: r._id },
      update: { $set: { rank: i + 1 } },
    },
  }));

  if (rankOps.length) await Result.bulkWrite(rankOps);
};

/**
 * Get all results for an exam (admin view).
 */
const getResultsForExam = async (schoolId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  const results = await Result.find({ examId, schoolId, isDeleted: false })
    .populate('studentId', 'name rollNumber')
    .lean();

  return { exam, results };
};

/**
 * Get a single student's result for an exam, with per-subject pass/fail.
 */
const getStudentResult = async (schoolId, studentId, examId) => {
  const exam = await Exam.findOne({ _id: examId, schoolId, isDeleted: false });
  if (!exam) throw new ApiError(404, 'Exam not found');

  const result = await Result.findOne({ examId, studentId, schoolId, isDeleted: false }).lean();
  if (!result) throw new ApiError(404, 'No result found for this student and exam');

  // Attach pass/fail per subject
  const subjectMap = {};
  for (const s of exam.subjects) {
    subjectMap[s.name] = { totalMarks: s.totalMarks, passMark: s.passMark };
  }

  const marksWithStatus = result.marks.map((m) => {
    const subjectInfo = subjectMap[m.subject] || { totalMarks: 100, passMark: null };
    const threshold = subjectInfo.passMark ?? Math.ceil(subjectInfo.totalMarks * 0.35);
    return {
      ...m,
      totalMarks: subjectInfo.totalMarks,
      passed: m.marksObtained >= threshold,
    };
  });

  return { ...result, marks: marksWithStatus, exam };
};

module.exports = { upsertResults, getResultsForExam, getStudentResult };
