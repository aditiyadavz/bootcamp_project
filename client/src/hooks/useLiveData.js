// Loads data from the API and loads it again whenever the server says something changed.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useRealtime } from '../context/Realtime.jsx';

export function useLiveData(path) {
  const { version } = useRealtime();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => api(path)
    .then((result) => {
      setData(result);
      setError('');
    })
    .catch((problem) => setError(problem.message)), [path]);

  useEffect(() => {
    if (path) reload();
  }, [reload, version, path]);

  return { data, error, reload };
}
