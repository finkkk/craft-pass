import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasMinimumRconPasswordLength,
  minimumRconPasswordLength,
} from '../domain/rconPassword.js';
import { env } from './env.js';

const defaultDataDirectory = fileURLToPath(
  new URL('../../data/', import.meta.url),
);
const dataDirectory = env.runtimeDataDir
  ? resolve(env.runtimeDataDir)
  : defaultDataDirectory;
const runtimeConfigPath = resolve(dataDirectory, 'runtime-config.json');
const encryptionKeyPath = resolve(dataDirectory, 'app-secret.key');
const setupTokenPath = resolve(dataDirectory, 'setup-token.txt');

export interface RuntimeRconConfig {
  enabled: boolean;
  host: string;
  port: number;
  password: string;
  timeoutMs: number;
  whitelistAddCommand: string;
  whitelistReloadCommand: string | null;
  customCommandsEnabled: boolean;
  blockedCommands: string[];
}

export interface RuntimeApplicationConfig {
  submissionsEnabled: boolean;
  quizFailCooldownMinutes: number;
  rateLimitWindowMinutes: number;
  maxSubmissionsPerIp: number;
  maxSubmissionsPerQq: number;
  maxSubmissionsPerMinecraftId: number;
}

export interface RuntimeServerConfig {
  port: number;
}

export const defaultApplicationConfig: RuntimeApplicationConfig = {
  submissionsEnabled: true,
  quizFailCooldownMinutes: 0,
  rateLimitWindowMinutes: 15,
  maxSubmissionsPerIp: 50,
  maxSubmissionsPerQq: 20,
  maxSubmissionsPerMinecraftId: 5,
};

export const defaultRconCommandSafety = {
  customCommandsEnabled: true,
  blockedCommands: ['stop', 'op', 'deop', 'ban', 'pardon', 'whitelist off'],
};

const fallbackRconConfig: RuntimeRconConfig = {
  ...env.rcon,
  ...defaultRconCommandSafety,
};

type StoredRconConfig = Omit<RuntimeRconConfig, 'password'> & {
  encryptedPassword: string;
};

function normalizeRconConfig(
  rcon: Partial<StoredRconConfig> & {
    encryptedPassword: string;
  },
): StoredRconConfig {
  return {
    enabled: rcon.enabled ?? false,
    host: rcon.host ?? '127.0.0.1',
    port: rcon.port ?? 25_575,
    encryptedPassword: rcon.encryptedPassword,
    timeoutMs: rcon.timeoutMs ?? 5_000,
    whitelistAddCommand:
      rcon.whitelistAddCommand ?? 'whitelist add {minecraftId}',
    whitelistReloadCommand: rcon.whitelistReloadCommand ?? null,
    customCommandsEnabled:
      rcon.customCommandsEnabled ??
      defaultRconCommandSafety.customCommandsEnabled,
    blockedCommands:
      rcon.blockedCommands ?? defaultRconCommandSafety.blockedCommands,
  };
}

interface StoredRuntimeConfig {
  version: 1;
  server?: RuntimeServerConfig;
  site: {
    name: string;
    subtitle: string;
  };
  application?: RuntimeApplicationConfig;
  rcon: StoredRconConfig;
  configuredAt: string;
}

let cachedRuntimeConfig: StoredRuntimeConfig | null | undefined;
let cachedEncryptionKey: Buffer | undefined;

export interface SetupRuntimeConfigInput {
  siteName: string;
  siteSubtitle: string;
  server?: RuntimeServerConfig;
  rcon: RuntimeRconConfig;
  application?: RuntimeApplicationConfig;
}

export interface UpdateRuntimeConfigInput {
  siteName: string;
  siteSubtitle: string;
  server: RuntimeServerConfig;
  rcon: Omit<RuntimeRconConfig, 'password'> & {
    password?: string;
  };
  application: RuntimeApplicationConfig;
}

export function hasRuntimeConfig() {
  return existsSync(runtimeConfigPath);
}

export function getEffectiveHttpPort() {
  return env.portLocked
    ? env.port
    : (readRuntimeConfig()?.server?.port ?? env.port);
}

// A saved port change only takes effect on the next process start.
export const startupHttpPort = getEffectiveHttpPort();

export function saveRuntimeConfig(input: SetupRuntimeConfigInput) {
  ensureDataDirectory();
  const storedConfig: StoredRuntimeConfig = {
    version: 1,
    server: input.server ?? { port: env.port },
    site: {
      name: input.siteName,
      subtitle: input.siteSubtitle,
    },
    application: input.application ?? defaultApplicationConfig,
    rcon: {
      enabled: input.rcon.enabled,
      host: input.rcon.host,
      port: input.rcon.port,
      encryptedPassword: encryptSecret(input.rcon.password),
      timeoutMs: input.rcon.timeoutMs,
      whitelistAddCommand: input.rcon.whitelistAddCommand,
      whitelistReloadCommand: input.rcon.whitelistReloadCommand,
      customCommandsEnabled: input.rcon.customCommandsEnabled,
      blockedCommands: input.rcon.blockedCommands,
    },
    configuredAt: new Date().toISOString(),
  };
  const temporaryPath = `${runtimeConfigPath}.tmp`;

  writeFileSync(temporaryPath, JSON.stringify(storedConfig, null, 2), {
    encoding: 'utf8',
  });
  renameSync(temporaryPath, runtimeConfigPath);
  cachedRuntimeConfig = storedConfig;
}

export function getPublicSiteConfig() {
  const storedConfig = readRuntimeConfig();

  return {
    name: storedConfig?.site.name ?? 'Craft Pass',
    subtitle: storedConfig?.site.subtitle ?? '服务器入服审核',
  };
}

