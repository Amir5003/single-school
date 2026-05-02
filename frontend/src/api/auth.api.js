import axiosInstance from './axiosInstance';

export const loginUser = (data) =>
  axiosInstance.post('/auth/login', data).then((r) => r.data);

export const registerUser = (data) =>
  axiosInstance.post('/auth/register', data).then((r) => r.data);

export const logoutUser = () =>
  axiosInstance.post('/auth/logout').then((r) => r.data);

export const getCurrentUser = () =>
  axiosInstance.get('/auth/me').then((r) => r.data);
