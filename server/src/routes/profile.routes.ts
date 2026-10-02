import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { getProfile, forceSyncProfile, listRepos } from '../controllers/profile.controller';

const router = Router();

router.get('/profile', requireAuth, getProfile);
router.post('/profile/sync', requireAuth, forceSyncProfile);
router.get('/repos', requireAuth, listRepos);

export default router;
