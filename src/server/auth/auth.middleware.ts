import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { User } from '../../shared/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.dukaanlens_session || req.headers['x-session-id'] as string;

  if (!sessionId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource.'
      }
    });
    return;
  }

  const user = authService.validateSession(sessionId);
  if (!user) {
    res.clearCookie('dukaanlens_session');
    res.status(401).json({
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please log in again.'
      }
    });
    return;
  }

  req.user = user;
  req.sessionId = sessionId;
  next();
}
