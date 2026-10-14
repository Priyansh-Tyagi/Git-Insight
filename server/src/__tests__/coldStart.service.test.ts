import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { pool } from '../config/db';
import { encrypt } from '../utils/crypto';
import { getColdStartAssessment } from '../services/coldStart.service';

describe('coldStart.service', () => {
  let userId: string;

  beforeEach(async () => {
    const userRes = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [666000777, 'coldstart-test-user', null, encrypt('fake-token')]
    );
    userId = userRes.rows[0].id;
    await pool.query(`DELETE FROM repositories WHERE user_id = $1`, [userId]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE github_id = 666000777`);
  });

  it('reports insufficient for a user with no repos', async () => {
    const r = await getColdStartAssessment(userId);
    expect(r.depth).toBe('insufficient');
  });

  it('counts only non-fork, analyzed, non-clone repos from real rows', async () => {
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, is_fork, engineering_score, authenticity_flag, score_breakdown)
       VALUES
        ($1, 1, 'a', 'u/a', false, 80, 'likely_original', $2),
        ($1, 2, 'b', 'u/b', true,  70, 'likely_original', $2),
        ($1, 3, 'c', 'u/c', false, 60, 'possible_tutorial_clone', $2),
        ($1, 4, 'd', 'u/d', false, NULL, NULL, NULL)`,
      [userId, JSON.stringify([{ id: 'tests', label: 'Tests', passed: false }])]
    );
    const r = await getColdStartAssessment(userId);
    expect(r.evidenceRepoCount).toBe(1);
    expect(r.depth).toBe('thin');
    expect(r.totals).toEqual({ repos: 4, forks: 1, unanalyzed: 1, possibleClones: 1 });
  });
});
