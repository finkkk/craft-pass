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

const activeApplicationStatuses = [
  ApplicationStatus.PENDING_REVIEW,
  ApplicationStatus.WHITELISTED,
  ApplicationStatus.RCON_FAILED,
] as const;

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

    if (
      activeApplicationStatuses.some(
        (status) => status === current.status,
      )
    ) {
      const duplicate = await transaction.application.findFirst({
        where: {
          id: { not: applicationId },
          minecraftIdNormalized,
          status: { in: [...activeApplicationStatuses] },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ApplicationRecordOperationError(
          'ACTIVE_APPLICATION_EXISTS',
          '该 Minecraft ID 已存在有效申请',
        );
      }
    }

    const updated = await transaction.application.update({
      where: { id: applicationId },
      data: {
        qqNumber: input.qqNumber,
        minecraftId: input.minecraftId,
        minecraftIdNormalized,
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
      | 'ACTIVE_APPLICATION_EXISTS'
      | 'RCON_OPERATION_IN_PROGRESS',
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationRecordOperationError';
  }
}
