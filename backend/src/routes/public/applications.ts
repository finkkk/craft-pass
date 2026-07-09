import { Router } from 'express';
import { z } from 'zod';
import { getContentConfig } from '../../config/contentConfig.js';
import { toPublicApplicationStatus } from '../../domain/applicationStatus.js';
import { applicationSubmissionRateLimiter } from '../../middleware/security.js';
import { createApplicationSchema } from '../../schemas/application.js';
import {
  AgreementVersionOutdatedError,
  createApplication,
  DuplicateActiveApplicationError,
} from '../../services/applicationService.js';
import { HttpError } from '../../utils/HttpError.js';

export const applicationsRouter = Router();

applicationsRouter.get('/agreement', (_request, response) => {
  const { agreement } = getContentConfig();
  response.json({
    agreement,
  });
});

applicationsRouter.get('/quiz', (_request, response) => {
  const { quiz } = getContentConfig();
  response.json({
    passingScore: quiz.passingScore,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map(
      ({ correctOptionId: _correctOptionId, ...question }) => question,
    ),
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

      throw error;
    }
  },
);
