const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
    },
    enrollmentId: {
      type: String,
      required: [true, 'Enrollment ID is required'],
      unique: true,
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

// classId and isDeleted indexes (enrollmentId unique index handled by field definition)
studentSchema.index({ classId: 1 });
studentSchema.index({ isDeleted: 1 });

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
