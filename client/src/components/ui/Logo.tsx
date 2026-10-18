import { Link } from 'react-router-dom';

export default function Logo({ to = '/', className = '' }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${className}`} aria-label="GitInsight home">
      <span className="grid place-items-center w-7 h-7 rounded-lg bg-accent text-on-accent">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="6" cy="6" r="2" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="9" r="2" />
          <path d="M6 8v8M8 6h4a4 4 0 0 1 4 3" />
        </svg>
      </span>
      <span className="text-[15px]">GitInsight</span>
    </Link>
  );
}
