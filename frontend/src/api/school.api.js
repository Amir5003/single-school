import axiosInstance from './axiosInstance';

/**
 * Fetch public school config by slug.
 * No auth required — used by SchoolLanding and SchoolContextLoader.
 */
export const getSchoolConfig = (slug) =>
  axiosInstance.get(`/public/schools/${slug}/config`);

export const getSchoolPublicAnnouncements = (slug) =>
  axiosInstance.get(`/public/schools/${slug}/announcements`);
