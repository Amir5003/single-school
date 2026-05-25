const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export const getAccessToken = () => {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
};

export const getRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
};

export const setTokens = ({ accessToken, refreshToken }) => {
  try {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    /* localStorage unavailable — ignore */
  }
};

export const setAccessToken = (accessToken) => {
  try {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  } catch {
    /* ignore */
  }
};

export const clearTokens = () => {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
};
