import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, send this to an error tracking service (e.g. Sentry)
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '3rem', height: '3rem', borderRadius: '50%',
            background: 'rgba(239,68,68,0.1)', marginBottom: '1rem',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" style={{ width: 20, height: 20 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p style={{ color: '#f87171', fontWeight: 500, marginBottom: '0.5rem' }}>
            Something went wrong loading this section
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginBottom: '1.25rem' }}>
            {this.state.error?.message}
          </p>
          <button
            className="btn-outline"
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}