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
  it('checks frameworks from scanned repositories and reports coverage', async () => {
    const recent = new Date().toISOString();
    const react = JSON.stringify([{ skill: 'React', via: ['package.json: react'] }, { skill: 'MongoDB', via: ['package.json: mongoose'] }]);
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, is_fork, language_stats, raw_metadata, detected_frameworks)
       VALUES
        ($1, 21, 'mern-app',  'u/mern-app',  false, $2, $3, $4),
        ($1, 22, 'forked-ui', 'u/forked-ui', true,  $2, $3, $5),
        ($1, 23, 'unscanned', 'u/unscanned', false, $2, $3, NULL)`,
      [userId, JSON.stringify({ JavaScript: 9000 }), JSON.stringify({ pushedAt: recent }), react, JSON.stringify([{ skill: 'Express', via: ['package.json: express'] }])]
    );

    const result = await getJobMatch(userId, 'Requirements\n- React\n- MongoDB\n- Express.js\n- Django', null);
    const by = Object.fromEntries(result.requirements.map((r) => [r.skill, [r.status, r.method]]));
    expect(by).toEqual({
      React: ['matched', 'dependencies'],
      MongoDB: ['matched', 'dependencies'],
      Express: ['weak', 'dependencies'], // only the fork declares it
      Django: ['gap', 'dependencies'],
    });
    expect(result.coverage).toEqual({ scannedRepos: 2, totalRepos: 3 });
    expect(result.requirements.find((r) => r.skill === 'React')!.via).toEqual(['mern-app/package.json: react']);
  });

  it('asks for a scan when no repository has been scanned yet', async () => {
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, is_fork, language_stats, raw_metadata)
       VALUES ($1, 31, 'old-analysis', 'u/old-analysis', false, $2, $3)`,
      [userId, JSON.stringify({ JavaScript: 9000 }), JSON.stringify({ pushedAt: new Date().toISOString() })]
    );
    const result = await getJobMatch(userId, 'We need React experience', null);
    expect(result.requirements[0]).toMatchObject({ status: 'unverifiable', needsScan: true });
    expect(result.coverage).toEqual({ scannedRepos: 0, totalRepos: 1 });
    expect(result.nextSteps[0]).toMatch(/Scan your repositories \(0 of 1 done\)/);
  });

  it('ignores malformed framework data instead of failing', async () => {
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, is_fork, language_stats, raw_metadata, detected_frameworks)
       VALUES ($1, 41, 'weird', 'u/weird', false, $2, $3, $4)`,
      [userId, JSON.stringify({}), JSON.stringify({ pushedAt: new Date().toISOString() }), JSON.stringify([42, null, { via: ['x'] }, { skill: 'React', via: 'not-an-array' }])]
    );
    const result = await getJobMatch(userId, 'React', null);
    expect(result.requirements[0]).toMatchObject({ status: 'matched', method: 'dependencies', via: [] });
  });
});
