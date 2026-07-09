import { getContentConfig } from '../config/contentConfig.js';
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
