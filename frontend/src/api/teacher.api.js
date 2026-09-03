import axiosInstance from './axiosInstance';

// ── Classes ───────────────────────────────────────────────────────────────────

export const getTeacherClasses = () =>
  axiosInstance.get('/teacher/classes').then((r) => r.data);

export const getClassStudents = (classId) =>
  axiosInstance.get(`/teacher/classes/${classId}/students`).then((r) => r.data);

// ── Attendance ────────────────────────────────────────────────────────────────

/**
 * @param {{ classId, date, records: { studentId, status }[] }} data
 */
export const markAttendance = (data) =>
  axiosInstance.post('/teacher/attendance', data).then((r) => r.data);

/**
 * @param {string} classId
 * @param {string} date  YYYY-MM-DD
 */
export const getAttendance = (classId, date) =>
  axiosInstance.get('/teacher/attendance', { params: { classId, date } }).then((r) => r.data);

// ── Marks ─────────────────────────────────────────────────────────────────────

// ── Announcements ─────────────────────────────────────────────────────────────

export const postAnnouncement = (data) =>
  axiosInstance.post('/teacher/announcements', data).then((r) => r.data);

export const getAnnouncements = () =>
  axiosInstance.get('/teacher/announcements').then((r) => r.data);

export const updateAnnouncement = (id, data) =>
  axiosInstance.put(`/teacher/announcements/${id}`, data).then((r) => r.data);

export const deleteAnnouncement = (id) =>
  axiosInstance.delete(`/teacher/announcements/${id}`).then((r) => r.data);
