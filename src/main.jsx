import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, useLocation } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './styles.css';

// Remounting the app when the page changes gives every page the same clean start as a refresh.
function Root() {
  const { pathname } = useLocation();
  return <App key={pathname} />;
}

// HashRouter (URLs like /#/movie/123) keeps direct links and refresh working on GitHub Pages.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Root />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
