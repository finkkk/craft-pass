import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export async function createAdminSession(
  adminId: string,
  metadata: SessionMetadata,
) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + env.adminSessionTtlHours * 60 * 60 * 1_000,
  );

  await prisma.adminSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  await prisma.adminSession.create({
    data: {
      tokenHash,
      adminId,
      expiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function authenticateAdminSession(token: string) {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.adminSession.findUnique({
    where: {
      tokenHash,
    },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.adminSession.delete({
      where: {
        id: session.id,
      },
    });
    return null;
  }

  await prisma.adminSession.update({
    where: {
      id: session.id,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });

  return session;
}

export async function deleteAdminSession(token: string) {
  await prisma.adminSession.deleteMany({
    where: {
      tokenHash: hashSessionToken(token),
    },
  });
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
