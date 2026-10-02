import { LanguageShare } from '../lib/languageStats';

const COLORS = ['#4ade80', '#22d3ee', '#facc15', '#f472b6', '#a78bfa', '#fb923c', '#94a3b8'];

interface LanguageBreakdownProps {
  languages: LanguageShare[];
}

export default function LanguageBreakdown({ languages }: LanguageBreakdownProps) {
  if (languages.length === 0) {
    return <p className="text-sm text-zinc-500">No language data yet — sync your profile to populate this.</p>;
  }

  const top = languages.slice(0, 6);

  return (
    <div>
      <div className="flex h-3 rounded overflow-hidden border border-zinc-800">
        {top.map((lang, i) => (
          <div key={lang.language} style={{ width: `${lang.percent}%`, backgroundColor: COLORS[i % COLORS.length] }} title={`${lang.language}: ${lang.percent}%`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {top.map((lang, i) => (
          <span key={lang.language} className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {lang.language} <span className="text-zinc-600">{lang.percent}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
