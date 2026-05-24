const mongoose = require('mongoose');

const markEntrySchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    marksObtained: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    marks: { type: [markEntrySchema], default: [] },
    overallPercentage: { type: Number, default: null },
    rank: { type: Number, default: null },
    published: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Unique per student per exam per school
resultSchema.index({ schoolId: 1, examId: 1, studentId: 1 }, { unique: true });
resultSchema.index({ schoolId: 1, studentId: 1, examId: 1 });
resultSchema.index({ schoolId: 1, examId: 1 });
resultSchema.index({ schoolId: 1, studentId: 1, published: 1 });

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;
