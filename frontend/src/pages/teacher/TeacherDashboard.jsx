import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import { getTeacherClasses } from '../../api/teacher.api';

// ── Class card ────────────────────────────────────────────────────────────────

function ClassCard({ assignment, onAttendance, onMarks }) {
  const cls = assignment.classId;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{cls?.name ?? '—'}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Grade {cls?.grade} · Section {cls?.section}
          </p>
        </div>
        <span className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-0.5 font-medium shrink-0">
          {assignment.subject}
        </span>
      </div>

      {/* Stats */}
      <p className="text-xs text-gray-400">
        {assignment.studentCount}{' '}
        {assignment.studentCount === 1 ? 'student' : 'students'} enrolled
      </p>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onAttendance(cls?._id)}
          className="flex-1 rounded-xl bg-indigo-600 text-white text-xs font-semibold py-2 hover:bg-indigo-700 transition"
        >
          Mark Attendance
        </button>
        <button
          onClick={() => onMarks(cls?._id)}
          className="flex-1 rounded-xl border border-indigo-300 text-indigo-700 text-xs font-semibold py-2 hover:bg-indigo-50 transition"
        >
          Enter Marks
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await getTeacherClasses();
        setClasses(res.data?.classes ?? []);
      } catch {
        setError('Failed to load classes.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Layout role="teacher">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">My Classes</h2>
        <p className="text-sm text-gray-500 mt-0.5">Select a class to mark attendance or enter marks.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-12 text-center">
          <p className="text-sm text-gray-400">No classes assigned yet.</p>
          <p className="text-xs text-gray-300 mt-1">Contact the admin to get assigned to a class.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((assignment, idx) => (
            <ClassCard
              key={assignment.classId?._id ?? idx}
              assignment={assignment}
              onAttendance={(classId) =>
                navigate(`/teacher/attendance?classId=${classId}&date=${today}`)
              }
              onMarks={(classId) => navigate(`/teacher/marks?classId=${classId}`)}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}

