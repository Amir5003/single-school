const mongoose = require('mongoose');
const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    filename: { type: String, required: true },
  },
  { _id: false }
);

const homeworkSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    dueDate: { type: Date, required: true },
    attachments: { type: [attachmentSchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

homeworkSchema.index({ schoolId: 1, classId: 1, dueDate: 1 });
homeworkSchema.index({ schoolId: 1, teacherId: 1 });

module.exports = mongoose.model('Homework', homeworkSchema);
