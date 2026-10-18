import { linkFor } from '../../config/siteLinks';
import Button from '../ui/Button';
import { FlaskIcon } from '../ui/icons';

const STATS = [
  { value: '11', label: 'rubric signals' },
  { value: '100', label: 'point deterministic score' },
  { value: '0', label: 'status contradictions in structured mode (21 repos)' },
];

export default function Research() {
  const paper = linkFor('paper');

  return (
    <section id="research" className="mx-auto max-w-6xl px-6 py-20">
      <div className="rounded-2xl border border-hairline bg-surface shadow-card p-8 sm:p-10 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-ai/10 text-ai">
            <FlaskIcon className="w-5 h-5" />
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Built to be checked</h2>
          <p className="mt-3 text-ink-muted leading-relaxed">
            GitInsight started as research into LLM hallucination. Free-text summaries needed manual auditing, because
            checking prose with rules is unreliable. Summaries constrained to a fixed schema can be verified by direct
            comparison with the computed result.
          </p>
          <p className="mt-3 text-xs text-ink-faint">Small evaluation (21 repositories, two runs) — see the write-up for method and limits.</p>
          {paper && (
            <Button className="mt-5" variant="secondary" href={paper.href}>
              Read the paper
            </Button>
          )}
        </div>

        <div className="grid gap-3">
          {STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-4 rounded-xl border border-hairline bg-canvas px-5 py-4">
              <span className="font-mono text-3xl font-semibold text-accent w-16">{s.value}</span>
              <span className="text-sm text-ink-muted">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
