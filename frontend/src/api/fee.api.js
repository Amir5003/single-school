import axiosInstance from './axiosInstance';

export const createFee = (data) =>
  axiosInstance.post('/admin/fees', data).then((r) => r.data);

export const listFees = (params = {}) =>
  axiosInstance.get('/admin/fees', { params }).then((r) => r.data);

export const markFeePaid = (feeId) =>
  axiosInstance.patch(`/admin/fees/${feeId}/pay`).then((r) => r.data);

export const getStudentFees = () =>
  axiosInstance.get('/student/fees').then((r) => r.data);
