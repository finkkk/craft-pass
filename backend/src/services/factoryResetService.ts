import {
  getOrCreateSetupToken,
  resetRuntimeConfigFiles,
} from '../config/runtimeConfig.js';
import { resetContentConfig } from '../config/contentConfig.js';
import { prisma } from '../lib/prisma.js';
import { deleteSiteLogo } from './siteLogoService.js';

export async function factoryReset() {
  await prisma.$transaction([
    prisma.rconAttempt.deleteMany(),
    prisma.adminLog.deleteMany(),
    prisma.adminSession.deleteMany(),
    prisma.application.deleteMany(),
    prisma.admin.deleteMany(),
  ]);

  resetRuntimeConfigFiles();
  resetContentConfig();
  deleteSiteLogo();

  return {
    setupToken: getOrCreateSetupToken().token,
  };
}
