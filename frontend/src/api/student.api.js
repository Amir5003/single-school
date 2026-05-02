import axiosInstance from './axiosInstance';

export const getProfile = () =>
  axiosInstance.get('/student/profile').then((r) => r.data);

export const getTimetable = () =>
  axiosInstance.get('/student/timetable').then((r) => r.data);

export const getAttendance = (month) =>
  axiosInstance
    .get('/student/attendance', { params: month ? { month } : {} })
    .then((r) => r.data);

export const getMarks = () =>
  axiosInstance.get('/student/marks').then((r) => r.data);

export const getStudentAnnouncements = () =>
  axiosInstance.get('/student/announcements').then((r) => r.data);
