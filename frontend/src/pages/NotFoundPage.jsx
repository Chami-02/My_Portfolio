import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-6">
      <p className="font-mono text-[var(--accent)] text-sm tracking-widest uppercase mb-4">
        Error 404
      </p>
      <h1 className="text-7xl md:text-9xl font-black text-[var(--border-bright)] mb-4">
        404
      </h1>
      <p className="text-[var(--text-body)] text-lg mb-8 text-center max-w-md">
        This page doesn't exist. Probably not a bug — you just wandered off.
      </p>
      <Link to="/" className="btn-primary">
        ← Back to Home
      </Link>
    </div>
  );
}