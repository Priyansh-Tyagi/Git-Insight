import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signSession, verifySession } from '../utils/jwt';
import { env } from '../config/env';

describe('jwt (session token)', () => {
  it('signs and verifies a valid session round-trip', () => {
    const token = signSession({ userId: 'abc-123' });
    const payload = verifySession(token);
    expect(payload.userId).toBe('abc-123');
  });

  it('rejects a token signed with the wrong secret', () => {
    const badToken = jwt.sign({ userId: 'abc-123' }, 'wrong-secret');
    expect(() => verifySession(badToken)).toThrow();
  });

  it('rejects an expired token', () => {
    const expiredToken = jwt.sign({ userId: 'abc-123' }, env.jwtSecret, { expiresIn: -10 });
    expect(() => verifySession(expiredToken)).toThrow();
  });

  it('rejects a malformed token string', () => {
    expect(() => verifySession('not.a.jwt')).toThrow();
  });
});
