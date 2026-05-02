const Timetable = require('../models/Timetable.model');
const ApiError = require('../utils/ApiError');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Populate teacher name on a Timetable query.
 * Teacher → User (nested populate for the user's name).
 */
const populateEntry = (query) =>
  query.populate({
    path: 'teacherId',
    populate: { path: 'userId', select: 'name email' },
  });

/**
 * Check for time-slot conflicts.
 *
 * Two periods overlap when:
 *   existing.startTime < new.endTime  AND  existing.endTime > new.startTime
 *
 * HH:MM zero-padded strings compare correctly with MongoDB's lexicographic $lt/$gt.
 *
 * @param {object} data       The entry data being created / updated
 * @param {string} [excludeId] _id to exclude (for update conflict re-check)
 */
const checkConflicts = async (data, excludeId = null) => {
  const { classId, teacherId, day, startTime, endTime } = data;

  const overlapFilter = {
    day,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeId) {
    overlapFilter._id = { $ne: excludeId };
  }

  const [classConflict, teacherConflict] = await Promise.all([
    Timetable.findOne({ classId, ...overlapFilter }),
    Timetable.findOne({ teacherId, ...overlapFilter }),
  ]);

  if (classConflict) {
    throw new ApiError(
      409,
      `Time conflict: class already has a period on ${day} from ${classConflict.startTime} to ${classConflict.endTime}`
    );
  }
  if (teacherConflict) {
    throw new ApiError(
      409,
      `Time conflict: teacher already has a period on ${day} from ${teacherConflict.startTime} to ${teacherConflict.endTime}`
    );
  }
};

// ── Service functions ────────────────────────────────────────────────────────

/**
 * Create a timetable entry after conflict detection.
 *
 * @param {{ classId, teacherId, subject, day, startTime, endTime }} data
 * @returns {Promise<Timetable>}
 */
const createEntry = async (data) => {
  await checkConflicts(data);
  const entry = await Timetable.create(data);
  return populateEntry(Timetable.findById(entry._id));
};

/**
 * List all timetable entries for a class (sorted by day + startTime).
 *
 * @param {string} classId
 * @returns {Promise<Timetable[]>}
 */
const listByClass = async (classId) => {
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const entries = await populateEntry(
    Timetable.find({ classId })
  );

  // Sort by day order then startTime (string comparison is safe for HH:MM)
  entries.sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime < b.startTime ? -1 : 1;
  });

  return entries;
};

/**
 * Update a timetable entry, re-running conflict detection (excluding the entry itself).
 *
 * @param {string} id   Timetable document _id
 * @param {object} data Partial fields to update
 */
const updateEntry = async (id, data) => {
  const existing = await Timetable.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Timetable entry not found');
  }

  // Merge with existing values so conflict check has a complete picture
  const merged = {
    classId:    data.classId   ?? existing.classId,
    teacherId:  data.teacherId ?? existing.teacherId,
    day:        data.day       ?? existing.day,
    startTime:  data.startTime ?? existing.startTime,
    endTime:    data.endTime   ?? existing.endTime,
  };

  await checkConflicts(merged, id);

  const updateFields = {};
  ['classId', 'teacherId', 'subject', 'day', 'startTime', 'endTime'].forEach((f) => {
    if (data[f] !== undefined) updateFields[f] = data[f];
  });

  return populateEntry(
    Timetable.findByIdAndUpdate(id, { $set: updateFields }, { new: true })
  );
};

/**
 * Delete a timetable entry by ID.
 *
 * @param {string} id
 */
const deleteEntry = async (id) => {
  const entry = await Timetable.findById(id);
  if (!entry) {
    throw new ApiError(404, 'Timetable entry not found');
  }
  await Timetable.findByIdAndDelete(id);
};

module.exports = { createEntry, listByClass, updateEntry, deleteEntry };
