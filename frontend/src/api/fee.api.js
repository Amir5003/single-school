import axiosInstance from './axiosInstance';

// ── Legacy fee record creation (manual, per-student) ─────────────────────────
export const createFee = (data) =>
  axiosInstance.post('/admin/fees', data).then((r) => r.data);

export const markFeePaid = (feeId) =>
  axiosInstance.patch(`/admin/fees/${feeId}/pay`).then((r) => r.data);

// ── Enhanced fee records list ─────────────────────────────────────────────────
export const listFees = (params = {}) =>
  axiosInstance.get('/admin/fees', { params }).then((r) => r.data);

export const updateFeeStatus = (feeId, status) =>
  axiosInstance.patch(`/admin/fees/${feeId}/status`, { status }).then((r) => r.data);

// ── Fee Configs (class-level fee templates) ───────────────────────────────────
export const listFeeConfigs = () =>
  axiosInstance.get('/admin/fee-configs').then((r) => r.data);

export const createFeeConfig = (data) =>
  axiosInstance.post('/admin/fee-configs', data).then((r) => r.data);

export const updateFeeConfig = (id, data) =>
  axiosInstance.patch(`/admin/fee-configs/${id}`, data).then((r) => r.data);

export const deleteFeeConfig = (id) =>
  axiosInstance.delete(`/admin/fee-configs/${id}`).then((r) => r.data);

export const generateFeesFromConfig = (id) =>
  axiosInstance.post(`/admin/fee-configs/${id}/generate`).then((r) => r.data);

// ── Student self-view ─────────────────────────────────────────────────────────
export const getStudentFees = () =>
  axiosInstance.get('/student/fees').then((r) => r.data);
