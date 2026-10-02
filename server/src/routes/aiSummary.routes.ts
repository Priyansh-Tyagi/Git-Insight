import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { postGenerateSummary } from '../controllers/aiSummary.controller';

const router = Router();

router.post('/repos/:id/summarize', requireAuth, postGenerateSummary);

export default router;
