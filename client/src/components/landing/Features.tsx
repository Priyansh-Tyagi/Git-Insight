import { ReactNode } from 'react';
import { CompassIcon, FingerprintIcon, GaugeIcon, LockIcon, SparkIcon, TrendIcon } from '../ui/icons';

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <GaugeIcon className="w-5 h-5" />,
    title: 'Engineering score',
    body: 'A 100-point rubric over 11 signals — README, tests, CI, license, Docker, docs, structure, activity and more. Same repo, same score, every time.',
  },
  {
    icon: <TrendIcon className="w-5 h-5" />,
    title: 'Skill inference',
    body: 'Languages and tooling become a skill radar, with growing, stable or stale trends taken from how recently you actually shipped.',
  },
  {
    icon: <FingerprintIcon className="w-5 h-5" />,
    title: 'Authenticity check',
    body: 'Flags repos that look like tutorial clones from commit shape, time clustering and structural fingerprints — never from a single signal alone.',
  },
  {
    icon: <SparkIcon className="w-5 h-5" />,
    title: 'Grounded AI summaries',
    body: 'Narratives are generated from the computed facts in a fixed schema and checked field by field, so a contradiction can’t slip through unnoticed.',
  },
  {
    icon: <CompassIcon className="w-5 h-5" />,
    title: 'Cold-start aware',
    body: 'New profile? GitInsight tells you how much evidence it really has and what to build next, instead of guessing from a handful of forks.',
  },
  {
    icon: <LockIcon className="w-5 h-5" />,
    title: 'Private by design',
    body: 'Your GitHub token is encrypted at rest and never sent to your browser. Analysis is read-only.',
  },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Features</p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-ink">Evidence first, opinion second</h2>
        <p className="mt-3 text-ink-muted">Every number on your dashboard is computed. Anything written by an AI is labelled and verified.</p>
      </div>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <article key={f.title} className="group rounded-xl border border-hairline bg-surface shadow-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-on-accent transition-colors">
              {f.icon}
            </span>
            <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
            <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
