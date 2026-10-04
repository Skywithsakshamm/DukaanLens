import { Router, Response } from 'express';
import { authService } from './auth.service';
import { AuthenticatedRequest, requireAuth } from './auth.middleware';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Username/email and password are required.'
        }
      });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const { user, sessionId } = await authService.login(username, password, ip);

    // Set secure HTTP-only cookie
    res.cookie('dukaanlens_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      user,
      sessionId // Also returned in body for non-cookie API clients
    });
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: 'AUTH_FAILED',
        message: err.message || 'Login failed.'
      }
    });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.cookies?.dukaanlens_session || req.headers['x-session-id'] as string;
  if (sessionId) {
    authService.logout(sessionId, req.user?.username || 'user');
  }

  res.clearCookie('dukaanlens_session');
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});
