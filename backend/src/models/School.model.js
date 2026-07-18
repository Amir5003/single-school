const mongoose = require('mongoose');
const { Schema } = mongoose;

const TRIAL_DURATION_DAYS = 30;
const GRACE_DURATION_DAYS = 7;
const DEFAULT_MAX_TRIAL_STUDENTS = 50;

const SUBSCRIPTION_STATUSES = [
  'trial',
  'trial_limit_reached',
  'grace_period',
  'active',
  'expired',
  'cancelled',
];

const PLAN_TYPES = ['starter', 'standard', 'premium'];
const BILLING_CYCLES = ['monthly', 'annual'];

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

const scheduledChangeSchema = new Schema(
  {
    planType: { type: String, enum: PLAN_TYPES, required: true },
    billingCycle: { type: String, enum: BILLING_CYCLES, required: true },
    // Apply when the current paid window ends (subscriptionEndsAt). Stored
    // explicitly so we don't have to recompute every cron tick.
    applyAt: { type: Date, required: true },
    scheduledAt: { type: Date, default: () => new Date() },
    reason: { type: String, default: null },
  },
  { _id: false }
);

const subscriptionSchema = new Schema(
  {
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: 'trial',
    },
    planType: {
      type: String,
      enum: PLAN_TYPES,
      default: 'starter',
    },
    // Billing cycle of the *current* paid window. Trial/grace don't use it.
    billingCycle: {
      type: String,
      enum: BILLING_CYCLES,
      default: 'monthly',
    },

    // Trial window
    trialStartedAt: { type: Date, default: () => new Date() },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000),
    },

    // Grace window
    graceStartedAt: { type: Date, default: null },
    graceEndsAt: { type: Date, default: null },

    // Paid subscription window
    subscriptionStartedAt: { type: Date, default: null },
    subscriptionEndsAt: { type: Date, default: null },

    // Usage cache
    activeStudentCount: { type: Number, default: 0, min: 0 },
    maxTrialStudents: { type: Number, default: DEFAULT_MAX_TRIAL_STUDENTS, min: 1 },

    // Pricing snapshot (rupees) — `basePrice` is the per-cycle plan amount,
    // `perStudentPrice` is retained at 0 for backward-compat.
    basePrice: { type: Number, default: 0, min: 0 },
    perStudentPrice: { type: Number, default: 0, min: 0 },

    // Payment metadata
    lastPaymentAt: { type: Date, default: null },
    lastPaymentId: { type: String, default: null },
    nextBillingDate: { type: Date, default: null },
    paymentProvider: { type: String, default: null },

    // Scheduled plan/cycle change to apply at the end of the current window
    // (used for downgrades — never charged immediately).
    scheduledChange: { type: scheduledChangeSchema, default: null },
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
    subscription: { type: subscriptionSchema, default: () => ({}) },
  },
  { timestamps: true }
);

schoolSchema.index({ isActive: 1 });
schoolSchema.index({ plan: 1 });
schoolSchema.index({ 'subscription.status': 1 });
schoolSchema.index({ 'subscription.trialEndsAt': 1 });
schoolSchema.index({ 'subscription.graceEndsAt': 1 });
schoolSchema.index({ 'subscription.subscriptionEndsAt': 1 });

const School = mongoose.model('School', schoolSchema);
School.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES;
School.PLAN_TYPES = PLAN_TYPES;
School.BILLING_CYCLES = BILLING_CYCLES;
School.TRIAL_DURATION_DAYS = TRIAL_DURATION_DAYS;
School.GRACE_DURATION_DAYS = GRACE_DURATION_DAYS;
School.DEFAULT_MAX_TRIAL_STUDENTS = DEFAULT_MAX_TRIAL_STUDENTS;

module.exports = School;
