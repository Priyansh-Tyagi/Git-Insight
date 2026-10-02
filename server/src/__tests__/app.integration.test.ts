import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../config/db';
import { signSession } from '../utils/jwt';
import { encrypt } from '../utils/crypto';

const app = createApp();

describe('app health + unauthenticated access', () => {
  it('GET /api/health returns ok with no auth needed', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: 'ok' });
  });

  it('GET /api/auth/me with no cookie returns 401 UNAUTHENTICATED envelope', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /api/auth/github redirects to the real GitHub OAuth consent screen', async () => {
    const res = await request(app).get('/api/auth/github');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://github.com/login/oauth/authorize');
    expect(res.headers.location).toContain('client_id=');
    expect(res.headers.location).toContain('state=');
    // a state cookie must be set for CSRF protection on the callback
    expect(res.headers['set-cookie']?.[0]).toContain('gi_oauth_state');
  });

  it('GET /api/repos with no cookie returns 401, not a crash, even though it touches the DB path', async () => {
    const res = await request(app).get('/api/repos');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('auth middleware against a real logged-in user', () => {
  let userId: string;
  let sessionCookie: string;

  beforeAll(async () => {
    const result = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [999999001, 'test-user', 'https://example.com/avatar.png', encrypt('fake-token-for-testing')]
    );
    userId = result.rows[0].id;
    sessionCookie = `gi_session=${signSession({ userId })}`;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  it('GET /api/auth/me with a valid session cookie returns the real user', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('test-user');
    expect(res.body.data.id).toBe(userId);
  });

  it('GET /api/auth/me with a tampered cookie is rejected', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'gi_session=garbage.not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout clears the session cookie', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/gi_session=;/);
  });

  it('a session for a deleted user is rejected even with a structurally valid JWT', async () => {
    const ghostToken = signSession({ userId: '00000000-0000-0000-0000-000000000000' });
    const res = await request(app).get('/api/auth/me').set('Cookie', `gi_session=${ghostToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('no longer exists');
  });
});
