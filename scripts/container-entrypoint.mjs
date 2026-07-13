import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const backendDirectory = path.join(projectDirectory, 'backend');
const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/craft-pass.db';

if (!databaseUrl.startsWith('file:')) {
  throw new Error('DATABASE_URL must use the file: scheme for SQLite.');
}

const configuredDatabasePath = databaseUrl.slice('file:'.length);
const databasePath = path.isAbsolute(configuredDatabasePath)
  ? configuredDatabasePath
  : path.resolve(backendDirectory, configuredDatabasePath);

mkdirSync(path.dirname(databasePath), { recursive: true });
closeSync(openSync(databasePath, 'a'));

const prismaCli = path.join(
  backendDirectory,
  'node_modules',
  'prisma',
  'build',
  'index.js',
);
const migration = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: backendDirectory,
  env: process.env,
  stdio: 'inherit',
});

if (migration.error) {
  throw migration.error;
}
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

await import('../backend/dist/server.js');

