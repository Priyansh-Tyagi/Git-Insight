import { api } from '../lib/axiosInstance';

export interface Profile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  followers: number;
  publicRepos: number;
}

export interface SignalResult {
  id: string;
  label: string;
  points: number;
  maxPoints: number;
  passed: boolean;
  detail: string;
}

export interface Repo {
  id: string;
  name: string;
  full_name: string;
  description: string | null;
  stargazer_count: number;
  language_stats: Record<string, number>;
  engineering_score: number | null;
  score_breakdown: SignalResult[] | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  last_analyzed_at: string | null;
  authenticity_flag: 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data' | null;
  authenticity_evidence: { id: string; label: string; triggered: boolean; detail: string }[] | null;
}

export async function fetchProfile(): Promise<{ profile: Profile; repoCount: number }> {
  const res = await api.get('/api/profile');
  return res.data.data;
}

export async function fetchRepos(): Promise<Repo[]> {
  const res = await api.get('/api/repos');
  return res.data.data;
}

export async function triggerSync(): Promise<void> {
  await api.post('/api/profile/sync');
}

export async function analyzeRepo(repoId: string): Promise<{
  totalScore: number;
  breakdown: SignalResult[];
  strengths: string[];
  weaknesses: string[];
  authenticityFlag: 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data';
  authenticityEvidence: { id: string; label: string; triggered: boolean; detail: string }[];
}> {
  const res = await api.post(`/api/repos/${repoId}/analyze`);
  return res.data.data;
}

export interface StructuredSummary {
  headline: string;
  signalNotes: { signalId: string; note: string }[];
  closing: string;
}

export async function generateSummary(repoId: string): Promise<{
  summary: string;
  structured: StructuredSummary;
  warnings: { signalId: string; sentence: string; contradicted: boolean }[];
}> {
  const res = await api.post(`/api/repos/${repoId}/summarize`);
  return res.data.data;
}
