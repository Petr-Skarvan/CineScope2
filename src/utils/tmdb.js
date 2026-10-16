// Centralised TMDB v3 client: auth header, fetch, error mapping, caching and image URLs.
//
// NOTE: Vite inlines VITE_* variables into the browser bundle, so the token is visible to
// anyone who can open the site. That is acceptable for a local school prototype only.

const API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const PLACEHOLDER_TOKEN = 'your_tmdb_read_access_token_here';
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const MAX_RETRY_WAIT_MS = 3000;

export const MAX_PAGES = 500; // TMDB does not serve pages beyond 500.

const cache = new Map();

export class ApiError extends Error {
  constructor(message, { code = 'HTTP', status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code; // NO_TOKEN | UNAUTHORIZED | NOT_FOUND | RATE_LIMIT | NETWORK | PARSE | HTTP
    this.status = status;
  }
}

const TOKEN_STORAGE_KEY = 'cinescope:token';

// Token source order: build-time .env value, then a token the user pasted into the site
// (kept only in this browser's localStorage, which keeps it out of the public GitHub repo).
function getToken() {
  const fromEnv = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN;
  if (typeof fromEnv === 'string' && fromEnv.trim() && fromEnv.trim() !== PLACEHOLDER_TOKEN) {
    return fromEnv.trim();
  }
  try {
    return (window.localStorage.getItem(TOKEN_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function hasToken() {
  const token = getToken();
  return token.length > 0 && token !== PLACEHOLDER_TOKEN;
}

export function saveToken(token) {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, String(token).trim());
    return true;
  } catch {
    return false;
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function abortError() {
  return new DOMException('The request was aborted.', 'AbortError');
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  const merged = { language: 'en-US', ...params };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function toHttpError(response) {
  let apiMessage = '';
  try {
    const body = await response.json();
    apiMessage = body?.status_message || '';
  } catch {
    // Body was not JSON; fall back to the generic message below.
  }
  if (response.status === 401) {
    return new ApiError(apiMessage || 'TMDB rejected the access token.', {
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }
  if (response.status === 404) {
    return new ApiError(apiMessage || 'That resource was not found on TMDB.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }
  if (response.status === 429) {
    return new ApiError('TMDB is rate limiting requests. Please wait a moment and try again.', {
      code: 'RATE_LIMIT',
      status: 429,
    });
  }
  return new ApiError(apiMessage || `TMDB responded with an unexpected error (${response.status}).`, {
    code: 'HTTP',
    status: response.status,
  });
}

function remember(url, data) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(url, { data, time: Date.now() });
}

export async function request(path, params = {}, { signal } = {}) {
  if (!hasToken()) {
    throw new ApiError('No TMDB access token is configured.', { code: 'NO_TOKEN' });
  }

  const url = buildUrl(path, params);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) return hit.data;

  let retried = false;
  // At most one automatic retry, and only for HTTP 429.
  for (;;) {
    let response;
    try {
      response = await fetch(url, {
        signal,
        headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ApiError('Could not reach TMDB. Check your internet connection and try again.', {
        code: 'NETWORK',
      });
    }

    if (response.status === 429 && !retried) {
      retried = true;
      const seconds = Number(response.headers.get('Retry-After')) || 1;
      await sleep(Math.min(seconds * 1000, MAX_RETRY_WAIT_MS), signal);
      continue;
    }

    if (!response.ok) throw await toHttpError(response);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('TMDB returned a response that could not be read.', { code: 'PARSE' });
    }
    remember(url, data);
    return data;
  }
}

/* ---------- Images ---------- */

export function imageUrl(path, size = 'w500') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function posterSrcSet(path) {
  if (!path) return undefined;
  return `${imageUrl(path, 'w342')} 342w, ${imageUrl(path, 'w500')} 500w, ${imageUrl(path, 'w780')} 780w`;
}

export function backdropSrcSet(path) {
  if (!path) return undefined;
  return `${imageUrl(path, 'w780')} 780w, ${imageUrl(path, 'w1280')} 1280w, ${imageUrl(path, 'original')} 2000w`;
}

/* ---------- Sorting options used by the catalogue pages ---------- */

export const SORT_OPTIONS = {
  movie: [
    { value: 'popularity.desc', label: 'Popularity' },
    { value: 'vote_average.desc', label: 'Rating' },
    { value: 'primary_release_date.desc', label: 'Newest' },
  ],
  tv: [
    { value: 'popularity.desc', label: 'Popularity' },
    { value: 'vote_average.desc', label: 'Rating' },
    { value: 'first_air_date.desc', label: 'Newest' },
  ],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- Endpoints ---------- */

export const api = {
  // /trending/{all|movie|tv}/{day|week}
  trending: (type = 'all', window = 'week', page = 1, opts) =>
    request(`/trending/${type}/${window}`, { page: Math.min(page, MAX_PAGES) }, opts),

  // /movie/{popular|top_rated|now_playing|upcoming} and /tv/{popular|top_rated}
  list: (type, category, page = 1, opts) =>
    request(`/${type}/${category}`, { page: Math.min(page, MAX_PAGES) }, opts),

  // Genre + sort filtering for the catalogue pages.
  discover: (type, { genre, sort = 'popularity.desc', page = 1 } = {}, opts) => {
    const params = {
      sort_by: sort,
      with_genres: genre,
      include_adult: false,
      page: Math.min(page, MAX_PAGES),
    };
    if (sort.startsWith('vote_average')) {
      // Without a vote floor, titles with a single 10/10 vote would dominate.
      params['vote_count.gte'] = type === 'movie' ? 300 : 150;
    } else if (sort.endsWith('date.desc')) {
      const field = type === 'movie' ? 'primary_release_date' : 'first_air_date';
      params[`${field}.lte`] = todayIso(); // hide titles that have not been released yet
      params['vote_count.gte'] = 20;
    }
    return request(`/discover/${type}`, params, opts);
  },

  // Used by "Recommended For You": any of the given genres, most popular first.
  byGenres: (type, genreIds, page = 1, opts) =>
    request(
      `/discover/${type}`,
      {
        with_genres: genreIds.join('|'),
        sort_by: 'popularity.desc',
        'vote_count.gte': 50,
        include_adult: false,
        page,
      },
      opts,
    ),

  searchMulti: (query, page = 1, opts) =>
    request('/search/multi', { query, page: Math.min(page, MAX_PAGES), include_adult: false }, opts),
  searchMovie: (query, page = 1, opts) =>
    request('/search/movie', { query, page: Math.min(page, MAX_PAGES), include_adult: false }, opts),
  searchTv: (query, page = 1, opts) =>
    request('/search/tv', { query, page: Math.min(page, MAX_PAGES), include_adult: false }, opts),

  details: (type, id, opts) => request(`/${type}/${id}`, {}, opts),
  credits: (type, id, opts) => request(`/${type}/${id}/credits`, {}, opts),
  reviews: (type, id, opts) => request(`/${type}/${id}/reviews`, {}, opts),
  recommendations: (type, id, opts) => request(`/${type}/${id}/recommendations`, {}, opts),
  videos: (type, id, opts) =>
    request(`/${type}/${id}/videos`, { include_video_language: 'en,null' }, opts),

  genres: async (type, opts) => {
    const body = await request(`/genre/${type}/list`, {}, opts);
    return Array.isArray(body?.genres) ? body.genres : [];
  },
};
