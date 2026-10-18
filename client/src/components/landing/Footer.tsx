import { configuredLinks } from '../../config/siteLinks';
import Logo from '../ui/Logo';

export default function Footer() {
  const links = configuredLinks();

  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-6 py-12 grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-muted leading-relaxed">
            Reproducible repository scoring and fact-checked AI summaries, built from your real GitHub history.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-ink-faint mb-3">Product</p>
          <ul className="space-y-2 text-sm">
            {[
              ['#features', 'Features'],
              ['#how-it-works', 'How it works'],
              ['#research', 'Research'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-ink-muted hover:text-ink transition-colors">{label}</a>
              </li>
            ))}
          </ul>
        </div>

        {links.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-faint mb-3">Links</p>
            <ul className="space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-ink-muted hover:text-ink transition-colors"
                    {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-hairline">
        <p className="mx-auto max-w-6xl px-6 py-5 text-xs text-ink-faint">
          © {new Date().getFullYear()} GitInsight AI · Not affiliated with GitHub, Inc.
        </p>
      </div>
    </footer>
  );
}
