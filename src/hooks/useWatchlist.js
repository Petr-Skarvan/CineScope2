import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  addToWatchlist,
  clearWatchlist,
  entryKey,
  parseWatchlist,
  readRawWatchlist,
  removeFromWatchlist,
  subscribeToWatchlist,
  toggleWatchlist,
} from '../utils/watchlist.js';

const getServerSnapshot = () => null;

/** Reactive view of the localStorage watchlist (also syncs across browser tabs). */
export function useWatchlist() {
  // The raw string is a primitive, so React can cheaply tell whether anything changed.
  const raw = useSyncExternalStore(subscribeToWatchlist, readRawWatchlist, getServerSnapshot);
  const items = useMemo(() => parseWatchlist(raw), [raw]);
  const keys = useMemo(() => new Set(items.map((entry) => entryKey(entry.mediaType, entry.id))), [items]);

  const has = useCallback((mediaType, id) => keys.has(entryKey(mediaType, id)), [keys]);

  return {
    items,
    count: items.length,
    has,
    add: addToWatchlist,
    remove: removeFromWatchlist,
    toggle: toggleWatchlist,
    clear: clearWatchlist,
  };
}
