import { getContentConfig } from '../config/contentConfig.js';
import { getEffectiveApplicationConfig } from '../config/runtimeConfig.js';
import {
  ApplicationStatus,
  type Prisma,
} from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import type { CreateApplicationBody } from '../schemas/application.js';
import { gradeQuiz } from './quizService.js';
import { resolveQuizQuestionIds } from './quizSelectionService.js';

export interface ApplicationRequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export async function createApplication(
  input: CreateApplicationBody,
  metadata: ApplicationRequestMetadata,
) {
  const agreement = getContentConfig().agreement;

  if (input.agreementVersion !== agreement.version) {
    throw new AgreementVersionOutdatedError();
  }

  await assertIdentityAvailable(input.qqNumber, input.minecraftId);
  await assertApplicationSubmissionAllowed(input, metadata);

  const questionIds = resolveQuizQuestionIds(input.quizToken, input.answers);
  const quizResult = gradeQuiz(input.answers, questionIds);
  const status = quizResult.passed
    ? ApplicationStatus.PENDING_REVIEW
    : ApplicationStatus.QUIZ_FAILED;
  const minecraftIdNormalized = input.minecraftId.toLowerCase();
  const answersJson: Prisma.InputJsonValue = {
    version: 1,
    answers: quizResult.answers.map((answer) => ({
      questionId: answer.questionId,
      questionPrompt: answer.questionPrompt,
      selectedOptionId: answer.selectedOptionId,
      selectedOptionText: answer.selectedOptionText,
      isCorrect: answer.isCorrect,
    })),
  };

  try {
    return await prisma.$transaction(async (transaction) => {
      const conflicts = await transaction.application.findMany({
      where: {
        status: { not: ApplicationStatus.QUIZ_FAILED },
        OR: [{ qqNumber: input.qqNumber }, { minecraftIdNormalized }],
      },
      select: {
        qqNumber: true,
        minecraftIdNormalized: true,
      },
      take: 2,
    });

      if (conflicts.length > 0) {
        throw buildIdentityConflict(
          conflicts,
          input.qqNumber,
          minecraftIdNormalized,
        );
      }

      return transaction.application.create({
        data: {
          qqNumber: input.qqNumber,
          minecraftId: input.minecraftId,
          minecraftIdNormalized,
          score: quizResult.score,
          passedQuiz: quizResult.passed,
          status,
          agreementVersion: agreement.version,
          signedAt: new Date(),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          answersJson,
          identityLocked: quizResult.passed,
        },
        select: {
          id: true,
          minecraftId: true,
          qqNumber: true,
          score: true,
          passedQuiz: true,
          status: true,
          createdAt: true,
        },
      });
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      await assertIdentityAvailable(input.qqNumber, input.minecraftId);
    }
    throw error;
  }
}

export async function queryApplicationStatus(
  qqNumber: string,
  minecraftId: string,
) {
  return prisma.application.findFirst({
    where: {
      qqNumber,
      minecraftIdNormalized: minecraftId.toLowerCase(),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      minecraftId: true,
      status: true,
      score: true,
      rejectReason: true,
      createdAt: true,
      reviewedAt: true,
    },
  });
}

export async function assertIdentityAvailable(
  qqNumber: string,
  minecraftId: string,
) {
  const minecraftIdNormalized = minecraftId.toLowerCase();
  const conflicts = await prisma.application.findMany({
    where: {
      status: { not: ApplicationStatus.QUIZ_FAILED },
      OR: [{ qqNumber }, { minecraftIdNormalized }],
    },
    select: {
      qqNumber: true,
      minecraftIdNormalized: true,
    },
    take: 2,
  });

  if (conflicts.length > 0) {
    throw buildIdentityConflict(conflicts, qqNumber, minecraftIdNormalized);
  }
}

function buildIdentityConflict(
  conflicts: Array<{ qqNumber: string; minecraftIdNormalized: string }>,
  qqNumber: string,
  minecraftIdNormalized: string,
) {
  return new IdentityConflictError(
    conflicts.some((item) => item.qqNumber === qqNumber),
    conflicts.some(
      (item) => item.minecraftIdNormalized === minecraftIdNormalized,
    ),
  );
}

async function assertApplicationSubmissionAllowed(
  input: CreateApplicationBody,
  metadata: ApplicationRequestMetadata,
) {
  const config = getEffectiveApplicationConfig();

  if (!config.submissionsEnabled) {
    throw new ApplicationSubmissionsDisabledError();
  }

  const windowStart = minutesAgo(config.rateLimitWindowMinutes);
  const ipCount = metadata.ipAddress
    ? await prisma.application.count({
          where: {
            ipAddress: metadata.ipAddress,
            createdAt: { gte: windowStart },
          },
        })
      : 0;

  if (metadata.ipAddress && ipCount >= config.maxSubmissionsPerIp) {
    throw new ApplicationRateLimitError('IP 地址');
  }
}

function minutesAgo(minutes: number) {
  return addMinutes(new Date(), -minutes);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1_000);
}

export class AgreementVersionOutdatedError extends Error {
  constructor() {
    super('服务器协议已经更新，请重新阅读后再提交');
    this.name = 'AgreementVersionOutdatedError';
  }
}

export class IdentityConflictError extends Error {
  constructor(
    readonly qqNumberDuplicate: boolean,
    readonly minecraftIdDuplicate: boolean,
  ) {
    const duplicateLabel = qqNumberDuplicate && minecraftIdDuplicate
      ? 'QQ 号和 Minecraft ID'
      : qqNumberDuplicate
        ? 'QQ 号'
        : 'Minecraft ID';
    super(
      `检测到${duplicateLabel}已经提交过申请，请联系腐竹或管理组核实情况`,
    );
    this.name = 'IdentityConflictError';
  }
}

export class ApplicationSubmissionsDisabledError extends Error {
  constructor() {
    super('当前暂未开放新的入服申请');
    this.name = 'ApplicationSubmissionsDisabledError';
  }
}

export class ApplicationRateLimitError extends Error {
  constructor(readonly dimension: string) {
    super(`${dimension} 在当前时间窗口内提交次数过多，请稍后再试`);
    this.name = 'ApplicationRateLimitError';
  }
}
