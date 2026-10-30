import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { pool } from '../config/db';
import { encrypt } from '../utils/crypto';

vi.mock('../services/repoAnalysis/fetchRepoTree', () => ({
  fetchRepoSignalInput: vi.fn(),
}));

vi.mock('../services/authenticity/fetchCommitHistory', () => ({
  fetchCommitPatternInput: vi.fn(),
}));

vi.mock('../services/repoAnalysis/fetchManifests', () => ({
  fetchManifestContents: vi.fn(),
  fetchRepoFileList: vi.fn(),
}));

import { fetchRepoSignalInput } from '../services/repoAnalysis/fetchRepoTree';
import { fetchCommitPatternInput } from '../services/authenticity/fetchCommitHistory';
import { fetchManifestContents } from '../services/repoAnalysis/fetchManifests';
import { analyzeRepo, RepoNotFoundError } from '../services/analyzer.service';

const mockedFetch = fetchRepoSignalInput as unknown as ReturnType<typeof vi.fn>;
const mockedCommitFetch = fetchCommitPatternInput as unknown as ReturnType<typeof vi.fn>;
const mockedManifests = fetchManifestContents as unknown as ReturnType<typeof vi.fn>;

describe('analyzer.service', () => {
  let userId: string;
  let repoId: string;

  beforeEach(async () => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({
      files: ['README.md', 'LICENSE', 'src/index.ts', 'src/index.test.ts', '.github/workflows/ci.yml'],
      readmeLength: 500,
      sizeKb: 300,
      weeklyCommitCounts: new Array(52).fill(1),
    });

    mockedManifests.mockReset();
    mockedManifests.mockResolvedValue({ contents: [], attempted: 0, failed: 0 });

    mockedCommitFetch.mockReset();
    mockedCommitFetch.mockResolvedValue({
      files: ['README.md', 'LICENSE', 'src/index.ts', 'src/index.test.ts', '.github/workflows/ci.yml'],
      totalFileCount: 5,
      firstCommitFileCount: 1,
      totalCommitCount: 40,
      firstCommitDate: '2025-01-01T10:00:00Z',
      lastCommitDate: '2025-06-01T10:00:00Z',
    });

    const userRes = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [777000333, 'analyzer-test-user', null, encrypt('fake-token')]
    );
    userId = userRes.rows[0].id;

    await pool.query(`DELETE FROM repositories WHERE user_id = $1`, [userId]);
    const repoRes = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, raw_metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, 424242, 'demo-repo', 'analyzer-test-user/demo-repo', JSON.stringify({ defaultBranch: 'main', size: 300 })]
    );
    repoId = repoRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE github_id = 777000333`);
  });

  it('computes and persists a score for a valid repo', async () => {
    const result = await analyzeRepo(userId, repoId);
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.breakdown).toHaveLength(11);

    const row = await pool.query(`SELECT * FROM repositories WHERE id = $1`, [repoId]);
    expect(row.rows[0].engineering_score).toBe(result.totalScore);
    expect(row.rows[0].last_analyzed_at).not.toBeNull();
  });

  it('computes and persists an authenticity flag alongside the score', async () => {
    const result = await analyzeRepo(userId, repoId);
    expect(result.authenticityFlag).toBe('likely_original'); // the mocked commit data is organic
    expect(result.authenticityEvidence).toHaveLength(3);

    const row = await pool.query(`SELECT * FROM repositories WHERE id = $1`, [repoId]);
    expect(row.rows[0].authenticity_flag).toBe('likely_original');
    expect(row.rows[0].authenticity_evidence).toHaveLength(3);
    expect(row.rows[0].commit_pattern_json).not.toBeNull();
  });

  it('flags a clone-like commit pattern correctly through the full pipeline', async () => {
    mockedCommitFetch.mockResolvedValue({
      files: ['public/index.html', 'src/App.js', 'src/index.js', 'src/logo.svg', 'src/App.css'],
      totalFileCount: 5,
      firstCommitFileCount: 5,
      totalCommitCount: 2,
      firstCommitDate: '2025-01-01T10:00:00Z',
      lastCommitDate: '2025-01-01T18:00:00Z',
    });

    const result = await analyzeRepo(userId, repoId);
    expect(result.authenticityFlag).toBe('possible_tutorial_clone');
  });

  it('throws RepoNotFoundError for a repo belonging to a different user', async () => {
    const otherUserRes = await pool.query(
      `INSERT INTO users (github_id, username, access_token_enc)
       VALUES ($1, $2, $3) RETURNING id`,
      [777000444, 'other-user', encrypt('fake-token-2')]
    );
    const otherUserId = otherUserRes.rows[0].id;

    await expect(analyzeRepo(otherUserId, repoId)).rejects.toThrow(RepoNotFoundError);

    await pool.query(`DELETE FROM users WHERE id = $1`, [otherUserId]);
  });

  it('re-analyzing overwrites the previous score rather than duplicating rows', async () => {
    await analyzeRepo(userId, repoId);

    mockedFetch.mockResolvedValue({
      files: [], // now a bare repo — score should drop
      readmeLength: 0,
      sizeKb: 5,
      weeklyCommitCounts: [],
    });

    const second = await analyzeRepo(userId, repoId);
    expect(second.totalScore).toBeLessThan(20);

    const rows = await pool.query(`SELECT * FROM repositories WHERE id = $1`, [repoId]);
    expect(rows.rows).toHaveLength(1); // still one row, just updated
    expect(rows.rows[0].engineering_score).toBe(second.totalScore);
  });
  describe('framework detection', () => {
    const withManifests = (files: string[]) =>
      mockedFetch.mockResolvedValue({ files, readmeLength: 500, sizeKb: 300, weeklyCommitCounts: new Array(52).fill(1) });
    const manifest = (path: string, deps: Record<string, string>) => ({ path, content: JSON.stringify({ dependencies: deps }) });
    const stored = async () => (await pool.query(`SELECT detected_frameworks FROM repositories WHERE id = $1`, [repoId])).rows[0].detected_frameworks;

    it('detects frameworks from dependency files and persists them', async () => {
      withManifests(['README.md', 'client/package.json', 'server/package.json']);
      mockedManifests.mockResolvedValue({
        contents: [manifest('client/package.json', { react: '^18' }), manifest('server/package.json', { express: '^4', mongoose: '^8' })],
        attempted: 2,
        failed: 0,
      });

      const result = await analyzeRepo(userId, repoId);
      expect(result.detectedFrameworks!.map((f) => f.skill)).toEqual(['Express', 'MongoDB', 'Node.js', 'React']);
      expect((await stored()).map((f: { skill: string }) => f.skill)).toEqual(['Express', 'MongoDB', 'Node.js', 'React']);
    });

    it('stores an empty array (scanned, nothing recognised) rather than NULL', async () => {
      withManifests(['package.json']);
      mockedManifests.mockResolvedValue({ contents: [manifest('package.json', { lodash: '4' })], attempted: 1, failed: 0 });

      await analyzeRepo(userId, repoId);
      expect(await stored()).toEqual([]);
    });

    it('keeps a previous good detection when a later manifest fetch fails', async () => {
      withManifests(['package.json']);
      mockedManifests.mockResolvedValue({ contents: [manifest('package.json', { react: '^18' })], attempted: 1, failed: 0 });
      await analyzeRepo(userId, repoId);

      mockedManifests.mockResolvedValue({ contents: [], attempted: 1, failed: 1 }); // GitHub hiccup
      const second = await analyzeRepo(userId, repoId);

      expect(second.detectedFrameworks).toBeNull();
      expect((await stored()).map((f: { skill: string }) => f.skill)).toEqual(['React']); // not overwritten with "unknown"
    });

    it('never fails the analysis if framework detection throws', async () => {
      withManifests(['package.json']);
      mockedManifests.mockRejectedValue(new Error('boom'));

      const result = await analyzeRepo(userId, repoId);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(await stored()).toBeNull(); // never scanned -> still unknown
    });
  });
});
