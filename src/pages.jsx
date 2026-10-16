import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Info, Play } from 'lucide-react';
import { api, hasToken, imageUrl, backdropSrcSet, SORT_OPTIONS } from './utils/tmdb.js';
import {
  formatDate,
  formatRuntime,
  normalizeItem,
  normalizeList,
  pickTrailer,
  plural,
  topGenres,
  yearOf,
} from './utils/media.js';
import { useFetch } from './hooks/useFetch.js';
import { usePaged } from './hooks/usePaged.js';
import { useWatchlist } from './hooks/useWatchlist.js';
import { useDocumentTitle } from './hooks/useDocumentTitle.js';
import {
  EmptyState,
  ErrorState,
  Grid,
  MovieCard,
  Rail,
  SetupNotice,
  Skeleton,
  WatchlistButton,
} from './components.jsx';

/* ---------- Home ---------- */

function Hero({ entry, movie }) {
  return (
    <section className="hero">
      <img
        className="hero-bg"
        srcSet={backdropSrcSet(movie.backdrop_path)}
        sizes="100vw"
        src={imageUrl(movie.backdrop_path, 'w1280')}
        alt=""
      />
      <div className="hero-shade" />
      <div className="hero-body">
        <p className="eyebrow">Trending this week</p>
        <h1>{entry.title}</h1>
        <p className="meta">
          {entry.rating != null ? `★ ${entry.rating.toFixed(1)}` : ''} {yearOf(entry.releaseDate)}
        </p>
        <p className="overview clamp">{movie.overview}</p>
        <div className="actions">
          <Link className="btn primary" to={`/movie/${entry.id}`}>
            <Info size={16} /> Details
          </Link>
          <WatchlistButton entry={entry} />
        </div>
      </div>
    </section>
  );
}

function FetchRail({ title, to, fetcher, mediaType, deps = [], filter }) {
  const state = useFetch(fetcher, deps);
  const entries = useMemo(() => {
    const list = normalizeList(state.data?.results, mediaType);
    return filter ? list.filter(filter) : list;
  }, [state.data, mediaType, filter]);

  if (state.loading) return <section className="section"><h2>{title}</h2><div className="sk-row" aria-busy="true" /></section>;
  if (state.error) return <section className="section"><h2>{title}</h2><ErrorState error={state.error} onRetry={state.reload} /></section>;
  if (!entries.length) return null;
  return <Rail title={title} to={to} entries={entries} />;
}

function Recommended() {
  const { items } = useWatchlist();
  const movies = items.filter((entry) => entry.mediaType === 'movie').length;
  const type = items.length - movies > movies ? 'tv' : 'movie';
  const genreIds = useMemo(() => topGenres(items.filter((entry) => entry.mediaType === type), 2), [items, type]);
  const genres = useFetch((signal) => api.genres(type, { signal }), [type], { enabled: genreIds.length > 0 });
  const saved = useMemo(() => new Set(items.map((entry) => `${entry.mediaType}:${entry.id}`)), [items]);
  const filter = useMemo(() => (entry) => !saved.has(`${entry.mediaType}:${entry.id}`), [saved]);

  if (!items.length || !genreIds.length) {
    return (
      <section className="section">
        <h2>Recommended For You</h2>
        <p className="muted">Add titles to your watchlist and we will suggest more from the genres you save most.</p>
      </section>
    );
  }
  const names = (genres.data || []).filter((g) => genreIds.includes(g.id)).map((g) => g.name);
  return (
    <>
      <FetchRail
        title="Recommended For You"
        mediaType={type}
        fetcher={(signal) => api.byGenres(type, genreIds, 1, { signal })}
        deps={[type, genreIds.join(',')]}
        filter={filter}
      />
      {names.length ? <p className="muted note">Because your watchlist leans towards {names.join(' and ')}.</p> : null}
    </>
  );
}

