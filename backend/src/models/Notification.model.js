const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetRole: {
      type: String,
      enum: ['all', 'teacher', 'student', 'parent'],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

notificationSchema.index({ schoolId: 1, targetRole: 1, createdAt: -1 });
notificationSchema.index({ schoolId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
