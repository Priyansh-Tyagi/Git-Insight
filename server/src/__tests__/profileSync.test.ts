import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { pool } from '../config/db';
import { encrypt } from '../utils/crypto';

// Mock the GitHub GraphQL call so tests never touch the real network or need
// a real access token — we're testing OUR caching/upsert logic, not GitHub's API.
vi.mock('../services/github.service', () => ({
  fetchProfileAndRepos: vi.fn(),
}));

import { fetchProfileAndRepos } from '../services/github.service';
import { syncUserProfile } from '../services/profileSync.service';

const mockedFetch = fetchProfileAndRepos as unknown as ReturnType<typeof vi.fn>;

const FAKE_SYNC_RESULT = {
  profile: {
    login: 'test-sync-user',
    name: 'Test User',
    avatarUrl: 'https://example.com/a.png',
    bio: 'testing',
    followers: 5,
    publicRepos: 1,
  },
  repos: [
    {
      githubRepoId: '555000111',
      name: 'demo-repo',
      fullName: 'test-sync-user/demo-repo',
      description: 'a repo for testing',
      isFork: false,
      stargazerCount: 3,
      languages: { TypeScript: 40000, CSS: 5000 },
      pushedAt: new Date().toISOString(),
      size: 1200,
      defaultBranch: 'main',
    },
  ],
  rateLimit: { remaining: 4999, resetAt: new Date(Date.now() + 3600_000).toISOString() },
};

describe('profileSync.service — TTL caching behavior', () => {
  let userId: string;

  beforeEach(async () => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue(FAKE_SYNC_RESULT);

    // fresh user each test, with last_synced_at = null (never synced)
    const result = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET last_synced_at = NULL, profile_json = NULL
       RETURNING id`,
      [888000222, 'sync-test-user', null, encrypt('fake-token')]
    );
    userId = result.rows[0].id;
    await pool.query(`DELETE FROM repositories WHERE user_id = $1`, [userId]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE github_id = 888000222`);
  });

  it('force-fetches from GitHub on first sync (never synced before)', async () => {
    const result = await syncUserProfile(userId, false);
    expect(result.cached).toBe(false);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(result.repos).toHaveLength(1);
  });

  it('writes repo rows into Postgres correctly, matching the mocked data', async () => {
    await syncUserProfile(userId, false);
    const repoRow = await pool.query(`SELECT * FROM repositories WHERE user_id = $1`, [userId]);
    expect(repoRow.rows).toHaveLength(1);
    expect(repoRow.rows[0].name).toBe('demo-repo');
    expect(repoRow.rows[0].stargazer_count).toBe(3);
    expect(repoRow.rows[0].language_stats).toEqual({ TypeScript: 40000, CSS: 5000 });
  });

  it('serves from cache on a second call within the TTL — no second GitHub call', async () => {
    await syncUserProfile(userId, false); // first call, syncs
    mockedFetch.mockClear();

    const second = await syncUserProfile(userId, false);
    expect(second.cached).toBe(true);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('force=true always bypasses the cache, even immediately after a fresh sync', async () => {
    await syncUserProfile(userId, false);
    mockedFetch.mockClear();

    const forced = await syncUserProfile(userId, true);
    expect(forced.cached).toBe(false);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('upserts on repeated syncs instead of creating duplicate repo rows', async () => {
    await syncUserProfile(userId, false);
    await syncUserProfile(userId, true); // same repo, force-synced again

    const rows = await pool.query(
      `SELECT * FROM repositories WHERE user_id = $1 AND github_repo_id = 555000111`,
      [userId]
    );
    expect(rows.rows).toHaveLength(1); // not 2
  });

  it('degrades to cached data instead of throwing when GitHub reports a rate limit', async () => {
    // first, a real successful sync so there IS cached data to fall back to
    await syncUserProfile(userId, false);
    mockedFetch.mockClear();

    mockedFetch.mockRejectedValueOnce({ errors: [{ type: 'RATE_LIMITED' }] });

    const result = await syncUserProfile(userId, true); // force=true, but GitHub says no
    expect(result.cached).toBe(true);
    expect((result as any).degraded).toBe(true);
    expect(result.repos).toHaveLength(1); // still returns the previously cached repo
  });

  it('propagates a genuinely unexpected error instead of silently swallowing it', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('totally unexpected failure'));
    await expect(syncUserProfile(userId, true)).rejects.toThrow('totally unexpected failure');
  });
});
