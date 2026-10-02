import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { postAnalyzeRepo } from '../controllers/analyzer.controller';

const router = Router();

router.post('/repos/:id/analyze', requireAuth, postAnalyzeRepo);

export default router;
