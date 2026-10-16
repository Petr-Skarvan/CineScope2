// Persistent local watchlist backed by localStorage.
// Only the fields needed to render a card are stored. Invalid/missing data is ignored safely.

export const WATCHLIST_STORAGE_KEY = 'cinescope:watchlist:v1';
export const WATCHLIST_EVENT = 'cinescope:watchlist-changed';

let memoryRaw = null; // fallback when localStorage is unavailable (private mode, blocked, quota)

export function entryKey(mediaType, id) {
  return `${mediaType}:${id}`;
}

export function sanitizeEntry(input) {
  if (!input || typeof input !== 'object') return null;
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (input.mediaType !== 'movie' && input.mediaType !== 'tv') return null;

  const rating = Number(input.rating);
  return {
    id,
    mediaType: input.mediaType,
    title: typeof input.title === 'string' && input.title.trim() ? input.title : 'Untitled',
    posterPath: typeof input.posterPath === 'string' && input.posterPath.startsWith('/') ? input.posterPath : null,
    releaseDate: typeof input.releaseDate === 'string' ? input.releaseDate : '',
    rating: input.rating !== null && input.rating !== undefined && Number.isFinite(rating) ? rating : null,
    genreIds: Array.isArray(input.genreIds) ? input.genreIds.filter((g) => Number.isInteger(g)) : [],
    addedAt: Number.isFinite(Number(input.addedAt)) ? Number(input.addedAt) : 0,
  };
}

/** Pure parser: raw string from storage -> clean, de-duplicated array. Never throws. */
export function parseWatchlist(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const seen = new Set();
  const entries = [];
  for (const item of data) {
    const entry = sanitizeEntry(item);
    if (!entry) continue;
    const key = entryKey(entry.mediaType, entry.id);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  return entries;
}

export function readRawWatchlist() {
  try {
    return window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function writeWatchlist(entries) {
  const raw = JSON.stringify(entries);
  memoryRaw = raw;
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, raw);
  } catch {
    // Storage is full or blocked: the list still works for this session via memoryRaw.
  }
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

export function getWatchlist() {
  return parseWatchlist(readRawWatchlist());
}

export function isInWatchlist(mediaType, id) {
  return getWatchlist().some((entry) => entry.mediaType === mediaType && entry.id === Number(id));
}

export function addToWatchlist(item) {
  const entry = sanitizeEntry({ ...item, addedAt: Date.now() });
  if (!entry) return false;
  const list = getWatchlist();
  if (list.some((existing) => existing.mediaType === entry.mediaType && existing.id === entry.id)) {
    return false;
  }
  writeWatchlist([entry, ...list]);
  return true;
}

export function removeFromWatchlist(mediaType, id) {
  const list = getWatchlist();
  const next = list.filter((entry) => !(entry.mediaType === mediaType && entry.id === Number(id)));
  if (next.length === list.length) return false;
  writeWatchlist(next);
  return true;
}

export function toggleWatchlist(item) {
  if (isInWatchlist(item.mediaType, item.id)) {
    removeFromWatchlist(item.mediaType, item.id);
    return false;
  }
  addToWatchlist(item);
  return true;
}

export function clearWatchlist() {
  writeWatchlist([]);
}

export function subscribeToWatchlist(callback) {
  const onStorage = (event) => {
    if (event.key === null || event.key === WATCHLIST_STORAGE_KEY) callback();
  };
  window.addEventListener(WATCHLIST_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(WATCHLIST_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}
