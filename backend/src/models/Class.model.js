const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
    },
    grade: {
      type: String,
      required: [true, 'Grade is required'],
      trim: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
      uppercase: true,
      maxlength: [5, 'Section cannot exceed 5 characters'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique: class name must be unique within a school for an academic year
classSchema.index({ schoolId: 1, name: 1, academicYear: 1 }, { unique: true });
classSchema.index({ schoolId: 1, academicYear: 1 });

const Class = mongoose.model('Class', classSchema);

module.exports = Class;
