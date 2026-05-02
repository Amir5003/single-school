import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/common/Layout';
import StatusMessage from '../../components/common/StatusMessage';
import ConfirmModal from '../../components/common/ConfirmModal';
import AnnouncementForm from '../../components/teacher/AnnouncementForm';
import {
  getAnnouncements,
  postAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../api/teacher.api';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createLoading, setCreateLoading] = useState(false);

  const [editId, setEditId] = useState(null);   // id of announcement being edited
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);   // { _id, title }
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = useCallback((message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(
      () => setStatus({ message: '', type: 'success' }),
      4000
    );
  }, []);

  const fetchAnnouncements = useCallback(() => {
    return getAnnouncements()
      .then((res) => setAnnouncements(res.data.announcements ?? []))
      .catch(() => showStatus('Failed to load announcements.', 'error'));
  }, [showStatus]);

  useEffect(() => {
    fetchAnnouncements().finally(() => setLoading(false));
  }, [fetchAnnouncements]);

  // ── Create ────────────────────────────────────────────────────────────────

  async function handleCreate(data) {
    setCreateLoading(true);
    try {
      await postAnnouncement(data);
      showStatus('Announcement posted.');
      await fetchAnnouncements();
    } catch (err) {
      showStatus(err?.response?.data?.message ?? 'Failed to post announcement.', 'error');
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  async function handleEdit(data) {
    setEditLoading(true);
    try {
      await updateAnnouncement(editId, data);
      showStatus('Announcement updated.');
      setEditId(null);
      await fetchAnnouncements();
    } catch (err) {
      showStatus(err?.response?.data?.message ?? 'Failed to update announcement.', 'error');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteAnnouncement(deleteTarget._id);
      showStatus('Announcement deleted.');
      setDeleteTarget(null);
      await fetchAnnouncements();
    } catch (err) {
      showStatus(err?.response?.data?.message ?? 'Failed to delete announcement.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">
            Post updates, reminders, and notices for your students.
          </p>
        </div>

        <StatusMessage message={status.message} type={status.type} />

        {/* Create form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Announcement</h2>
          <AnnouncementForm onSubmit={handleCreate} loading={createLoading} />
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-100 rounded-2xl animate-pulse"
              />
            ))
          ) : announcements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No announcements yet. Post the first one above.
            </p>
          ) : (
            announcements.map((a) => {
              const isEditing = editId === a._id;
              return (
                <div
                  key={a._id}
                  className={`bg-white rounded-2xl border shadow-sm p-5 transition ${
                    a.isDeleted
                      ? 'border-gray-100 opacity-50'
                      : 'border-gray-100'
                  }`}
                >
                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <AnnouncementForm
                      initialData={{ title: a.title, content: a.content }}
                      onSubmit={handleEdit}
                      onCancel={() => setEditId(null)}
                      loading={editLoading}
                    />
                  ) : (
                    /* ── View mode ── */
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-semibold text-gray-800 text-sm leading-snug ${
                              a.isDeleted ? 'line-through text-gray-400' : ''
                            }`}
                          >
                            {a.title}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(a.publishedAt)}
                            {a.isDeleted && (
                              <span className="ml-2 text-red-400 font-medium">(deleted)</span>
                            )}
                          </p>
                        </div>

                        {/* Actions — only for non-deleted */}
                        {!a.isDeleted && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => setEditId(a._id)}
                              className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(a)}
                              className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      <p
                        className={`text-sm mt-3 whitespace-pre-wrap leading-relaxed ${
                          a.isDeleted ? 'text-gray-400 line-through' : 'text-gray-600'
                        }`}
                      >
                        {a.content}
                      </p>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.title}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => { if (!deleteLoading) setDeleteTarget(null); }}
        />
      )}
    </Layout>
  );
}
