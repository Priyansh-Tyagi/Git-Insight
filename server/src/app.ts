import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import analyzerRoutes from './routes/analyzer.routes';
import skillsRoutes from './routes/skills.routes';
import aiSummaryRoutes from './routes/aiSummary.routes';
import { errorHandler } from './middlewares/errorHandler';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true, // required so the httpOnly session cookie is sent/received
    })
  );
  app.use(cookieParser());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api', profileRoutes); // exposes /api/profile, /api/profile/sync, /api/repos
  app.use('/api', analyzerRoutes); // exposes /api/repos/:id/analyze
  app.use('/api', skillsRoutes); // exposes /api/skills
  app.use('/api', aiSummaryRoutes); // exposes /api/repos/:id/summarize

  app.get('/api/health', (_req, res) => res.json({ success: true, data: 'ok' }));

  app.use(errorHandler);

  return app;
}
