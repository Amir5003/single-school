import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, fadeInUp, getVariants } from '../../utils/animationVariants';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBJECT_COLOURS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
];

function subjectColour(subject) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLOURS[Math.abs(hash) % SUBJECT_COLOURS.length];
}

export default function TimetableCard({ periods }) {
  const [activeDay, setActiveDay] = useState('Monday');
  const staggerProps = getVariants(staggerContainer);

  const filtered = (periods ?? []).filter((p) => p.day === activeDay);

  return (
    <div>
      {/* Day tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none ${
              activeDay === day
                ? 'text-white'
                : 'text-gray-600 hover:text-indigo-600'
            }`}
          >
            {activeDay === day && (
              <motion.span
                layoutId="active-day-pill"
                className="absolute inset-0 bg-indigo-600 rounded-full"
              />
            )}
            <span className="relative">{day.slice(0, 3)}</span>
          </button>
        ))}
      </div>

      {/* Period list */}
      <AnimatePresence mode="wait">
        <motion.ul
          key={activeDay}
          variants={staggerContainer}
          {...staggerProps}
          className="space-y-3"
        >
          {filtered.length === 0 ? (
            <motion.li variants={fadeInUp} {...getVariants(fadeInUp)}>
              <p className="text-gray-400 text-sm py-4 text-center">
                No periods scheduled for {activeDay}.
              </p>
            </motion.li>
          ) : (
            filtered.map((period) => (
              <motion.li
                key={period._id}
                variants={fadeInUp}
                className="backdrop-blur-sm bg-white/70 rounded-xl border border-white/20 shadow-sm p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${subjectColour(period.subject)}`}
                  >
                    {period.subject}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    {period.teacherId?.userId?.name ?? 'Teacher'}
                  </span>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {period.startTime} – {period.endTime}
                </span>
              </motion.li>
            ))
          )}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}
