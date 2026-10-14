import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { getColdStart } from '../controllers/coldStart.controller';

const router = Router();

router.get('/cold-start', requireAuth, getColdStart);

export default router;
