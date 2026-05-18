const mongoose = require('mongoose');
const { Schema } = mongoose;

const brandingSchema = new Schema(
  {
    logoUrl: { type: String, default: null },
    primaryColor: { type: String, default: '#1a73e8' },
    secondaryColor: { type: String, default: '#fbbc04' },
    tagline: { type: String, default: null, maxlength: 200 },
    address: { type: String, default: null, maxlength: 500 },
    contactNumber: { type: String, default: null },
  },
  { _id: false }
);

const schoolSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'Invalid slug format'],
    },
    slugLockedAt: { type: Date, default: null },
    plan: {
      type: String,
      enum: ['free', 'standard', 'premium'],
      default: 'free',
    },
    isActive: { type: Boolean, default: false },
    branding: { type: brandingSchema, default: () => ({}) },
  },
  { timestamps: true }
);

schoolSchema.index({ isActive: 1 });
schoolSchema.index({ plan: 1 });

module.exports = mongoose.model('School', schoolSchema);
