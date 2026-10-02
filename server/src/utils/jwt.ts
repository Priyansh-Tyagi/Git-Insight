import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface SessionPayload {
  userId: string;
}

const EXPIRY = '7d';

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: EXPIRY });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, env.jwtSecret) as SessionPayload;
}
