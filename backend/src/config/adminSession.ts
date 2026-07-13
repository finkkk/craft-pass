import type { CookieOptions } from 'express';
import { env } from './env.js';

export const adminSessionCookieName = 'craft_pass_admin_session';

export function getAdminSessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: env.adminSessionTtlHours * 60 * 60 * 1_000,
    path: '/api/admin',
  };
}

export function getAdminSessionClearCookieOptions(
  secure: boolean,
): CookieOptions {
  const { maxAge: _maxAge, ...options } =
    getAdminSessionCookieOptions(secure);
  return options;
}
