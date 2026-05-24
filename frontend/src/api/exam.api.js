import axiosInstance from './axiosInstance';

/** Admin exam management */
export const getAdminExams  = (params)         => axiosInstance.get('/admin/exams', { params }).then(r => r.data);
export const getAdminExam   = (id)              => axiosInstance.get(`/admin/exams/${id}`).then(r => r.data);
export const createExam     = (data)            => axiosInstance.post('/admin/exams', data).then(r => r.data);
export const updateExam     = (id, data)        => axiosInstance.put(`/admin/exams/${id}`, data).then(r => r.data);
export const deleteExam     = (id)              => axiosInstance.delete(`/admin/exams/${id}`).then(r => r.data);
export const getExamResults = (examId)          => axiosInstance.get(`/admin/exams/${examId}/results`).then(r => r.data);
export const upsertResults  = (examId, results) => axiosInstance.put(`/admin/exams/${examId}/results`, results).then(r => r.data);

/** Exam lifecycle (005) */
export const activateExam       = (examId)              => axiosInstance.post(`/admin/exams/${examId}/activate`).then(r => r.data);
export const publishExam        = (examId)              => axiosInstance.post(`/admin/exams/${examId}/publish`).then(r => r.data);
export const revertExamToDraft  = (examId)              => axiosInstance.post(`/admin/exams/${examId}/revert-to-draft`).then(r => r.data);
export const getExamDashboard   = (examId)              => axiosInstance.get(`/admin/exams/${examId}/dashboard`).then(r => r.data);
export const reopenSubmission   = (examId, submissionId) => axiosInstance.post(`/admin/exams/${examId}/submissions/${submissionId}/reopen`).then(r => r.data);
export const reassignSubmission = (examId, submissionId, teacherId) => axiosInstance.post(`/admin/exams/${examId}/submissions/${submissionId}/reassign`, { teacherId }).then(r => r.data);
