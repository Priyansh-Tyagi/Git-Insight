import { describe, it, expect, vi, afterEach } from 'vitest';

const GOOD = {
  CLIENT_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgres://u:p@localhost:5432/d',
  GITHUB_CLIENT_ID: 'id',
  GITHUB_CLIENT_SECRET: 'secret',
  GITHUB_CALLBACK_URL: 'http://localhost:4000/cb',
  JWT_SECRET: 'a'.repeat(64),
  TOKEN_ENCRYPTION_KEY: 'b'.repeat(64),
};

async function loadEnvWith(overrides: Record<string, string>) {
  vi.resetModules();
  vi.stubGlobal('process', { ...process, env: { ...process.env, ...GOOD, ...overrides } });
  return import('../config/env');
}

afterEach(() => vi.unstubAllGlobals());

describe('env validation (fail fast on weak secrets)', () => {
  it('accepts strong secrets', async () => {
    const { env } = await loadEnvWith({});
    expect(env.jwtSecret).toHaveLength(64);
  });
  it('rejects a short JWT_SECRET', async () => {
    await expect(loadEnvWith({ JWT_SECRET: 'short' })).rejects.toThrow(/JWT_SECRET must be at least 32/);
  });
  it('rejects a TOKEN_ENCRYPTION_KEY that is not 64 hex chars', async () => {
    await expect(loadEnvWith({ TOKEN_ENCRYPTION_KEY: 'z'.repeat(64) })).rejects.toThrow(/TOKEN_ENCRYPTION_KEY must be exactly 64 hex/);
    await expect(loadEnvWith({ TOKEN_ENCRYPTION_KEY: 'ab' })).rejects.toThrow(/64 hex/);
  });
  it('defaults the OAuth scope to the current behaviour and honours an override', async () => {
    expect((await loadEnvWith({})).env.githubOAuthScope).toBe('read:user repo');
    expect((await loadEnvWith({ GITHUB_OAUTH_SCOPE: 'read:user' })).env.githubOAuthScope).toBe('read:user');
  });
});
