const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Leave'],
      required: [true, 'Status is required'],
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Marked by teacher is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Prevents double-marking a student on the same date within a school
attendanceSchema.index({ schoolId: 1, studentId: 1, date: 1 }, { unique: true });

// Fast lookups by class + date within a school (bulk attendance fetch)
attendanceSchema.index({ schoolId: 1, classId: 1, date: 1 });

// Fast lookups by student (student attendance history)
attendanceSchema.index({ studentId: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
