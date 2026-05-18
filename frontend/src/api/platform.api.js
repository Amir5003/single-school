import axiosInstance from './axiosInstance';

export const listSchools = (params = {}) =>
  axiosInstance.get('/platform/schools', { params }).then((r) => r.data);

export const getSchool = (id) =>
  axiosInstance.get(`/platform/schools/${id}`).then((r) => r.data);

export const activateSchool = (id) =>
  axiosInstance.patch(`/platform/schools/${id}/activate`).then((r) => r.data);

export const deactivateSchool = (id) =>
  axiosInstance.patch(`/platform/schools/${id}/deactivate`).then((r) => r.data);

export const getAnalytics = () =>
  axiosInstance.get('/platform/analytics').then((r) => r.data);

export const listPendingRegistrations = () =>
  axiosInstance.get('/platform/pending-registrations').then((r) => r.data);

export const approveRegistration = (userId) =>
  axiosInstance.patch(`/platform/registrations/${userId}/approve`).then((r) => r.data);

export const rejectRegistration = (userId, remark) =>
  axiosInstance.patch(`/platform/registrations/${userId}/reject`, { remark }).then((r) => r.data);
