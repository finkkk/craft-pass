import type { RequestHandler } from 'express';
import {
  adminSessionCookieName,
  getAdminSessionClearCookieOptions,
} from '../config/adminSession.js';
import { authenticateAdminSession } from '../services/adminSessionService.js';
import { HttpError } from '../utils/HttpError.js';

export const requireAdmin: RequestHandler = async (
  request,
  response,
  next,
) => {
  const token = request.cookies?.[adminSessionCookieName] as
    | string
    | undefined;

  if (!token) {
    next(new HttpError(401, 'ADMIN_AUTH_REQUIRED', '请先登录管理员后台'));
    return;
  }

  const session = await authenticateAdminSession(token);

  if (!session) {
    response.clearCookie(
      adminSessionCookieName,
      getAdminSessionClearCookieOptions(),
    );
    next(new HttpError(401, 'ADMIN_SESSION_INVALID', '登录状态已失效'));
    return;
  }

  response.locals.admin = session.admin;
  response.locals.adminSessionToken = token;
  next();
};
