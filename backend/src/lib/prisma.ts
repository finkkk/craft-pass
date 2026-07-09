import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const databaseUrl = resolveSqliteUrl(env.databaseUrl);
  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

function resolveSqliteUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const databasePath = databaseUrl.slice('file:'.length);

  if (databaseUrl.startsWith('file://')) {
    return `file:${fileURLToPath(databaseUrl)}`;
  }

  if (isAbsolute(databasePath)) {
    return databaseUrl;
  }

  const backendDirectory = fileURLToPath(new URL('../../', import.meta.url));
  return `file:${resolve(backendDirectory, databasePath)}`;
}
