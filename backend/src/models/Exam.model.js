const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    totalMarks: { type: Number, required: true, min: 1 },
    passMark: { type: Number, default: null }, // null → use global 35%
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    term: {
      type: String,
      required: true,
      enum: ['Term 1', 'Term 2', 'Term 3', 'Mid-Year', 'Final'],
    },
    subjects: { type: [subjectSchema], default: [] },
    publishedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound indexes
examSchema.index({ schoolId: 1, classId: 1, year: 1, term: 1 });
examSchema.index({ schoolId: 1, year: 1 });
examSchema.index({ schoolId: 1, isDeleted: 1 });
examSchema.index(
  { schoolId: 1, classId: 1, name: 1, year: 1, term: 1 },
  { unique: true }
);

const Exam = mongoose.model('Exam', examSchema);

module.exports = Exam;
