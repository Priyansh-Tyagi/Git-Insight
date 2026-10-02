import axios from 'axios';
import { RepoSignalInput } from './signals';

/**
 * Pulls exactly what the rubric needs and nothing more:
 *  - full recursive file tree (paths only, for pattern matching)
 *  - README content length (separate call — the tree doesn't include content)
 *  - weekly commit counts for the last year (GitHub's own bucketed stats endpoint)
 *  - repo size (already known from the Phase 2 sync, passed in rather than re-fetched)
 */
export async function fetchRepoSignalInput(
  accessToken: string | undefined,
  owner: string,
  repo: string,
  defaultBranch: string,
  sizeKb: number
): Promise<RepoSignalInput> {
  const headers = accessToken ? { Authorization: `token ${accessToken}` } : {};

  const [treeRes, readmeRes, statsRes] = await Promise.all([
    axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers }
    ),
    axios
      .get(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers })
      .catch(() => null), // 404 if no README — that's a valid, scoreable state, not an error
    axios
      .get(`https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`, { headers })
      .catch(() => ({ data: [] as Array<{ total: number }> })), // GitHub sometimes returns 202 while computing stats — treat as empty rather than fail the whole analysis
  ]);

  const files: string[] = treeRes.data.tree
    .filter((node: any) => node.type === 'blob')
    .map((node: any) => node.path);

  const readmeLength = readmeRes ? Buffer.from(readmeRes.data.content, 'base64').toString('utf8').length : 0;

  const weeklyCommitCounts = Array.isArray(statsRes.data)
    ? statsRes.data.map((week: any) => week.total)
    : [];

  return { files, readmeLength, sizeKb, weeklyCommitCounts };
}
