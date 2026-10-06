import { githubLoginUrl } from '../api/auth.api';

export default function Login() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-sm text-ink-muted tracking-tight">GitInsight</span>
        </div>

        <h1 className="text-3xl font-semibold text-ink leading-tight mb-3">
          Know what your repos actually say about you
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed mb-8">
          A deterministic engineering score, skill inference, and an AI summary that's
          checked against the facts before you see it — built from your real commit history.
        </p>

        <a
          href={githubLoginUrl()}
          className="flex items-center justify-center gap-2 w-full rounded-md bg-accent text-canvas font-medium text-sm px-4 py-2.5 hover:bg-accent-bright transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          Connect GitHub account
        </a>
      </div>
    </div>
  );
}
