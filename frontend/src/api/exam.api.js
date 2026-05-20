import axiosInstance from './axiosInstance';

/** Admin exam management */
export const getAdminExams  = (params)         => axiosInstance.get('/admin/exams', { params }).then(r => r.data);
export const createExam     = (data)            => axiosInstance.post('/admin/exams', data).then(r => r.data);
export const updateExam     = (id, data)        => axiosInstance.put(`/admin/exams/${id}`, data).then(r => r.data);
export const deleteExam     = (id)              => axiosInstance.delete(`/admin/exams/${id}`).then(r => r.data);
export const getExamResults = (examId)          => axiosInstance.get(`/admin/exams/${examId}/results`).then(r => r.data);
export const upsertResults  = (examId, results) => axiosInstance.put(`/admin/exams/${examId}/results`, { results }).then(r => r.data);
