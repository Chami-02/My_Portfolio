import { Component } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import styles from './ErrorBoundary.module.css';

export class ErrorBoundary extends Component {
  // The page's QueryClient, when there is one — read so TRY AGAIN can refetch.
  static contextType = QueryClientContext;

  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * TRY AGAIN refetches, THEN re-renders.
   *
   * ⚠️ Clearing the error alone re-rendered the section from TanStack's cache
   * — the same payload that just threw — so it threw again until staleTime ran
   * out, and the button looked broken. Refetching first means the retry reads
   * what the server holds NOW. A refetch that fails keeps the old data and the
   * section may throw again, which is the honest answer.
   *
   * Every cached query, not a guess at which one: the boundary cannot know
   * which query fed the throw, and the stale data stays on screen elsewhere
   * until the fresh answer replaces it — nothing blanks. No client (a test, a
   * page outside the provider) = just re-render, as before.
   */
  retry = async () => {
    await this.context?.refetchQueries();
    this.setState({ hasError: false, error: null });
  };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, send this to an error tracking service (e.g. Sentry)
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // PF-116: Phase 2 tokens, styled in ErrorBoundary.module.css. The
      // message stays sentence-case in the DOM (CSS uppercases it), so its
      // accessible text reads normally rather than as shouted capitals.
      return (
        <div className={styles.wrap}>
          <div className={styles.panel} role="alert">
            <span className={styles.icon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            <p className={styles.heading}>
              Something went wrong loading this section
            </p>
            <p className={styles.detail}>
              {this.state.error?.message}
            </p>
            <button
              type="button"
              className={styles.button}
              onClick={this.retry}
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}