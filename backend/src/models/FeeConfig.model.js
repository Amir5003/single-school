const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * FeeConfig — a class-level fee template.
 * Admins create one config per class per fee cycle (e.g. "Term 1 Fees — Class 5A").
 * Calling /generate on a config creates individual Fee records for every enrolled student.
 */
const feeConfigSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    classId:  { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    label:    { type: String, required: true, trim: true, maxlength: 200 },
    amount:   { type: Number, required: true, min: 0 },
    dueDate:  { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

feeConfigSchema.index({ schoolId: 1, classId: 1 });

module.exports = mongoose.model('FeeConfig', feeConfigSchema);
