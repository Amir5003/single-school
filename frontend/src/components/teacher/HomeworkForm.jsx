import { useState, useEffect } from 'react';
import { createHomework } from '../../api/homework.api';
import { getTeacherClasses } from '../../api/teacher.api';

const HomeworkForm = ({ onCreated }) => {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ classId: '', title: '', description: '', dueDate: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Use the teacher's own classes — not the admin endpoint (which would 403)
    getTeacherClasses()
      .then((res) => setClasses(res.data?.classes ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await createHomework(form);
      setForm({ classId: '', title: '', description: '', dueDate: '' });
      onCreated?.(res.data?.homework);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create homework.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-gray-800 text-base">New Homework</h3>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Class</label>
        <select
          value={form.classId}
          onChange={(e) => setForm({ ...form, classId: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          required
        >
          <option value="">Select a class…</option>
          {classes.map((c) => (
            <option key={c.classId?._id} value={c.classId?._id}>
              {c.classId?.name} — {c.subject}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Homework title"
          maxLength={200}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Description <span className="text-gray-400">(optional)</span></label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Due Date</label>
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          required
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Uploading…' : 'Assign Homework'}
        </button>
      </div>
    </form>
  );
};

export default HomeworkForm;
