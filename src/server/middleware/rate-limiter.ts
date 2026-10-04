import rateLimit from 'express-rate-limit';

// Rate limiter for login endpoint (prevents brute-force)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again after 15 minutes.'
    }
  }
});

// Rate limiter for AI extraction (protects resource ceiling & quotas)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AI_RATE_LIMITED',
      message: 'Too many AI requests. Please wait a moment before retrying.'
    }
  }
});

// General API rate limiter
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.'
    }
  }
});
