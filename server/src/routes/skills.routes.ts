import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { getSkills } from '../controllers/skills.controller';

const router = Router();

router.get('/skills', requireAuth, getSkills);

export default router;
