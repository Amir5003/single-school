import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../utils/animationVariants';
import { EFFECTIVE_DATE, hasUnfilledPlaceholders } from '../../constants/legalConfig';

/**
 * Shared shell for the three published legal documents.
 *
 * Deliberately plain: these pages are read, not experienced. The measure is
 * constrained to ~68ch because an unbounded legal document at full viewport
 * width is genuinely unreadable, and there is no scroll-triggered animation.
 */
export default function LegalLayout({ title, version, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            ← Back
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/terms" className="text-gray-500 hover:text-gray-900 transition-colors">Terms</Link>
            <Link to="/privacy" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy</Link>
            <Link to="/refunds" className="text-gray-500 hover:text-gray-900 transition-colors">Refunds</Link>
          </nav>
        </div>
      </header>

      <motion.main
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-3xl px-6 py-10 pb-[calc(3rem_+_env(safe-area-inset-bottom,0px))]"
      >
        {hasUnfilledPlaceholders() && (
          <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong className="font-semibold">Not ready to publish.</strong> This document still
            contains TODO placeholders. Fill in{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">src/constants/legalConfig.js</code>{' '}
            before showing this to a real school.
          </div>
        )}

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm px-6 py-8 sm:px-10 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-gray-500 tabular-nums">
            Version {version} · Effective {EFFECTIVE_DATE}
          </p>
          <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-gray-700">
            {children}
          </div>
        </div>
      </motion.main>
    </div>
  );
}

/** A numbered top-level clause. */
export function Clause({ n, title, children }) {
  return (
    <section className="scroll-mt-6">
      <h2 className="text-base font-semibold text-gray-900 mb-2">
        <span className="text-gray-400 tabular-nums mr-2">{n}.</span>
        {title}
      </h2>
      <div className="space-y-3 pl-6">{children}</div>
    </section>
  );
}

/** A sub-clause, numbered for cross-reference. */
export function Sub({ n, children }) {
  return (
    <p className="flex gap-3">
      <span className="text-xs text-gray-400 tabular-nums pt-1 shrink-0 w-8">{n}</span>
      <span>{children}</span>
    </p>
  );
}

/** An unordered list inside a clause. */
export function List({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-gray-400">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
