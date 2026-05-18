const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: ['super-admin', 'school-admin', 'teacher', 'student', 'parent'],
      required: [true, 'Role is required'],
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    rejectionRemark: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
  }
);

userSchema.index({ schoolId: 1, role: 1 });
userSchema.index({ schoolId: 1, isActive: 1 });

// Hash password only when it has been modified
// Mongoose 8: use async without `next` parameter — return the Promise, don't call next()
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
