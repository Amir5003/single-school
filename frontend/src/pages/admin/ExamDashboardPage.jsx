import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  getExamDashboard,
  activateExam,
  publishExam,
  revertExamToDraft,
  reopenSubmission,
  reassignSubmission,
} from '../../api/exam.api';
import { getTeachers } from '../../api/admin.api';
import Layout from '../../components/common/Layout';
import EmptyState from '../../components/common/EmptyState';
import { staggerContainer, fadeInUp } from '../../utils/animationVariants';

const STATE_STYLES = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  locked: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  pending: 'bg-gray-100 text-gray-600',
  submitted: 'bg-green-100 text-green-700',
};

function StateBadge({ state }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
        STATE_STYLES[state] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {state || 'unknown'}
    </span>
  );
}

function StatCard({ label, value, accent = 'text-gray-800' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}

export default function ExamDashboardPage() {
  const { slug, examId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [toast, setToast] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [reassignFor, setReassignFor] = useState(null); // submissionId being reassigned

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getExamDashboard(examId);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchDashboard();
    getTeachers().then((r) => setTeachers(r.data?.teachers ?? [])).catch(() => {});
  }, [fetchDashboard]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleActivate = async () => {
    setActionPending(true);
    try {
      await activateExam(examId);
      showToast('Exam activated');
      await fetchDashboard();
    } catch (err) {
      showToast(err.response?.data?.message || 'Activation failed');
    } finally {
      setActionPending(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Publish results to students? This cannot be undone.')) return;
    setActionPending(true);
    try {
      const res = await publishExam(examId);
      showToast(`Published — ${res.data.resultsCreated} result(s) created`);
      await fetchDashboard();
    } catch (err) {
      const msg = err.response?.data?.message || 'Publish failed';
      const blocking = err.response?.data?.blocking;
      if (blocking && blocking.length) {
        showToast(`${msg} — blocking: ${blocking.map((b) => b.subject).join(', ')}`);
      } else {
        showToast(msg);
      }
    } finally {
      setActionPending(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!window.confirm('Revert exam to draft? All submission rows will be deleted.')) return;
    setActionPending(true);
    try {
      await revertExamToDraft(examId);
      showToast('Reverted to draft');
      await fetchDashboard();
    } catch (err) {
      showToast(err.response?.data?.message || 'Revert failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleReopen = async (submissionId) => {
    try {
      await reopenSubmission(examId, submissionId);
      showToast('Submission re-opened');
      await fetchDashboard();
    } catch (err) {
      showToast(err.response?.data?.message || 'Reopen failed');
    }
  };

  const handleReassign = async (submissionId, teacherId) => {
    if (!teacherId) return;
    try {
      await reassignSubmission(examId, submissionId, teacherId);
      showToast('Teacher reassigned');
      setReassignFor(null);
      await fetchDashboard();
    } catch (err) {
      showToast(err.response?.data?.message || 'Reassign failed');
    }
  };

  if (loading) {
    return (
      <Layout role="school-admin">
        <div className="p-6 text-sm text-gray-500">Loading dashboard…</div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout role="school-admin">
        <div className="p-6">
          <EmptyState title="Could not load exam" message={error || 'Try again later.'} />
          <Link to={`/schools/${slug}/admin/exams`} className="text-indigo-600 text-sm hover:underline">
            ← Back to Exams
          </Link>
        </div>
      </Layout>
    );
  }

  const { exam, stats, submissions } = data;
  const isDraft = exam.state === 'draft';
  const isActive = exam.state === 'active';
  const isPublished = exam.state === 'published';
  const allSubmitted =
    stats.totalSubjects > 0 && stats.submittedCount === stats.totalSubjects;

  return (
    <Layout role="school-admin">
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <Link to={`/schools/${slug}/admin/exams`} className="text-xs text-gray-400 hover:text-gray-600">
              ← Exams
            </Link>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl font-bold text-gray-800">{exam.name}</h1>
              <StateBadge state={exam.state} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {exam.year} · {exam.term} · {exam.classId?.name || 'Class'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <button
                onClick={handleActivate}
                disabled={actionPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                Activate Exam
              </button>
            )}
            {isActive && !allSubmitted && (
              <button
                onClick={handleRevertToDraft}
                disabled={actionPending}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Revert to Draft
              </button>
            )}
            {isActive && (
              <button
                onClick={handlePublish}
                disabled={actionPending || !allSubmitted}
                title={
                  allSubmitted
                    ? 'Publish results to students'
                    : `Cannot publish — ${stats.totalSubjects - stats.submittedCount} subject(s) not yet submitted`
                }
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Publish Results
              </button>
            )}
            {isPublished && (
              <span className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
                Published
              </span>
            )}
          </div>
        </div>

        {toast && (
          <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-200 text-sm text-indigo-700 rounded-lg">
            {toast}
          </div>
        )}

        {/* KPI strip */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6"
        >
          <motion.div variants={fadeInUp}><StatCard label="Total Subjects" value={stats.totalSubjects} /></motion.div>
          <motion.div variants={fadeInUp}><StatCard label="Pending" value={stats.pendingCount} accent="text-gray-700" /></motion.div>
          <motion.div variants={fadeInUp}><StatCard label="Draft" value={stats.draftCount} accent="text-blue-600" /></motion.div>
          <motion.div variants={fadeInUp}><StatCard label="Submitted" value={stats.submittedCount} accent="text-green-600" /></motion.div>
          <motion.div variants={fadeInUp}>
            <StatCard
              label="Completion"
              value={`${stats.completionPercentage}%`}
              accent={stats.completionPercentage === 100 ? 'text-green-600' : 'text-amber-600'}
            />
          </motion.div>
        </motion.div>

        {/* Subjects table */}
        {submissions.length === 0 ? (
          <EmptyState
            title="No subjects yet"
            message={isDraft ? 'Activate the exam to materialise subject submissions.' : 'No submissions have been created for this exam.'}
          />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Teacher</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">State</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Marks Entered</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Last Updated</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer}>
                {submissions.map((s) => (
                  <motion.tr key={s._id} variants={fadeInUp} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {s.subject}
                      <span className="text-xs text-gray-400 ml-1">/ {s.totalMarks}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {reassignFor === s._id ? (
                        <div className="flex items-center gap-2">
                          <select
                            defaultValue=""
                            onChange={(e) => handleReassign(s._id, e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                          >
                            <option value="">Choose teacher…</option>
                            {teachers.map((t) => (
                              <option key={t._id} value={t._id}>
                                {t.userId?.name || t.employeeId}
                              </option>
                            ))}
                          </select>
                          <button onClick={() => setReassignFor(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : s.assignedTeacher ? (
                        <span className="text-gray-700">{s.assignedTeacher.name}</span>
                      ) : (
                        <span className="text-amber-600 text-xs font-semibold">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><StateBadge state={s.state} /></td>
                    <td className="px-4 py-2.5 text-gray-600">{s.marksCount}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {s.lastSavedAt ? new Date(s.lastSavedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs space-x-2">
                      {!isPublished && (
                        <button
                          onClick={() => setReassignFor(s._id)}
                          className="text-indigo-600 hover:underline"
                        >
                          Reassign
                        </button>
                      )}
                      {!isPublished && s.state === 'submitted' && (
                        <button
                          onClick={() => handleReopen(s._id)}
                          className="text-amber-600 hover:underline"
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
