const mongoose = require('mongoose');

const classTeacherSchema = new mongoose.Schema(
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

// A teacher can only be assigned to the same class for the same subject once (scoped by school)
classTeacherSchema.index({ schoolId: 1, classId: 1, teacherId: 1, subject: 1 }, { unique: true });
classTeacherSchema.index({ schoolId: 1, classId: 1, teacherId: 1 });
classTeacherSchema.index({ schoolId: 1, teacherId: 1 });

const ClassTeacher = mongoose.model('ClassTeacher', classTeacherSchema);

module.exports = ClassTeacher;
