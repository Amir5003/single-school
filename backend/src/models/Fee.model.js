const mongoose = require('mongoose');
const { Schema } = mongoose;

const feeSchema = new Schema(
  {
    schoolId:   { type: Schema.Types.ObjectId, ref: 'School',    required: true },
    studentId:  { type: Schema.Types.ObjectId, ref: 'Student',   required: true },
    configId:   { type: Schema.Types.ObjectId, ref: 'FeeConfig', default: null },
    amount:     { type: Number, required: true, min: 0 },
    description:{ type: String, required: true, trim: true, maxlength: 300 },
    dueDate:    { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'exempt'],
      default: 'pending',
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

feeSchema.index({ schoolId: 1, studentId: 1, status: 1 });
feeSchema.index({ schoolId: 1, dueDate: 1, status: 1 });

module.exports = mongoose.model('Fee', feeSchema);
