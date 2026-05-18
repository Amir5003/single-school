import axiosInstance from './axiosInstance';

export const listNotifications = (role) =>
  axiosInstance.get(`/${role}/notifications`).then((r) => r.data);

export const markNotificationRead = (role, notificationId) =>
  axiosInstance.patch(`/${role}/notifications/${notificationId}/read`).then((r) => r.data);

export const sendNotification = (data) =>
  axiosInstance.post('/admin/notifications', data).then((r) => r.data);
