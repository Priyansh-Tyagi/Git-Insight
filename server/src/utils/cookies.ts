import { CookieOptions } from 'express';
import { env } from '../config/env';

export const SESSION_COOKIE = 'gi_session';
export const OAUTH_STATE_COOKIE = 'gi_oauth_state';

const isProd = env.nodeEnv === 'production';

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT expiry
  path: '/',
};

export const oauthStateCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000, // short-lived — only needs to survive the OAuth redirect round trip
  path: '/',
};
