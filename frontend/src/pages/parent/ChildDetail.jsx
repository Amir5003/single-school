import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getChildAttendance,
  getChildCoursework,
  getChildFees,
  getChildHomework,
  getChildNotifications,
  getChildExams,
  getChildResult,
} from '../../api/parent.api';
import { selectSchoolSlug } from '../../redux/slices/authSlice';
import { slideInRight } from '../../utils/animationVariants';
import { assessmentTypeLabel } from '../../utils/assessmentTypes';

const TABS = ['Attendance', 'Coursework', 'Report Cards', 'Fees', 'Homework', 'Notifications'];

const STATUS_COLOR = {
  Present: 'bg-green-100 text-green-700',
  Absent: 'bg-red-100 text-red-700',
  Late: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

export default function ChildDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const schoolSlug = useSelector(selectSchoolSlug);
  const base = schoolSlug ? `/schools/${schoolSlug}` : '';
  const [activeTab, setActiveTab] = useState('Attendance');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (data[activeTab]) return; // cache per tab
    const fetchers = {
      Attendance: () => getChildAttendance(studentId).then((r) => r.data.attendance),
      Coursework: () => getChildCoursework(studentId).then((r) => r.data.subjects),
      'Report Cards': async () => {
        // Published exams only; each row carries the child's own result.
        const { data } = await getChildExams(studentId);
        const exams = data.exams || [];
        const settled = await Promise.all(
          exams.map((exam) =>
            getChildResult(studentId, exam._id)
              .then((r) => ({ exam, result: r.data }))
              .catch(() => null)
          )
        );
        return settled.filter(Boolean);
      },
      Fees: () => getChildFees(studentId).then((r) => r.data.fees),
      Homework: () => getChildHomework(studentId).then((r) => r.data.homework),
      Notifications: () => getChildNotifications(studentId).then((r) => r.data.notifications),
    };
    setLoading(true);
    setError('');
    fetchers[activeTab]()
      .then((items) => setData((d) => ({ ...d, [activeTab]: items || [] })))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [activeTab, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = data[activeTab] || [];

  const renderContent = () => {
    if (loading) return <p className="text-gray-400 py-6 text-center">Loading…</p>;
    if (error) return <p className="text-red-600 py-6 text-center">{error}</p>;
    if (items.length === 0)
      return <p className="text-gray-400 py-6 text-center">No records found.</p>;

    if (activeTab === 'Attendance') {
      return items.map((a) => (
        <div key={a._id} className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-700">{formatDate(a.date)}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] || 'bg-gray-100 text-gray-600'}`}>
            {a.status}
          </span>
        </div>
      ));
    }

    if (activeTab === 'Coursework') {
      // Grouped by subject, same shape the student sees.
      return items.map((group) => (
        <div key={group.subject} className="py-3 border-b border-gray-100 last:border-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">{group.subject}</p>
            {group.average !== null && (
              <span className="text-sm font-bold text-indigo-700">{group.average}%</span>
            )}
          </div>
          {group.entries.map((e) => (
            <div
              key={e._id}
              className="flex items-start justify-between gap-3 py-1 pl-3 border-l-2 border-gray-100"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700">{e.title}</p>
                <p className="text-[11px] text-gray-400">
                  {assessmentTypeLabel(e.assessmentType)} · {formatDate(e.date)}
                  {e.teacherName ? ` · ${e.teacherName}` : ''}
                </p>
                {e.remarks ? (
                  <p className="text-[11px] text-gray-500 italic mt-0.5">“{e.remarks}”</p>
                ) : null}
              </div>
              <span className="text-xs font-bold text-gray-900 flex-none tabular-nums">
                {e.absent ? 'Absent' : `${e.marksObtained}/${e.maxMarks}`}
              </span>
            </div>
          ))}
        </div>
      ));
    }

    if (activeTab === 'Report Cards') {
      return items.map(({ exam, result }) => (
        <div key={exam._id} className="py-3 border-b border-gray-100 last:border-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">{exam.name}</p>
              <p className="text-xs text-gray-500">
                {exam.term} · {exam.year}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">
                {result.overallPercentage}%
              </p>
              {result.rank != null && (
                <p className="text-xs text-gray-500">Rank {result.rank}</p>
              )}
            </div>
          </div>
          {(result.marks || []).map((m) => (
            <div
              key={m.subject}
              className="flex items-center justify-between py-1 pl-3 border-l-2 border-gray-100"
            >
              <span className="text-xs text-gray-600">{m.subject}</span>
              <span
                className={`text-xs font-medium ${
                  m.passed ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {m.marksObtained}/{m.totalMarks}
              </span>
            </div>
          ))}
        </div>
      ));
    }

    if (activeTab === 'Fees') {
      return items.map((f) => (
        <div key={f._id} className="flex items-center justify-between py-2 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-800">{f.description}</p>
            <p className="text-xs text-gray-500">Due: {formatDate(f.dueDate)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">₹{f.amount}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[f.status] || 'bg-gray-100 text-gray-600'}`}>
              {f.status}
            </span>
          </div>
        </div>
      ));
    }

    if (activeTab === 'Homework') {
      return items.map((hw) => (
        <div key={hw._id} className="py-2 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-800">{hw.title}</p>
          <p className="text-xs text-gray-500">Due: {formatDate(hw.dueDate)}</p>
          {hw.description && <p className="text-xs text-gray-600 mt-1">{hw.description}</p>}
          {hw.attachments?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hw.attachments.map((att) => (
                <a
                  key={att.publicId}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  {att.filename}
                </a>
              ))}
            </div>
          )}
        </div>
      ));
    }

    if (activeTab === 'Notifications') {
      return items.map((n) => (
        <div key={n._id} className="py-2 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-800">{n.title}</p>
          <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.createdAt)}</p>
        </div>
      ));
    }

    return null;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate(`${base}/parent/dashboard`)}
        className="mb-4 text-sm text-blue-600 hover:underline"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-4">Child Details</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={slideInRight}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="min-h-[200px]"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
