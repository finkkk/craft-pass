import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const backendDirectory = path.join(projectDirectory, 'backend');
const prismaConfigPath = path.join(backendDirectory, 'prisma.config.ts');
const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/craft-pass.db';

if (!databaseUrl.startsWith('file:')) {
  throw new Error('DATABASE_URL must use the file: scheme for SQLite.');
}

const configuredDatabasePath = databaseUrl.slice('file:'.length);
const databasePath = path.isAbsolute(configuredDatabasePath)
  ? configuredDatabasePath
  : path.resolve(backendDirectory, configuredDatabasePath);

try {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  closeSync(openSync(databasePath, 'a'));
} catch (error) {
  if (error?.code === 'EACCES') {
    const uid =
      typeof process.getuid === 'function' ? process.getuid() : 'unknown';
    throw new Error(
      `The SQLite data path is not writable by the container user (uid=${uid}): ${databasePath}. ` +
        'When using Docker Compose, run "docker compose up" so the data-init service can repair bind-mount ownership.',
      { cause: error },
    );
  }
  throw error;
}

if (!existsSync(prismaConfigPath)) {
  throw new Error(
    `Prisma config is missing from the runtime image: ${prismaConfigPath}`,
  );
}

const prismaCli = path.join(
  backendDirectory,
  'node_modules',
  'prisma',
  'build',
  'index.js',
);
const migration = spawnSync(
  process.execPath,
  [prismaCli, 'migrate', 'deploy', '--config', prismaConfigPath],
  {
    cwd: backendDirectory,
    env: process.env,
    stdio: 'inherit',
  },
);

if (migration.error) {
  throw migration.error;
}
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

await import('../backend/dist/server.js');
