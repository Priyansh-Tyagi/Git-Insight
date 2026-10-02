import { pool } from '../config/db';
import { decrypt } from '../utils/crypto';
import { fetchProfileAndRepos } from './github.service';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export class RateLimitError extends Error {
  constructor(public resetAt: string) {
    super('GITHUB_RATE_LIMIT');
  }
}

/**
 * The single entry point both GET /api/profile and POST /api/profile/sync
 * call into. `force=false` respects the 6-hour TTL and returns cached data
 * if still fresh. `force=true` (manual sync button) always hits GitHub.
 */
export async function syncUserProfile(userId: string, force = false) {
  const userRes = await pool.query(
    `SELECT access_token_enc, last_synced_at, profile_json FROM users WHERE id = $1`,
    [userId]
  );
  if (userRes.rowCount === 0) throw new Error('USER_NOT_FOUND');

  const user = userRes.rows[0];
  const isStale =
    !user.last_synced_at || Date.now() - new Date(user.last_synced_at).getTime() > SIX_HOURS_MS;

  if (!force && !isStale) {
    // Return cached data, no GitHub call at all.
    const repos = await pool.query(`SELECT * FROM repositories WHERE user_id = $1`, [userId]);
    return {
      profile: user.profile_json,
      repos: repos.rows,
      cached: true,
      lastSyncedAt: user.last_synced_at,
    };
  }

  const accessToken = decrypt(user.access_token_enc);

  let result;
  try {
    result = await fetchProfileAndRepos(accessToken);
  } catch (err: any) {
    // If GitHub itself returns a rate-limit error, degrade to cached data
    // instead of throwing a raw 500 at the user.
    if (err?.errors?.[0]?.type === 'RATE_LIMITED') {
      const repos = await pool.query(`SELECT * FROM repositories WHERE user_id = $1`, [userId]);
      return {
        profile: user.profile_json,
        repos: repos.rows,
        cached: true,
        degraded: true,
        lastSyncedAt: user.last_synced_at,
      };
    }
    throw err;
  }

  // Proactive rate-limit guard: if we're close to the ceiling, log it —
  // future syncs for this user should back off, even though this one succeeded.
  if (result.rateLimit.remaining < 100) {
    console.warn(
      `[github-sync] user ${userId} is at ${result.rateLimit.remaining} remaining requests, resets ${result.rateLimit.resetAt}`
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE users SET profile_json = $1, last_synced_at = now() WHERE id = $2`,
      [JSON.stringify(result.profile), userId]
    );

    for (const repo of result.repos) {
      await client.query(
        `INSERT INTO repositories
           (user_id, github_repo_id, name, full_name, description, is_fork, stargazer_count, language_stats, raw_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, github_repo_id) DO UPDATE SET
           name = EXCLUDED.name,
           full_name = EXCLUDED.full_name,
           description = EXCLUDED.description,
           stargazer_count = EXCLUDED.stargazer_count,
           language_stats = EXCLUDED.language_stats,
           raw_metadata = EXCLUDED.raw_metadata`,
        [
          userId,
          repo.githubRepoId,
          repo.name,
          repo.fullName,
          repo.description,
          repo.isFork,
          repo.stargazerCount,
          JSON.stringify(repo.languages),
          JSON.stringify({ pushedAt: repo.pushedAt, size: repo.size, defaultBranch: repo.defaultBranch }),
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const repos = await pool.query(`SELECT * FROM repositories WHERE user_id = $1`, [userId]);
  return { profile: result.profile, repos: repos.rows, cached: false, lastSyncedAt: new Date() };
}
