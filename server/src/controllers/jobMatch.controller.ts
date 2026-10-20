import { Request, Response, NextFunction } from 'express';
import { getJobMatch } from '../services/jobMatch.service';
import { validateMatchInput } from '../services/jobMatch/validateInput';

// POST /api/match   body: { jobDescription: string, resume?: string }
export async function postJobMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateMatchInput(req.body);
    if (!input.ok) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: input.message } });
    }
    const data = await getJobMatch(req.user!.id, input.jobDescription, input.resume);
    res.json({ success: true, data, meta: {} });
  } catch (err) {
    next(err);
  }
}
