import { Request, Response, NextFunction } from 'express';
import { scanFrameworks } from '../services/frameworkScan.service';
import { RepoNotFoundError } from '../services/analyzer.service';

// POST /api/repos/:id/frameworks — read dependency files and store detected frameworks (no re-scoring)
export async function postScanFrameworks(req: Request, res: Response, next: NextFunction) {
  try {
    const frameworks = await scanFrameworks(req.user!.id, req.params.id);
    res.json({ success: true, data: { frameworks }, meta: {} });
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return res.status(404).json({ success: false, error: { code: 'REPO_NOT_FOUND', message: 'Repo not found for this user' } });
    }
    next(err);
  }
}
