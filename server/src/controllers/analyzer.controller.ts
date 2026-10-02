import { Request, Response, NextFunction } from 'express';
import { analyzeRepo, RepoNotFoundError } from '../services/analyzer.service';

// POST /api/repos/:id/analyze
export async function postAnalyzeRepo(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await analyzeRepo(req.user!.id, req.params.id);
    res.json({ success: true, data: result, meta: {} });
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'REPO_NOT_FOUND', message: 'Repo not found for this user' },
      });
    }
    next(err);
  }
}
