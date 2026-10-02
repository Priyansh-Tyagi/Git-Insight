interface ScoreBadgeProps {
  score: number | null;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null) {
    return <span className="text-xs px-2 py-1 border border-zinc-700 text-zinc-500 rounded">not analyzed</span>;
  }

  const color = score >= 70 ? 'border-green-500 text-green-400' : score >= 40 ? 'border-yellow-500 text-yellow-400' : 'border-red-500 text-red-400';

  return <span className={`text-xs px-2 py-1 border rounded font-bold ${color}`}>{score}/100</span>;
}
