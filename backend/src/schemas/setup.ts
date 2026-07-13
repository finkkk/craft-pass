import { z } from 'zod';
import {
  hasMinimumRconPasswordLength,
  minimumRconPasswordLength,
} from '../domain/rconPassword.js';
import { adminPasswordSchema } from './admin.js';
import { rconPasswordSchema } from './rcon.js';

export const completeSetupSchema = z
  .object({
    setupToken: z.string().trim().min(16).max(256),
    siteName: z.string().trim().min(2).max(60),
    siteSubtitle: z.string().trim().min(2).max(100),
    admin: z.object({
      username: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]{3,32}$/),
      password: adminPasswordSchema,
    }),
    rcon: z
      .object({
        enabled: z.boolean(),
        host: z.string().trim().min(1).max(255),
        port: z.number().int().min(1).max(65_535),
        password: rconPasswordSchema,
        timeoutMs: z.number().int().min(500).max(30_000),
        whitelistAddCommand: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine(
            (command) => command.includes('{minecraftId}'),
            '命令必须包含 {minecraftId}',
          )
          .refine((command) => !command.includes('\n'), '命令不能换行'),
        whitelistReloadCommand: z
          .string()
          .trim()
          .max(200)
          .refine((command) => !command.includes('\n'), '命令不能换行'),
      })
      .superRefine((rcon, context) => {
        if (
          rcon.enabled &&
          !hasMinimumRconPasswordLength(rcon.password)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['password'],
            message: `启用 RCON 时密码至少需要 ${minimumRconPasswordLength} 位`,
          });
        }
      }),
  })
  .strict();
