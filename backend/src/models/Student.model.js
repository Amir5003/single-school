const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
    },
    enrollmentId: {
      type: String,
      required: [true, 'Enrollment ID is required'],
      trim: true,
      uppercase: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique: enrollmentId must be unique within a school
studentSchema.index({ schoolId: 1, enrollmentId: 1 }, { unique: true });
studentSchema.index({ schoolId: 1, classId: 1 });
studentSchema.index({ schoolId: 1, isDeleted: 1 });

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
