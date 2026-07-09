import RconModule from 'rcon-srcds';
import { getEffectiveRconConfig } from '../config/runtimeConfig.js';

const Rcon = RconModule.default;

export interface RconWhitelistResult {
  command: string;
  response: string;
  reloadResponse?: string;
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
    const client = new Rcon({
      host: rconConfig.host,
      port: rconConfig.port,
      encoding: 'utf8',
      timeout: rconConfig.timeoutMs,
    });

    try {
      const authenticated = await client.authenticate(rconConfig.password);

      if (!authenticated) {
        throw new Error('RCON 身份验证失败');
      }

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
    } finally {
      if (client.isConnected()) {
        await client.disconnect().catch(() => undefined);
      }
    }
  }
}

export class RconNotConfiguredError extends Error {
  constructor() {
    super('RCON 尚未在后端启用或配置');
    this.name = 'RconNotConfiguredError';
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
  };
}

function normalizeRconResponse(response: string | boolean) {
  return typeof response === 'string' ? response : String(response);
}
