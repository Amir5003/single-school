import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import StatusMessage from '../../components/common/StatusMessage';
import MarksTable from '../../components/teacher/MarksTable';
import {
  getTeacherClasses,
  getClassStudents,
  getMarks,
  saveMark,
} from '../../api/teacher.api';

const EXAM_TYPES = ['midterm', 'final', 'quiz', 'assignment'];

export default function MarksPage() {
  const [searchParams] = useSearchParams();

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') ?? '');
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState('final');
  const [maxMarks, setMaxMarks] = useState(100);

  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});     // { [studentId]: string }

  const [pageLoading, setPageLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = useCallback((message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(
      () => setStatus({ message: '', type: 'success' }),
      5000
    );
  }, []);

  // Load classes once
  useEffect(() => {
    getTeacherClasses()
      .then((res) => {
        const list = res.data.classes ?? [];
        setClasses(list);
        // Pre-fill subject from selected class if available
        if (classId) {
          const cls = list.find((c) => c.classId?._id === classId);
          if (cls?.subject) setSubject(cls.subject);
        }
      })
      .catch(() => showStatus('Failed to load classes.', 'error'))
      .finally(() => setPageLoading(false));
  }, [showStatus]); // classId intentionally excluded — only on mount

  // Load students when classId changes
  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    setDataLoading(true);
    getClassStudents(classId)
      .then((res) => setStudents(res.data.students ?? []))
      .catch(() => showStatus('Failed to load students.', 'error'))
      .finally(() => setDataLoading(false));
  }, [classId, showStatus]);

  // Load existing marks when classId + subject change
  useEffect(() => {
    if (!classId || !subject.trim()) { setMarks({}); return; }
    getMarks(classId, subject.trim())
      .then((res) => {
        const existing = res.data.marks ?? [];
        const map = {};
        existing.forEach((m) => {
          const sid = m.studentId?._id ?? m.studentId;
          if (sid != null) map[sid] = String(m.marksObtained);
        });
        setMarks(map);
      })
      .catch(() => {/* non-fatal; just leave marks empty */});
  }, [classId, subject]);

  function handleMarkChange(studentId, val) {
    setMarks((prev) => ({ ...prev, [studentId]: val }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!classId || !subject.trim()) {
      showStatus('Please select a class and enter a subject.', 'error');
      return;
    }

    const entries = Object.entries(marks).filter(([, v]) => v !== '' && v != null);
    if (entries.length === 0) {
      showStatus('No marks to save.', 'error');
      return;
    }

    const mm = Number(maxMarks) || 100;
    // Validate all
    const invalid = entries.filter(([, v]) => {
      const n = Number(v);
      return isNaN(n) || n < 0 || n > mm;
    });
    if (invalid.length > 0) {
      showStatus(`${invalid.length} mark(s) out of range (0–${mm}). Please fix before saving.`, 'error');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    await Promise.all(
      entries.map(([studentId, marksObtained]) =>
        saveMark({
          studentId,
          classId,
          subject: subject.trim(),
          examType,
          marksObtained: Number(marksObtained),
          maxMarks: Number(maxMarks) || 100,
        })
          .then(() => { successCount += 1; })
          .catch(() => { errorCount += 1; })
      )
    );

    setSaving(false);

    if (errorCount === 0) {
      showStatus(`Marks saved for ${successCount} student${successCount !== 1 ? 's' : ''}.`);
    } else {
      showStatus(
        `Saved ${successCount} / ${entries.length} marks. ${errorCount} failed.`,
        'error'
      );
    }
  }

  const selectedClass = classes.find((c) => c.classId?._id === classId);

  return (
    <Layout role="teacher">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Enter Marks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select a class, enter the subject and exam type, then fill in marks.
          </p>
        </div>

        <StatusMessage message={status.message} type={status.type} />

        <form onSubmit={handleSave} className="space-y-5">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap gap-4">
            {/* Class */}
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-gray-600">Class</label>
              {pageLoading ? (
                <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={classId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setClassId(newId);
                    // Auto-fill subject from class assignment
                    const cls = classes.find((c) => c.classId?._id === newId);
                    if (cls?.subject) setSubject(cls.subject);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">— Select class —</option>
                  {classes.map((c) => (
                    <option key={c.classId?._id} value={c.classId?._id}>
                      {c.classId?.name} (Grade {c.classId?.grade} · {c.classId?.section}) — {c.subject}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-xs font-medium text-gray-600">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Exam type */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs font-medium text-gray-600">Exam Type</label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 capitalize"
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Marks */}
            <div className="flex flex-col gap-1 min-w-[100px]">
              <label className="text-xs font-medium text-gray-600">Max Marks (MM)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxMarks}
                onChange={(e) => setMaxMarks(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
              />
            </div>
          </div>

          {/* Table */}
          {classId && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    {selectedClass?.classId?.name ?? 'Class'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {subject || 'No subject selected'} · {examType}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {students.length} student{students.length !== 1 ? 's' : ''}
                </span>
              </div>

              {dataLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <MarksTable
                  students={students}
                  marks={marks}
                  maxMarks={Number(maxMarks) || 100}
                  onChange={handleMarkChange}
                  disabled={saving}
                />
              )}

              {!dataLoading && students.length > 0 && (
                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving || !subject.trim()}
                    className="rounded-xl bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : 'Save Marks'}
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
}
