import axiosInstance from './axiosInstance';

/** Teacher — coursework assessments */
export const createAssessment = (data) =>
  axiosInstance.post('/teacher/assessments', data).then((r) => r.data);

export const listAssessments = (params = {}) =>
  axiosInstance.get('/teacher/assessments', { params }).then((r) => r.data);

export const getAssessment = (id) =>
  axiosInstance.get(`/teacher/assessments/${id}`).then((r) => r.data);

export const updateAssessment = (id, data) =>
  axiosInstance.put(`/teacher/assessments/${id}`, data).then((r) => r.data);

export const deleteAssessment = (id) =>
  axiosInstance.delete(`/teacher/assessments/${id}`).then((r) => r.data);

export const saveAssessmentScores = (id, scores) =>
  axiosInstance.put(`/teacher/assessments/${id}/scores`, { scores }).then((r) => r.data);
