import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_PAGES } from '../utils/tmdb.js';

const EMPTY = {
  items: [],
  page: 0,
  totalPages: 0,
  totalResults: 0,
  loading: false,
  loadingMore: false,
  error: null,
};

const keyOf = (raw) => `${raw.media_type || ''}-${raw.id}`;

function merge(existing, incoming) {
  const seen = new Set(existing.map(keyOf));
  const merged = [...existing];
  for (const raw of incoming) {
    if (!raw || seen.has(keyOf(raw))) continue;
    seen.add(keyOf(raw));
    merged.push(raw);
  }
  return merged;
}

/**
 * Paginated loading with "Load more".
 * `fetchPage(page, signal)` must resolve to a TMDB list response ({ results, total_pages, ... }).
 * Everything resets (and in-flight requests are aborted) when `deps` change.
 */
export function usePaged(fetchPage, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ ...EMPTY, loading: enabled });
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(fetchPage);
  const stateRef = useRef(state);
  const controllerRef = useRef(null);
  fetchRef.current = fetchPage;
  stateRef.current = state;

  const load = useCallback((page, replace) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) =>
      replace ? { ...EMPTY, loading: true } : { ...prev, loadingMore: true, error: null },
    );

    Promise.resolve()
      .then(() => fetchRef.current(page, controller.signal))
      .then((response) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          items: merge(replace ? [] : prev.items, Array.isArray(response?.results) ? response.results : []),
          page: Number(response?.page) || page,
          totalPages: Number(response?.total_pages) || 0,
          totalResults: Number(response?.total_results) || 0,
          loading: false,
          loadingMore: false,
          error: null,
        }));
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setState((prev) => ({ ...prev, loading: false, loadingMore: false, error }));
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort();
      setState({ ...EMPTY });
      return undefined;
    }
    load(1, true);
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, tick, load]);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (current.loading || current.loadingMore) return;
    load(current.page + 1, false);
  }, [load]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  const hasMore = state.page > 0 && state.page < Math.min(state.totalPages, MAX_PAGES);

  return { ...state, hasMore, loadMore, reload };
}
