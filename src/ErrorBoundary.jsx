import { Component } from 'react';

// Shows a readable message instead of a blank page if rendering crashes.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('CineScope crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>Please reload the page. If it keeps happening, report this message:</p>
        <pre>{String(this.state.error?.stack || this.state.error)}</pre>
      </div>
    );
  }
}
