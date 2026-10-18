import { githubLoginUrl } from '../api/auth.api';
import Logo from '../components/ui/Logo';
import Button from '../components/ui/Button';
import ThemeToggle from '../components/ui/ThemeToggle';
import { GithubIcon, ArrowRightIcon } from '../components/ui/icons';

export default function Login() {
  return (
    <div className="relative min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-glow pointer-events-none" aria-hidden="true" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-hairline bg-surface shadow-pop p-8">
        <Logo className="mb-8" />

        <h1 className="text-2xl font-semibold text-ink leading-tight mb-3">Know what your repos actually say about you</h1>
        <p className="text-sm text-ink-muted leading-relaxed mb-8">
          A deterministic engineering score, skill inference, and an AI summary that&apos;s checked against the facts
          before you see it — built from your real commit history.
        </p>

        <Button variant="primary" size="lg" className="w-full" href={githubLoginUrl()} icon={<GithubIcon className="w-4 h-4" />}>
          Connect GitHub account
        </Button>

        <Button variant="ghost" size="sm" className="w-full mt-3" to="/" icon={<ArrowRightIcon className="w-3.5 h-3.5 rotate-180" />}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
