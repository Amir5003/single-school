import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getSchool, getAnalytics, activateSchool, deactivateSchool } from '../../api/platform.api';
import { scaleIn } from '../../utils/animationVariants';
import PlatformLayout from '../../components/common/PlatformLayout';

export default function SchoolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [schoolRes, analyticsRes] = await Promise.all([
          getSchool(id),
          getAnalytics(),
        ]);
        setSchool(schoolRes.data.school);
        const entry = analyticsRes.data.analytics.find(
          (a) => a.schoolId.toString() === id
        );
        setAnalytics(entry || null);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load school');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (school.isActive) {
        const res = await deactivateSchool(id);
        setSchool(res.data.school);
      } else {
        const res = await activateSchool(id);
        setSchool(res.data.school);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!school) return null;

  const statCards = [
    { label: 'Students', value: analytics?.students ?? '—' },
    { label: 'Teachers', value: analytics?.teachers ?? '—' },
    { label: 'Classes', value: analytics?.classes ?? '—' },
  ];

  return (
    <PlatformLayout>
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className="p-6 max-w-3xl mx-auto"
    >
      <button
        onClick={() => navigate('/platform/schools')}
        className="mb-4 text-sm text-blue-600 hover:underline"
      >
        ← Back to Schools
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
            <p className="text-gray-500 font-mono text-sm mt-1">{school.slug}</p>
            {school.branding?.tagline && (
              <p className="text-gray-600 mt-2 italic">{school.branding.tagline}</p>
            )}
          </div>
          {school.branding?.logoUrl && (
            <img
              src={school.branding.logoUrl}
              alt="School logo"
              className="w-16 h-16 object-contain rounded-lg border border-gray-100"
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded-full font-medium ${school.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {school.isActive ? 'Active' : 'Inactive'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium capitalize">
            {school.plan}
          </span>
        </div>

        {school.branding?.address && (
          <p className="mt-3 text-sm text-gray-600">{school.branding.address}</p>
        )}
        {school.branding?.contactNumber && (
          <p className="text-sm text-gray-600">{school.branding.contactNumber}</p>
        )}
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {statCards.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Branding preview */}
      {(school.branding?.primaryColor || school.branding?.secondaryColor) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Branding Preview</p>
          <div className="flex gap-3">
            <div
              className="w-12 h-12 rounded-lg border border-gray-200"
              style={{ backgroundColor: school.branding.primaryColor }}
              title={`Primary: ${school.branding.primaryColor}`}
            />
            <div
              className="w-12 h-12 rounded-lg border border-gray-200"
              style={{ backgroundColor: school.branding.secondaryColor }}
              title={`Secondary: ${school.branding.secondaryColor}`}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${school.isActive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'} disabled:opacity-50`}
      >
        {toggling ? 'Working…' : school.isActive ? 'Deactivate School' : 'Activate School'}
      </button>
    </motion.div>
    </PlatformLayout>
  );
}
