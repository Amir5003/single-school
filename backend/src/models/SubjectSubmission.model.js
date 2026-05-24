const mongoose = require('mongoose');

const submissionMarkSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    marksObtained: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const subjectSubmissionSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    totalMarks: { type: Number, required: true, min: 1 },
    passMark: { type: Number, default: null },
    assignedTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    state: {
      type: String,
      enum: ['pending', 'draft', 'submitted', 'locked'],
      default: 'pending',
    },
    marks: { type: [submissionMarkSchema], default: [] },
    submittedAt: { type: Date, default: null },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastSavedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One submission per (exam, subject) within a school
subjectSubmissionSchema.index(
  { schoolId: 1, examId: 1, subject: 1 },
  { unique: true }
);
subjectSubmissionSchema.index({ schoolId: 1, examId: 1 });
subjectSubmissionSchema.index({ schoolId: 1, assignedTeacherId: 1, state: 1 });
subjectSubmissionSchema.index({ schoolId: 1, classId: 1 });

const SubjectSubmission = mongoose.model(
  'SubjectSubmission',
  subjectSubmissionSchema
);

module.exports = SubjectSubmission;
