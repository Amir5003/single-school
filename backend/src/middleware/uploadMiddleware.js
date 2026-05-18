const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ── Logo upload (single image, school-logos folder) ──────────────────────────

const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'school-logos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
    transformation: [{ width: 400, height: 400, crop: 'limit' }],
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single('logo');

// ── Homework attachments (up to 5, pdf + images) ─────────────────────────────

const homeworkStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'homework-attachments',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'auto',
  },
});

const uploadHomeworkAttachment = multer({
  storage: homeworkStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
}).array('attachments', 5);

module.exports = { uploadLogo, uploadHomeworkAttachment };
