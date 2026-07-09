import {
  AdminAction,
  ApplicationStatus,
  RconAttemptStatus,
} from '../generated/prisma/enums.js';
import { getEffectiveRconConfig } from '../config/runtimeConfig.js';
import { prisma } from '../lib/prisma.js';
import {
  rconExecutor,
  type RconExecutor,
} from './rconService.js';

interface ReviewMetadata {
  ipAddress?: string;
}

export async function rejectApplication(
  applicationId: string,
  adminId: string,
  reason: string,
  metadata: ReviewMetadata,
) {
  await prisma.$transaction(async (transaction) => {
    const application = await transaction.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new ReviewOperationError(
        'APPLICATION_NOT_FOUND',
        '申请记录不存在',
      );
    }

    if (application.status !== ApplicationStatus.PENDING_REVIEW) {
      throw new ReviewOperationError(
        'INVALID_APPLICATION_STATE',
        '当前申请状态不允许执行该操作',
      );
    }

    const pendingRconAttempt = await transaction.rconAttempt.findFirst({
      where: {
        applicationId,
        status: RconAttemptStatus.PENDING,
      },
    });

    if (pendingRconAttempt) {
      throw new ReviewOperationError(
        'RCON_OPERATION_IN_PROGRESS',
        'RCON 正在执行，暂时不能拒绝该申请',
      );
    }

    await transaction.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.REJECTED,
        reviewerId: adminId,
        reviewedAt: new Date(),
        rejectReason: reason,
      },
    });

    await transaction.adminLog.create({
      data: {
        adminId,
        action: AdminAction.REJECT_APPLICATION,
        targetApplicationId: applicationId,
        detail: { reason },
        ipAddress: metadata.ipAddress,
      },
    });
  });

  return prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
  });
}

export function approveApplication(
  applicationId: string,
  adminId: string,
  metadata: ReviewMetadata,
  executor: RconExecutor = rconExecutor,
) {
  return executeWhitelistReview(
    applicationId,
    adminId,
    ApplicationStatus.PENDING_REVIEW,
    AdminAction.APPROVE_APPLICATION,
    metadata,
    executor,
  );
}

export function retryApplicationRcon(
  applicationId: string,
  adminId: string,
  metadata: ReviewMetadata,
  executor: RconExecutor = rconExecutor,
) {
  return executeWhitelistReview(
    applicationId,
    adminId,
    ApplicationStatus.RCON_FAILED,
    AdminAction.RETRY_RCON,
    metadata,
    executor,
  );
}

async function executeWhitelistReview(
  applicationId: string,
  adminId: string,
  requiredStatus: ApplicationStatus,
  successAction: AdminAction,
  metadata: ReviewMetadata,
  executor: RconExecutor,
) {
  if (executor === rconExecutor && !getEffectiveRconConfig().enabled) {
    throw new ReviewOperationError(
      'RCON_NOT_CONFIGURED',
      'RCON 尚未在后端启用或配置',
    );
  }

  const { application, attempt } = await prisma.$transaction(
    async (transaction) => {
      const target = await transaction.application.findUnique({
        where: { id: applicationId },
      });

      if (!target) {
        throw new ReviewOperationError(
          'APPLICATION_NOT_FOUND',
          '申请记录不存在',
        );
      }

      if (target.status !== requiredStatus) {
        throw new ReviewOperationError(
          'INVALID_APPLICATION_STATE',
          '当前申请状态不允许执行该操作',
        );
      }

      const pendingAttempt = await transaction.rconAttempt.findFirst({
        where: {
          applicationId,
          status: RconAttemptStatus.PENDING,
        },
      });

      if (pendingAttempt) {
        throw new ReviewOperationError(
          'RCON_OPERATION_IN_PROGRESS',
          '该申请已有 RCON 操作正在执行',
        );
      }

      const createdAttempt = await transaction.rconAttempt.create({
        data: {
          applicationId,
          adminId,
          status: RconAttemptStatus.PENDING,
        },
      });

      return {
        application: target,
        attempt: createdAttempt,
      };
    },
  );

  try {
    const result = await executor.addToWhitelist(application.minecraftId);
    const finishedAt = new Date();

    await prisma.$transaction([
      prisma.rconAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RconAttemptStatus.SUCCEEDED,
          response: formatRconResult(result),
          finishedAt,
        },
      }),
      prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.WHITELISTED,
          reviewerId: adminId,
          reviewedAt: finishedAt,
          rejectReason: null,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: successAction,
          targetApplicationId: applicationId,
          detail: {
            command: result.command,
            response: result.response,
          },
          ipAddress: metadata.ipAddress,
        },
      }),
    ]);

    return prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
    });
  } catch (error) {
    const message = getSafeErrorMessage(error);
    const finishedAt = new Date();

    await prisma.$transaction([
      prisma.rconAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RconAttemptStatus.FAILED,
          errorMessage: message,
          finishedAt,
        },
      }),
      prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.RCON_FAILED,
          reviewerId: adminId,
          reviewedAt: finishedAt,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: AdminAction.RCON_FAILED,
          targetApplicationId: applicationId,
          detail: { error: message },
          ipAddress: metadata.ipAddress,
        },
      }),
    ]);

    throw new ReviewOperationError(
      'RCON_EXECUTION_FAILED',
      'RCON 执行失败，申请已标记为等待重试',
      message,
    );
  }
}

function formatRconResult(result: {
  command: string;
  response: string;
  reloadResponse?: string;
}) {
  return JSON.stringify(result);
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2_000);
  }

  return '未知 RCON 错误';
}

export class ReviewOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'ReviewOperationError';
  }
}
