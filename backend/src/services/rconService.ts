import RconModule from 'rcon-srcds';
import { getEffectiveRconConfig } from '../config/runtimeConfig.js';
import { withTimeout } from '../utils/promiseTimeout.js';

const Rcon = RconModule.default;
export const maximumRconStatusTimeoutMs = 5_000;

export interface RconWhitelistResult {
  command: string;
  response: string;
  reloadResponse?: string;
}

export interface RconCommandResult {
  command: string;
  response: string;
  executedAt: string;
}

export interface RconConnectionStatus {
  enabled: boolean;
  connected: boolean;
  errorMessage: string | null;
  whitelistAddCommandConfigured: boolean;
  reloadAfterAdd: boolean;
  customCommandsEnabled: boolean;
}

export interface RconExecutor {
  addToWhitelist(minecraftId: string): Promise<RconWhitelistResult>;
}

export class MinecraftRconExecutor implements RconExecutor {
  async addToWhitelist(minecraftId: string) {
    const rconConfig = getEffectiveRconConfig();

    if (!rconConfig.enabled) {
      throw new RconNotConfiguredError();
    }

    if (!/^[A-Za-z0-9_]{3,16}$/.test(minecraftId)) {
      throw new Error('数据库中的 Minecraft ID 格式无效');
    }

    const command = rconConfig.whitelistAddCommand.replaceAll(
      '{minecraftId}',
      minecraftId,
    );
    return withAuthenticatedRconClient(async (client) => {
      const rawResponse = await client.execute(command);
      const response = normalizeRconResponse(rawResponse);
      let reloadResponse: string | undefined;

      if (rconConfig.whitelistReloadCommand) {
        reloadResponse = normalizeRconResponse(
          await client.execute(rconConfig.whitelistReloadCommand),
        );
      }

      return {
        command,
        response,
        reloadResponse,
      };
    });
  }
}

export async function executeRconCommand(
  command: string,
): Promise<RconCommandResult> {
  const rconConfig = getEffectiveRconConfig();

  if (!rconConfig.enabled) {
    throw new RconNotConfiguredError();
  }

  if (!rconConfig.customCommandsEnabled) {
    throw new RconCustomCommandsDisabledError();
  }

  const normalizedCommand = command.trim();

  if (!normalizedCommand || /[\r\n]/.test(normalizedCommand)) {
    throw new Error('RCON 命令不能为空，且不能包含换行');
  }

  const blockedCommand = findBlockedCommand(
    normalizedCommand,
    rconConfig.blockedCommands,
  );

  if (blockedCommand) {
    throw new RconCommandBlockedError(blockedCommand);
  }

  const response = await withAuthenticatedRconClient((client) =>
    client.execute(normalizedCommand),
  );

  return {
    command: normalizedCommand,
    response: normalizeRconResponse(response),
    executedAt: new Date().toISOString(),
  };
}

export async function getRconConnectionStatus(): Promise<RconConnectionStatus> {
  const configurationStatus = getRconConfigurationStatus();

  if (!configurationStatus.enabled) {
    return {
      ...configurationStatus,
      connected: false,
      errorMessage: 'RCON 尚未启用',
    };
  }

  try {
    await withAuthenticatedRconClient(
      async () => true,
      maximumRconStatusTimeoutMs,
    );

    return {
      ...configurationStatus,
      connected: true,
      errorMessage: null,
    };
  } catch (error) {
    return {
      ...configurationStatus,
      connected: false,
      errorMessage: getSafeRconErrorMessage(error),
    };
  }
}

export class RconNotConfiguredError extends Error {
  constructor() {
    super('RCON 尚未在后端启用或配置');
    this.name = 'RconNotConfiguredError';
  }
}

export class RconCustomCommandsDisabledError extends Error {
  constructor() {
    super('自定义 RCON 命令已在系统配置中关闭');
    this.name = 'RconCustomCommandsDisabledError';
  }
}

export class RconCommandBlockedError extends Error {
  constructor(readonly blockedCommand: string) {
    super(`命令被危险命令黑名单拦截：${blockedCommand}`);
    this.name = 'RconCommandBlockedError';
  }
}

export const rconExecutor = new MinecraftRconExecutor();

export function getRconConfigurationStatus() {
  const config = getEffectiveRconConfig();

  return {
    enabled: config.enabled,
    whitelistAddCommandConfigured:
      config.whitelistAddCommand.includes('{minecraftId}'),
    reloadAfterAdd: Boolean(config.whitelistReloadCommand),
    customCommandsEnabled: config.customCommandsEnabled,
  };
}

async function withAuthenticatedRconClient<T>(
  operation: (client: InstanceType<typeof Rcon>) => Promise<T>,
  maximumTimeoutMs = Number.POSITIVE_INFINITY,
) {
  const rconConfig = getEffectiveRconConfig();
  const timeoutMs = Math.min(rconConfig.timeoutMs, maximumTimeoutMs);
  const client = new Rcon({
    host: rconConfig.host,
    port: rconConfig.port,
    encoding: 'utf8',
    timeout: rconConfig.timeoutMs,
  });

  try {
    return await withTimeout(
      (async () => {
        const authenticated = await client.authenticate(rconConfig.password);

        if (!authenticated) {
          throw new Error('RCON 身份验证失败');
        }

        return operation(client);
      })(),
      timeoutMs,
      `RCON 连接或响应超时（${timeoutMs}ms）`,
      () => client.connection?.destroy(),
    );
  } finally {
    // rcon-srcds sets a socket timeout but does not handle the timeout event,
    // so its Promise can otherwise remain pending forever. This client is not
    // reused; destroying the socket is also safe after successful operations.
    client.connection?.destroy();
  }
}

function normalizeRconResponse(response: string | boolean) {
  return typeof response === 'string' ? response : String(response);
}

function getSafeRconErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2_000);
  }

  return '未知 RCON 错误';
}

function findBlockedCommand(
  command: string,
  blockedCommands: readonly string[],
) {
  const normalizedCommand = normalizeCommandForSafety(command);

  return blockedCommands.find((blockedCommand) => {
    const normalizedBlockedCommand = normalizeCommandForSafety(blockedCommand);

    return (
      normalizedCommand === normalizedBlockedCommand ||
      normalizedCommand.startsWith(`${normalizedBlockedCommand} `)
    );
  });
}

function normalizeCommandForSafety(command: string) {
  return command.trim().replace(/^\/+/, '').replace(/\s+/g, ' ').toLowerCase();
}
