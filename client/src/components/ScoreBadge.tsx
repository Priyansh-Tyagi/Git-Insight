import ScoreRing, { scoreTone } from './ui/ScoreRing';

interface ScoreBadgeProps {
  score: number | null;
}

const TONE_TEXT = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' } as const;

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <div className="flex items-center gap-3">
        <ScoreRing score={null} size={40} strokeWidth={4} showValue={false} />
        <div className="text-right">
          <span className="font-mono text-xl text-ink-faint">—</span>
          <p className="text-[10px] text-ink-faint">not analyzed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <ScoreRing score={score} size={40} strokeWidth={4} showValue={false} />
      <div className="text-right leading-none">
        <span className={`font-mono text-xl font-semibold ${TONE_TEXT[scoreTone(score)]}`}>{score}</span>
        <span className="font-mono text-xs text-ink-faint">/100</span>
        <p className="text-[10px] text-ink-faint mt-0.5">score</p>
      </div>
    </div>
  );
}
