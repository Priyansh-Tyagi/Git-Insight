import { configuredLinks } from '../../config/siteLinks';
import Logo from '../ui/Logo';
import ThemeToggle from '../ui/ThemeToggle';
import CtaButton from './CtaButton';

const ANCHORS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#research', label: 'Research' },
];

export default function LandingNav() {
  const github = configuredLinks().find((l) => l.label === 'GitHub');

  return (
    <header className="sticky top-3 z-30 px-4">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface/80 backdrop-blur-md shadow-card px-4 h-14">
        <Logo />

        <nav className="hidden md:flex items-center gap-1" aria-label="Page sections">
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href} className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors">
              {a.label}
            </a>
          ))}
          {github && (
            <a href={github.href} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors">
              GitHub
            </a>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <CtaButton size="md" className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  );
}
