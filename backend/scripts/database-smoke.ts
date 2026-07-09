import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';

const expectedTables = new Set([
  '_prisma_migrations',
  'admin_logs',
  'admin_sessions',
  'admins',
  'applications',
  'rcon_attempts',
]);

try {
  const tables = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `;
  const tableNames = new Set(tables.map((table) => table.name));

  for (const tableName of expectedTables) {
    assert.equal(
      tableNames.has(tableName),
      true,
      `数据库缺少数据表：${tableName}`,
    );
  }

  console.log('SQLite 数据库连接与表结构检查通过');
} finally {
  await prisma.$disconnect();
}
