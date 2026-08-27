/**
 * Initials avatar used by the admin list rows (teachers, students).
 * Colour is derived from the name so the same person keeps the same tone.
 *
 * @param {object} props
 * @param {string} props.name  - Full name; falls back to "?" when missing.
 * @param {'md'|'lg'} [props.size]
 */
export default function Avatar({ name, size = 'md' }) {
  const initials = name
    ? name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : '?';
  const colors = [
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
  ];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  const sz = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';

  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold shrink-0 select-none`}>
      {initials}
    </div>
  );
}
