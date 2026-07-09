import { hash } from 'bcryptjs';
import {
  consumeGeneratedSetupToken,
  getOrCreateSetupToken,
  getPublicSiteConfig,
  hasRuntimeConfig,
  saveRuntimeConfig,
  verifySetupToken,
} from '../config/runtimeConfig.js';
import { prisma } from '../lib/prisma.js';
import type { z } from 'zod';
import type { completeSetupSchema } from '../schemas/setup.js';
import { env } from '../config/env.js';

type CompleteSetupInput = z.infer<typeof completeSetupSchema>;

export async function getSetupStatus() {
  const adminCount = await prisma.admin.count();

  return {
    setupRequired: adminCount === 0,
    runtimeConfigPresent: hasRuntimeConfig(),
    site: getPublicSiteConfig(),
  };
}

export async function initializeSetupBootstrap() {
  const status = await getSetupStatus();

  if (!status.setupRequired) {
    return;
  }

  const setupToken = getOrCreateSetupToken();

  console.log('');
  console.log('======================================================');
  console.log('Craft Pass 尚未初始化');
  if (setupToken.generated) {
    console.log(
      `打开 http://localhost:${env.port}/setup，并输入部署令牌：${setupToken.token}`,
    );
  } else {
    console.log(
      `打开 http://localhost:${env.port}/setup，并输入环境变量 SETUP_TOKEN 的值。`,
    );
  }
  console.log('完成初始化后，该令牌与部署入口将自动失效。');
  console.log('======================================================');
  console.log('');
}

export async function completeSetup(input: CompleteSetupInput) {
  const adminCount = await prisma.admin.count();

  if (adminCount > 0) {
    throw new SetupError('SETUP_ALREADY_COMPLETED', '系统已经完成初始化');
  }

  if (!verifySetupToken(input.setupToken)) {
    throw new SetupError('INVALID_SETUP_TOKEN', '部署令牌不正确');
  }

  saveRuntimeConfig({
    siteName: input.siteName,
    siteSubtitle: input.siteSubtitle,
    rcon: {
      enabled: input.rcon.enabled,
      host: input.rcon.host,
      port: input.rcon.port,
      password: input.rcon.password,
      timeoutMs: input.rcon.timeoutMs,
      whitelistAddCommand: input.rcon.whitelistAddCommand,
      whitelistReloadCommand:
        input.rcon.whitelistReloadCommand || null,
    },
  });

  const passwordHash = await hash(input.admin.password, 12);
  const admin = await prisma.$transaction(async (transaction) => {
    if ((await transaction.admin.count()) > 0) {
      throw new SetupError(
        'SETUP_ALREADY_COMPLETED',
        '系统已经完成初始化',
      );
    }

    return transaction.admin.create({
      data: {
        username: input.admin.username,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
  });

  consumeGeneratedSetupToken();

  return {
    admin,
    site: getPublicSiteConfig(),
  };
}

export class SetupError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SetupError';
  }
}
