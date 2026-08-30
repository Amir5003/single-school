import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../../components/common/Layout';
import StatusMessage from '../../components/common/StatusMessage';
import { selectSchoolBranding, selectSchoolName, setSchoolBranding } from '../../redux/slices/schoolSlice';
import { selectSchoolSlug } from '../../redux/slices/authSlice';
import { getSchoolProfile, updateSchoolBranding } from '../../api/admin.api';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function SchoolSettingsPage() {
  const dispatch = useDispatch();
  const schoolSlug = useSelector(selectSchoolSlug);
  const schoolName = useSelector(selectSchoolName);
  const branding   = useSelector(selectSchoolBranding);

  const [form, setForm] = useState({
    primaryColor:   branding?.primaryColor   ?? '#1a73e8',
    secondaryColor: branding?.secondaryColor ?? '#fbbc04',
    tagline:        branding?.tagline        ?? '',
    address:        branding?.address        ?? '',
    contactNumber:  branding?.contactNumber  ?? '',
  });

  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);
  const [status,   setStatus]   = useState({ message: '', type: 'success' });

  // Load latest values from the public config endpoint so we always show live DB data
  useEffect(() => {
    if (!schoolSlug) return;
    getSchoolProfile(schoolSlug)
      .then((res) => {
        const b = res.data?.school?.branding ?? {};
        setForm({
          primaryColor:   b.primaryColor   ?? '#1a73e8',
          secondaryColor: b.secondaryColor ?? '#fbbc04',
          tagline:        b.tagline        ?? '',
          address:        b.address        ?? '',
          contactNumber:  b.contactNumber  ?? '',
        });
      })
      .catch(() => {/* use Redux fallback already set */})
      .finally(() => setFetching(false));
  }, [schoolSlug]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validate hex colors
    if (!HEX_RE.test(form.primaryColor)) {
      setStatus({ message: 'Primary color must be a valid hex (e.g. #1a73e8)', type: 'error' });
      return;
    }
    if (!HEX_RE.test(form.secondaryColor)) {
      setStatus({ message: 'Secondary color must be a valid hex (e.g. #fbbc04)', type: 'error' });
      return;
    }

    setLoading(true);
    setStatus({ message: '', type: 'success' });
    try {
      const payload = {
        primaryColor:   form.primaryColor,
        secondaryColor: form.secondaryColor,
        tagline:        form.tagline  || null,
        address:        form.address  || null,
        contactNumber:  form.contactNumber || null,
      };
      const res = await updateSchoolBranding(payload);
      const updated = res.data?.school?.branding ?? payload;

      // Push updated branding into Redux so Navbar/Sidebar reflect changes immediately
      dispatch(setSchoolBranding(updated));
      setStatus({ message: 'School settings saved successfully.', type: 'success' });
    } catch (err) {
      setStatus({
        message: err?.response?.data?.message ?? 'Failed to save settings.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout role="school-admin">
      {/* Scrollable page body */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-28 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">School Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customise your school's branding and contact information.
          </p>
        </div>

        <StatusMessage message={status.message} type={status.type} />

        {fetching ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <form id="settings-form" onSubmit={handleSubmit} className="space-y-5">
            {/* School name (read-only) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Identity</h2>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">School Name</label>
                <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
                  {schoolName ?? '—'}
                </div>
                <p className="text-xs text-gray-400">Contact platform support to change your school name.</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Tagline <span className="text-gray-400">(optional)</span></label>
                <input
                  value={form.tagline}
                  onChange={(e) => set('tagline', e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Nurturing Minds, Building Futures"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            {/* Contact info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Contact Information</h2>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Address <span className="text-gray-400">(optional)</span></label>
                <textarea
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="123 School Lane, City, State"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Contact Number <span className="text-gray-400">(optional)</span></label>
                <input
                  type="tel"
                  value={form.contactNumber}
                  onChange={(e) => set('contactNumber', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            {/* Branding colors */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Brand Colors</h2>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-medium text-gray-600">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => set('primaryColor', e.target.value)}
                      className="h-9 w-12 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.primaryColor}
                      onChange={(e) => set('primaryColor', e.target.value)}
                      maxLength={7}
                      placeholder="#1a73e8"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-medium text-gray-600">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.secondaryColor}
                      onChange={(e) => set('secondaryColor', e.target.value)}
                      className="h-9 w-12 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.secondaryColor}
                      onChange={(e) => set('secondaryColor', e.target.value)}
                      maxLength={7}
                      placeholder="#fbbc04"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="mt-2 rounded-xl border border-gray-100 overflow-hidden">
                <div
                  className="h-10 flex items-center px-4"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  <span className="text-white text-sm font-semibold">{schoolName ?? 'School Name'}</span>
                  {form.tagline && (
                    <span className="ml-3 text-white/70 text-xs hidden sm:block">{form.tagline}</span>
                  )}
                </div>
                <div
                  className="h-2"
                  style={{ backgroundColor: form.secondaryColor }}
                />
                <div className="bg-white px-4 py-3 text-xs text-gray-500 space-y-0.5">
                  {form.address && <p>📍 {form.address}</p>}
                  {form.contactNumber && <p>📞 {form.contactNumber}</p>}
                  {!form.address && !form.contactNumber && (
                    <p className="text-gray-300 italic">Address and contact number will appear here</p>
                  )}
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Sticky action footer — always visible at bottom of scroll area */}
      {!fetching && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mt-2">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400 hidden sm:block">
              Changes are applied to your school profile immediately.
            </p>
            <button
              type="submit"
              form="settings-form"
              disabled={loading}
              className="ml-auto rounded-xl bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
