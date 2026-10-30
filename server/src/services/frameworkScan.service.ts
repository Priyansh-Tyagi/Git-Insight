import axios from 'axios';
import { pool } from '../config/db';
import { decrypt } from '../utils/crypto';
import { RepoNotFoundError } from './analyzer.service';
import { detectForRepo } from './repoAnalysis/detectForRepo';
import { fetchRepoFileList } from './repoAnalysis/fetchManifests';
import { FrameworkEvidence } from './repoAnalysis/detectFrameworks';

export class GithubFetchError extends Error {
  status = 502;
  code = 'GITHUB_FETCH_FAILED';
  constructor() {
    super('Could not read this repository from GitHub right now');
  }
}

/**
 * Lightweight alternative to a full analysis: lists the repo's files, reads its dependency manifests, and stores
 * the detected frameworks. It does NOT re-score the repo or re-run authenticity checks (far fewer GitHub calls).
 */
export async function scanFrameworks(userId: string, repoId: string): Promise<FrameworkEvidence[]> {
  const res = await pool.query(
    `SELECT r.full_name, r.raw_metadata, u.access_token_enc
     FROM repositories r JOIN users u ON u.id = r.user_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [repoId, userId]
  );
  if (res.rowCount === 0) throw new RepoNotFoundError();

  const repo = res.rows[0];
  const accessToken = decrypt(repo.access_token_enc);
  const [owner, name] = repo.full_name.split('/');
  const branch = repo.raw_metadata?.defaultBranch ?? 'main';

  let frameworks: FrameworkEvidence[] | null;
  try {
    let files: string[];
    try {
      files = await fetchRepoFileList(accessToken, owner, name, branch);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) files = []; // GitHub answers 409 for an empty repository
      else throw err;
    }
    frameworks = await detectForRepo(accessToken, owner, name, files);
  } catch {
    throw new GithubFetchError();
  }

  if (frameworks === null) throw new GithubFetchError(); // manifests existed but none were readable — don't store a false "none"

  await pool.query(`UPDATE repositories SET detected_frameworks = $1 WHERE id = $2`, [JSON.stringify(frameworks), repoId]);
  return frameworks;
}
