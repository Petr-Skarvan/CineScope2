import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WATCHLIST_STORAGE_KEY,
  addToWatchlist,
  clearWatchlist,
  getWatchlist,
  isInWatchlist,
  parseWatchlist,
  removeFromWatchlist,
  toggleWatchlist,
} from '../src/utils/watchlist.js';
import { normalizeItem, pickTrailer, topGenres, yearOf } from '../src/utils/media.js';

const dune = { id: 1, mediaType: 'movie', title: 'Dune', posterPath: '/a.jpg', releaseDate: '2021-10-22', rating: 7.8, genreIds: [12, 878] };

describe('watchlist', () => {
  beforeEach(() => clearWatchlist());

  it('adds, persists to localStorage and ignores duplicates', () => {
    expect(addToWatchlist(dune)).toBe(true);
    expect(addToWatchlist(dune)).toBe(false);
    expect(isInWatchlist('movie', 1)).toBe(true);
    expect(isInWatchlist('tv', 1)).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY))).toHaveLength(1);
  });

  it('removes and toggles', () => {
    addToWatchlist(dune);
    expect(removeFromWatchlist('movie', 1)).toBe(true);
    expect(getWatchlist()).toEqual([]);
    expect(toggleWatchlist(dune)).toBe(true);
    expect(toggleWatchlist(dune)).toBe(false);
  });

  it('survives invalid stored data', () => {
    expect(parseWatchlist('not json')).toEqual([]);
    expect(parseWatchlist('{"a":1}')).toEqual([]);
    expect(parseWatchlist(JSON.stringify([null, { id: 'x' }, { id: 2, mediaType: 'person' }, dune]))).toHaveLength(1);
  });
});

describe('media helpers', () => {
  it('normalises movies and tv, and drops people', () => {
    expect(normalizeItem({ id: 5, media_type: 'person', name: 'X' })).toBeNull();
    const tv = normalizeItem({ id: 7, name: 'Show', first_air_date: '2020-01-01', vote_average: 8.04, vote_count: 10, genre_ids: [1] }, 'tv');
    expect(tv).toMatchObject({ id: 7, mediaType: 'tv', title: 'Show', rating: 8, genreIds: [1] });
    expect(normalizeItem({ id: 8, title: 'Unrated', vote_average: 0, vote_count: 0 }, 'movie').rating).toBeNull();
  });

  it('picks the official YouTube trailer first', () => {
    const pick = pickTrailer([
      { site: 'YouTube', key: 'teaser1234', type: 'Teaser', official: true },
      { site: 'YouTube', key: 'trailer123', type: 'Trailer', official: true },
      { site: 'Vimeo', key: 'vimeo12345', type: 'Trailer', official: true },
    ]);
    expect(pick.key).toBe('trailer123');
    expect(pickTrailer([])).toBeNull();
  });

  it('finds top genres and years', () => {
    expect(topGenres([{ genreIds: [1, 2] }, { genreIds: [2, 3] }], 1)).toEqual([2]);
    expect(yearOf('1999-03-31')).toBe('1999');
    expect(yearOf('')).toBe('');
  });
});

describe('tmdb client without a token', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('rejects with NO_TOKEN and never calls fetch', async () => {
    vi.stubEnv('VITE_TMDB_READ_ACCESS_TOKEN', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { api, hasToken } = await import('../src/utils/tmdb.js');
    expect(hasToken()).toBe(false);
    await expect(api.trending()).rejects.toMatchObject({ code: 'NO_TOKEN' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the bearer token when configured', async () => {
    vi.stubEnv('VITE_TMDB_READ_ACCESS_TOKEN', 'test-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const { api } = await import('../src/utils/tmdb.js');
    await api.list('movie', 'popular');
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain('https://api.themoviedb.org/3/movie/popular');
    expect(options.headers.Authorization).toBe('Bearer test-token');
  });
});
