const mongoose = require('mongoose');

const classTeacherSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// A teacher can only be assigned to the same class for the same subject once
classTeacherSchema.index({ classId: 1, teacherId: 1, subject: 1 }, { unique: true });

const ClassTeacher = mongoose.model('ClassTeacher', classTeacherSchema);

module.exports = ClassTeacher;
