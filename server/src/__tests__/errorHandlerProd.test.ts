import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../config/env', () => ({ env: { nodeEnv: 'production' } }));

import { errorHandler } from '../middlewares/errorHandler';

describe('errorHandler in production', () => {
  const mini = express();
  mini.get('/boom', () => {
    throw new Error('connect ECONNREFUSED 10.0.0.5:5432 password authentication failed for user "gitinsight"');
  });
  mini.get('/teapot', (_req, _res, next) => next(Object.assign(new Error('nope'), { status: 418, code: 'TEAPOT' })));
  mini.use(errorHandler);

  it('hides internal error text from 5xx responses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(mini).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Something went wrong');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('still passes through deliberate 4xx errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(mini).get('/teapot');
    expect(res.status).toBe(418);
    expect(res.body.error).toEqual({ code: 'TEAPOT', message: 'nope' });
  });
});
