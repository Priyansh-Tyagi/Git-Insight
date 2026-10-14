import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { exchangeCodeForToken, fetchGithubProfile } from '../config/githubOAuth';
import { encrypt } from '../utils/crypto';
import { signSession } from '../utils/jwt';
import { pool } from '../config/db';
import {
  SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  sessionCookieOptions,
  oauthStateCookieOptions,
} from '../utils/cookies';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// GET /api/auth/github — kick off the OAuth flow
export function redirectToGithub(req: Request, res: Response) {
  const state = crypto.randomBytes(16).toString('hex');

  res.cookie(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions);

  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: env.githubCallbackUrl,
    scope: env.githubOAuthScope, // see GITHUB_OAUTH_SCOPE in env.ts — 'repo' is broader than a read-only analyzer needs
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

// GET /api/auth/github/callback
export async function handleGithubCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state } = req.query;
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];

    // Always clear the state cookie — it's single-use regardless of outcome.
    res.clearCookie(OAUTH_STATE_COOKIE);

    // Query values can be arrays/objects (?code[]=x) — only plain strings are acceptable.
    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      typeof expectedState !== 'string' ||
      !code ||
      !safeEqual(state, expectedState)
    ) {
      return res.status(400).json({
        success: false,
        error: { code: 'OAUTH_STATE_MISMATCH', message: 'Invalid or missing OAuth state' },
      });
    }

    const accessToken = await exchangeCodeForToken(code);
    const profile = await fetchGithubProfile(accessToken);

    const encryptedToken = encrypt(accessToken);

    const result = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET
         username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url,
         access_token_enc = EXCLUDED.access_token_enc
       RETURNING id`,
      [profile.id, profile.login, profile.avatar_url, encryptedToken]
    );

    const userId = result.rows[0].id;
    const sessionToken = signSession({ userId });

    res.cookie(SESSION_COOKIE, sessionToken, sessionCookieOptions);
    res.redirect(`${env.clientUrl}/dashboard`);
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export function getMe(req: Request, res: Response) {
  // requireAuth middleware has already populated req.user, or this route wouldn't be reached.
  res.json({ success: true, data: req.user, meta: {} });
}

// POST /api/auth/logout
export function logout(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true, data: null, meta: {} });
}
