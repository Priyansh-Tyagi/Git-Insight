import { LanguageShare } from '../lib/languageStats';

const COLORS = ['#D9A441', '#5BA3D0', '#3DD68C', '#C97FD6', '#E0A935', '#6B9BD1', '#8C8C94'];

interface LanguageBreakdownProps {
  languages: LanguageShare[];
}

export default function LanguageBreakdown({ languages }: LanguageBreakdownProps) {
  if (languages.length === 0) {
    return <p className="text-sm text-ink-muted">No language data yet — sync your profile to populate this.</p>;
  }

  const top = languages.slice(0, 6);

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-raised">
        {top.map((lang, i) => (
          <div
            key={lang.language}
            style={{ width: `${lang.percent}%`, backgroundColor: COLORS[i % COLORS.length] }}
            title={`${lang.language}: ${lang.percent}%`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {top.map((lang, i) => (
          <span key={lang.language} className="flex items-center gap-1.5 text-ink-muted">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {lang.language} <span className="font-mono text-ink-faint">{lang.percent}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
