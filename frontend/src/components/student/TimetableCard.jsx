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

  // "HH:MM" sorts correctly as a string, so the day always reads top-to-bottom.
  const filtered = (periods ?? [])
    .filter((p) => p.day === activeDay)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  return (
    <div>
      {/* Day tabs — a fixed 6-up grid on phones so Saturday never wraps */}
      <div className="grid grid-cols-6 gap-1 sm:flex sm:gap-2 mb-6">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`relative px-1 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors focus:outline-none ${
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
                className="backdrop-blur-sm bg-white/70 rounded-xl border border-white/20 shadow-sm p-4 flex items-stretch gap-3 sm:gap-4"
              >
                {/* Fixed-width time column keeps every row's subject and
                    teacher starting at the same x, whatever the subject name */}
                <div className="w-14 flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-gray-800 tabular-nums leading-tight">
                    {period.startTime}
                  </p>
                  <p className="text-xs text-gray-400 tabular-nums leading-tight mt-0.5">
                    {period.endTime}
                  </p>
                </div>

                <div className="w-px bg-gray-200 flex-shrink-0" aria-hidden="true" />

                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${subjectColour(period.subject)}`}
                  >
                    {period.subject}
                  </span>
                  <p className="mt-1.5 text-sm text-gray-700 font-medium truncate">
                    {period.teacherId?.userId?.name ?? 'Teacher'}
                  </p>
                </div>
              </motion.li>
            ))
          )}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}
