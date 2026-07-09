import Database from 'better-sqlite3';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const dataDirectory = resolve(backendDirectory, 'data');
const migrationsDirectory = resolve(backendDirectory, 'prisma/migrations');
const testDatabasePath = resolve(
  dataDirectory,
  `craft-pass-test-${process.pid}-${Date.now()}.db`,
);
const testRuntimeDirectory = resolve(
  dataDirectory,
  `craft-pass-runtime-test-${process.pid}-${Date.now()}`,
);

mkdirSync(dataDirectory, { recursive: true });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${testDatabasePath}`;
process.env.RATE_LIMIT_MAX = '1000';
process.env.RCON_ENABLED = 'false';
process.env.RUNTIME_DATA_DIR = testRuntimeDirectory;
process.env.SETUP_TOKEN = 'test-setup-token-1234567890';
process.env.APP_SECRET = 'test-app-secret-at-least-thirty-two-characters';

const database = new Database(testDatabasePath);

try {
  database.pragma('foreign_keys = ON');

  const migrationDirectories = readdirSync(migrationsDirectory, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationDirectory of migrationDirectories) {
    const migrationSql = readFileSync(
      resolve(migrationsDirectory, migrationDirectory, 'migration.sql'),
      'utf8',
    );
    database.exec(migrationSql);
  }
} finally {
  database.close();
}

export async function cleanupTestDatabase() {
  const { prisma } = await import('../src/lib/prisma.js');
  await prisma.$disconnect();

  for (const suffix of ['', '-shm', '-wal']) {
    rmSync(`${testDatabasePath}${suffix}`, { force: true });
  }
  rmSync(testRuntimeDirectory, { force: true, recursive: true });
}
