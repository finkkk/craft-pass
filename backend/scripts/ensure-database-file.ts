import Database from 'better-sqlite3';
import { config as loadDotEnv } from 'dotenv';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
loadDotEnv({
  path: resolve(backendDirectory, '.env'),
  quiet: true,
});

const databaseUrl =
  process.env.DATABASE_URL ?? 'file:./data/craft-pass.db';

if (!databaseUrl.startsWith('file:')) {
  throw new Error('SQLite DATABASE_URL 必须以 file: 开头');
}

const configuredPath = databaseUrl.slice('file:'.length);
const databasePath = isAbsolute(configuredPath)
  ? configuredPath
  : resolve(backendDirectory, configuredPath);

mkdirSync(dirname(databasePath), { recursive: true });

if (!existsSync(databasePath)) {
  const database = new Database(databasePath);
  database.close();
  console.log(`已创建 SQLite 数据库文件：${databasePath}`);
}
