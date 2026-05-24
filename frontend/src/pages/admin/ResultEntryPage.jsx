import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getAdminExam, getExamResults, upsertResults } from '../../api/exam.api';
import Layout from '../../components/common/Layout';
import EmptyState from '../../components/common/EmptyState';
import { staggerContainer, fadeInUp } from '../../utils/animationVariants';

export default function ResultEntryPage() {
  const { slug, examId } = useParams();
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);  // { studentId, name, marks: {subject: score} }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [examRes, resultsRes] = await Promise.all([
        getAdminExam(examId),
        getExamResults(examId),
      ]);
      const examData = examRes.data ?? null;
      setExam(examData);
      const existing = resultsRes.data?.results ?? [];
      // Build per-student rows
      const rows = existing.map((r) => {
        const markMap = {};
        r.marks?.forEach((m) => { markMap[m.subject] = m.marksObtained; });
        return { studentId: r.studentId?._id ?? r.studentId, name: r.studentId?.name ?? 'Student', marks: markMap };
      });
      setStudents(rows);
    } catch {
      setError('Failed to load data for this exam.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkChange = (studentId, subject, value) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, marks: { ...s.marks, [subject]: value } }
          : s
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const results = students.map((s) => ({
        studentId: s.studentId,
        marks: subjects.map((sub) => ({
          subject: sub.name,
          marksObtained: Number(s.marks[sub.name] ?? 0),
        })),
      }));
      await upsertResults(examId, results);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save results. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout role="school-admin">
        <div className="p-6 text-sm text-gray-500">Loading…</div>
      </Layout>
    );
  }

  if (!exam) {
    return (
      <Layout role="school-admin">
        <div className="p-6">
          <EmptyState title="Exam not found" message="This exam could not be loaded." />
          <div className="mt-4">
            <Link to={`/schools/${slug}/admin/exams`} className="text-indigo-600 text-sm hover:underline">
              ← Back to Exams
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const subjects = exam.subjects ?? [];

  return (
    <Layout role="school-admin">
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <Link to={`/schools/${slug}/admin/exams`} className="text-xs text-gray-400 hover:text-gray-600">
            ← Exams
          </Link>
          <h1 className="text-xl font-bold text-gray-800 mt-1">{exam.name}</h1>
          <p className="text-sm text-gray-500">{exam.year} · {exam.term}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || students.length === 0}
          className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : 'Save Results'}
        </button>
      </div>

      <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 text-xs text-amber-700 rounded-lg">
        Legacy direct entry — the recommended flow is now via the{' '}
        <Link to={`/schools/${slug}/admin/exams/${examId}/dashboard`} className="underline font-semibold">
          Exam Dashboard
        </Link>
        {' '}where each teacher enters marks for their assigned subjects and the admin publishes once all are submitted.
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {saved && <p className="text-sm text-green-700 mb-3">Results saved successfully!</p>}

      {students.length === 0 ? (
        <EmptyState
          title="No students enrolled"
          message="Enrol students in a class that is associated with this exam."
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="overflow-x-auto mt-4"
        >
          <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border-b border-gray-200">
                  Student
                </th>
                {subjects.map((sub) => (
                  <th key={sub.name} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border-b border-gray-200">
                    {sub.name} <span className="text-gray-400 font-normal">/ {sub.totalMarks}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={staggerContainer}>
              {students.map((s) => (
                <motion.tr key={s.studentId} variants={fadeInUp} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{s.name}</td>
                  {subjects.map((sub) => (
                    <td key={sub.name} className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={sub.totalMarks}
                        value={s.marks[sub.name] ?? ''}
                        onChange={(e) => handleMarkChange(s.studentId, sub.name, e.target.value)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="—"
                      />
                    </td>
                  ))}
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
