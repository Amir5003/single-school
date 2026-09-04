const mongoose = require('mongoose');

/**
 * One student's score on one Assessment.
 *
 * The unique key is (schoolId, assessmentId, studentId) — one row per student
 * per assessment. This is what fixes the defect in the flat model it replaces,
 * where the key included the assessment *type* rather than the assessment
 * itself, so a second class test in a subject silently overwrote the first.
 */
const assessmentScoreSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment is required'],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    // Null when the student was absent — never coerce an absence to 0, which
    // would read as a fail and drag the coursework average down.
    marksObtained: {
      type: Number,
      min: [0, 'Marks cannot be less than 0'],
      default: null,
    },
    absent: { type: Boolean, default: false },
    remarks: {
      type: String,
      trim: true,
      maxlength: [300, 'Remarks cannot exceed 300 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

// One score per student per assessment.
assessmentScoreSchema.index(
  { schoolId: 1, assessmentId: 1, studentId: 1 },
  { unique: true }
);
assessmentScoreSchema.index({ schoolId: 1, studentId: 1 });
assessmentScoreSchema.index({ schoolId: 1, assessmentId: 1 });

const AssessmentScore = mongoose.model('AssessmentScore', assessmentScoreSchema);

module.exports = AssessmentScore;
