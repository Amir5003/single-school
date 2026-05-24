import axiosInstance from './axiosInstance';

/** Teacher subject submission flow (005) */
export const getMyExams         = ()          => axiosInstance.get('/teacher/exams').then(r => r.data);
export const getMySubmissions   = (examId)    => axiosInstance.get(`/teacher/exams/${examId}/submissions`).then(r => r.data);
export const getSubmission      = (id)        => axiosInstance.get(`/teacher/submissions/${id}`).then(r => r.data);
export const saveSubmissionDraft = (id, marks) => axiosInstance.put(`/teacher/submissions/${id}/marks`, { marks }).then(r => r.data);
export const submitSubmission   = (id)        => axiosInstance.post(`/teacher/submissions/${id}/submit`).then(r => r.data);
