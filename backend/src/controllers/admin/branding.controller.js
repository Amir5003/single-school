const schoolService = require('../../services/school.service');
const ApiResponse = require('../../utils/ApiResponse');

const updateBranding = async (req, res, next) => {
  try {
    const schoolId = req.school._id;
    const school = await schoolService.updateBranding(schoolId, req.body);
    res.json(new ApiResponse(200, { school }, 'Branding updated successfully'));
  } catch (err) {
    next(err);
  }
};

const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(new ApiResponse(400, null, 'No logo file provided'));
    }
    const schoolId = req.school._id;
    const school = await schoolService.uploadLogo(schoolId, req.file);
    res.json(new ApiResponse(200, { school }, 'Logo uploaded successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = { updateBranding, uploadLogo };
