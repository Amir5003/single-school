import axiosInstance from './axiosInstance';

export const getChildren = () =>
  axiosInstance.get('/parent/children').then((r) => r.data);

export const getChildAttendance = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/attendance`).then((r) => r.data);

export const getChildMarks = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/marks`).then((r) => r.data);

export const getChildFees = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/fees`).then((r) => r.data);

export const getChildHomework = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/homework`).then((r) => r.data);

export const getChildNotifications = (studentId) =>
  axiosInstance.get(`/parent/children/${studentId}/notifications`).then((r) => r.data);
