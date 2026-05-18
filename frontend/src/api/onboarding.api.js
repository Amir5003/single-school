import axiosInstance from './axiosInstance';

export const checkSlugAvailability = (slug) =>
  axiosInstance.get('/onboarding/slug-check', { params: { slug } });

export const registerSchool = (data) =>
  axiosInstance.post('/onboarding/register', data);
