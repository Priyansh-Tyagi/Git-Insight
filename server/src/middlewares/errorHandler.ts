import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Axios errors carry the full request config — including Authorization headers
 * and, for the OAuth code exchange, the GitHub client_secret in the request
 * body. Logging the raw error object would write those secrets to the logs, so
 * we log only a safe summary.
 */
export function describeErrorForLog(err: any): string {
  if (!err) return 'unknown error';
  if (err.isAxiosError) {
    const method = String(err.config?.method ?? '').toUpperCase();
    const url = String(err.config?.url ?? '').split('?')[0]; // drop query strings (may contain codes)
    return `axios ${method} ${url} -> ${err.response?.status ?? err.code ?? 'no response'}: ${err.message}`;
  }
  return err.stack ?? err.message ?? String(err);
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', describeErrorForLog(err));

  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  const hideDetails = status >= 500 && env.nodeEnv === 'production';

  res.status(status).json({
    success: false,
    error: {
      code: hideDetails ? 'INTERNAL_ERROR' : err?.code && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR',
      message: hideDetails ? 'Something went wrong' : err?.message ?? 'Something went wrong',
    },
  });
}
