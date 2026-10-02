import { api } from '../lib/axiosInstance';

export type Trend = 'growing' | 'stable' | 'stale';

export interface Skill {
  skill: string;
  category: string;
  strengthScore: number;
  trend: Trend;
  repoCount: number;
  evidenceRepoIds: string[];
}

export interface CategoryScore {
  category: string;
  averageScore: number;
  skillCount: number;
}

export async function fetchSkills(): Promise<{ skills: Skill[]; categories: CategoryScore[] }> {
  const res = await api.get('/api/skills');
  return res.data.data;
}
