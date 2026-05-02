import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
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

// ── Response interceptor — handle 401 globally ───────────────────────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (_store) {
        // Dynamic import to avoid circular dependency at module load time
        import('../redux/slices/authSlice').then(({ clearCredentials }) => {
          _store.dispatch(clearCredentials());
        });
      }
      if (_navigate) {
        _navigate('/login');
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
