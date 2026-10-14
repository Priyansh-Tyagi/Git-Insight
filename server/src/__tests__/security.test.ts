import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { env } from '../config/env';
import { verifySession, signSession } from '../utils/jwt';
import { describeErrorForLog } from '../middlewares/errorHandler';
import { validateUuidParam } from '../middlewares/validateUuidParam';
import { makeLimiter } from '../middlewares/rateLimit';

describe('HTTP hardening', () => {
  const app = createApp();

  it('does not advertise Express and sends helmet security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('rejects OAuth callback params that are arrays instead of strings', async () => {
    const res = await request(app)
      .get('/api/auth/github/callback?code[]=x&state[]=y')
      .set('Cookie', ['gi_oauth_state=y']);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OAUTH_STATE_MISMATCH');
  });

  it('rejects an OAuth callback whose state does not match the cookie', async () => {
    const res = await request(app)
      .get('/api/auth/github/callback?code=abc&state=wrong')
      .set('Cookie', ['gi_oauth_state=right']);
    expect(res.status).toBe(400);
  });

  it('rejects a request body over 100kb', async () => {
    const big = JSON.stringify({ x: 'a'.repeat(200_000) });
    const res = await request(app).post('/api/auth/logout').set('Content-Type', 'application/json').send(big);
    expect(res.status).toBe(413);
  });

  it('returns 404 (not a Postgres 500) for a malformed repo id on analyze and summarize', async () => {
    for (const path of ['/api/repos/not-a-uuid/analyze', '/api/repos/1%20OR%201=1/summarize']) {
      const res = await request(app).post(path);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('REPO_NOT_FOUND');
    }
  });
});

describe('validateUuidParam', () => {
  const mini = express();
  mini.get('/r/:id', validateUuidParam('id'), (_req, res) => res.json({ ok: true }));

  it('lets a valid UUID through', async () => {
    const res = await request(mini).get('/r/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).toBe(200);
  });
  it('blocks anything else', async () => {
    expect((await request(mini).get('/r/123')).status).toBe(404);
    expect((await request(mini).get("/r/'; DROP TABLE users;--")).status).toBe(404);
  });
});

describe('rate limiting', () => {
  it('allows up to the limit then answers 429 in the standard error envelope', async () => {
    const mini = express();
    mini.use(makeLimiter(3));
    mini.get('/x', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 3; i++) expect((await request(mini).get('/x')).status).toBe(200);
    const blocked = await request(mini).get('/x');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
  });
});

describe('JWT algorithm pinning', () => {
  it('accepts a normally signed session', () => {
    expect(verifySession(signSession({ userId: 'u1' })).userId).toBe('u1');
  });

  it('rejects an unsigned (alg: none) token', () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: 'u1' })}.`;
    expect(() => verifySession(forged)).toThrow();
  });

  it('rejects a token signed with a different HMAC algorithm', () => {
    const t = jwt.sign({ userId: 'u1' }, env.jwtSecret, { algorithm: 'HS512' });
    expect(() => verifySession(t)).toThrow();
  });

  it('rejects a token signed with the wrong secret', () => {
    const t = jwt.sign({ userId: 'u1' }, 'x'.repeat(64), { algorithm: 'HS256' });
    expect(() => verifySession(t)).toThrow();
  });
});

describe('error log redaction', () => {
  it('never includes request headers, bodies or client secrets from an axios error', () => {
    const axiosErr: any = new Error('Request failed with status code 401');
    axiosErr.isAxiosError = true;
    axiosErr.config = {
      method: 'post',
      url: 'https://github.com/login/oauth/access_token?code=SECRETCODE',
      headers: { Authorization: 'token gho_SUPERSECRETTOKEN' },
      data: JSON.stringify({ client_secret: 'MY_CLIENT_SECRET', code: 'SECRETCODE' }),
    };
    axiosErr.response = { status: 401 };
    const line = describeErrorForLog(axiosErr);
    expect(line).toContain('POST https://github.com/login/oauth/access_token -> 401');
    for (const secret of ['gho_SUPERSECRETTOKEN', 'MY_CLIENT_SECRET', 'SECRETCODE']) {
      expect(line).not.toContain(secret);
    }
  });
});
