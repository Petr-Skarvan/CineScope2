// Helpers that turn raw TMDB payloads into the small, consistent shape the UI uses.
// Nothing here invents data: missing fields stay empty / null.

export const MEDIA_TYPES = ['movie', 'tv'];

export function mediaLabel(mediaType) {
  return mediaType === 'tv' ? 'TV Show' : 'Movie';
}

/**
 * Normalise a TMDB movie/TV object (list item or details payload).
 * Returns null for anything that is not a movie or TV show (e.g. people in multi-search).
 */
export function normalizeItem(raw, fallbackType) {
  if (!raw || typeof raw !== 'object') return null;
  const mediaType = raw.media_type || fallbackType;
  const id = Number(raw.id);
  if (!MEDIA_TYPES.includes(mediaType) || !Number.isInteger(id) || id <= 0) return null;

  const average = Number(raw.vote_average);
  const votes = Number(raw.vote_count);
  const rating = average > 0 && votes > 0 ? Math.round(average * 10) / 10 : null;

  let genreIds = [];
  if (Array.isArray(raw.genre_ids)) genreIds = raw.genre_ids;
  else if (Array.isArray(raw.genres)) genreIds = raw.genres.map((genre) => genre?.id);

  return {
    id,
    mediaType,
    title: raw.title || raw.name || raw.original_title || raw.original_name || 'Untitled',
    posterPath: typeof raw.poster_path === 'string' ? raw.poster_path : null,
    releaseDate: raw.release_date || raw.first_air_date || '',
    rating,
    genreIds: genreIds.filter((value) => Number.isInteger(value)),
  };
}

export function normalizeList(results, fallbackType) {
  if (!Array.isArray(results)) return [];
  return results.map((item) => normalizeItem(item, fallbackType)).filter(Boolean);
}

export function yearOf(date) {
  const match = /^(\d{4})/.exec(date || '');
  return match ? match[1] : '';
}

export function formatDate(date) {
  if (!date) return '';
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatRuntime(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return '';
  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Pick the best YouTube video: official trailer > trailer > official teaser > teaser > any. */
export function pickTrailer(videos) {
  const list = Array.isArray(videos) ? videos : [];
  const youtube = list.filter(
    (video) => video && video.site === 'YouTube' && /^[\w-]{6,20}$/.test(video.key || ''),
  );
  const rank = (video) => {
    const official = video.official ? 0 : 1;
    if (video.type === 'Trailer') return official;
    if (video.type === 'Teaser') return 2 + official;
    return 4;
  };
  return [...youtube].sort((a, b) => rank(a) - rank(b))[0] || null;
}

/** Most frequent genre ids across watchlist entries (ties broken by id for stable output). */
export function topGenres(entries, limit = 2) {
  const counts = new Map();
  for (const entry of entries) {
    for (const id of entry.genreIds || []) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([id]) => id);
}
