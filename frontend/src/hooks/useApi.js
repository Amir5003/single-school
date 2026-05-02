import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setLoading } from '../redux/slices/uiSlice';

/**
 * Generic data-fetching hook.
 * @param {Function} apiFn  - async function that returns response.data
 * @returns {{ data, loading, error, execute }}
 */
export default function useApi(apiFn) {
  const dispatch = useDispatch();
  const [data, setData] = useState(null);
  const [loading, setLocalLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      setLocalLoading(true);
      dispatch(setLoading(true));
      setError(null);
      try {
        const result = await apiFn(...args);
        setData(result);
        return result;
      } catch (err) {
        const message =
          err?.response?.data?.message || err.message || 'An error occurred';
        setError(message);
        throw err;
      } finally {
        setLocalLoading(false);
        dispatch(setLoading(false));
      }
    },
    [apiFn, dispatch]
  );

  return { data, loading, error, execute };
}
