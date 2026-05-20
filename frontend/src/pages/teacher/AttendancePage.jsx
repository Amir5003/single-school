import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import StatusMessage from '../../components/common/StatusMessage';
import AttendanceTable from '../../components/teacher/AttendanceTable';
import {
  getTeacherClasses,
  getClassStudents,
  getAttendance,
  markAttendance,
} from '../../api/teacher.api';

// yyyy-mm-dd in local time
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export default function AttendancePage() {
  const [searchParams] = useSearchParams();

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') ?? '');
  const [date, setDate] = useState(searchParams.get('date') ?? today());

  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});   // { [studentId]: status }

  const [pageLoading, setPageLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ message: '', type: 'success' });
  const statusTimer = useRef(null);

  const showStatus = useCallback((message, type = 'success') => {
    setStatus({ message, type });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus({ message: '', type: 'success' }), 4000);
  }, []);

  // Load classes once
  useEffect(() => {
    getTeacherClasses()
      .then((res) => setClasses(res.data.classes ?? []))
      .catch(() => showStatus('Failed to load classes.', 'error'))
      .finally(() => setPageLoading(false));
  }, [showStatus]);

  // Load students + existing records when classId/date changes
  useEffect(() => {
    if (!classId || !date) return;
    setDataLoading(true);
    Promise.all([getClassStudents(classId), getAttendance(classId, date)])
      .then(([studentsRes, attendanceRes]) => {
        const studentList = studentsRes.data.students ?? [];
        setStudents(studentList);

        const existingRecords = attendanceRes.data.records ?? [];
        const map = {};
        existingRecords.forEach((r) => {
          const sid = r.studentId?._id ?? r.studentId;
          if (sid) map[sid] = r.status;
        });
        setStatuses(map);
      })
      .catch(() => showStatus('Failed to load attendance data.', 'error'))
      .finally(() => setDataLoading(false));
  }, [classId, date, showStatus]);

  function handleToggle(studentId, newStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: newStatus }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!classId || !date) {
      showStatus('Please select a class and date.', 'error');
      return;
    }
    const records = Object.entries(statuses)
      .filter(([, s]) => s)
      .map(([studentId, status]) => ({ studentId, status }));

    if (records.length === 0) {
      showStatus('No attendance data to save.', 'error');
      return;
    }

    setSaving(true);
    try {
      await markAttendance({ classId, date, records });
      showStatus(`Attendance saved for ${records.length} student${records.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Failed to save attendance.';
      showStatus(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  const todayStr = today();
  const selectedClass = classes.find((c) => c.classId?._id === classId);

  return (
    <Layout role="teacher">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mark Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select a class and date, then toggle each student's status.
          </p>
        </div>

        <StatusMessage message={status.message} type={status.type} />

        {/* Filters */}
        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap gap-4">
            {/* Class selector */}
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-gray-600">Class</label>
              {pageLoading ? (
                <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">— Select class —</option>
                  {classes.map((c) => (
                    <option key={c.classId?._id} value={c.classId?._id}>
                      {c.classId?.name} (Grade {c.classId?.grade} · {c.classId?.section}) —{' '}
                      {c.subject}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date picker */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-600">Date</label>
              <input
                type="date"
                value={date}
                max={todayStr}
                onChange={(e) => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Table */}
          {classId && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {/* Sub-header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    {selectedClass?.classId?.name ?? 'Class'}
                  </p>
                  <p className="text-xs text-gray-400">{date}</p>
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
                <AttendanceTable
                  students={students}
                  statuses={statuses}
                  onChange={handleToggle}
                  disabled={saving}
                />
              )}

              {/* Save */}
              {!dataLoading && students.length > 0 && (
                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : 'Save Attendance'}
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
