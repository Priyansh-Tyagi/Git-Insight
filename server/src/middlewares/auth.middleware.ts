import { Request, Response, NextFunction } from 'express';
import { verifySession } from '../utils/jwt';
import { SESSION_COOKIE } from '../utils/cookies';
import { pool } from '../config/db';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; avatarUrl: string | null };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'No session cookie present' },
    });
  }

  try {
    const payload = verifySession(token);

    const result = await pool.query(
      `SELECT id, username, avatar_url FROM users WHERE id = $1`,
      [payload.userId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'User no longer exists' },
      });
    }

    req.user = {
      id: result.rows[0].id,
      username: result.rows[0].username,
      avatarUrl: result.rows[0].avatar_url,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired session' },
    });
  }
}
