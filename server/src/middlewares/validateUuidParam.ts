import { Request, Response, NextFunction } from 'express';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rejects malformed ids before they reach Postgres (which would throw a 500 "invalid input syntax for type uuid"). */
export function validateUuidParam(name: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[name];
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      return res.status(404).json({
        success: false,
        error: { code: 'REPO_NOT_FOUND', message: 'Repo not found for this user' },
      });
    }
    next();
  };
}
