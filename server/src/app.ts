import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import analyzerRoutes from './routes/analyzer.routes';
import skillsRoutes from './routes/skills.routes';
import aiSummaryRoutes from './routes/aiSummary.routes';
import coldStartRoutes from './routes/coldStart.routes';
import jobMatchRoutes from './routes/jobMatch.routes';
import { errorHandler } from './middlewares/errorHandler';
import { apiLimiter, authLimiter, expensiveLimiter } from './middlewares/rateLimit';
import { validateUuidParam } from './middlewares/validateUuidParam';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

  // Security headers (CSP, HSTS, nosniff, frameguard, ...). This server only returns JSON/redirects,
  // so helmet's defaults are safe to apply as-is.
  app.use(helmet());

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true, // required so the httpOnly session cookie is sent/received
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  // Quota-spending endpoints get a tighter limit and id validation before reaching any route/DB code.
  app.post('/api/profile/sync', expensiveLimiter);
  app.post('/api/repos/:id/analyze', validateUuidParam('id'), expensiveLimiter);
  app.post('/api/repos/:id/summarize', validateUuidParam('id'), expensiveLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api', profileRoutes); // exposes /api/profile, /api/profile/sync, /api/repos
  app.use('/api', analyzerRoutes); // exposes /api/repos/:id/analyze
  app.use('/api', skillsRoutes); // exposes /api/skills
  app.use('/api', aiSummaryRoutes); // exposes /api/repos/:id/summarize
  app.use('/api', coldStartRoutes); // exposes /api/cold-start
  app.use('/api', jobMatchRoutes); // exposes POST /api/match

  app.get('/api/health', (_req, res) => res.json({ success: true, data: 'ok' }));

  app.use(errorHandler);

  return app;
}
