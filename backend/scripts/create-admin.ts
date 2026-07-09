import { hash } from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { adminPasswordSchema } from '../src/schemas/admin.js';

const username = process.env.ADMIN_USERNAME?.trim();
const password = process.env.ADMIN_PASSWORD;

try {
  if (!username || !/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
    throw new Error(
      'ADMIN_USERNAME 必须是 3 至 32 位英文、数字、下划线或连字符',
    );
  }

  const passwordResult = adminPasswordSchema.safeParse(password);

  if (!passwordResult.success) {
    throw new Error(
      `ADMIN_PASSWORD 不符合要求：${passwordResult.error.issues
        .map((issue) => issue.message)
        .join('；')}`,
    );
  }

  const existingAdmin = await prisma.admin.findUnique({
    where: {
      username,
    },
  });

  if (existingAdmin) {
    throw new Error(`管理员 ${username} 已存在，未修改现有密码`);
  }

  const passwordHash = await hash(passwordResult.data, 12);

  await prisma.admin.create({
    data: {
      username,
      passwordHash,
    },
  });

  console.log(`管理员 ${username} 创建成功`);
} finally {
  await prisma.$disconnect();
}
