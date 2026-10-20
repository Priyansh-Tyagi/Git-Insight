import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { pool } from '../config/db';
import { encrypt } from '../utils/crypto';
import { getJobMatch } from '../services/jobMatch.service';

describe('jobMatch.service', () => {
  let userId: string;

  beforeEach(async () => {
    const userRes = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [666000888, 'jobmatch-test-user', null, encrypt('fake-token')]
    );
    userId = userRes.rows[0].id;
    await pool.query(`DELETE FROM repositories WHERE user_id = $1`, [userId]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE github_id = 666000888`);
  });

  it('matches against real repo rows and respects fork status', async () => {
    const recent = new Date().toISOString();
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, is_fork, language_stats, raw_metadata)
       VALUES
        ($1, 11, 'py-original', 'u/py-original', false, $2, $4),
        ($1, 12, 'rust-fork',   'u/rust-fork',   true,  $3, $4)`,
      [userId, JSON.stringify({ Python: 9000 }), JSON.stringify({ Rust: 9000 }), JSON.stringify({ pushedAt: recent })]
    );

    const result = await getJobMatch(userId, 'Requirements\n- Python\n- Rust\n- Go language\n- React', null);
    const by = Object.fromEntries(result.requirements.map((r) => [r.skill, r.status]));
    expect(by).toEqual({ Python: 'matched', Rust: 'weak', Go: 'gap', React: 'unverifiable' });
    expect(result.counts.verifiable).toBe(3);
    expect(result.matchPercent).not.toBeNull();
    expect(result.resumeClaims).toBeNull();
  });

  it('returns a result for a user with no repos at all', async () => {
    const result = await getJobMatch(userId, 'We need a Python developer with Docker', 'I know Python');
    expect(result.matchPercent).toBe(0);
    expect(result.resumeClaims!.counts.unsupported).toBe(1);
  });
});
