import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getExamYears,
  getExamsForYear,
  getStudentResult,
  getReportCardPayload,
} from '../../api/result.api';
import Layout from '../../components/common/Layout';
import EmptyState from '../../components/common/EmptyState';
import { fadeInUp, staggerContainer } from '../../utils/animationVariants';
import { downloadReportCard } from '../../utils/reportCardPdf';

const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Mid-Year', 'Final'];

function PassBadge({ pass }) {
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}
    >
      {pass ? 'Pass' : 'Fail'}
    </span>
  );
}

function SubjectCard({ subject, score, maxScore, pass }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white border border-gray-200 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">{subject}</span>
        <PassBadge pass={pass} />
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-gray-900">{score}</span>
        <span className="text-xs text-gray-400 mb-1">/ {maxScore}</span>
        <span className="text-xs text-gray-500 mb-1 ml-auto">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pass ? 'bg-green-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </motion.div>
  );
}

export default function ResultsPage() {
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resultLoading, setResultLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Load years on mount
  useEffect(() => {
    getExamYears()
      .then((res) => {
        const yr = res.data?.years ?? [];
        setYears(yr);
        // getDistinctYears returns descending — index 0 is the newest year.
        if (yr.length > 0) setSelectedYear(yr[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load exams when year changes
  useEffect(() => {
    if (!selectedYear) return;
    setExams([]);
    setSelectedTerm(null);
    setResult(null);
    getExamsForYear(selectedYear)
      .then((res) => {
        const list = res.data?.exams ?? [];
        setExams(list);
        // Auto-select first available term
        if (list.length > 0) setSelectedTerm(list[0].term);
      })
      .catch(() => {});
  }, [selectedYear]);

  // Load result when exam/term selected
  useEffect(() => {
    if (!selectedTerm || !exams.length) return;
    const exam = exams.find((e) => e.term === selectedTerm);
    if (!exam) return;
    setResultLoading(true);
    setResult(null);
    setPdfError('');
    getStudentResult(exam._id)
      .then((res) => setResult(res.data ?? null))
      .catch(() => setResult(null))
      .finally(() => setResultLoading(false));
  }, [selectedTerm, exams]);

  const handleDownloadReportCard = async () => {
    const exam = exams.find((e) => e.term === selectedTerm);
    if (!exam) return;
    setPdfError('');
    setDownloadingPdf(true);
    try {
      const res = await getReportCardPayload(exam._id);
      await downloadReportCard(res.data);
    } catch (err) {
      setPdfError(err.response?.data?.message || 'Failed to generate report card');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <Layout role="student">
        <div className="p-6 text-sm text-gray-500">Loading results…</div>
      </Layout>
    );
  }

  const activeTerm = selectedTerm;
  const activeExam = exams.find((e) => e.term === activeTerm);

  return (
    <Layout role="student">
      <div className="p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Report Cards</h1>

      {years.length === 0 ? (
        <EmptyState
          title="No results yet"
          message="Results will appear here once your school publishes exam results."
        />
      ) : (
        <>
          {/* Year dropdown */}
          <div className="flex items-center gap-3 mb-5">
            <label className="text-sm font-medium text-gray-600">Year:</label>
            <select
              value={selectedYear ?? ''}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Term pills */}
          {exams.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {exams.map((e) => (
                <button
                  key={e._id}
                  onClick={() => setSelectedTerm(e.term)}
                  className={`px-4 py-1.5 rounded-full text-sm transition ${
                    activeTerm === e.term
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {e.term}
                </button>
              ))}
            </div>
          )}

          {/* Result cards */}
          {resultLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : !result ? (
            <EmptyState
              title="No result for this term"
              message="Your result for this period has not been entered yet."
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={`${selectedYear}-${activeTerm}`} variants={staggerContainer} initial="hidden" animate="visible">
                {/* Summary banner */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 mb-5 flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-xs text-gray-500">Overall</p>
                    <p className="text-2xl font-bold text-indigo-700">{result.overallPercentage?.toFixed(1)}%</p>
                  </div>
                  {result.rank != null && (
                    <div>
                      <p className="text-xs text-gray-500">Rank</p>
                      <p className="text-2xl font-bold text-indigo-700">#{result.rank}</p>
                    </div>
                  )}
                  {activeExam && (
                    <div className="self-center">
                      <p className="text-xs text-gray-400">{activeExam.name}</p>
                      <p className="text-xs text-gray-400">{activeExam.year} · {activeExam.term}</p>
                    </div>
                  )}
                  <button
                    onClick={handleDownloadReportCard}
                    disabled={downloadingPdf}
                    className="ml-auto px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {downloadingPdf ? 'Generating…' : 'Download Report Card'}
                  </button>
                </div>
                {pdfError && (
                  <p className="text-sm text-red-600 mb-3">{pdfError}</p>
                )}

                {/* Subject cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.marks?.map((m) => (
                    <SubjectCard
                      key={m.subject}
                      subject={m.subject}
                      score={m.marksObtained}
                      maxScore={m.totalMarks ?? 100}
                      pass={m.passed}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}
    </div>
    </Layout>
  );
}
