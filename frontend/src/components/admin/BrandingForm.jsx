import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { setSchoolConfig } from '../../redux/slices/schoolSlice';
import { updateBranding, uploadLogo } from '../../api/admin.api';
import { fadeInUp } from '../../utils/animationVariants';

const BrandingForm = () => {
  const dispatch = useDispatch();

  const [form, setForm] = useState({
    primaryColor: '#1a73e8',
    secondaryColor: '#fbbc04',
    tagline: '',
    address: '',
    contactNumber: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // 1. Update text branding fields
      const res = await updateBranding(form);
      const updatedSchool = res.data?.school;

      // 2. Upload logo if selected
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        const logoRes = await uploadLogo(fd);
        const schoolWithLogo = logoRes.data?.school;
        if (schoolWithLogo) {
          dispatch(setSchoolConfig({ branding: schoolWithLogo.branding }));
        }
      } else if (updatedSchool) {
        dispatch(setSchoolConfig({ branding: updatedSchool.branding }));
      }

      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-lg shadow p-6 max-w-xl"
    >
      <h2 className="text-xl font-semibold mb-4">School Branding</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
          Branding saved successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Color Pickers */}
        <div className="flex gap-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Primary Colour
            <input
              type="color"
              name="primaryColor"
              value={form.primaryColor}
              onChange={handleChange}
              className="w-12 h-10 cursor-pointer border rounded"
            />
            <span className="text-xs text-gray-400">{form.primaryColor}</span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Secondary Colour
            <input
              type="color"
              name="secondaryColor"
              value={form.secondaryColor}
              onChange={handleChange}
              className="w-12 h-10 cursor-pointer border rounded"
            />
            <span className="text-xs text-gray-400">{form.secondaryColor}</span>
          </label>

          {/* Live Preview */}
          <div className="ml-auto flex flex-col gap-1 text-sm font-medium text-gray-700">
            Preview
            <div className="flex gap-2 items-center">
              <div
                className="w-8 h-8 rounded"
                style={{ background: form.primaryColor }}
              />
              <div
                className="w-8 h-8 rounded"
                style={{ background: form.secondaryColor }}
              />
            </div>
          </div>
        </div>

        {/* Tagline */}
        <label className="block text-sm font-medium text-gray-700">
          Tagline
          <input
            type="text"
            name="tagline"
            value={form.tagline}
            onChange={handleChange}
            maxLength={200}
            placeholder="e.g. Inspiring Tomorrow's Leaders"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {/* Address */}
        <label className="block text-sm font-medium text-gray-700">
          Address
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            maxLength={500}
            rows={2}
            placeholder="123 School St, City"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {/* Contact Number */}
        <label className="block text-sm font-medium text-gray-700">
          Contact Number
          <input
            type="text"
            name="contactNumber"
            value={form.contactNumber}
            onChange={handleChange}
            placeholder="+1 555-0100"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {/* Logo Upload */}
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1">School Logo</span>
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="w-16 h-16 object-contain rounded border"
              />
            )}
            <label className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
              {logoPreview ? 'Change Logo' : 'Upload Logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : 'Save Branding'}
        </button>
      </form>
    </motion.div>
  );
};

export default BrandingForm;
