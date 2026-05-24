import axiosInstance from './axiosInstance';

/** Student result access */
export const getExamYears        = ()         => axiosInstance.get('/student/exams/years').then(r => r.data);
export const getExamsForYear     = (year)     => axiosInstance.get('/student/exams', { params: { year } }).then(r => r.data);
export const getStudentResult    = (examId)   => axiosInstance.get('/student/results', { params: { examId } }).then(r => r.data);
export const getReportCardPayload = (examId)  => axiosInstance.get(`/student/results/${examId}/report-card`).then(r => r.data);
