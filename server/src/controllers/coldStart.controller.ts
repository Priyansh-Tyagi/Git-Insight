import { Request, Response, NextFunction } from 'express';
import { getColdStartAssessment } from '../services/coldStart.service';

// GET /api/cold-start
export async function getColdStart(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getColdStartAssessment(req.user!.id);
    res.json({ success: true, data, meta: {} });
  } catch (err) {
    next(err);
  }
}
