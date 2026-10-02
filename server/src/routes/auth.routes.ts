import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  redirectToGithub,
  handleGithubCallback,
  getMe,
  logout,
} from '../controllers/auth.controller';

const router = Router();

router.get('/github', redirectToGithub);
router.get('/github/callback', handleGithubCallback);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;
