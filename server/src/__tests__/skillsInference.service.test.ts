import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { pool } from '../config/db';
import { encrypt } from '../utils/crypto';
import { computeAndPersistSkills } from '../services/skillsInference.service';

describe('skillsInference.service', () => {
  let userId: string;

  beforeEach(async () => {
    const userRes = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [666000555, 'skills-test-user', null, encrypt('fake-token')]
    );
    userId = userRes.rows[0].id;

    await pool.query(`DELETE FROM repositories WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM user_skills WHERE user_id = $1`, [userId]);

    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, language_stats, raw_metadata, score_breakdown)
       VALUES
        ($1, 111, 'repo-a', 'skills-test-user/repo-a', $2, $3, $4),
        ($1, 222, 'repo-b', 'skills-test-user/repo-b', $5, $6, $7)`,
      [
        userId,
        JSON.stringify({ TypeScript: 8000, CSS: 2000 }),
        JSON.stringify({ pushedAt: new Date().toISOString() }),
        JSON.stringify([{ id: 'docker', passed: true }, { id: 'ci', passed: false }]),
        JSON.stringify({ Python: 5000 }),
        JSON.stringify({ pushedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString() }),
        JSON.stringify([]),
      ]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE github_id = 666000555`);
  });

  it('computes skills from real repo rows with zero network calls', async () => {
    const result = await computeAndPersistSkills(userId);
    expect(result.skills.find((s) => s.skill === 'TypeScript')).toBeDefined();
    expect(result.skills.find((s) => s.skill === 'Docker')).toBeDefined();
    expect(result.skills.find((s) => s.skill === 'Python')).toBeDefined();
  });

  it('persists skills to the user_skills table', async () => {
    await computeAndPersistSkills(userId);
    const rows = await pool.query(`SELECT * FROM user_skills WHERE user_id = $1`, [userId]);
    expect(rows.rows.length).toBeGreaterThan(0);
    const ts = rows.rows.find((r) => r.skill === 'TypeScript');
    expect(ts.category).toBe('Frontend');
  });

  it('replaces old skill rows on recompute rather than accumulating duplicates', async () => {
    await computeAndPersistSkills(userId);
    await computeAndPersistSkills(userId); // recompute with identical data

    const rows = await pool.query(`SELECT * FROM user_skills WHERE user_id = $1 AND skill = 'TypeScript'`, [userId]);
    expect(rows.rows).toHaveLength(1); // not 2
  });

  it('returns category aggregates alongside individual skills', async () => {
    const result = await computeAndPersistSkills(userId);
    expect(result.categories.length).toBeGreaterThan(0);
    const devops = result.categories.find((c) => c.category === 'DevOps');
    expect(devops).toBeDefined();
  });

  it('the stale Python skill (400 days old) is flagged as stale, not growing', async () => {
    const result = await computeAndPersistSkills(userId);
    const python = result.skills.find((s) => s.skill === 'Python');
    expect(python!.trend).toBe('stale');
  });
});
