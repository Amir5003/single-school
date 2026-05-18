import axiosInstance from './axiosInstance';

// ── Students ──────────────────────────────────────────────────────────────────

export const getStudents = (params = {}) =>
  axiosInstance.get('/admin/students', { params }).then((r) => r.data);

export const getStudent = (id) =>
  axiosInstance.get(`/admin/students/${id}`).then((r) => r.data);

export const createStudent = (data) =>
  axiosInstance.post('/admin/students', data).then((r) => r.data);

export const updateStudent = (id, data) =>
  axiosInstance.put(`/admin/students/${id}`, data).then((r) => r.data);

export const deleteStudent = (id) =>
  axiosInstance.delete(`/admin/students/${id}`).then((r) => r.data);

// ── Teachers (Phase 4) ────────────────────────────────────────────────────────

export const getTeachers = (params = {}) =>
  axiosInstance.get('/admin/teachers', { params }).then((r) => r.data);

export const createTeacher = (data) =>
  axiosInstance.post('/admin/teachers', data).then((r) => r.data);

export const updateTeacher = (id, data) =>
  axiosInstance.put(`/admin/teachers/${id}`, data).then((r) => r.data);

export const deleteTeacher = (id) =>
  axiosInstance.delete(`/admin/teachers/${id}`).then((r) => r.data);

export const assignTeacherToClass = (teacherId, data) =>
  axiosInstance.post(`/admin/teachers/${teacherId}/assign-class`, data).then((r) => r.data);

// ── Classes (Phase 4) ─────────────────────────────────────────────────────────

export const getClasses = (params = {}) =>
  axiosInstance.get('/admin/classes', { params }).then((r) => r.data);

export const createClass = (data) =>
  axiosInstance.post('/admin/classes', data).then((r) => r.data);

export const updateClass = (id, data) =>
  axiosInstance.put(`/admin/classes/${id}`, data).then((r) => r.data);

export const deleteClass = (id) =>
  axiosInstance.delete(`/admin/classes/${id}`).then((r) => r.data);

export const assignStudents = (classId, studentIds) =>
  axiosInstance
    .post(`/admin/classes/${classId}/assign-students`, { studentIds })
    .then((r) => r.data);

// ── Timetable (Phase 4) ───────────────────────────────────────────────────────

export const getTimetable = (classId) =>
  axiosInstance.get('/admin/timetable', { params: { classId } }).then((r) => r.data);

export const createTimetableEntry = (data) =>
  axiosInstance.post('/admin/timetable', data).then((r) => r.data);

export const updateTimetableEntry = (id, data) =>
  axiosInstance.put(`/admin/timetable/${id}`, data).then((r) => r.data);

export const deleteTimetableEntry = (id) =>
  axiosInstance.delete(`/admin/timetable/${id}`).then((r) => r.data);

// ── User approval (Phase 9) ───────────────────────────────────────────────────

export const getPendingUsers = () =>
  axiosInstance.get('/admin/users/pending').then((r) => r.data);

export const approveUser = (id) =>
  axiosInstance.put(`/admin/users/${id}/approve`).then((r) => r.data);

export const rejectUser = (id) =>
  axiosInstance.put(`/admin/users/${id}/reject`).then((r) => r.data);

// ── Branding ──────────────────────────────────────────────────────────────────

export const updateBranding = (data) =>
  axiosInstance.patch('/admin/school/branding', data).then((r) => r.data);

export const uploadLogo = (formData) =>
  axiosInstance.post('/admin/school/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
