import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { Skill, CategoryScore, Trend } from '../api/skills.api';

const TREND_STYLE: Record<Trend, { label: string; className: string }> = {
  growing: { label: '↑ growing', className: 'text-green-400' },
  stable: { label: '→ stable', className: 'text-zinc-400' },
  stale: { label: '↓ stale', className: 'text-yellow-500' },
};

interface SkillRadarProps {
  skills: Skill[];
  categories: CategoryScore[];
}

export default function SkillRadar({ skills, categories }: SkillRadarProps) {
  if (skills.length === 0) {
    return <p className="text-sm text-zinc-500">No skills inferred yet — analyze a few repos first.</p>;
  }

  const chartData = categories.map((c) => ({ category: c.category, score: c.averageScore }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis dataKey="category" tick={{ fill: '#4ade80', fontSize: 11, fontFamily: 'monospace' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 9 }} />
            <Radar dataKey="score" stroke="#4ade80" fill="#4ade80" fillOpacity={0.25} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2">
        {skills.map((s) => (
          <div key={s.skill} className="flex items-center justify-between text-xs border border-zinc-800 rounded px-2 py-1.5">
            <span className="text-zinc-300">{s.skill}</span>
            <div className="flex items-center gap-3">
              <span className={TREND_STYLE[s.trend].className}>{TREND_STYLE[s.trend].label}</span>
              <span className="text-zinc-600 w-10 text-right">{s.strengthScore}/100</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
