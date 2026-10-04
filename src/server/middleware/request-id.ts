import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export interface RequestWithId extends Request {
  id?: string;
}

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}
