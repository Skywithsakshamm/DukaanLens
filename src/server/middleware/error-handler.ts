import { Request, Response, NextFunction } from 'express';
import { RequestWithId } from './request-id';

export function errorHandler(
  err: any,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
): void {
  const reqId = req.id || 'unknown';
  const status = err.status || err.statusCode || 500;

  // Log error server-side
  console.error(`[ERROR] [${reqId}] ${req.method} ${req.originalUrl}:`, err.message || err);

  // Sanitized client response
  const clientMessage =
    status === 500
      ? 'An unexpected server error occurred. Please try again.'
      : err.message || 'Request processing failed.';

  const code = err.code || (status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR');

  res.status(status).json({
    error: {
      code,
      message: clientMessage,
      requestId: reqId
    }
  });
}
