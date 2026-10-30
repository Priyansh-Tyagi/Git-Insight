import { api } from '../lib/axiosInstance';
import { DetectedFramework } from './profile.api';

/** Reads one repository's dependency files and stores the detected frameworks (no re-scoring, far fewer GitHub calls). */
export async function scanRepoFrameworks(repoId: string): Promise<DetectedFramework[]> {
  const res = await api.post(`/api/repos/${repoId}/frameworks`);
  return res.data.data.frameworks;
}

export function scanErrorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}
