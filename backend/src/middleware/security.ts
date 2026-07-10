import type { CorsOptionsDelegate } from 'cors';
import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

export function createCorsOptions(
  allowedOrigins: readonly string[],
): CorsOptionsDelegate<Request> {
  return (request, callback) => {
    const origin = request.get('origin');
    const host = request.get('host');
    const sameOrigin =
      Boolean(origin && host) &&
      origin === `${request.protocol}://${host}`;

    if (!origin || sameOrigin || allowedOrigins.includes(origin)) {
      callback(null, {
        credentials: true,
        origin: Boolean(origin),
      });
      return;
    }

    callback(
      new HttpError(403, 'CORS_ORIGIN_DENIED', '当前页面来源不允许访问 API'),
    );
  };
}

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_request, response) {
    response.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '请求过于频繁，请稍后再试',
        requestId: response.locals.requestId,
      },
    });
  },
});

export const applicationSubmissionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: env.nodeEnv === 'test' ? 1_000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_request, response) {
    response.status(429).json({
      error: {
        code: 'APPLICATION_RATE_LIMIT_EXCEEDED',
        message: '申请提交过于频繁，请稍后再试',
        requestId: response.locals.requestId,
      },
    });
  },
});

export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_request, response) {
    response.status(429).json({
      error: {
        code: 'ADMIN_LOGIN_RATE_LIMIT_EXCEEDED',
        message: '登录尝试过于频繁，请稍后再试',
        requestId: response.locals.requestId,
      },
    });
  },
});

export const setupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_request, response) {
    response.status(429).json({
      error: {
        code: 'SETUP_RATE_LIMIT_EXCEEDED',
        message: '部署尝试过于频繁，请稍后再试',
        requestId: response.locals.requestId,
      },
    });
  },
});
