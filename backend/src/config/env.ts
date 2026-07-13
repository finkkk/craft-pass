import { config as loadDotEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envFilePath = fileURLToPath(new URL('../../.env', import.meta.url));
loadDotEnv({ path: envFilePath, quiet: true });

const optionalSecret = (minimumLength: number) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(minimumLength).optional(),
  );

const rawEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(47_821),
  PORT_LOCKED: z.enum(['true', 'false']).default('false'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  ADMIN_SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .default(8),
  DATABASE_URL: z.string().min(1).default('file:./data/craft-pass.db'),
  RCON_ENABLED: z.enum(['true', 'false']).default('false'),
  RCON_HOST: z.string().min(1).default('127.0.0.1'),
  RCON_PORT: z.coerce.number().int().min(1).max(65_535).default(25_575),
  RCON_PASSWORD: z.string().default(''),
  RCON_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  RCON_WHITELIST_ADD_COMMAND: z
    .string()
    .min(1)
    .default('whitelist add {minecraftId}'),
  RCON_WHITELIST_RELOAD_COMMAND: z.string().default(''),
  SETUP_TOKEN: optionalSecret(16),
  APP_SECRET: optionalSecret(32),
  RUNTIME_DATA_DIR: z.string().min(1).optional(),
});

const result = rawEnvSchema.safeParse(process.env);

if (!result.success) {
  const details = z.prettifyError(result.error);
  throw new Error(`环境变量配置无效：\n${details}`);
}

const rawEnv = result.data;
const corsOrigins = rawEnv.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  throw new Error('环境变量 CORS_ORIGINS 至少需要包含一个来源');
}

if (
  rawEnv.RCON_ENABLED === 'true' &&
  rawEnv.RCON_PASSWORD.length < 8
) {
  throw new Error('启用 RCON 时，RCON_PASSWORD 长度不能少于 8 位');
}

if (!rawEnv.RCON_WHITELIST_ADD_COMMAND.includes('{minecraftId}')) {
  throw new Error(
    'RCON_WHITELIST_ADD_COMMAND 必须包含 {minecraftId} 占位符',
  );
}

if (
  rawEnv.RCON_WHITELIST_ADD_COMMAND.includes('\n') ||
  rawEnv.RCON_WHITELIST_RELOAD_COMMAND.includes('\n')
) {
  throw new Error('RCON 命令配置不能包含换行符');
}

export const env = Object.freeze({
  nodeEnv: rawEnv.NODE_ENV,
  port: rawEnv.PORT,
  portLocked: rawEnv.PORT_LOCKED === 'true',
  corsOrigins,
  trustProxy: rawEnv.TRUST_PROXY === 'true',
  databaseUrl: rawEnv.DATABASE_URL,
  adminSessionTtlHours: rawEnv.ADMIN_SESSION_TTL_HOURS,
  rcon: {
    enabled: rawEnv.RCON_ENABLED === 'true',
    host: rawEnv.RCON_HOST,
    port: rawEnv.RCON_PORT,
    password: rawEnv.RCON_PASSWORD,
    timeoutMs: rawEnv.RCON_TIMEOUT_MS,
    whitelistAddCommand: rawEnv.RCON_WHITELIST_ADD_COMMAND,
    whitelistReloadCommand:
      rawEnv.RCON_WHITELIST_RELOAD_COMMAND.trim() || null,
  },
  setupToken: rawEnv.SETUP_TOKEN,
  appSecret: rawEnv.APP_SECRET,
  runtimeDataDir: rawEnv.RUNTIME_DATA_DIR,
  rateLimit: {
    windowMs: rawEnv.RATE_LIMIT_WINDOW_MS,
    max: rawEnv.RATE_LIMIT_MAX,
  },
});
