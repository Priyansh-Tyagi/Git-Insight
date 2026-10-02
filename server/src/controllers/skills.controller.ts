import { Request, Response, NextFunction } from 'express';
import { computeAndPersistSkills } from '../services/skillsInference.service';

// GET /api/skills
export async function getSkills(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await computeAndPersistSkills(req.user!.id);
    res.json({ success: true, data: result, meta: {} });
  } catch (err) {
    next(err);
  }
}
