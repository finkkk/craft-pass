import { Router } from 'express';
import { z } from 'zod';
import { getContentConfig } from '../../config/contentConfig.js';
import { getEffectiveApplicationConfig } from '../../config/runtimeConfig.js';
import { toPublicApplicationStatus } from '../../domain/applicationStatus.js';
import { applicationSubmissionRateLimiter } from '../../middleware/security.js';
import { createApplicationSchema } from '../../schemas/application.js';
import {
  AgreementVersionOutdatedError,
  ApplicationCooldownError,
  ApplicationRateLimitError,
  ApplicationSubmissionsDisabledError,
  createApplication,
  DuplicateActiveApplicationError,
} from '../../services/applicationService.js';
import { HttpError } from '../../utils/HttpError.js';

export const applicationsRouter = Router();

applicationsRouter.get('/agreement', (_request, response) => {
  const { agreement, ui } = getContentConfig();
  response.json({
    agreement,
    ui,
    application: {
      submissionsEnabled: getEffectiveApplicationConfig().submissionsEnabled,
    },
  });
});

applicationsRouter.get('/quiz', (_request, response) => {
  const { quiz } = getContentConfig();
  const questions = shuffle(
    quiz.questions.map(({ correctOptionId: _correctOptionId, ...question }) => ({
      ...question,
    })),
  );

  response.json({
    passingScore: quiz.passingScore,
    questionCount: quiz.questions.length,
    questions,
  });
});

applicationsRouter.post(
  '/applications',
  applicationSubmissionRateLimiter,
  async (request, response) => {
    const currentAgreement = getContentConfig().agreement;

    if (
      typeof request.body?.agreementVersion === 'string' &&
      request.body.agreementVersion.trim() !== currentAgreement.version
    ) {
      throw new HttpError(
        409,
        'AGREEMENT_VERSION_OUTDATED',
        '服务器协议已经更新，请重新阅读后再提交',
        { currentVersion: currentAgreement.version },
      );
    }

    const parseResult = createApplicationSchema.safeParse(request.body);

    if (!parseResult.success) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        '申请数据格式不正确',
        z.flattenError(parseResult.error),
      );
    }

    try {
      const application = await createApplication(parseResult.data, {
        ipAddress: request.ip,
        userAgent: request.get('user-agent')?.slice(0, 512),
      });

      response.status(201).json({
        applicationId: application.id,
        minecraftId: application.minecraftId,
        qqNumber: application.qqNumber,
        status: toPublicApplicationStatus(application.status),
        score: application.score,
        passed: application.passedQuiz,
        submittedAt: application.createdAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof AgreementVersionOutdatedError) {
        const agreement = getContentConfig().agreement;
        throw new HttpError(
          409,
          'AGREEMENT_VERSION_OUTDATED',
          error.message,
          {
            currentVersion: agreement.version,
          },
        );
      }

      if (error instanceof DuplicateActiveApplicationError) {
        throw new HttpError(
          409,
          'ACTIVE_APPLICATION_EXISTS',
          error.message,
          {
            currentStatus: toPublicApplicationStatus(error.currentStatus),
          },
        );
      }

      if (error instanceof ApplicationSubmissionsDisabledError) {
        throw new HttpError(
          503,
          'APPLICATION_SUBMISSIONS_DISABLED',
          error.message,
        );
      }

      if (error instanceof ApplicationCooldownError) {
        throw new HttpError(429, 'APPLICATION_COOLDOWN_ACTIVE', error.message, {
          retryAt: error.retryAt.toISOString(),
        });
      }

      if (error instanceof ApplicationRateLimitError) {
        throw new HttpError(429, 'APPLICATION_RATE_LIMIT_ACTIVE', error.message, {
          dimension: error.dimension,
        });
      }

      throw error;
    }
  },
);

function shuffle<T>(items: readonly T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }

  return shuffled;
}
