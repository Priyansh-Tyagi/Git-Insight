interface ScoreRingProps {
  /** 0-100, or null when not analyzed yet. */
  score: number | null;
  size?: number;
  strokeWidth?: number;
  /** Render the number in the middle. Off when the caller shows the number itself. */
  showValue?: boolean;
  className?: string;
}

export function scoreTone(score: number): 'good' | 'warn' | 'bad' {
  return score >= 70 ? 'good' : score >= 40 ? 'warn' : 'bad';
}

/** Circular progress for a 0-100 engineering score. Colour thresholds match ScoreBadge. */
export default function ScoreRing({ score, size = 56, strokeWidth = 5, showValue = true, className = '' }: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = score === null ? 0 : Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const tone = score === null ? null : scoreTone(clamped);

  return (
    <div
      className={`relative inline-grid place-items-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? 'Not analyzed' : `Score ${clamped} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-hairline" />
        {tone && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`transition-[stroke-dashoffset] duration-700 ${tone === 'good' ? 'stroke-good' : tone === 'warn' ? 'stroke-warn' : 'stroke-bad'}`}
          />
        )}
      </svg>
      {showValue && (
        <span className="absolute font-mono font-semibold text-ink" style={{ fontSize: size * 0.3 }}>
          {score === null ? '—' : clamped}
        </span>
      )}
    </div>
  );
}