export function getEffectiveRconConfig(): RuntimeRconConfig {
  const storedConfig = readRuntimeConfig();

  if (storedConfig) {
    return {
      enabled: storedConfig.rcon.enabled,
      host: storedConfig.rcon.host,
      port: storedConfig.rcon.port,
      password: decryptSecret(storedConfig.rcon.encryptedPassword),
      timeoutMs: storedConfig.rcon.timeoutMs,
      whitelistAddCommand: storedConfig.rcon.whitelistAddCommand,
      whitelistReloadCommand: storedConfig.rcon.whitelistReloadCommand,
      customCommandsEnabled: storedConfig.rcon.customCommandsEnabled,
      blockedCommands: storedConfig.rcon.blockedCommands,
    };
  }

  return fallbackRconConfig;
}

export function getEffectiveApplicationConfig(): RuntimeApplicationConfig {
  const storedConfig = readRuntimeConfig();

  return storedConfig?.application ?? defaultApplicationConfig;
}

export function getAdminRuntimeConfig() {
  const storedConfig = readRuntimeConfig();
  const rcon = getEffectiveRconConfig();
  const application = getEffectiveApplicationConfig();

  return {
    source: storedConfig ? ('runtime' as const) : ('environment' as const),
    server: {
      port: env.portLocked
        ? env.port
        : (storedConfig?.server?.port ?? env.port),
      activePort: startupHttpPort,
      restartRequired: !env.portLocked &&
        (storedConfig?.server?.port ?? env.port) !== startupHttpPort,
      locked: env.portLocked,
    },
    site: getPublicSiteConfig(),
    application,
    rcon: {
      enabled: rcon.enabled,
      host: rcon.host,
      port: rcon.port,
      passwordConfigured: rcon.password.length > 0,
      timeoutMs: rcon.timeoutMs,
      whitelistAddCommand: rcon.whitelistAddCommand,
      whitelistReloadCommand: rcon.whitelistReloadCommand ?? '',
      customCommandsEnabled: rcon.customCommandsEnabled,
      blockedCommands: rcon.blockedCommands,
    },
  };
}

export function updateRuntimeConfig(input: UpdateRuntimeConfigInput) {
  const currentRconConfig = getEffectiveRconConfig();
  const password = input.rcon.password || currentRconConfig.password;

  if (input.rcon.enabled && !hasMinimumRconPasswordLength(password)) {
    throw new Error(
      `启用 RCON 时必须提供至少 ${minimumRconPasswordLength} 位密码`,
    );
  }

  saveRuntimeConfig({
    siteName: input.siteName,
    siteSubtitle: input.siteSubtitle,
    server: env.portLocked ? { port: env.port } : input.server,
    application: input.application,
    rcon: {
      ...input.rcon,
      password,
    },
  });

  return getAdminRuntimeConfig();
}

export function getOrCreateSetupToken() {
  if (env.setupToken) {
    return {
      token: env.setupToken,
      generated: false,
    };
  }

  ensureDataDirectory();

  if (existsSync(setupTokenPath)) {
    return {
      token: readFileSync(setupTokenPath, 'utf8').trim(),
      generated: true,
    };
  }

  const token = randomBytes(24).toString('base64url');
  writeFileSync(setupTokenPath, token, {
    encoding: 'utf8',
    flag: 'wx',
  });

  return {
    token,
    generated: true,
  };
}

export function verifySetupToken(candidate: string) {
  const expected = getOrCreateSetupToken().token;
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);

  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  );
}

export function consumeGeneratedSetupToken() {
  if (!env.setupToken) {
    rmSync(setupTokenPath, { force: true });
  }
}

export function resetRuntimeConfigFiles() {
  rmSync(runtimeConfigPath, { force: true });
  rmSync(setupTokenPath, { force: true });
  rmSync(encryptionKeyPath, { force: true });
  cachedRuntimeConfig = null;
  cachedEncryptionKey = undefined;
}

function readRuntimeConfig(): StoredRuntimeConfig | null {
  if (cachedRuntimeConfig !== undefined) {
    return cachedRuntimeConfig;
  }

  if (!existsSync(runtimeConfigPath)) {
    cachedRuntimeConfig = null;
    return cachedRuntimeConfig;
  }

  const parsed = JSON.parse(
    readFileSync(runtimeConfigPath, 'utf8'),
  ) as StoredRuntimeConfig;

  if (parsed.version !== 1) {
    throw new Error('不支持的运行时配置版本');
  }

  cachedRuntimeConfig = {
    ...parsed,
    application: parsed.application ?? defaultApplicationConfig,
    rcon: normalizeRconConfig(parsed.rcon),
  };
  return cachedRuntimeConfig;
}

function encryptSecret(value: string) {
  if (!value) {
    return '';
  }

  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);

  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

function decryptSecret(value: string) {
  if (!value) {
    return '';
  }

  const [version, iv, authTag, encrypted] = value.split(':');

  if (version !== 'v1' || !iv || !authTag || !encrypted) {
    throw new Error('RCON 密码密文格式无效');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function getEncryptionKey() {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  if (env.appSecret) {
    cachedEncryptionKey = createHash('sha256').update(env.appSecret).digest();
    return cachedEncryptionKey;
  }

  ensureDataDirectory();

  if (!existsSync(encryptionKeyPath)) {
    writeFileSync(encryptionKeyPath, randomBytes(32).toString('base64url'), {
      encoding: 'utf8',
      flag: 'wx',
    });
  }

  cachedEncryptionKey = createHash('sha256')
    .update(readFileSync(encryptionKeyPath, 'utf8').trim())
    .digest();
  return cachedEncryptionKey;
}

export function getApplicationSigningKey() {
  return Buffer.from(getEncryptionKey());
}

function ensureDataDirectory() {
  mkdirSync(dirname(runtimeConfigPath), { recursive: true });
}
