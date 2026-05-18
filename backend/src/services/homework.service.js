const Homework = require('../models/Homework.model');
const cloudinary = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

const PAGE_SIZE = 20;

/**
 * Create a homework document.
 * `files` is the array from multer-storage-cloudinary; each element has
 *   { path: secureUrl, filename: publicId, originalname }.
 */
const createHomework = async (schoolId, teacherId, data, files = []) => {
  const { classId, title, description, dueDate } = data;

  const attachments = files.map((f) => ({
    url: f.path,
    publicId: f.filename,
    filename: f.originalname,
  }));

  return Homework.create({
    schoolId,
    classId,
    teacherId,
    title,
    description: description || null,
    dueDate,
    attachments,
  });
};

/**
 * List homework for a class, sorted by dueDate descending.
 */
const listForClass = async (schoolId, classId, { page = 1, limit = PAGE_SIZE } = {}) => {
  const filter = { schoolId, classId, isDeleted: false };
  const skip = (page - 1) * limit;
  const [homework, total] = await Promise.all([
    Homework.find(filter).sort({ dueDate: -1 }).skip(skip).limit(Number(limit)).lean(),
    Homework.countDocuments(filter),
  ]);
  return { homework, total, page: Number(page), pages: Math.ceil(total / limit) };
};

/**
 * Soft-delete a homework document.
 * Only the teacher who created it (or a school-admin) can delete it.
 * Removes Cloudinary assets after the DB record is soft-deleted.
 *
 * @param {string} schoolId
 * @param {string} homeworkId
 * @param {string} teacherId  — the requesting teacher's Teacher._id (or null for admin)
 */
const deleteHomework = async (schoolId, homeworkId, teacherId) => {
  const filter = { _id: homeworkId, schoolId, isDeleted: false };
  if (teacherId) filter.teacherId = teacherId;

  const homework = await Homework.findOneAndUpdate(
    filter,
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!homework) throw new ApiError(404, 'Homework not found or not authorised to delete');

  // Remove Cloudinary assets in the background (non-blocking)
  for (const att of homework.attachments) {
    cloudinary.uploader.destroy(att.publicId).catch(() => {}); // best-effort
  }

  return homework;
};

module.exports = { createHomework, listForClass, deleteHomework };
