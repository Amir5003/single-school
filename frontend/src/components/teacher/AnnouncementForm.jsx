// ── AnnouncementForm ──────────────────────────────────────────────────────────
//
// Props:
//   initialData  — { title, content, visibleUntil } | undefined  (edit mode when provided)
//   onSubmit     — ({ title, content, visibleUntil }) => void
//   onCancel     — () => void  (shown when initialData is provided)
//   loading      — bool
//
// `visibleUntil` is null for "Always", or a YYYY-MM-DD string. The backend
// treats the date as inclusive — an announcement set to the 6th stays up all
// through the 6th.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';

const VISIBILITY_PRESETS = [
  { key: 'always', label: 'Always',  days: null },
  { key: '7',      label: '7 days',  days: 7    },
  { key: '30',     label: '30 days', days: 30   },
  { key: 'custom', label: 'Pick a date' },
];

/** A Date as the YYYY-MM-DD an <input type="date"> expects, in local time. */
function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Today + `days`, as YYYY-MM-DD in local time. */
function dateInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

const todayISO = () => dateInDays(0);

/**
 * An announcement already carrying a date is editing a custom expiry. The
 * stored value is an end-of-day timestamp, so read the local calendar date
 * off it rather than slicing the UTC string.
 */
function initialVisibility(initialData) {
  if (!initialData?.visibleUntil) return { mode: 'always', date: '' };
  const stored = new Date(initialData.visibleUntil);
  if (Number.isNaN(stored.getTime())) return { mode: 'always', date: '' };
  return { mode: 'custom', date: toDateInput(stored) };
}

export default function AnnouncementForm({ initialData, onSubmit, onCancel, loading }) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [visibility, setVisibility] = useState(() => initialVisibility(initialData));
  const [errors, setErrors] = useState({});

  // Switching edit targets is handled by the caller keying this component on
  // the announcement id — remounting reseeds the fields, so no reset effect.

  function validate() {
    const e = {};
    if (!title.trim()) e.title = 'Title is required.';
    else if (title.length > 200) e.title = 'Title must be ≤ 200 characters.';
    if (!content.trim()) e.content = 'Content is required.';
    else if (content.length > 2000) e.content = 'Content must be ≤ 2000 characters.';
    if (visibility.mode === 'custom' && !visibility.date) {
      e.visibleUntil = 'Pick the last day this should be visible.';
    }
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length > 0) { setErrors(e2); return; }
    onSubmit({
      title: title.trim(),
      content: content.trim(),
      visibleUntil: visibility.mode === 'always' ? null : visibility.date,
    });
  }

  function choosePreset(preset) {
    setErrors((prev) => ({ ...prev, visibleUntil: '' }));
    setVisibility({
      mode: preset.key,
      date: preset.key === 'always' ? ''
        : preset.key === 'custom' ? (visibility.date || dateInDays(7))
        : dateInDays(preset.days),
    });
  }

  const isEdit = Boolean(initialData);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
        <input
          type="text"
          value={title}
          maxLength={200}
          onChange={(e) => { setTitle(e.target.value); setErrors((prev) => ({ ...prev, title: '' })); }}
          placeholder="Announcement title…"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
            errors.title ? 'border-red-400' : 'border-gray-200'
          }`}
        />
        {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
        <textarea
          rows={4}
          value={content}
          maxLength={2000}
          onChange={(e) => { setContent(e.target.value); setErrors((prev) => ({ ...prev, content: '' })); }}
          placeholder="Announcement content…"
          className={`w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
            errors.content ? 'border-red-400' : 'border-gray-200'
          }`}
        />
        {errors.content && <p className="text-xs text-red-500 mt-0.5">{errors.content}</p>}
        <p className="text-xs text-gray-400 text-right mt-0.5">{content.length} / 2000</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Visible until</label>
        <div className="flex flex-wrap gap-2">
          {VISIBILITY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => choosePreset(preset)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                visibility.mode === preset.key
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {visibility.mode === 'custom' && (
          <input
            type="date"
            min={todayISO()}
            value={visibility.date}
            onChange={(e) => {
              setVisibility((v) => ({ ...v, date: e.target.value }));
              setErrors((prev) => ({ ...prev, visibleUntil: '' }));
            }}
            className={`mt-2 w-full sm:w-52 bg-white border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
              errors.visibleUntil ? 'border-red-400' : 'border-gray-200'
            }`}
          />
        )}

        {errors.visibleUntil ? (
          <p className="text-xs text-red-500 mt-1">{errors.visibleUntil}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">
            {visibility.mode === 'always'
              ? 'Stays on students’ announcement list until you delete it.'
              : `Hidden from students after ${visibility.date || '—'}. You can still see and edit it.`}
          </p>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {isEdit && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (isEdit ? 'Saving…' : 'Publishing…') : (isEdit ? 'Save Changes' : 'Post Announcement')}
        </button>
      </div>
    </form>
  );
}
