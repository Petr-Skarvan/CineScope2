import { useEffect, useState } from 'react';

/**
 * Runs `fetcher(signal)` whenever `deps` change. Aborts stale requests.
 * Returns { data, error, loading, reload }.
 */
export function useFetch(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }

    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });

    Promise.resolve()
      .then(() => fetcher(controller.signal))
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setState({ data: null, error, loading: false });
      });

    return () => controller.abort();
    // `fetcher` is intentionally excluded: callers pass inline functions and list their real inputs in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, tick]);

  return { ...state, reload: () => setTick((value) => value + 1) };
}
