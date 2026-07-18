const mongoose = require('mongoose');
const { Schema } = mongoose;

const SUBSCRIPTION_EVENT_TYPES = [
  'trial_started',
  'trial_warning',
  'trial_limit_reached',
  'trial_limit_cleared',
  'grace_started',
  'subscription_activated',
  'payment_success',
  'payment_failed',
  'subscription_expired',
  'subscription_cancelled',
  'student_count_recalculated',
  'plan_changed',
  'migrated',
];

const subscriptionEventSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: SUBSCRIPTION_EVENT_TYPES,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false }
);

subscriptionEventSchema.index({ schoolId: 1, createdAt: -1 });
subscriptionEventSchema.index(
  { 'metadata.providerPaymentId': 1 },
  { sparse: true, unique: false }
);

const SubscriptionEvent = mongoose.model('SubscriptionEvent', subscriptionEventSchema);
SubscriptionEvent.TYPES = SUBSCRIPTION_EVENT_TYPES;

module.exports = SubscriptionEvent;
