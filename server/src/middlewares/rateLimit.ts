import rateLimit, { Options } from 'express-rate-limit';
import { env } from '../config/env';

const envelope = (message: string): Partial<Options> => ({
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Keep the app's own { success, error } response shape.
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } });
  },
  // Tests hit endpoints repeatedly from one IP; limits are covered by their own dedicated test.
  skip: () => env.nodeEnv === 'test',
});

/** Broad ceiling for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  ...envelope('Too many requests — slow down and try again in a few minutes'),
});

/** Login / OAuth endpoints — blocks brute-force and state-cookie spamming. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  ...envelope('Too many login attempts — try again in a few minutes'),
});

/** Endpoints that spend GitHub or Gemini quota (sync, analyze, summarize). */
export const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  ...envelope('Too many analysis requests — try again in a few minutes'),
});

/** Factory used by the tests so limits can be verified with tiny numbers. */
export function makeLimiter(limit: number, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    },
  });
}
