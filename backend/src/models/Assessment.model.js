const mongoose = require('mongoose');

/**
 * A single piece of coursework — one real classroom event.
 *
 * This is the formative half of assessment: class tests, quizzes, assignments,
 * projects, practicals. Teacher-owned and visible to students immediately, with
 * no admin publish step. Term exams are summative and belong to the governed
 * Exam → SubjectSubmission → Result pipeline instead.
 *
 * One Assessment holds the shared facts (title, date, maxMarks, who set it);
 * per-student marks live in AssessmentScore. That split is what allows many
 * class tests in one subject, and lets a title or date be corrected once rather
 * than on every student's row.
 *
 * See specs/009-coursework-assessments/.
 */
const assessmentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    assessmentType: {
      type: String,
      enum: ['class_test', 'quiz', 'assignment', 'project', 'practical'],
      default: 'class_test',
    },
    maxMarks: {
      type: Number,
      required: [true, 'maxMarks is required'],
      min: [1, 'maxMarks must be at least 1'],
    },
    // The date the assessment was conducted — teacher-set, and deliberately
    // distinct from createdAt, which is merely when the marks were typed in.
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    // Denormalised from the class so a student's coursework can be scoped to a
    // year without a join — the thing that stops a multi-year history becoming
    // one undifferentiated list.
    academicYear: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Creating teacher is required'],
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

assessmentSchema.index({ schoolId: 1, classId: 1, subject: 1, date: -1 });
assessmentSchema.index({ schoolId: 1, classId: 1, isDeleted: 1 });
assessmentSchema.index({ schoolId: 1, createdBy: 1 });

const Assessment = mongoose.model('Assessment', assessmentSchema);

module.exports = Assessment;
