import axiosInstance from './axiosInstance';

export const createHomework = (data) =>
  axiosInstance.post('/teacher/homework', data).then((r) => r.data);

export const listHomeworkForClass = (classId) =>
  axiosInstance.get('/teacher/homework', { params: { classId } }).then((r) => r.data);

export const deleteHomework = (homeworkId) =>
  axiosInstance.delete(`/teacher/homework/${homeworkId}`).then((r) => r.data);

export const getStudentHomework = () =>
  axiosInstance.get('/student/homework').then((r) => r.data);
