import { api } from '../lib/axiosInstance';

export type ProfileDepth = 'insufficient' | 'thin' | 'sufficient';

export interface ColdStartAssessment {
  coldStart: boolean;
  depth: ProfileDepth;
  evidenceRepoCount: number;
  minEvidenceRepos: number;
  totals: { repos: number; forks: number; unanalyzed: number; possibleClones: number };
  reasons: string[];
  nextSteps: string[];
}

export async function fetchColdStart(): Promise<ColdStartAssessment> {
  const res = await api.get('/api/cold-start');
  return res.data.data;
}
