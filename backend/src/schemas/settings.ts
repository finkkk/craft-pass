import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    site: z.object({
      name: z.string().trim().min(2).max(60),
      subtitle: z.string().trim().min(2).max(100),
    }),
    rcon: z.object({
      enabled: z.boolean(),
      host: z.string().trim().min(1).max(255),
      port: z.number().int().min(1).max(65_535),
      password: z
        .string()
        .max(256)
        .optional()
        .refine(
          (password) => !password || password.length >= 8,
          'RCON 密码至少需要 8 位',
        ),
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
        .refine((command) => !command.includes('\n')),
      whitelistReloadCommand: z
        .string()
        .trim()
        .max(200)
        .refine((command) => !command.includes('\n')),
    }),
  })
  .strict();

export const updateLogoSchema = z
  .object({
    dataUrl: z.string().max(750_000),
  })
  .strict();
