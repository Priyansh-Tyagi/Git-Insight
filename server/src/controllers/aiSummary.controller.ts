import { Request, Response, NextFunction } from 'express';
import {
  generateSummary,
  RepoNotFoundError,
  NotYetAnalyzedError,
  GeminiNotConfiguredError,
  SummaryGenerationError,
} from '../services/aiSummary.service';

// POST /api/repos/:id/summarize
export async function postGenerateSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateSummary(req.user!.id, req.params.id);
    res.json({ success: true, data: result, meta: {} });
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return res.status(404).json({ success: false, error: { code: 'REPO_NOT_FOUND', message: 'Repo not found for this user' } });
    }
    if (err instanceof NotYetAnalyzedError) {
      return res.status(409).json({ success: false, error: { code: 'NOT_YET_ANALYZED', message: 'Analyze this repo before generating a summary' } });
    }
    if (err instanceof GeminiNotConfiguredError) {
      return res.status(503).json({ success: false, error: { code: 'GEMINI_NOT_CONFIGURED', message: 'AI summaries are not configured on this server (GEMINI_API_KEY missing)' } });
    }
    if (err instanceof SummaryGenerationError) {
      return res.status(502).json({ success: false, error: { code: 'SUMMARY_GENERATION_FAILED', message: 'The AI summary could not be generated right now — try again in a moment' } });
    }
    next(err);
  }
}
