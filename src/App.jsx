import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Footer, Navbar } from './components.jsx';
import { Browse, Details, Home, NotFound, SearchPage, WatchlistPage } from './pages.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <a className="skip" href="#main">Skip to content</a>
      <Navbar />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Browse key="movie" kind="movie" />} />
          <Route path="/tv" element={<Browse key="tv" kind="tv" />} />
          <Route path="/trending" element={<Browse key="trending" kind="trending" />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/movie/:id" element={<Details key="movie" mediaType="movie" />} />
          <Route path="/tv/:id" element={<Details key="tv" mediaType="tv" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
