import { api } from '../lib/axiosInstance';

export type Importance = 'required' | 'preferred';
export type Trend = 'growing' | 'stable' | 'stale';
export type RequirementStatus = 'matched' | 'weak' | 'gap' | 'unverifiable';
export type ClaimStatus = 'supported' | 'weak' | 'unsupported' | 'unverifiable';

export interface RepoRef {
  id: string;
  name: string;
  isFork: boolean;
  isClone: boolean;
}

export interface RequirementMatch {
  skill: string;
  category: string;
  importance: Importance;
  verifiable: boolean;
  status: RequirementStatus;
  strengthScore: number | null;
  trend: Trend | null;
  evidenceRepos: RepoRef[];
  relatedEvidence: { skill: string; strengthScore: number }[];
}

export interface ClaimCheck {
  skill: string;
  status: ClaimStatus;
  strengthScore: number | null;
  evidenceRepos: RepoRef[];
}

export interface JobMatchResult {
  matchPercent: number | null;
  counts: { requirements: number; verifiable: number; unverifiable: number; matched: number; weak: number; gap: number };
  requirements: RequirementMatch[];
  resumeClaims: { checks: ClaimCheck[]; counts: Record<ClaimStatus, number> } | null;
  nextSteps: string[];
  notes: string[];
}

export const MAX_TEXT_CHARS = 20_000;

export async function runJobMatch(jobDescription: string, resume: string): Promise<JobMatchResult> {
  const res = await api.post('/api/match', { jobDescription, ...(resume.trim() ? { resume } : {}) });
  return res.data.data;
}

/** Pulls the server's own validation message out of an axios error when there is one. */
export function matchErrorMessage(err: unknown): string {
  const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
  return msg ?? 'Could not run the match. Please try again.';
}
