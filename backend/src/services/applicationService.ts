import { getContentConfig } from '../config/contentConfig.js';
import { getEffectiveApplicationConfig } from '../config/runtimeConfig.js';
import {
  ApplicationStatus,
  type Prisma,
} from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import type { CreateApplicationBody } from '../schemas/application.js';
import { gradeQuiz } from './quizService.js';

const activeApplicationStatuses = [
  ApplicationStatus.PENDING_REVIEW,
  ApplicationStatus.WHITELISTED,
  ApplicationStatus.RCON_FAILED,
] as const;

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

  await assertApplicationSubmissionAllowed(input, metadata);

  const quizResult = gradeQuiz(input.answers);
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

  const application = await prisma.$transaction(async (transaction) => {
    const activeApplication = await transaction.application.findFirst({
      where: {
        minecraftIdNormalized,
        status: {
          in: [...activeApplicationStatuses],
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (activeApplication) {
      throw new DuplicateActiveApplicationError(activeApplication.status);
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

  return application;
}

async function assertApplicationSubmissionAllowed(
  input: CreateApplicationBody,
  metadata: ApplicationRequestMetadata,
) {
  const config = getEffectiveApplicationConfig();

  if (!config.submissionsEnabled) {
    throw new ApplicationSubmissionsDisabledError();
  }

  const minecraftIdNormalized = input.minecraftId.toLowerCase();

  if (config.quizFailCooldownMinutes > 0) {
    const cooldownStart = minutesAgo(config.quizFailCooldownMinutes);
    const recentFailedApplication = await prisma.application.findFirst({
      where: {
        status: ApplicationStatus.QUIZ_FAILED,
        createdAt: { gte: cooldownStart },
        OR: [
          { minecraftIdNormalized },
          { qqNumber: input.qqNumber },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (recentFailedApplication) {
      throw new ApplicationCooldownError(
        addMinutes(
          recentFailedApplication.createdAt,
          config.quizFailCooldownMinutes,
        ),
      );
    }
  }

  const windowStart = minutesAgo(config.rateLimitWindowMinutes);
  const [ipCount, qqCount, minecraftIdCount] = await Promise.all([
    metadata.ipAddress
      ? prisma.application.count({
          where: {
            ipAddress: metadata.ipAddress,
            createdAt: { gte: windowStart },
          },
        })
      : Promise.resolve(0),
    prisma.application.count({
      where: {
        qqNumber: input.qqNumber,
        createdAt: { gte: windowStart },
      },
    }),
    prisma.application.count({
      where: {
        minecraftIdNormalized,
        createdAt: { gte: windowStart },
      },
    }),
  ]);

  if (metadata.ipAddress && ipCount >= config.maxSubmissionsPerIp) {
    throw new ApplicationRateLimitError('IP 地址');
  }

  if (qqCount >= config.maxSubmissionsPerQq) {
    throw new ApplicationRateLimitError('QQ 号');
  }

  if (minecraftIdCount >= config.maxSubmissionsPerMinecraftId) {
    throw new ApplicationRateLimitError('Minecraft ID');
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

export class DuplicateActiveApplicationError extends Error {
  constructor(readonly currentStatus: ApplicationStatus) {
    super('该 Minecraft ID 已存在有效申请，不能重复提交');
    this.name = 'DuplicateActiveApplicationError';
  }
}

export class ApplicationSubmissionsDisabledError extends Error {
  constructor() {
    super('当前暂未开放新的入服申请');
    this.name = 'ApplicationSubmissionsDisabledError';
  }
}

export class ApplicationCooldownError extends Error {
  constructor(readonly retryAt: Date) {
    super('答题未通过后需要等待冷却时间结束再重新提交');
    this.name = 'ApplicationCooldownError';
  }
}

export class ApplicationRateLimitError extends Error {
  constructor(readonly dimension: string) {
    super(`${dimension} 在当前时间窗口内提交次数过多，请稍后再试`);
    this.name = 'ApplicationRateLimitError';
  }
}
