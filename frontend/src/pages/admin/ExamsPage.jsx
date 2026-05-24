import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminExams, createExam, deleteExam, activateExam } from '../../api/exam.api';
import { getClasses } from '../../api/admin.api';
import Layout from '../../components/common/Layout';
import EmptyState from '../../components/common/EmptyState';
import { fadeInUp, staggerContainer } from '../../utils/animationVariants';

const STATE_STYLES = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  locked: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
};

function ExamStateBadge({ state }) {
  const label = state || 'draft';
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATE_STYLES[label] || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Mid-Year', 'Final'];
const CURRENT_YEAR = new Date().getFullYear();

function ExamForm({ onSave, onCancel, classes = [] }) {
  const [form, setForm] = useState({
    name: '',
    year: CURRENT_YEAR,
    term: 'Term 1',
    classId: '',
    subjects: [{ name: '', totalMarks: 100, passMark: '' }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const setSubject = (i, field, val) =>
    setForm((f) => {
      const subs = [...f.subjects];
      subs[i] = { ...subs[i], [field]: val };
      return { ...f, subjects: subs };
    });

  const addSubject = () => setForm((f) => ({ ...f, subjects: [...f.subjects, { name: '', totalMarks: 100, passMark: '' }] }));
  const removeSubject = (i) =>
    setForm((f) => ({ ...f, subjects: f.subjects.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const filteredSubjects = form.subjects.filter((s) => s.name.trim());
    if (!filteredSubjects.length) { setError('Add at least one subject.'); return; }
    if (!form.classId) { setError('Please select a class.'); return; }
    // Client-side validation: passMark must be ≤ totalMarks per subject
    for (const s of filteredSubjects) {
      const max = Number(s.totalMarks) || 100;
      if (s.passMark !== '' && Number(s.passMark) > max) {
        setError(`Pass mark for "${s.name}" cannot exceed its max marks (${max}).`);
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        year: Number(form.year),
        subjects: filteredSubjects.map((s) => ({
          name: s.name.trim(),
          totalMarks: Number(s.totalMarks) || 100,
          passMark: s.passMark !== '' ? Number(s.passMark) : null,
        })),
      });
    } catch (err) {
      const apiErr = err.response?.data;
      let msg = apiErr?.message || 'Failed to save exam.';
      if (apiErr?.errors?.length) {
        msg = apiErr.errors.map((e) => `${e.field}: ${e.msg}`).join(' · ');
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 mb-6">
      <h3 className="font-semibold text-gray-800">New Exam</h3>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="e.g. Annual Exam 2025"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
          <input
            type="number"
            required
            min={2000}
            max={2100}
            value={form.year}
            onChange={(e) => set('year', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
          <select
            value={form.term}
            onChange={(e) => set('term', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
          <select
            required
            value={form.classId}
            onChange={(e) => set('classId', e.target.value)}
            disabled={classes.length === 0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-100"
          >
            <option value="">
              {classes.length === 0 ? 'No classes — create one first' : 'Select class…'}
            </option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}{c.section ? ` ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Subjects</label>
        <div className="hidden sm:grid sm:grid-cols-[1fr_5rem_5rem_2rem] gap-2 text-[10px] uppercase tracking-wide text-gray-400 mb-1">
          <span>Subject name</span>
          <span className="text-right pr-1">Max marks</span>
          <span className="text-right pr-1">Pass mark</span>
          <span />
        </div>
        {form.subjects.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem_5rem_2rem] gap-2 mb-1 items-center">
            <input
              value={s.name}
              onChange={(e) => setSubject(i, 'name', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="e.g. Math"
            />
            <input
              type="number"
              min={1}
              max={1000}
              value={s.totalMarks}
              onChange={(e) => setSubject(i, 'totalMarks', e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 text-right"
              placeholder="100"
            />
            <input
              type="number"
              min={0}
              max={1000}
              value={s.passMark}
              onChange={(e) => setSubject(i, 'passMark', e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 text-right"
              placeholder="auto"
              title="Leave empty to use 35% of max marks"
            />
            {form.subjects.length > 1 ? (
              <button type="button" onClick={() => removeSubject(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
            ) : <span />}
          </div>
        ))}
        <p className="text-[11px] text-gray-400 mt-1">Pass mark is optional — leave empty to default to 35% of max marks.</p>
        <button type="button" onClick={addSubject} className="text-xs text-indigo-600 hover:underline mt-1">+ Add subject</button>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
          {saving ? 'Saving…' : 'Create Exam'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ExamsPage() {
  const { slug } = useParams();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [classOptions, setClassOptions] = useState([]);

  useEffect(() => {
    getClasses().then((res) => setClassOptions(res.data?.classes ?? [])).catch(() => {});
  }, []);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminExams();
      setExams(res.data?.exams ?? []);
    } catch {
      setError('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const handleCreate = async (data) => {
    await createExam(data);
    setShowForm(false);
    fetchExams();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam?')) return;
    try {
      await deleteExam(id);
      setExams((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete exam.');
    }
  };

  const handleActivate = async (id) => {
    try {
      await activateExam(id);
      fetchExams();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate exam.');
    }
  };

  return (
    <Layout role="school-admin">
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">Exams</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
          >
            + New Exam
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div key="form" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
            <ExamForm onSave={handleCreate} onCancel={() => setShowForm(false)} classes={classOptions} />
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <div className="text-sm text-gray-500">Loading exams…</div>
      ) : exams.length === 0 ? (
        <EmptyState title="No exams yet" message="Create the first exam to start entering results." />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
          {exams.map((exam) => {
            const state = exam.state || 'draft';
            return (
              <motion.div
                key={exam._id}
                variants={fadeInUp}
                className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{exam.name}</p>
                    <ExamStateBadge state={state} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{exam.year} · {exam.term} · {exam.subjects?.length ?? 0} subject(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/schools/${slug}/admin/exams/${exam._id}/dashboard`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                  >
                    Open Dashboard
                  </Link>
                  {state === 'draft' && (
                    <button
                      onClick={() => handleActivate(exam._id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      Activate
                    </button>
                  )}
                  {(state === 'draft' || state === 'active') && (
                    <Link
                      to={`/schools/${slug}/admin/exams/${exam._id}/results`}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                      title="Legacy direct-entry path"
                    >
                      Legacy Entry
                    </Link>
                  )}
                  {state === 'draft' && (
                    <button
                      onClick={() => handleDelete(exam._id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
    </Layout>
  );
}
