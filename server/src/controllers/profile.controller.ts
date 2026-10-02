import { Request, Response, NextFunction } from 'express';
import { syncUserProfile } from '../services/profileSync.service';

// GET /api/profile — respects TTL, cheap/fast path
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncUserProfile(req.user!.id, false);
    res.json({
      success: true,
      data: { profile: result.profile, repoCount: result.repos.length },
      meta: { cached: result.cached, computedAt: result.lastSyncedAt },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/profile/sync — always force-refreshes from GitHub
export async function forceSyncProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncUserProfile(req.user!.id, true);
    res.json({
      success: true,
      data: { profile: result.profile, repoCount: result.repos.length },
      meta: { cached: result.cached, degraded: !!(result as any).degraded, computedAt: result.lastSyncedAt },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/repos — list cached repos (never triggers a GitHub call itself)
export async function listRepos(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncUserProfile(req.user!.id, false);
    res.json({
      success: true,
      data: result.repos,
      meta: { cached: result.cached, computedAt: result.lastSyncedAt },
    });
  } catch (err) {
    next(err);
  }
}
