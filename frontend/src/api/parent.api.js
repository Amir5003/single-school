import axiosInstance from './axiosInstance';

export const getChildren = () =>
  axiosInstance.get('/parent/children').then((r) => r.data);

export const getChildAttendance = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/attendance`).then((r) => r.data);

export const getChildCoursework = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/coursework`).then((r) => r.data);

export const getChildFees = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/fees`).then((r) => r.data);

export const getChildHomework = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/homework`).then((r) => r.data);

export const getChildNotifications = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/notifications`).then((r) => r.data);

export const getChildExamYears = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/exam-years`).then((r) => r.data);

export const getChildExams = (studentId, year) =>
  axiosInstance
    .get(`/parent/children/${studentId}/exams`, { params: { year } })
    .then((r) => r.data);

export const getChildResult = (studentId, examId) =>
  axiosInstance
    .get(`/parent/children/${studentId}/results`, { params: { examId } })
    .then((r) => r.data);

export const getChildReportCard = (studentId, examId) =>
  axiosInstance
    .get(`/parent/children/${studentId}/results/${examId}/report-card`)
    .then((r) => r.data);
