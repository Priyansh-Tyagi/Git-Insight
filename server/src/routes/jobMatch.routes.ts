import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { postJobMatch } from '../controllers/jobMatch.controller';

const router = Router();

router.post('/match', requireAuth, postJobMatch);

export default router;
