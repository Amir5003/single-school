const mongoose = require('mongoose');
const { Schema } = mongoose;

const parentStudentLinkSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  },
  { timestamps: true }
);

parentStudentLinkSchema.index({ schoolId: 1, parentId: 1 });
parentStudentLinkSchema.index({ schoolId: 1, studentId: 1 });
parentStudentLinkSchema.index({ parentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ParentStudentLink', parentStudentLinkSchema);
