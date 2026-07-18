const mongoose = require('mongoose');
const Student = require('../../models/Student.model');
const User = require('../../models/User.model');
const School = require('../../models/School.model');
const eventService = require('./event.service');
const lifecycleService = require('./lifecycle.service');
const logger = require('../../utils/logger');

/**
 * Canonical definition of "active student":
 *   - Student.isDeleted == false
 *   - linked User.isActive == true
 *   - linked User.approvalStatus == 'approved'
 *
 * Implemented as an aggregation so we don't pull every doc into memory.
 *
 * @param {string|ObjectId} schoolId
 * @returns {Promise<number>}
 */
const recount = async (schoolId) => {
  const sid =
    typeof schoolId === 'string' ? new mongoose.Types.ObjectId(schoolId) : schoolId;

  const pipeline = [
    { $match: { schoolId: sid, isDeleted: false } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.isActive': true,
        'user.approvalStatus': 'approved',
      },
    },
    { $count: 'count' },
  ];

  const result = await Student.aggregate(pipeline);
  return result.length > 0 ? result[0].count : 0;
};

/**
 * Recount and update the cached `subscription.activeStudentCount`. If the
 * count crosses `maxTrialStudents` while still on a trial state, auto-flip
 * between `trial` and `trial_limit_reached`.
 *
 * Safe to call from any controller after a student create/update/delete.
 *
 * @param {string|ObjectId} schoolId
 * @param {object} [opts]
 * @param {boolean} [opts.silent]  Skip event logging when true (used by cron self-heal)
 */
const updateCachedCount = async (schoolId, { silent = false } = {}) => {
  const school = await School.findById(schoolId).lean();
  if (!school) return null;

  const previous = school.subscription?.activeStudentCount ?? 0;
  const count = await recount(schoolId);

  const update = { 'subscription.activeStudentCount': count };
  await School.findByIdAndUpdate(schoolId, { $set: update });

  if (!silent && count !== previous) {
    await eventService
      .logEvent(schoolId, 'student_count_recalculated', { previous, count })
      .catch(() => {});
  }

  // Trial auto-flip (only meaningful while the trial window is still open
  // and the school is in one of the two trial states).
  const status = school.subscription?.status;
  const maxTrial =
    school.subscription?.maxTrialStudents ?? School.DEFAULT_MAX_TRIAL_STUDENTS;
  const trialEndsAt = school.subscription?.trialEndsAt;
  const stillInsideTrialWindow =
    trialEndsAt && new Date(trialEndsAt).getTime() > Date.now();

  try {
    if (stillInsideTrialWindow) {
      if (status === 'trial' && count >= maxTrial) {
        const fresh = await School.findById(schoolId).lean();
        await lifecycleService.transitionTo(fresh, 'trial_limit_reached', {
          activeStudentCount: count,
          maxTrialStudents: maxTrial,
        });
      } else if (status === 'trial_limit_reached' && count < maxTrial) {
        const fresh = await School.findById(schoolId).lean();
        await lifecycleService.transitionTo(fresh, 'trial', {
          activeStudentCount: count,
          maxTrialStudents: maxTrial,
          reason: 'limit_cleared',
        });
      }
    }
  } catch (err) {
    logger.warn(
      `[subscription.studentCount] auto-flip skipped for ${schoolId}: ${err.message}`
    );
  }

  return count;
};

module.exports = { recount, updateCachedCount };
