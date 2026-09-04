import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import StatusMessage from '../../components/common/StatusMessage';
import EmptyState from '../../components/common/EmptyState';
import { getTeacherClasses } from '../../api/teacher.api';
import { listAssessments, createAssessment, deleteAssessment } from '../../api/assessment.api';
import { ASSESSMENT_TYPES, assessmentTypeLabel } from '../../utils/assessmentTypes';
import { fadeInUp } from '../../utils/animationVariants';

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function CourseworkPage() {
  const { slug } = useParams();

  const [classes, setClasses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const [form, setForm] = useState({
    classId: '',
    subject: '',
    title: '',
    assessmentType: 'class_test',
    maxMarks: 20,
    date: today(),
  });

  const showStatus = useCallback((message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(
      () => setStatus({ message: '', type: 'success' }),
      5000
    );
  }, []);

  const reload = useCallback(async () => {
    const res = await listAssessments();
    setAssessments(res.data.assessments ?? []);
  }, []);

  useEffect(() => {
    Promise.all([getTeacherClasses(), listAssessments()])
      .then(([cls, list]) => {
        const items = cls.data.classes ?? [];
        setClasses(items);
        setAssessments(list.data.assessments ?? []);
        if (items.length > 0) {
          setForm((f) => ({
            ...f,
            classId: items[0].classId?._id ?? '',
            subject: items[0].subject ?? '',
          }));
        }
      })
      .catch(() => showStatus('Could not load coursework', 'error'))
      .finally(() => setLoading(false));
  }, [showStatus]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.classId || !form.subject.trim() || !form.title.trim()) {
      showStatus('Class, subject and title are all required', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAssessment({
        ...form,
        subject: form.subject.trim(),
        title: form.title.trim(),
        maxMarks: Number(form.maxMarks),
      });
      await reload();
      setForm((f) => ({ ...f, title: '' }));
      setShowForm(false);
      showStatus('Assessment created — now enter marks');
    } catch (err) {
      showStatus(err.response?.data?.message || 'Could not create assessment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}" and all its marks? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteAssessment(id);
      await reload();
      showStatus('Assessment deleted');
    } catch {
      showStatus('Could not delete assessment', 'error');
    }
  };

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Layout role="teacher">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h1 className="text-xl font-bold text-gray-800">Coursework</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'New assessment'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5 max-w-2xl">
          Class tests, quizzes, assignments, projects and practicals. Marks are visible to
          students as soon as you save. Term exams go through Report Cards instead.
        </p>

        <StatusMessage message={status.message} type={status.type} />

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Class</label>
              <select
                value={form.classId}
                onChange={(e) => {
                  const cls = classes.find((c) => c.classId?._id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    classId: e.target.value,
                    subject: cls?.subject ?? f.subject,
                  }));
                }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={`${c.classId?._id}-${c.subject}`} value={c.classId?._id}>
                    {c.classId?.name} · {c.subject}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Subject</label>
              <input
                value={form.subject}
                onChange={field('subject')}
                placeholder="e.g. Mathematics"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                Title <span className="text-gray-400">— how students recognise it</span>
              </label>
              <input
                value={form.title}
                onChange={field('title')}
                placeholder="e.g. Unit Test 1"
                maxLength={120}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Type</label>
              <select
                value={form.assessmentType}
                onChange={field('assessmentType')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {ASSESSMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {assessmentTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Max marks</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.maxMarks}
                onChange={field('maxMarks')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Date conducted</label>
              <input
                type="date"
                value={form.date}
                onChange={field('date')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create assessment'}
              </button>
            </div>
          </form>
        )}

        {loading && <p className="text-sm text-gray-500">Loading coursework…</p>}

        {!loading && assessments.length === 0 && (
          <EmptyState message="No coursework yet — create your first assessment above" />
        )}

        {!loading && assessments.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {assessments.map((a) => (
              <div key={a._id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500">
                    {a.classId?.name ?? 'Class'} · {a.subject} ·{' '}
                    {assessmentTypeLabel(a.assessmentType)} · {formatDate(a.date)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-none flex-wrap">
                  <span className="text-xs text-gray-500 tabular-nums">
                    {a.scoresEntered} entered · out of {a.maxMarks}
                  </span>
                  <Link
                    to={`/schools/${slug}/teacher/coursework/${a._id}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    Enter marks
                  </Link>
                  <button
                    onClick={() => handleDelete(a._id, a.title)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
