import { useState } from 'react';
import { motion } from 'framer-motion';
import { assessmentTypeLabel } from '../../utils/assessmentTypes';
import { fadeInUp, staggerContainer, getVariants } from '../../utils/animationVariants';

const TYPE_STYLES = {
  class_test: 'bg-sky-100 text-sky-700',
  quiz: 'bg-violet-100 text-violet-700',
  assignment: 'bg-amber-100 text-amber-700',
  project: 'bg-emerald-100 text-emerald-700',
  practical: 'bg-rose-100 text-rose-700',
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

/** One coursework entry — everything needed to tell it apart from the others. */
function Entry({ entry }) {
  const {
    title,
    assessmentType,
    date,
    teacherName,
    marksObtained,
    maxMarks,
    absent,
    remarks,
    percentage,
    classAverage,
  } = entry;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                TYPE_STYLES[assessmentType] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {assessmentTypeLabel(assessmentType)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(date)}
            {teacherName ? ` · ${teacherName}` : ''}
          </p>
        </div>

        <div className="text-right flex-none">
          {absent ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              Absent
            </span>
          ) : (
            <>
              <p className="text-base font-bold text-gray-900 tabular-nums">
                {marksObtained}
                <span className="text-xs font-normal text-gray-400">/{maxMarks}</span>
              </p>
              {classAverage !== null && classAverage !== undefined && (
                <p className="text-[11px] text-gray-400 tabular-nums">
                  class avg {classAverage}%
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!absent && percentage !== null && percentage !== undefined && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentage)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}

      {remarks ? (
        <p className="text-xs text-gray-600 mt-2 italic">“{remarks}”</p>
      ) : null}
    </div>
  );
}

/** Collapsible per-subject group. Open by default so nothing is hidden on load. */
function SubjectGroup({ group }) {
  const [open, setOpen] = useState(true);

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div>
          <p className="text-sm font-bold text-gray-900">{group.subject}</p>
          <p className="text-xs text-gray-500">
            {group.count} {group.count === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {group.average !== null && (
            <span className="text-sm font-semibold text-indigo-700 tabular-nums">
              {group.average}%
            </span>
          )}
          <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-2">
          {group.entries.map((e) => (
            <Entry key={e._id} entry={e} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function CourseworkList({ subjects, overallPercentage, totalCount }) {
  return (
    <motion.div
      variants={staggerContainer}
      {...getVariants(staggerContainer)}
      className="flex flex-col gap-4"
    >
      <motion.div
        variants={fadeInUp}
        className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 px-5 py-4 flex items-center justify-between gap-4"
      >
        <div>
          <p className="text-sm font-semibold text-gray-700">Coursework average</p>
          <p className="text-xs text-gray-500">
            Across {totalCount} {totalCount === 1 ? 'entry' : 'entries'} · absences excluded
          </p>
        </div>
        <p className="text-2xl font-bold text-indigo-700 tabular-nums">{overallPercentage}%</p>
      </motion.div>

      {subjects.map((group) => (
        <SubjectGroup key={group.subject} group={group} />
      ))}
    </motion.div>
  );
}
