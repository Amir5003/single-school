// ── AnnouncementForm ──────────────────────────────────────────────────────────
//
// Props:
//   initialData  — { title, content } | undefined  (edit mode when provided)
//   onSubmit     — ({ title, content }) => void
//   onCancel     — () => void  (shown when initialData is provided)
//   loading      — bool
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';

export default function AnnouncementForm({ initialData, onSubmit, onCancel, loading }) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [errors, setErrors] = useState({});

  // Reset when switching between create / edit
  useEffect(() => {
    setTitle(initialData?.title ?? '');
    setContent(initialData?.content ?? '');
    setErrors({});
  }, [initialData]);

  function validate() {
    const e = {};
    if (!title.trim()) e.title = 'Title is required.';
    else if (title.length > 200) e.title = 'Title must be ≤ 200 characters.';
    if (!content.trim()) e.content = 'Content is required.';
    else if (content.length > 2000) e.content = 'Content must be ≤ 2000 characters.';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length > 0) { setErrors(e2); return; }
    onSubmit({ title: title.trim(), content: content.trim() });
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
