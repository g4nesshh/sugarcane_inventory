import { useState, useEffect, useCallback } from 'react';
import { errorMessage } from '../api/client';

// Same shape as useListPage, but reports return every matching row at once —
// no page/limit, so there's nothing to reset or page through.
export function useReport(fetchFn, filters) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFn(JSON.parse(filtersKey))
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
