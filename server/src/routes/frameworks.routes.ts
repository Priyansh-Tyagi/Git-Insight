import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { postScanFrameworks } from '../controllers/frameworks.controller';

const router = Router();

router.post('/repos/:id/frameworks', requireAuth, postScanFrameworks);

export default router;
