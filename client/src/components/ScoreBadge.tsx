interface ScoreBadgeProps {
  score: number | null;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <div className="text-right">
        <span className="font-mono text-xl text-ink-faint">—</span>
        <p className="text-[10px] text-ink-faint">not analyzed</p>
      </div>
    );
  }

  const color = score >= 70 ? 'text-good' : score >= 40 ? 'text-warn' : 'text-bad';

  return (
    <div className="text-right leading-none">
      <span className={`font-mono text-xl font-semibold ${color}`}>{score}</span>
      <span className="font-mono text-xs text-ink-faint">/100</span>
      <p className="text-[10px] text-ink-faint mt-0.5">score</p>
    </div>
  );
}
