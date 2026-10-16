import { Component } from 'react';

// Shows a readable message instead of a blank page if rendering crashes.
// It silently retries once (a fresh render) and resets when the URL hash changes.
export default class ErrorBoundary extends Component {
  state = { error: null, componentStack: '', retrying: false };
  retries = 0;

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    this.onHash = () => {
      this.retries = 0;
      if (this.state.error) this.setState({ error: null, componentStack: '', retrying: false });
    };
    window.addEventListener('hashchange', this.onHash);
  }

  componentDidUpdate(_prevProps, prevState) {
    if (this.state.retrying && !prevState.retrying) {
      this.setState({ error: null, componentStack: '', retrying: false });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHash);
  }

  componentDidCatch(error, info) {
    console.error('CineScope crashed:', error, info?.componentStack);
    if (this.retries < 1) {
      this.retries += 1;
      this.setState({ retrying: true });
    } else {
      this.setState({ componentStack: info?.componentStack || '' });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.retrying) return null;
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>
          <a href="#/">Back to Home</a> · If it keeps happening, report this message:
        </p>
        <pre>{String(this.state.error?.stack || this.state.error)}</pre>
        {this.state.componentStack ? <pre>{this.state.componentStack}</pre> : null}
      </div>
    );
  }
}