export function Home() {
  useDocumentTitle('CineScope — Discover movies & TV');
  const live = hasToken();
  const trending = useFetch((signal) => api.trending('movie', 'week', 1, { signal }), [], { enabled: live });
  const featured = useMemo(() => {
    const movie = (trending.data?.results || []).find((m) => m.backdrop_path && m.overview);
    return movie ? { movie, entry: normalizeItem(movie, 'movie') } : null;
  }, [trending.data]);

  if (!live) {
    return (
      <div className="page">
        <SetupNotice />
      </div>
    );
  }

  return (
    <>
      {trending.loading ? <div className="hero sk" aria-busy="true" /> : null}
      {featured ? <Hero entry={featured.entry} movie={featured.movie} /> : null}
      {trending.error ? <div className="page"><ErrorState error={trending.error} onRetry={trending.reload} /></div> : null}
      <div className="page">
        <FetchRail title="Trending This Week" to="/trending" fetcher={(s) => api.trending('all', 'week', 1, { signal: s })} />
        <FetchRail title="Popular Movies" to="/movies" mediaType="movie" fetcher={(s) => api.list('movie', 'popular', 1, { signal: s })} />
        <FetchRail title="Top Rated Movies" to="/movies?sort=vote_average.desc" mediaType="movie" fetcher={(s) => api.list('movie', 'top_rated', 1, { signal: s })} />
        <FetchRail title="Popular TV Shows" to="/tv" mediaType="tv" fetcher={(s) => api.list('tv', 'popular', 1, { signal: s })} />
        <FetchRail title="Upcoming Movies" mediaType="movie" fetcher={(s) => api.list('movie', 'upcoming', 1, { signal: s })} />
        <Recommended />
      </div>
    </>
  );
}

/* ---------- Paged grids: Movies, TV, Trending, Search ---------- */

