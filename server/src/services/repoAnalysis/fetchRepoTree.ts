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
  sizeKb: number,
  statsRetryDelayMs = 2000
): Promise<RepoSignalInput> {
  const headers: Record<string, string> = accessToken ? { Authorization: `token ${accessToken}` } : {};

  const [treeRes, readmeRes, statsRes] = await Promise.all([
    axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers }
    ),
    axios
      .get(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers })
      .catch(() => null), // 404 if no README — that's a valid, scoreable state, not an error
    fetchCommitActivity(owner, repo, headers, statsRetryDelayMs),
  ]);

  const files: string[] = treeRes.data.tree
    .filter((node: any) => node.type === 'blob')
    .map((node: any) => node.path);

  const readmeLength = readmeRes ? Buffer.from(readmeRes.data.content, 'base64').toString('utf8').length : 0;

  const weeklyCommitCounts: number[] = statsRes;

  return { files, readmeLength, sizeKb, weeklyCommitCounts };
}

/**
 * GitHub's stats endpoints answer 202 (empty body) while they compute the
 * stats in the background, typically for repos nobody has requested stats for
 * recently. axios treats 202 as success, so without handling it the activity
 * signal silently scored 0 on cold-cache repos and the rubric was
 * non-deterministic across runs. Retry with backoff; if still not ready, warn
 * loudly and return [] (same fallback as before, but no longer silent).
 */
export async function fetchCommitActivity(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  retryDelayMs = 2000,
  maxAttempts = 5
): Promise<number[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await axios.get(url, { headers });
    } catch {
      return []; // real error (403/404/...) — same behaviour as before
    }
    if (res.status === 200 && Array.isArray(res.data)) {
      return res.data.map((week: any) => week.total);
    }
    if (res.status !== 202) return [];
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
  }
  console.warn(`[fetchRepoSignalInput] commit stats for ${owner}/${repo} still not ready after retries (HTTP 202) - activity signal will score 0 for this run`);
  return [];
}
