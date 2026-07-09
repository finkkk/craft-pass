import type { CookieOptions } from 'express';
import { env } from './env.js';

export const adminSessionCookieName = 'craft_pass_admin_session';

export function getAdminSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.nodeEnv === 'production',
    maxAge: env.adminSessionTtlHours * 60 * 60 * 1_000,
    path: '/api/admin',
  };
}

export function getAdminSessionClearCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...options } = getAdminSessionCookieOptions();
  return options;
}
