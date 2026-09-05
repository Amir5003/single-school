import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp, getVariants } from '../../utils/animationVariants';
import formatDate from '../../utils/formatDate';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS_STYLES = {
  Present: 'bg-emerald-100 text-emerald-700',
  Absent: 'bg-red-100 text-red-700',
  Leave: 'bg-amber-100 text-amber-700',
};

export default function AttendanceSummary({ summary }) {
  const {
    totalDays = 0,
    presentDays = 0,
    absentDays = 0,
    leaveDays = 0,
    percentage = 0,
    records = [],
  } = summary ?? {};

  const pct = Math.min(100, Math.max(0, parseFloat(percentage) || 0));
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  const staggerProps = getVariants(staggerContainer);

  return (
    <div className="space-y-6">
      {/* Donut + counters */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col sm:flex-row items-center gap-8">
        {/* SVG donut */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle
              cx="50" cy="50" r={RADIUS}
              fill="none" stroke="#e5e7eb" strokeWidth="10"
            />
            {/* Animated fill */}
            <motion.circle
              cx="50" cy="50" r={RADIUS}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-indigo-700">
            {pct.toFixed(1)}%
          </span>
        </div>

        {/* Counter grid */}
        <motion.div
          variants={staggerContainer}
          {...staggerProps}
          className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm"
        >
          <Counter label="Total Days" value={totalDays} />
          <Counter label="Present" value={presentDays} colour="text-emerald-600" />
          <Counter label="Absent" value={absentDays} colour="text-red-600" />
          <Counter label="Leave" value={leaveDays} colour="text-amber-600" />
        </motion.div>
      </div>

      {/* Record list */}
      {records.length > 0 && (
        <motion.ul
          variants={staggerContainer}
          {...staggerProps}
          className="space-y-2"
        >
          {records.map((rec) => (
            <motion.li
              key={rec._id}
              variants={fadeInUp}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm ${
                rec.status === 'Absent'
                  ? 'bg-red-50 border-red-100'
                  : 'bg-white border-gray-100'
              }`}
            >
              <span className="text-gray-700">{formatDate(rec.date)}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  STATUS_STYLES[rec.status] ?? ''
                }`}
              >
                {rec.status}
              </span>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

function Counter({ label, value, colour = 'text-gray-800' }) {
  return (
    <motion.div variants={fadeInUp}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${colour}`}>{value}</p>
    </motion.div>
  );
}
