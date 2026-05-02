const mongoose = require('mongoose');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timetableSchema = new mongoose.Schema(
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
    day: {
      type: String,
      enum: DAYS,
      required: [true, 'Day is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [TIME_REGEX, 'Start time must be in HH:MM format (e.g. 08:00)'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [TIME_REGEX, 'End time must be in HH:MM format (e.g. 09:00)'],
    },
  },
  {
    timestamps: true,
  }
);

// Composite index for fast lookups by class + day (used in conflict checks and list)
timetableSchema.index({ classId: 1, day: 1 });

const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable;
