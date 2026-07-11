import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    site: z.object({
      name: z.string().trim().min(2).max(60),
      subtitle: z.string().trim().min(2).max(100),
    }),
    server: z
      .object({
        port: z.number().int().min(1).max(65_535),
      })
      .optional(),
    application: z.object({
      submissionsEnabled: z.boolean(),
      quizFailCooldownMinutes: z.number().int().min(0).max(10_080),
      rateLimitWindowMinutes: z.number().int().min(1).max(1_440),
      maxSubmissionsPerIp: z.number().int().min(1).max(500),
      maxSubmissionsPerQq: z.number().int().min(1).max(100),
      maxSubmissionsPerMinecraftId: z.number().int().min(1).max(100),
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
      customCommandsEnabled: z.boolean(),
      blockedCommands: z
        .array(
          z
            .string()
            .trim()
            .min(1)
            .max(80)
            .refine((command) => !/[\r\n]/.test(command)),
        )
        .max(50),
    }),
  })
  .strict();

export const updateLogoSchema = z
  .object({
    dataUrl: z.string().max(750_000),
  })
  .strict();
