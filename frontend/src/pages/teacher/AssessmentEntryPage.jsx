import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import StatusMessage from '../../components/common/StatusMessage';
import EmptyState from '../../components/common/EmptyState';
import { getAssessment, saveAssessmentScores } from '../../api/assessment.api';
import { assessmentTypeLabel } from '../../utils/assessmentTypes';
import { fadeInUp } from '../../utils/animationVariants';

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function AssessmentEntryPage() {
  const { slug, assessmentId } = useParams();

  const [assessment, setAssessment] = useState(null);
  const [rows, setRows] = useState([]);
  const [classAverage, setClassAverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = useCallback((message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(
      () => setStatus({ message: '', type: 'success' }),
      5000
    );
  }, []);

  const apply = useCallback((data) => {
    setAssessment(data.assessment);
    setClassAverage(data.classAverage);
    setRows(
      (data.students ?? []).map((s) => ({
        ...s,
        marksObtained: s.marksObtained ?? '',
      }))
    );
  }, []);

  useEffect(() => {
    getAssessment(assessmentId)
      .then((res) => apply(res.data))
      .catch(() => showStatus('Could not load this assessment', 'error'))
      .finally(() => setLoading(false));
  }, [assessmentId, apply, showStatus]);

  const update = (studentId, patch) =>
    setRows((rs) => rs.map((r) => (r.studentId === studentId ? { ...r, ...patch } : r)));

  const max = assessment?.maxMarks ?? 100;

  const isOver = (v) => v !== '' && Number(v) > max;
  const anyInvalid = rows.some((r) => !r.absent && (isOver(r.marksObtained) || Number(r.marksObtained) < 0));

  const handleSave = async () => {
    if (anyInvalid) {
      showStatus(`Marks must be between 0 and ${max}`, 'error');
      return;
    }
    setSaving(true);
    try {
      const scores = rows.map((r) => ({
        studentId: r.studentId,
        marksObtained: r.absent || r.marksObtained === '' ? null : Number(r.marksObtained),
        absent: Boolean(r.absent),
        remarks: r.remarks ?? '',
      }));
      const res = await saveAssessmentScores(assessmentId, scores);
      apply(res.data);
      showStatus('Marks saved — students can see them now');
    } catch (err) {
      showStatus(err.response?.data?.message || 'Could not save marks', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout role="teacher">
        <p className="text-sm text-gray-500">Loading assessment…</p>
      </Layout>
    );
  }

  if (!assessment) {
    return (
      <Layout role="teacher">
        <EmptyState message="Assessment not found" />
      </Layout>
    );
  }

  return (
    <Layout role="teacher">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Link
          to={`/schools/${slug}/teacher/coursework`}
          className="text-xs text-indigo-600 hover:underline"
        >
          ← Back to coursework
        </Link>

        <div className="flex items-end justify-between flex-wrap gap-3 mt-2 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{assessment.title}</h1>
            <p className="text-sm text-gray-500">
              {assessment.subject} · {assessmentTypeLabel(assessment.assessmentType)} ·{' '}
              {formatDate(assessment.date)} · out of {assessment.maxMarks}
            </p>
          </div>
          {classAverage !== null && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Class average</p>
              <p className="text-lg font-bold text-indigo-700 tabular-nums">{classAverage}%</p>
            </div>
          )}
        </div>

        <StatusMessage message={status.message} type={status.type} />

        {rows.length === 0 ? (
          <EmptyState message="No students in this class yet" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-3 px-4 font-medium">Student</th>
                    <th className="py-3 px-4 font-medium w-32 text-right">
                      Marks (0–{max})
                    </th>
                    <th className="py-3 px-4 font-medium w-24 text-center">Absent</th>
                    <th className="py-3 px-4 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.studentId} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 px-4">
                        <p className="font-medium text-gray-800">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.enrollmentId}</p>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <input
                          type="number"
                          min={0}
                          max={max}
                          value={r.absent ? '' : r.marksObtained}
                          disabled={r.absent}
                          onChange={(e) =>
                            update(r.studentId, { marksObtained: e.target.value })
                          }
                          className={`w-24 border rounded-lg px-2 py-1.5 text-sm text-right tabular-nums disabled:bg-gray-50 disabled:text-gray-300 ${
                            isOver(r.marksObtained)
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-200'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(r.absent)}
                          onChange={(e) =>
                            update(r.studentId, {
                              absent: e.target.checked,
                              marksObtained: e.target.checked ? '' : r.marksObtained,
                            })
                          }
                          className="w-4 h-4 accent-indigo-600"
                          aria-label={`Mark ${r.name} absent`}
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          value={r.remarks ?? ''}
                          onChange={(e) => update(r.studentId, { remarks: e.target.value })}
                          maxLength={300}
                          placeholder="Optional note for this student"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-100 flex-wrap">
              <p className="text-xs text-gray-500">
                An absent student stores no mark, and is left out of every average.
              </p>
              <button
                onClick={handleSave}
                disabled={saving || anyInvalid}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save marks'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
