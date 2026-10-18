import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { CheckIcon } from '../ui/icons';
import CtaButton from './CtaButton';
import ProductPreview from './ProductPreview';

// Floating chips echo the rubric's real signals; position is a % of the orbit area.
const CHIPS: { label: string; passed: boolean; left: string; top: string; delay: string }[] = [
  { label: 'README', passed: true, left: '4%', top: '14%', delay: '0s' },
  { label: 'Tests', passed: true, left: '10%', top: '52%', delay: '1.2s' },
  { label: 'License', passed: true, left: '2%', top: '80%', delay: '2.4s' },
  { label: 'CI/CD', passed: true, left: '84%', top: '10%', delay: '0.6s' },
  { label: 'Docker', passed: false, left: '88%', top: '46%', delay: '1.8s' },
  { label: 'Docs', passed: false, left: '80%', top: '78%', delay: '3s' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24">
      <div className="absolute inset-0 bg-glow pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" aria-hidden="true" />

      {/* Orbit rings + floating signal chips */}
      <div className="absolute inset-x-0 top-0 h-[640px] pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-[260px] -translate-x-1/2 -translate-y-1/2">
          <div className="w-[520px] h-[520px] rounded-full border border-hairline/80 absolute -translate-x-1/2 -translate-y-1/2" />
          <div className="w-[860px] h-[860px] rounded-full border border-hairline/60 absolute -translate-x-1/2 -translate-y-1/2 animate-spin-slow">
            <span className="absolute -top-1.5 left-1/2 w-3 h-3 rounded-full bg-accent shadow-[0_0_16px_rgb(var(--c-accent)/0.7)]" />
          </div>
          <div className="w-[1200px] h-[1200px] rounded-full border border-hairline/40 absolute -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="relative mx-auto h-full max-w-6xl">
          {CHIPS.map((c) => (
            <div
              key={c.label}
              style={{ left: c.left, top: c.top, animationDelay: c.delay }}
              className="absolute hidden lg:flex items-center gap-1.5 rounded-full border border-hairline bg-surface shadow-card px-3 py-1.5 text-xs text-ink-muted animate-float"
            >
              {c.passed ? <CheckIcon className="w-3.5 h-3.5 text-good" /> : <span className="text-ink-faint">○</span>}
              {c.label}
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center animate-fade-up">
        <Badge tone="accent">Deterministic scoring · Fact-checked AI</Badge>
        <h1 className="mt-5 text-4xl sm:text-6xl font-semibold tracking-tight text-ink leading-[1.05]">
          Know what your repositories <span className="text-accent">actually</span> say about you
        </h1>
        <p className="mt-5 text-base sm:text-lg text-ink-muted leading-relaxed max-w-2xl mx-auto">
          GitInsight reads your real GitHub history and gives you a reproducible engineering score, an honest skill map,
          and AI summaries that are checked against the facts before you see them.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CtaButton />
          <Button size="lg" variant="secondary" href="#how-it-works">
            See how it works
          </Button>
        </div>
        <p className="mt-4 text-xs text-ink-faint">Free to use · Read-only analysis · Your token is encrypted at rest</p>
      </div>

      <div className="relative mt-14 px-6">
        <ProductPreview />
      </div>
    </section>
  );
}
