import axios from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearTokens,
} from './tokenStorage';
import { resetSession } from '../utils/sessionReset';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// ── Request interceptor — attach Authorization header from localStorage ──────
axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Injected references (set after store / router are created) ────────────────
let _store = null;
let _navigate = null;

export const injectStore = (store) => {
  _store = store;
};
export const injectNavigate = (navigate) => {
  _navigate = navigate;
};

// ── Token refresh state ───────────────────────────────────────────────────────
let _isRefreshing = false;
let _refreshQueue = [];

function onRefreshed() {
  _refreshQueue.forEach((resolve) => resolve());
  _refreshQueue = [];
}

function addToRefreshQueue() {
  return new Promise((resolve) => _refreshQueue.push(resolve));
}

function redirectToLogin() {
  clearTokens();
  if (_store) {
    // resetSession clears auth AND the school/subscription slices — clearing
    // auth alone left the expired user's school slug and branding in memory.
    resetSession(_store.dispatch);
  }
  const href = _navigate ? null : window.location.href;
  if (_navigate) {
    _navigate('/login');
  } else if (!href?.includes('/login')) {
    window.location.href = '/login';
  }
}

// ── Response interceptor — 401: attempt refresh then retry ───────────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry auth or refresh endpoints themselves
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (_isRefreshing) {
        // Wait for the ongoing refresh, then retry
        await addToRefreshQueue();
        return axiosInstance(originalRequest);
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        const { data } = await axiosInstance.post('/auth/refresh', { refreshToken });
        const newAccessToken = data?.data?.accessToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken);
        }
        onRefreshed();
        return axiosInstance(originalRequest);
      } catch {
        _refreshQueue = [];
        redirectToLogin();
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
