import { useState, useEffect } from 'react';
import { createHomework } from '../../api/homework.api';
import { getClasses } from '../../api/admin.api';

const HomeworkForm = ({ onCreated }) => {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ classId: '', title: '', description: '', dueDate: '' });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getClasses()
      .then((res) => setClasses(res.data?.classes ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (files.length > 5) {
      setError('Maximum 5 attachments allowed.');
      return;
    }
    const fd = new FormData();
    fd.append('classId', form.classId);
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('dueDate', form.dueDate);
    files.forEach((f) => fd.append('attachments', f));

    setLoading(true);
    try {
      const res = await createHomework(fd);
      setForm({ classId: '', title: '', description: '', dueDate: '' });
      setFiles([]);
      onCreated?.(res.data?.homework);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create homework.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
      <h3 className="font-semibold text-gray-800 text-lg">New Homework</h3>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div>
        <label className="block text-sm text-gray-600 mb-1">Class</label>
        <select
          value={form.classId}
          onChange={(e) => setForm({ ...form, classId: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm"
          required
        >
          <option value="">Select a class…</option>
          {classes.map((cls) => (
            <option key={cls._id} value={cls._id}>{cls.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Homework title"
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm"
          rows={3}
          maxLength={2000}
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Due Date</label>
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">
          Attachments <span className="text-gray-400">(max 5 files)</span>
        </label>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
          onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 5))}
          className="text-sm"
        />
        {files.length > 0 && (
          <ul className="mt-1 text-xs text-gray-500 list-disc list-inside">
            {files.map((f, i) => <li key={i}>{f.name}</li>)}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-[var(--school-primary,#4F46E5)] text-white rounded-lg px-5 py-2 text-sm hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Uploading…' : 'Assign Homework'}
      </button>
    </form>
  );
};

export default HomeworkForm;
