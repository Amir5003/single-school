import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { scaleIn, staggerContainer, getVariants } from '../../utils/animationVariants';
import calculatePercentage from '../../utils/calculatePercentage';

const EXAM_TYPE_STYLES = {
  midterm: 'bg-sky-100 text-sky-700',
  final: 'bg-indigo-100 text-indigo-700',
  quiz: 'bg-violet-100 text-violet-700',
  assignment: 'bg-amber-100 text-amber-700',
};

function AnimatedCount({ to }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, to, { duration: 1, ease: 'easeOut' });
    return controls.stop;
  }, [to, count]);

  return <motion.span>{rounded}</motion.span>;
}

function MarksCard({ mark }) {
  const pct = parseFloat(
    calculatePercentage(mark.marksObtained, mark.maxMarks ?? 100)
  );

  return (
    <motion.div
      variants={scaleIn}
      {...getVariants(scaleIn)}
      className="backdrop-blur-sm bg-white/70 rounded-2xl shadow-lg border border-white/20 p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{mark.subject}</p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              EXAM_TYPE_STYLES[mark.examType] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {mark.examType}
          </span>
        </div>
        <p className="text-2xl font-bold text-indigo-700 tabular-nums">
          <AnimatedCount to={mark.marksObtained} />
          <span className="text-sm font-normal text-gray-400">
            /{mark.maxMarks ?? 100}
          </span>
        </p>
      </div>

      {/* Animated progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1 text-right">{pct.toFixed(1)}%</p>
    </motion.div>
  );
}

export default function MarksCardList({ marks, overallPercentage }) {
  const staggerProps = getVariants(staggerContainer);
  const overall = parseFloat(overallPercentage ?? 0);

  return (
    <div>
      {/* Overall percentage */}
      <div className="mb-6 p-5 backdrop-blur-sm bg-indigo-50/80 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-4">
        <div className="text-4xl font-extrabold text-indigo-700 tabular-nums">
          <AnimatedCount to={Math.round(overall)} />
          <span className="text-lg font-normal text-indigo-400">%</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Overall Performance</p>
          <p className="text-xs text-gray-500">Across all subjects and exams</p>
        </div>
      </div>

      {/* Cards grid */}
      {marks?.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">
          No marks recorded yet. Check back after exams.
        </p>
      ) : (
        <motion.div
          variants={staggerContainer}
          {...staggerProps}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {marks?.map((mark) => (
            <MarksCard key={mark._id} mark={mark} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
