import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { AxiosError } from 'axios';
import { pool } from '../config/db';
import { encrypt } from '../utils/crypto';

vi.mock('../services/repoAnalysis/fetchManifests', () => ({
  fetchManifestContents: vi.fn(),
  fetchRepoFileList: vi.fn(),
}));

import { fetchManifestContents, fetchRepoFileList } from '../services/repoAnalysis/fetchManifests';
import { scanFrameworks, GithubFetchError } from '../services/frameworkScan.service';
import { RepoNotFoundError } from '../services/analyzer.service';

const mockedFiles = fetchRepoFileList as unknown as ReturnType<typeof vi.fn>;
const mockedManifests = fetchManifestContents as unknown as ReturnType<typeof vi.fn>;

describe('frameworkScan.service', () => {
  let userId: string;
  let repoId: string;
  const stored = async () => (await pool.query(`SELECT detected_frameworks FROM repositories WHERE id = $1`, [repoId])).rows[0].detected_frameworks;

  beforeEach(async () => {
    mockedFiles.mockReset();
    mockedManifests.mockReset();

    const userRes = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [777000555, 'scan-test-user', null, encrypt('fake-token')]
    );
    userId = userRes.rows[0].id;
    await pool.query(`DELETE FROM repositories WHERE user_id = $1`, [userId]);
    const repoRes = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, raw_metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, 515151, 'demo', 'scan-test-user/demo', JSON.stringify({ defaultBranch: 'main' })]
    );
    repoId = repoRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE github_id IN (777000555, 777000556)`);
  });

  it('reads the dependency files and stores the detected frameworks', async () => {
    mockedFiles.mockResolvedValue(['package.json', 'src/index.js']);
    mockedManifests.mockResolvedValue({
      contents: [{ path: 'package.json', content: JSON.stringify({ dependencies: { react: '^18', mongoose: '^8' } }) }],
      attempted: 1,
      failed: 0,
    });

    const result = await scanFrameworks(userId, repoId);
    expect(result.map((f) => f.skill)).toEqual(['MongoDB', 'React']);
    expect((await stored()).map((f: { skill: string }) => f.skill)).toEqual(['MongoDB', 'React']);
    expect(mockedFiles).toHaveBeenCalledWith(expect.any(String), 'scan-test-user', 'demo', 'main'); // token is decrypted, branch from metadata
  });

  it('refuses a repo that belongs to someone else', async () => {
    const other = await pool.query(
      `INSERT INTO users (github_id, username, access_token_enc) VALUES ($1, $2, $3)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username RETURNING id`,
      [777000556, 'scan-other', encrypt('t')]
    );
    await expect(scanFrameworks(other.rows[0].id, repoId)).rejects.toThrow(RepoNotFoundError);
  });

  it('treats an empty repository (GitHub 409) as "scanned, nothing found"', async () => {
    mockedFiles.mockRejectedValue(new AxiosError('Git Repository is empty', 'ERR_BAD_REQUEST', undefined, undefined, { status: 409 } as never));
    expect(await scanFrameworks(userId, repoId)).toEqual([]);
    expect(await stored()).toEqual([]);
  });

  it('reports a GitHub failure cleanly and leaves stored data untouched', async () => {
    mockedFiles.mockRejectedValue(new Error('network down'));
    await expect(scanFrameworks(userId, repoId)).rejects.toThrow(GithubFetchError);
    expect(await stored()).toBeNull();
  });

  it('does not store a false "none" when manifests exist but none could be read', async () => {
    mockedFiles.mockResolvedValue(['package.json']);
    mockedManifests.mockResolvedValue({ contents: [], attempted: 1, failed: 1 });
    await expect(scanFrameworks(userId, repoId)).rejects.toThrow(GithubFetchError);
    expect(await stored()).toBeNull();
  });
});
