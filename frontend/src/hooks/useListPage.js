import { useState, useEffect, useCallback, useRef } from 'react';
import { errorMessage } from '../api/client';

/**
 * fetchFn receives { ...filters, page, limit } and must resolve to whatever
 * shape the caller expects (e.g. { categories, meta }). Page resets to 1
 * automatically whenever any filter value changes (not on page-only changes).
 */
export function useListPage(fetchFn, filters, limit = 20) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtersKey = JSON.stringify(filters);
  const prevFiltersKey = useRef(filtersKey);

  useEffect(() => {
    if (prevFiltersKey.current !== filtersKey) {
      prevFiltersKey.current = filtersKey;
      setPage(1);
    }
  }, [filtersKey]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFn({ ...JSON.parse(filtersKey), page, limit })
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // filtersKey is the stable serialized form of filters; fetchFn/limit are stable from callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page, limit]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, page, setPage, reload: load };
}
