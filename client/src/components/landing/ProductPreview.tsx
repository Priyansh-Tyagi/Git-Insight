import ScoreRing from '../ui/ScoreRing';
import Badge from '../ui/Badge';
import { CheckIcon, SparkIcon } from '../ui/icons';

// Illustrative sample data only — this card is a picture of the product, not a real analysis.
const SIGNALS: { label: string; points: string; passed: boolean }[] = [
  { label: 'README', points: '10/10', passed: true },
  { label: 'Tests', points: '15/15', passed: true },
  { label: 'CI pipeline', points: '10/10', passed: true },
  { label: 'License', points: '5/5', passed: true },
  { label: 'Docker', points: '0/5', passed: false },
  { label: 'Docs folder', points: '0/10', passed: false },
];

export default function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-2xl border border-hairline bg-surface shadow-pop text-left overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <ScoreRing score={82} size={56} />
          <div className="min-w-0">
            <p className="font-medium text-ink truncate">acme/api-gateway</p>
            <p className="text-xs text-ink-muted">Engineering score · 11 signals</p>
          </div>
        </div>
        <Badge tone="neutral">Sample data</Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-1.5 p-4">
        {SIGNALS.map((s) => (
          <div key={s.label} className="flex items-center justify-between rounded-lg bg-surface-raised/70 px-3 py-2 text-xs">
            <span className={`flex items-center gap-2 ${s.passed ? 'text-good' : 'text-ink-muted'}`}>
              {s.passed ? <CheckIcon className="w-3.5 h-3.5" /> : <span className="w-3.5 text-center">○</span>}
              {s.label}
            </span>
            <span className="font-mono text-ink-faint">{s.points}</span>
          </div>
        ))}
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-ai/25 bg-ai/[0.05] p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-ai mb-1.5">
          <SparkIcon className="w-3 h-3" /> AI summary — grounded in the computed score
        </p>
        <p className="text-sm text-ink leading-relaxed">
          Solid foundations: tests, CI and a clear README. Adding a Dockerfile and a docs folder would round out the
          project.
        </p>
      </div>
    </div>
  );
}
