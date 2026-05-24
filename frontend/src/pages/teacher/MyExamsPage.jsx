import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMyExams } from '../../api/subjectSubmission.api';
import Layout from '../../components/common/Layout';
import EmptyState from '../../components/common/EmptyState';
import { fadeInUp, staggerContainer } from '../../utils/animationVariants';

const STATE_STYLES = {
  pending: 'bg-gray-100 text-gray-600',
  draft: 'bg-blue-100 text-blue-700',
  submitted: 'bg-green-100 text-green-700',
  locked: 'bg-amber-100 text-amber-700',
};

function StateBadge({ state }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATE_STYLES[state] || 'bg-gray-100 text-gray-600'}`}>
      {state}
    </span>
  );
}

export default function MyExamsPage() {
  const { slug } = useParams();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyExams()
      .then((r) => setExams(r.data?.exams ?? []))
      .catch(() => setError('Failed to load assigned exams.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout role="teacher">
        <div className="p-6 text-sm text-gray-500">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout role="teacher">
      <div className="p-4 md:p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6">My Exams</h1>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {exams.length === 0 ? (
          <EmptyState
            title="No assigned exams"
            message="Your admin hasn't activated any exams with subjects assigned to you yet."
          />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
            {exams.map((exam) => (
              <motion.div
                key={exam._id}
                variants={fadeInUp}
                className="bg-white border border-gray-200 rounded-xl px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{exam.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {exam.year} · {exam.term} · {exam.classId?.name || 'Class'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">Exam state: <StateBadge state={exam.state} /></span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {exam.mySubmissions.map((s) => (
                    <Link
                      key={s._id}
                      to={`/schools/${slug}/teacher/submissions/${s._id}`}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 rounded-lg transition"
                    >
                      <span className="text-sm font-medium text-gray-700">{s.subject}</span>
                      <StateBadge state={s.state} />
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
