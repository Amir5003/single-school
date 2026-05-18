const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
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
    examType: {
      type: String,
      enum: ['midterm', 'final', 'quiz', 'assignment'],
      default: 'final',
    },
    marksObtained: {
      type: Number,
      required: [true, 'Marks obtained is required'],
      min: [0, 'Marks cannot be less than 0'],
      max: [100, 'Marks cannot exceed 100'],
    },
    maxMarks: {
      type: Number,
      default: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Prevents duplicate entry for same student+subject+class+examType combination within a school
marksSchema.index(
  { schoolId: 1, studentId: 1, subject: 1, classId: 1, examType: 1 },
  { unique: true }
);

marksSchema.index({ schoolId: 1, studentId: 1, examType: 1, subject: 1 });
marksSchema.index({ schoolId: 1, classId: 1, examType: 1 });

const Marks = mongoose.model('Marks', marksSchema);

module.exports = Marks;
