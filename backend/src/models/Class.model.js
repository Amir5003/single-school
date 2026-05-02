const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

// Compound unique index — one section per grade (e.g. Grade 5 Section A is unique)
classSchema.index({ grade: 1, section: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);

module.exports = Class;
