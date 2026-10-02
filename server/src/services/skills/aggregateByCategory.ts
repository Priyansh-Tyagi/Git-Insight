import { SkillResult } from './inferSkills';

export interface CategoryScore {
  category: string;
  averageScore: number;
  skillCount: number;
}

export function aggregateByCategory(skills: SkillResult[]): CategoryScore[] {
  const byCategory = new Map<string, number[]>();

  for (const skill of skills) {
    if (!byCategory.has(skill.category)) byCategory.set(skill.category, []);
    byCategory.get(skill.category)!.push(skill.strengthScore);
  }

  return Array.from(byCategory.entries())
    .map(([category, scores]) => ({
      category,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      skillCount: scores.length,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}
