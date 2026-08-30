const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: [2000, 'Content cannot exceed 2000 characters'],
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher is required'],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    // When the announcement stops being shown to students/parents and on the
    // public landing page. `null` means "always visible" — the default, so an
    // announcement never disappears unless the author asked it to.
    visibleUntil: {
      type: Date,
      default: null,
    },
    targetRole: {
      type: String,
      enum: ['all', 'teacher', 'student', 'parent'],
      default: 'all',
    },
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ schoolId: 1, createdAt: -1 });
announcementSchema.index({ schoolId: 1, targetRole: 1 });
announcementSchema.index({ isDeleted: 1 });
announcementSchema.index({ schoolId: 1, visibleUntil: 1 });

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;
