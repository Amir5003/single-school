import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getSubmission, saveSubmissionDraft, submitSubmission } from '../../api/subjectSubmission.api';
import Layout from '../../components/common/Layout';
import EmptyState from '../../components/common/EmptyState';
import { fadeInUp, staggerContainer } from '../../utils/animationVariants';

const STATE_LABELS = {
  pending: 'Not started',
  draft: 'Draft',
  submitted: 'Submitted (locked from edits)',
  locked: 'Locked (exam published)',
};

const STATE_STYLES = {
  pending: 'bg-gray-100 text-gray-600',
  draft: 'bg-blue-100 text-blue-700',
  submitted: 'bg-green-100 text-green-700',
  locked: 'bg-amber-100 text-amber-700',
};

export default function SubmissionEntryPage() {
  const { slug, submissionId } = useParams();
  const [data, setData] = useState(null);
  const [marksMap, setMarksMap] = useState({}); // studentId -> value
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSubmission(submissionId);
      setData(res.data);
      const m = {};
      (res.data.submission.marks || []).forEach((entry) => {
        m[entry.studentId.toString()] = entry.marksObtained;
      });
      setMarksMap(m);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buildPayload = () => {
    if (!data) return [];
    return data.students
      .map((s) => {
        const val = marksMap[s._id.toString()];
        if (val === undefined || val === '') return null;
        return { studentId: s._id, marksObtained: Number(val) };
      })
      .filter(Boolean);
  };

  const handleSaveDraft = async () => {
    if (!data) return;
    const marks = buildPayload();
    setSaving(true);
    try {
      await saveSubmissionDraft(submissionId, marks);
      showToast('Draft saved');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!data) return;
    if (!window.confirm('Submit marks? You will not be able to edit after this.')) return;
    setSubmitting(true);
    try {
      // Always save first to ensure latest marks
      const marks = buildPayload();
      await saveSubmissionDraft(submissionId, marks);
      await submitSubmission(submissionId);
      showToast('Submitted');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout role="teacher">
        <div className="p-6 text-sm text-gray-500">Loading…</div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout role="teacher">
        <div className="p-6">
          <EmptyState title="Could not load submission" message={error || 'You may not be assigned to this subject.'} />
          <Link to={`/schools/${slug}/teacher/my-exams`} className="text-indigo-600 text-sm hover:underline">
            ← Back to My Exams
          </Link>
        </div>
      </Layout>
    );
  }

  const { submission, exam, students } = data;
  const isLocked = submission.state === 'submitted' || submission.state === 'locked' || exam.state !== 'active';
  const overValues = students.filter((s) => {
    const v = marksMap[s._id.toString()];
    return v !== undefined && v !== '' && Number(v) > submission.totalMarks;
  });

  return (
    <Layout role="teacher">
      <div className="p-4 md:p-6">
        <div className="mb-5">
          <Link to={`/schools/${slug}/teacher/my-exams`} className="text-xs text-gray-400 hover:text-gray-600">
            ← My Exams
          </Link>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-xl font-bold text-gray-800">{exam.name} — {submission.subject}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATE_STYLES[submission.state]}`}>
              {STATE_LABELS[submission.state] || submission.state}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {exam.year} · {exam.term} · {exam.classId?.name || 'Class'} · Max marks: {submission.totalMarks}
          </p>
        </div>

        {toast && (
          <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-200 text-sm text-indigo-700 rounded-lg">{toast}</div>
        )}

        {isLocked && (
          <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 text-sm text-amber-700 rounded-lg">
            {submission.state === 'locked'
              ? 'This exam has been published — marks are locked.'
              : submission.state === 'submitted'
                ? 'You have submitted these marks. Contact the admin to re-open if changes are needed.'
                : 'This exam is no longer active — marks entry is closed.'}
          </div>
        )}

        {students.length === 0 ? (
          <EmptyState title="No students" message="No students are enrolled in this class." />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold w-12">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Enrollment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Marks (out of {submission.totalMarks})</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer}>
                {students.map((s, i) => {
                  const idKey = s._id.toString();
                  const value = marksMap[idKey] ?? '';
                  const over = value !== '' && Number(value) > submission.totalMarks;
                  return (
                    <motion.tr key={idKey} variants={fadeInUp} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 text-gray-600">{s.enrollmentId}</td>
                      <td className="px-4 py-2.5 text-gray-800">{s.name}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={submission.totalMarks}
                          disabled={isLocked}
                          value={value}
                          onChange={(e) =>
                            setMarksMap((prev) => ({ ...prev, [idKey]: e.target.value }))
                          }
                          className={`w-24 border rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400 ${
                            over ? 'border-red-400 bg-red-50' : 'border-gray-300'
                          } disabled:bg-gray-100 disabled:text-gray-500`}
                          placeholder="—"
                        />
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </motion.div>
        )}

        {!isLocked && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={saving || overValues.length > 0}
              className="px-4 py-2 border border-indigo-200 text-indigo-600 text-sm rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || overValues.length > 0 || buildPayload().length === 0}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            {overValues.length > 0 && (
              <span className="text-xs text-red-600 self-center">
                {overValues.length} mark(s) exceed the subject's max
              </span>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
