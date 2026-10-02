import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err);

  res.status(err.status ?? 500).json({
    success: false,
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message ?? 'Something went wrong',
    },
  });
}