function LoadMore({ paged }) {
  if (paged.error && paged.items.length) {
    return <ErrorState error={paged.error} onRetry={paged.loadMore} />;
  }
  if (!paged.hasMore) return null;
  return (
    <div className="center">
      <button className="btn" onClick={paged.loadMore} disabled={paged.loadingMore}>
        {paged.loadingMore ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}

function Results({ paged, entries, empty }) {
  if (paged.loading) return <Skeleton />;
  if (paged.error && !paged.items.length) return <ErrorState error={paged.error} onRetry={paged.reload} />;
  if (!entries.length && !paged.hasMore) return empty;
  return (
    <>
      <Grid entries={entries} />
      <LoadMore paged={paged} />
    </>
  );
}

export function Browse({ kind }) {
  const [params, setParams] = useSearchParams();
  const trending = kind === 'trending';
  const type = trending ? (['all', 'movie', 'tv'].includes(params.get('type')) ? params.get('type') : 'all') : kind;
  const sorts = SORT_OPTIONS[type] || [];
  const genre = /^\d+$/.test(params.get('genre') || '') ? params.get('genre') : '';
  const sort = sorts.some((option) => option.value === params.get('sort')) ? params.get('sort') : 'popularity.desc';
  const filtered = Boolean(genre) || sort !== 'popularity.desc';
  const heading = trending ? 'Trending This Week' : type === 'movie' ? 'Movies' : 'TV Shows';
  useDocumentTitle(`${heading} — CineScope`);

  const genres = useFetch((signal) => api.genres(type, { signal }), [type], { enabled: !trending });
  const paged = usePaged(
    (page, signal) =>
      trending ? api.trending(type, 'week', page, { signal }) : api.discover(type, { genre, sort, page }, { signal }),
    [kind, type, genre, sort],
  );
  const entries = useMemo(
    () => normalizeList(paged.items, trending ? undefined : type).map((entry, i) => (trending ? { ...entry, rank: i + 1 } : entry)),
    [paged.items, type, trending],
  );

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next);
  };

  return (
    <div className="page">
      <h1 className="page-title">{heading}</h1>
      {trending ? (
        <div className="chips" role="group" aria-label="Media type">
          {[['all', 'All'], ['movie', 'Movies'], ['tv', 'TV Shows']].map(([value, label]) => (
            <button key={value} className="chip" aria-pressed={type === value} onClick={() => update({ type: value === 'all' ? '' : value })}>
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="filters">
          <div className="chips" role="group" aria-label="Genres">
            <button className="chip" aria-pressed={!genre} onClick={() => update({ genre: '' })}>All genres</button>
            {(genres.data || []).map((g) => (
              <button key={g.id} className="chip" aria-pressed={genre === String(g.id)} onClick={() => update({ genre: String(g.id) })}>
                {g.name}
              </button>
            ))}
          </div>
          <label className="sort">
            Sort by
            <select value={sort} onChange={(event) => update({ sort: event.target.value === 'popularity.desc' ? '' : event.target.value })}>
              {sorts.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {filtered ? (
            <button className="btn" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>
          ) : null}
        </div>
      )}
      <Results
        paged={paged}
        entries={entries}
        empty={
          <EmptyState title="No titles match these filters">
            {filtered ? <button className="btn" onClick={() => setParams(new URLSearchParams())}>Clear filters</button> : null}
          </EmptyState>
        }
      />
    </div>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const type = ['movie', 'tv'].includes(params.get('type')) ? params.get('type') : 'all';
  useDocumentTitle(q ? `“${q}” — CineScope search` : 'Search — CineScope');

  const paged = usePaged(
    (page, signal) =>
      type === 'movie' ? api.searchMovie(q, page, { signal }) : type === 'tv' ? api.searchTv(q, page, { signal }) : api.searchMulti(q, page, { signal }),
    [q, type],
    { enabled: q.length > 0 },
  );
  // normalizeList drops people from multi-search results.
  const entries = useMemo(() => normalizeList(paged.items, type === 'all' ? undefined : type), [paged.items, type]);

  const setType = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('type');
    else next.set('type', value);
    setParams(next);
  };

  if (!q) {
    return (
      <div className="page">
        <h1 className="page-title">Search</h1>
        <EmptyState title="Search for a movie or TV show">
          <p className="muted">Type a title in the search box at the top and press Enter.</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Results for “{q}”</h1>
      <div className="chips" role="group" aria-label="Media type">
        {[['all', 'All'], ['movie', 'Movies'], ['tv', 'TV Shows']].map(([value, label]) => (
          <button key={value} className="chip" aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>
        ))}
      </div>
      <Results
        paged={paged}
        entries={entries}
        empty={<EmptyState title={`No results for “${q}”`}><p className="muted">Check the spelling or try a different title.</p></EmptyState>}
      />
    </div>
  );
}

/* ---------- Details ---------- */

function Review({ review }) {
  const [open, setOpen] = useState(false);
  const text = (review.content || '').trim();
  const long = text.length > 450;
  const rating = review.author_details?.rating;
  return (
    <article className="review">
      <header>
        <strong>{review.author || 'Anonymous'}</strong>
        {rating != null ? <span className="rating-inline">★ {rating}/10</span> : null}
        <span className="muted">{formatDate(review.created_at)}</span>
      </header>
      <p>{open || !long ? text : `${text.slice(0, 450).trimEnd()}…`}</p>
      {long ? (
        <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </article>
  );
}

function Trailer({ video }) {
  const [play, setPlay] = useState(false);
  useEffect(() => setPlay(false), [video?.key]);
  if (!video) return <p className="muted">No trailer is currently available for this title.</p>;
  return (
    <div className="trailer">
      {play ? (
        <iframe
          title={video.name || 'Trailer'}
          src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button className="trailer-btn" onClick={() => setPlay(true)} aria-label="Play trailer">
          <Play size={36} fill="currentColor" />
          <span>Play trailer</span>
        </button>
      )}
      <a className="link" href={`https://www.youtube.com/watch?v=${video.key}`} target="_blank" rel="noopener noreferrer">
        Watch on YouTube
      </a>
    </div>
  );
}

export function Details({ mediaType }) {
  const { id } = useParams();
  const valid = /^\d+$/.test(id || '');
  const deps = [mediaType, id];
  const on = { enabled: valid };
  const details = useFetch((signal) => api.details(mediaType, id, { signal }), deps, on);
  const credits = useFetch((signal) => api.credits(mediaType, id, { signal }), deps, on);
  const videos = useFetch((signal) => api.videos(mediaType, id, { signal }), deps, on);
  const reviews = useFetch((signal) => api.reviews(mediaType, id, { signal }), deps, on);
  const recs = useFetch((signal) => api.recommendations(mediaType, id, { signal }), deps, on);
  const [shown, setShown] = useState(3);
  useEffect(() => setShown(3), [mediaType, id]);

  const x = details.data;
  useDocumentTitle(x ? `${x.title || x.name} — CineScope` : 'CineScope');

  if (!valid) return <div className="page"><EmptyState title="That title could not be found" /></div>;
  if (details.loading) return <div className="page"><div className="sk detail-sk" aria-busy="true" /></div>;
  if (details.error) return <div className="page"><ErrorState error={details.error} onRetry={details.reload} /></div>;

  const entry = normalizeItem(x, mediaType);
  const title = entry.title;
  const original = x.original_title || x.original_name;
  const meta = [
    formatDate(entry.releaseDate),
    mediaType === 'movie'
      ? formatRuntime(x.runtime)
      : [x.number_of_seasons ? plural(x.number_of_seasons, 'season') : '', x.number_of_episodes ? plural(x.number_of_episodes, 'episode') : ''].filter(Boolean).join(', '),
    x.status,
  ].filter(Boolean);
  const makers =
    mediaType === 'movie'
      ? (credits.data?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name)
      : (x.created_by || []).map((c) => c.name);
  const cast = (credits.data?.cast || []).slice(0, 12);
  const reviewList = reviews.data?.results || [];
  const recEntries = normalizeList(recs.data?.results, mediaType);
  const poster = imageUrl(x.poster_path, 'w500');

  return (
    <>
      <section className="detail-hero">
        {x.backdrop_path ? <img className="hero-bg" srcSet={backdropSrcSet(x.backdrop_path)} sizes="100vw" src={imageUrl(x.backdrop_path, 'w1280')} alt="" /> : null}
        <div className="hero-shade" />
        <div className="detail-body">
          {poster ? <img className="detail-poster" src={poster} alt={`${title} poster`} /> : <div className="detail-poster nopost">{title}</div>}
          <div>
            <h1>{title}</h1>
            {original && original !== title ? <p className="muted">Original title: {original}</p> : null}
            {x.tagline ? <p className="tagline">“{x.tagline}”</p> : null}
            <p className="meta">
              {entry.rating != null ? `★ ${entry.rating.toFixed(1)}${x.vote_count ? ` (${x.vote_count.toLocaleString('en-US')} votes)` : ''}` : 'No rating yet'}
              {meta.length ? ` · ${meta.join(' · ')}` : ''}
            </p>
            {x.genres?.length ? (
              <p className="chips">
                {x.genres.map((g) => (
                  <Link className="chip" key={g.id} to={`/${mediaType === 'movie' ? 'movies' : 'tv'}?genre=${g.id}`}>{g.name}</Link>
                ))}
              </p>
            ) : null}
            <p className="overview">{x.overview || 'No overview is available for this title.'}</p>
            {makers.length ? <p><strong>{mediaType === 'movie' ? 'Director' : 'Created by'}:</strong> {makers.join(', ')}</p> : null}
            <div className="actions"><WatchlistButton entry={entry} /></div>
          </div>
        </div>
      </section>

      <div className="page">
        <section className="section">
          <h2>Trailer</h2>
          {videos.loading ? <div className="sk-row" /> : videos.error ? <ErrorState error={videos.error} onRetry={videos.reload} /> : <Trailer video={pickTrailer(videos.data?.results)} />}
        </section>

        <section className="section">
          <h2>Cast</h2>
          {credits.loading ? <div className="sk-row" /> : credits.error ? <ErrorState error={credits.error} onRetry={credits.reload} /> : cast.length ? (
            <div className="rail">
              {cast.map((p) => (
                <div className="person" key={p.credit_id || p.id}>
                  {p.profile_path ? <img src={imageUrl(p.profile_path, 'w185')} alt={p.name} loading="lazy" /> : <div className="nopost">{p.name?.[0]}</div>}
                  <strong>{p.name}</strong>
                  <span className="muted">{p.character}</span>
                </div>
              ))}
            </div>
          ) : <p className="muted">No cast information is available.</p>}
        </section>

        <section className="section">
          <h2>Reviews</h2>
          {reviews.loading ? <div className="sk-row" /> : reviews.error ? <ErrorState error={reviews.error} onRetry={reviews.reload} /> : reviewList.length ? (
            <>
              {reviewList.slice(0, shown).map((review) => <Review key={review.id} review={review} />)}
              {shown < reviewList.length ? <button className="btn" onClick={() => setShown(shown + 3)}>Show more reviews</button> : null}
            </>
          ) : <p className="muted">No reviews are currently available for this title.</p>}
        </section>

        {recs.loading ? <div className="sk-row" /> : recs.error ? null : recEntries.length ? <Rail title="Recommended" entries={recEntries} /> : (
          <section className="section"><h2>Recommended</h2><p className="muted">No recommendations are available.</p></section>
        )}
      </div>
    </>
  );
}

/* ---------- Watchlist ---------- */

export function WatchlistPage() {
  useDocumentTitle('My Watchlist — CineScope');
  const { items, clear } = useWatchlist();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="page">
      <h1 className="page-title">My Watchlist</h1>
      {items.length === 0 ? (
        <EmptyState title="Your watchlist is empty">
          <p className="muted">Use the bookmark on any poster to save it here. Saved titles stay on this device.</p>
          <Link className="btn primary" to="/movies">Browse movies</Link>
        </EmptyState>
      ) : (
        <>
          <div className="filters">
            <p className="muted">{plural(items.length, 'saved title')}</p>
            {confirming ? (
              <span>
                Remove all {items.length} titles?{' '}
                <button className="btn danger" onClick={() => { clear(); setConfirming(false); }}>Yes, remove all</button>{' '}
                <button className="btn" onClick={() => setConfirming(false)}>Cancel</button>
              </span>
            ) : (
              <button className="btn" onClick={() => setConfirming(true)}>Clear watchlist</button>
            )}
          </div>
          <Grid entries={items} />
        </>
      )}
    </div>
  );
}

export function NotFound() {
  useDocumentTitle('Not found — CineScope');
  return (
    <div className="page">
      <EmptyState title="Page not found">
        <Link className="btn primary" to="/">Back to Home</Link>
      </EmptyState>
    </div>
  );
}
