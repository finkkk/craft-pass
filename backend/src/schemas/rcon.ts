import { z } from 'zod';
import {
  hasMinimumRconPasswordLength,
  minimumRconPasswordLength,
} from '../domain/rconPassword.js';

export const rconPasswordSchema = z
  .string()
  .max(256)
  .refine(
    (password) => !password || hasMinimumRconPasswordLength(password),
    `RCON 密码至少需要 ${minimumRconPasswordLength} 位`,
  );
