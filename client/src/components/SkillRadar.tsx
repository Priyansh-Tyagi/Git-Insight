import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { Skill, CategoryScore, Trend } from '../api/skills.api';

const TREND_STYLE: Record<Trend, { label: string; className: string }> = {
  growing: { label: '↑ growing', className: 'text-good' },
  stable: { label: '→ stable', className: 'text-ink-muted' },
  stale: { label: '↓ stale', className: 'text-warn' },
};

interface SkillRadarProps {
  skills: Skill[];
  categories: CategoryScore[];
}

export default function SkillRadar({ skills, categories }: SkillRadarProps) {
  if (skills.length === 0) {
    return <p className="text-sm text-ink-muted">No skills inferred yet — analyze a few repos first.</p>;
  }

  const chartData = categories.map((c) => ({ category: c.category, score: c.averageScore }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="62%" margin={{ top: 16, right: 36, bottom: 16, left: 36 }}>
            <PolarGrid stroke="#27272B" />
            {/* fontSize kept small deliberately — category labels ("DevOps", "Backend")
                need to fit within the outerRadius+margin budget above without clipping,
                confirmed against the two longest labels in this product's taxonomy. */}
            <PolarAngleAxis dataKey="category" tick={{ fill: '#8C8C94', fontSize: 10, fontFamily: 'Inter' }} />
            {/* Tick NUMBERS intentionally hidden (tick={false}) — the shape plus the
                exact scores already listed alongside each skill made the floating
                0/50/100 labels redundant clutter rather than added information. */}
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="score" stroke="#D9A441" fill="#D9A441" fillOpacity={0.2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto pr-2">
        {skills.map((s) => (
          <div key={s.skill} className="flex items-center justify-between text-xs rounded-md px-2.5 py-2 hover:bg-surface-raised transition-colors">
            <span className="text-ink">{s.skill}</span>
            <div className="flex items-center gap-3">
              <span className={TREND_STYLE[s.trend].className}>{TREND_STYLE[s.trend].label}</span>
              <span className="font-mono text-ink-faint w-10 text-right">{s.strengthScore}/100</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
