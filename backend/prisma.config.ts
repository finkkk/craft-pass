import { config as loadDotEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadDotEnv({ path: '.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./data/craft-pass.db',
  },
});
