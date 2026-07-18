import { useEffect, useState } from 'react';

/**
 * Lightweight d:h:m:s countdown.
 *
 * Props:
 *  - endsAt: ISO date string or Date
 *  - showSeconds: render seconds segment (default true)
 *  - compact: render small inline pills instead of large blocks
 *  - onExpire: called once when the timer crosses zero
 */
export default function Countdown({
  endsAt,
  showSeconds = true,
  compact = false,
  onExpire,
}) {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!endsAt) return 0;
    return Math.max(0, new Date(endsAt).getTime() - Date.now());
  });

  useEffect(() => {
    if (!endsAt) return undefined;
    const tick = () => {
      const next = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemainingMs(next);
      if (next === 0 && onExpire) {
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  if (!endsAt) return null;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  const segments = [
    { label: 'Days',  value: days },
    { label: 'Hours', value: pad(hours) },
    { label: 'Min',   value: pad(minutes) },
  ];
  if (showSeconds) segments.push({ label: 'Sec', value: pad(seconds) });

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums">
        {segments.map((s) => (
          <span key={s.label} className="px-1.5 py-0.5 rounded bg-white/20 text-white">
            {s.value}
            <span className="ml-0.5 text-[10px] font-medium opacity-80">{s.label[0]}</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {segments.map((s) => (
        <div
          key={s.label}
          className="flex flex-col items-center min-w-[52px] px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-200"
        >
          <span className="text-2xl font-bold tabular-nums text-gray-900">
            {s.value}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
