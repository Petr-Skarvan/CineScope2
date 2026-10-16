import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bookmark, Clapperboard, Search, Star, X } from 'lucide-react';
import { imageUrl, saveToken } from './utils/tmdb.js';
import { mediaLabel, yearOf } from './utils/media.js';
import { useWatchlist } from './hooks/useWatchlist.js';

/* ---------- Layout ---------- */

const LINKS = [
  ['/', 'Home', true],
  ['/movies', 'Movies'],
  ['/tv', 'TV Shows'],
  ['/trending', 'Trending'],
  ['/watchlist', 'My Watchlist'],
  ['/search', 'Search'],
];

export function Navbar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { count } = useWatchlist();
  const [q, setQ] = useState(params.get('q') || '');
  const input = useRef(null);

  useEffect(() => setQ(params.get('q') || ''), [params]);

  const submit = (event) => {
    event.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="CineScope home">
        <Clapperboard size={24} /> Cine<span>Scope</span>
      </Link>
      <form className="searchbox" role="search" onSubmit={submit}>
        <input
          ref={input}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search movies & TV…"
          aria-label="Search movies and TV shows"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQ('');
              input.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
        <button type="submit" aria-label="Search">
          <Search size={16} />
        </button>
      </form>
      <nav className="nav-links" aria-label="Primary">
        {LINKS.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
            {to === '/watchlist' && count > 0 ? <b className="badge">{count}</b> : null}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <p>
        <strong>
          Cine<span className="accent">Scope</span>
        </strong>{' '}
        is an independent school project. It is not an official product of TMDB.
      </p>
      <p>
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
          TMDB
        </a>{' '}
        — This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
      </p>
    </footer>
  );
}

/* ---------- Cards ---------- */

export function MovieCard({ entry, rank }) {
  const { has, toggle } = useWatchlist();
  const [broken, setBroken] = useState(false);
  const saved = has(entry.mediaType, entry.id);
  const href = `/${entry.mediaType}/${entry.id}`;
  const poster = imageUrl(entry.posterPath, 'w500');
  const year = yearOf(entry.releaseDate);

  return (
    <article className="card">
      <div className="poster">
        <Link to={href} tabIndex={-1} aria-hidden="true">
          {poster && !broken ? (
            <img src={poster} alt={`${entry.title} poster`} loading="lazy" onError={() => setBroken(true)} />
          ) : (
            <div className="nopost">
              <Clapperboard size={30} />
              <span>{entry.title}</span>
            </div>
          )}
        </Link>
        {rank ? <span className="rank">{rank}</span> : null}
        {entry.rating != null && (
          <span className="rating">
            <Star size={12} fill="currentColor" /> {entry.rating.toFixed(1)}
          </span>
        )}
        <button
          className="save"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${entry.title} from watchlist` : `Add ${entry.title} to watchlist`}
          onClick={() => toggle(entry)}
        >
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <h3 className="card-title">
        <Link to={href}>{entry.title}</Link>
      </h3>
      <p className="card-sub">
        {year || 'TBA'} · {mediaLabel(entry.mediaType)}
      </p>
    </article>
  );
}

export function Grid({ entries }) {
  return (
    <div className="grid">
      {entries.map((entry, index) => (
        <MovieCard key={`${entry.mediaType}-${entry.id}`} entry={entry} rank={entry.rank ?? undefined} />
      ))}
    </div>
  );
}

export function Rail({ title, to, entries }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {to ? <Link to={to}>View all</Link> : null}
      </div>
      <div className="rail">
        {entries.map((entry) => (
          <div className="rail-item" key={`${entry.mediaType}-${entry.id}`}>
            <MovieCard entry={entry} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- States ---------- */

function TokenForm() {
  const [value, setValue] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (value.trim() && saveToken(value)) window.location.reload();
  };
  return (
    <form className="token-form" onSubmit={submit}>
      <label>
        Or paste your API Read Access Token here
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="eyJhbGciOi…"
          autoComplete="off"
        />
      </label>
      <button className="btn primary" type="submit" disabled={!value.trim()}>
        Save token
      </button>
    </form>
  );
}

export function SetupNotice() {
  return (
    <div className="state setup" role="status">
      <h2>Connect TMDB to load live data</h2>
      <ol>
        <li>
          Create a free account at <a href="https://www.themoviedb.org/signup">themoviedb.org</a>, then open Settings →
          API and copy the <strong>API Read Access Token</strong> (the long one).
        </li>
        <li>
          Copy <code>.env.example</code> to <code>.env</code> and set{' '}
          <code>VITE_TMDB_READ_ACCESS_TOKEN=your_token</code>.
        </li>
        <li>
          Restart <code>npm run dev</code>.
        </li>
      </ol>
      <TokenForm />
      <p className="muted">
        A token pasted here is stored only in this browser. A token placed in <code>.env</code> is bundled into the
        site code, so only do that for a local school prototype and never commit the file.
      </p>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  if (error?.code === 'NO_TOKEN') return <SetupNotice />;
  let message = error?.message || 'Something went wrong.';
  if (error?.code === 'UNAUTHORIZED') {
    message =
      'TMDB rejected the token. Use the long "API Read Access Token" (not the short API key) in .env and restart the dev server.';
  }
  return (
    <div className="state" role="alert">
      <AlertTriangle size={26} />
      <p>{message}</p>
      {onRetry ? (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Skeleton({ count = 12 }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <div className="sk" key={index} />
      ))}
    </div>
  );
}

export function WatchlistButton({ entry }) {
  const { has, toggle } = useWatchlist();
  const saved = has(entry.mediaType, entry.id);
  return (
    <button className={saved ? 'btn' : 'btn primary'} aria-pressed={saved} onClick={() => toggle(entry)}>
      <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Remove from Watchlist' : 'Add to Watchlist'}
    </button>
  );
}
