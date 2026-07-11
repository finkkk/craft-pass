import {
  AdminAction,
  ApplicationStatus,
  RconAttemptStatus,
} from '../generated/prisma/enums.js';
import { prisma } from '../lib/prisma.js';
import type { UpdateAdminApplicationBody } from '../schemas/admin.js';

const statusMap = {
  quiz_failed: ApplicationStatus.QUIZ_FAILED,
  pending_review: ApplicationStatus.PENDING_REVIEW,
  rejected: ApplicationStatus.REJECTED,
  whitelisted: ApplicationStatus.WHITELISTED,
  rcon_failed: ApplicationStatus.RCON_FAILED,
} as const;

export type PublicApplicationStatus = keyof typeof statusMap;

export function parsePublicApplicationStatus(value: unknown) {
  if (typeof value !== 'string' || !(value in statusMap)) {
    return null;
  }

  return value as PublicApplicationStatus;
}

export async function listAdminApplications(
  status: PublicApplicationStatus,
) {
  return prisma.application.findMany({
    where: {
      status: statusMap[status],
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
    select: {
      id: true,
      qqNumber: true,
      minecraftId: true,
      score: true,
      agreementVersion: true,
      ipAddress: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewer: {
        select: {
          username: true,
        },
      },
    },
  });
}

export function getAdminApplication(applicationId: string) {
  return prisma.application.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      reviewer: {
        select: {
          id: true,
          username: true,
        },
      },
      rconAttempts: {
        orderBy: {
          startedAt: 'desc',
        },
        include: {
          admin: {
            select: {
              username: true,
            },
          },
        },
      },
    },
  });
}

export async function getAdminDashboardSummary() {
  const [
    pendingReview,
    whitelisted,
    rejected,
    quizFailed,
    rconFailed,
  ] = await prisma.$transaction([
    prisma.application.count({
      where: { status: ApplicationStatus.PENDING_REVIEW },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.WHITELISTED },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.REJECTED },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.QUIZ_FAILED },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.RCON_FAILED },
    }),
  ]);

  return {
    pendingReview,
    whitelisted,
    rejected,
    quizFailed,
    rconFailed,
  };
}

interface AdminRecordOperationMetadata {
  ipAddress?: string;
}

export async function updateAdminApplication(
  applicationId: string,
  input: UpdateAdminApplicationBody,
  adminId: string,
  metadata: AdminRecordOperationMetadata,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.application.findUnique({
      where: { id: applicationId },
    });

    if (!current) {
      throw new ApplicationRecordOperationError(
        'APPLICATION_NOT_FOUND',
        '申请记录不存在',
      );
    }

    const pendingRconAttempt = await transaction.rconAttempt.findFirst({
      where: {
        applicationId,
        status: RconAttemptStatus.PENDING,
      },
      select: { id: true },
    });

    if (pendingRconAttempt) {
      throw new ApplicationRecordOperationError(
        'RCON_OPERATION_IN_PROGRESS',
        'RCON 正在执行，暂时不能修改申请记录',
      );
    }

    const minecraftIdNormalized = input.minecraftId.toLowerCase();

    const conflicts = await transaction.application.findMany({
      where: {
        id: { not: applicationId },
        OR: [
          { qqNumber: input.qqNumber },
          { minecraftIdNormalized },
        ],
      },
      select: {
        qqNumber: true,
        minecraftIdNormalized: true,
      },
      take: 2,
    });

    if (conflicts.length > 0) {
      const qqNumberDuplicate = conflicts.some(
        (item) => item.qqNumber === input.qqNumber,
      );
      const minecraftIdDuplicate = conflicts.some(
        (item) => item.minecraftIdNormalized === minecraftIdNormalized,
      );
      const label = qqNumberDuplicate && minecraftIdDuplicate
        ? 'QQ 号和 Minecraft ID'
        : qqNumberDuplicate
          ? 'QQ 号'
          : 'Minecraft ID';
      throw new ApplicationRecordOperationError(
        'IDENTITY_CONFLICT',
        `${label}已被其他申请记录占用`,
      );
    }

    const updated = await transaction.application.update({
      where: { id: applicationId },
      data: {
        qqNumber: input.qqNumber,
        minecraftId: input.minecraftId,
        minecraftIdNormalized,
        identityLocked: true,
      },
    });

    await transaction.adminLog.create({
      data: {
        adminId,
        action: AdminAction.UPDATE_APPLICATION,
        targetApplicationId: applicationId,
        ipAddress: metadata.ipAddress,
        detail: {
          before: {
            qqNumber: current.qqNumber,
            minecraftId: current.minecraftId,
          },
          after: {
            qqNumber: updated.qqNumber,
            minecraftId: updated.minecraftId,
          },
          status: current.status,
        },
      },
    });

    return updated;
  });
}

export async function deleteAdminApplication(
  applicationId: string,
  adminId: string,
  metadata: AdminRecordOperationMetadata,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        qqNumber: true,
        minecraftId: true,
        score: true,
        status: true,
        createdAt: true,
      },
    });

    if (!current) {
      throw new ApplicationRecordOperationError(
        'APPLICATION_NOT_FOUND',
        '申请记录不存在',
      );
    }

    const pendingRconAttempt = await transaction.rconAttempt.findFirst({
      where: {
        applicationId,
        status: RconAttemptStatus.PENDING,
      },
      select: { id: true },
    });

    if (pendingRconAttempt) {
      throw new ApplicationRecordOperationError(
        'RCON_OPERATION_IN_PROGRESS',
        'RCON 正在执行，暂时不能删除申请记录',
      );
    }

    await transaction.application.delete({
      where: { id: applicationId },
    });

    await transaction.adminLog.create({
      data: {
        adminId,
        action: AdminAction.DELETE_APPLICATION,
        ipAddress: metadata.ipAddress,
        detail: {
          deletedApplication: {
            id: current.id,
            qqNumber: current.qqNumber,
            minecraftId: current.minecraftId,
            score: current.score,
            status: current.status,
            createdAt: current.createdAt.toISOString(),
          },
        },
      },
    });
  });
}

export class ApplicationRecordOperationError extends Error {
  constructor(
    readonly code:
      | 'APPLICATION_NOT_FOUND'
      | 'IDENTITY_CONFLICT'
      | 'RCON_OPERATION_IN_PROGRESS',
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationRecordOperationError';
  }
}
