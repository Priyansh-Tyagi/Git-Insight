import { api } from '../lib/axiosInstance';

export type Importance = 'required' | 'preferred';
export type Trend = 'growing' | 'stable' | 'stale';
export type RequirementStatus = 'matched' | 'weak' | 'gap' | 'unverifiable';
export type ClaimStatus = 'supported' | 'weak' | 'unsupported' | 'unverifiable';
export type VerificationMethod = 'languages' | 'dependencies';

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
  /** Can be checked from dependency files once repositories are scanned. */
  frameworkVerifiable: boolean;
  /** Checkable from dependency files, but nothing has been scanned yet. */
  needsScan: boolean;
  method: VerificationMethod | null;
  status: RequirementStatus;
  strengthScore: number | null;
  trend: Trend | null;
  evidenceRepos: RepoRef[];
  /** For dependency evidence, e.g. "my-app/server/package.json: express". */
  via: string[];
  relatedEvidence: { skill: string; strengthScore: number }[];
  /** 'implied' = inferred from the work described, never scored or checked. */
  origin: 'explicit' | 'implied';
  cues: string[];
}

export interface ClaimCheck {
  skill: string;
  status: ClaimStatus;
  method: VerificationMethod | null;
  strengthScore: number | null;
  evidenceRepos: RepoRef[];
}

export interface ComparisonRow {
  skill: string;
  inJob: boolean;
  inResume: boolean;
  github: ClaimStatus;
}

export interface JobMatchResult {
  matchPercent: number | null;
  counts: {
    requirements: number;
    verifiable: number;
    unverifiable: number;
    matched: number;
    weak: number;
    gap: number;
    dependencyChecked: number;
    needsScan: number;
  };
  coverage: { scannedRepos: number; totalRepos: number };
  requirements: RequirementMatch[];
  resumeClaims: { checks: ClaimCheck[]; counts: Record<ClaimStatus, number> } | null;
  /** Job x resume x GitHub; null when no resume was supplied. */
  comparison: ComparisonRow[] | null;
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
