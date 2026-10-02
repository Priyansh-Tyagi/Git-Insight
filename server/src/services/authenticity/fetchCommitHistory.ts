import axios from 'axios';
import { AuthenticitySignalInput } from './signals';

function parseLastPageNumber(linkHeader: string | undefined): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fetches enough commit history to evaluate commit shape + time clustering:
 *  - the newest commit's date (from page 1)
 *  - the oldest commit's date + how many files it touched (from the last page)
 *  - a best-effort total commit count, derived from GitHub's pagination Link header
 *
 * This intentionally does NOT walk every page of commit history for repos
 * with thousands of commits — that's unnecessary cost for a signal that only
 * needs the first and last data points, not the full timeline.
 */
export async function fetchCommitPatternInput(
  accessToken: string,
  owner: string,
  repo: string,
  defaultBranch: string,
  totalFileCount: number,
  files: string[]
): Promise<AuthenticitySignalInput> {
  const headers = { Authorization: `token ${accessToken}` };
  const perPage = 100;

  const firstPageRes = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/commits?sha=${defaultBranch}&per_page=${perPage}`,
    { headers }
  );

  const firstPageCommits: any[] = firstPageRes.data;
  if (firstPageCommits.length === 0) {
    return {
      files,
      totalFileCount,
      firstCommitFileCount: 0,
      totalCommitCount: 0,
      firstCommitDate: new Date().toISOString(),
      lastCommitDate: new Date().toISOString(),
    };
  }

  const lastCommitDate = firstPageCommits[0].commit.author.date; // newest, since GitHub returns newest-first

  const lastPageNumber = parseLastPageNumber(firstPageRes.headers.link);

  let oldestPageCommits = firstPageCommits;
  let totalCommitCount = firstPageCommits.length;

  if (lastPageNumber && lastPageNumber > 1) {
    const lastPageRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits?sha=${defaultBranch}&per_page=${perPage}&page=${lastPageNumber}`,
      { headers }
    );
    oldestPageCommits = lastPageRes.data;
    totalCommitCount = (lastPageNumber - 1) * perPage + oldestPageCommits.length;
  }

  const oldestCommit = oldestPageCommits[oldestPageCommits.length - 1];
  const firstCommitDate = oldestCommit.commit.author.date;

  const oldestCommitDetailRes = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/commits/${oldestCommit.sha}`,
    { headers }
  );
  const firstCommitFileCount: number = oldestCommitDetailRes.data.files?.length ?? 0;

  return {
    files,
    totalFileCount,
    firstCommitFileCount,
    totalCommitCount,
    firstCommitDate,
    lastCommitDate,
  };
}
