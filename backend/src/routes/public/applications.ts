import { Router } from 'express';
import { z } from 'zod';
import { getContentConfig } from '../../config/contentConfig.js';
import { getEffectiveApplicationConfig } from '../../config/runtimeConfig.js';
import { toPublicApplicationStatus } from '../../domain/applicationStatus.js';
import {
  applicationStatusRateLimiter,
  applicationSubmissionRateLimiter,
} from '../../middleware/security.js';
import {
  applicationIdentitySchema,
  createApplicationSchema,
} from '../../schemas/application.js';
import {
  AgreementVersionOutdatedError,
  ApplicationRateLimitError,
  ApplicationSubmissionsDisabledError,
  assertIdentityAvailable,
  createApplication,
  IdentityConflictError,
  queryApplicationStatus,
} from '../../services/applicationService.js';
import {
  createQuizToken,
  QuizSelectionInvalidError,
} from '../../services/quizSelectionService.js';
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
  const selectedQuestions = shuffle(quiz.questions).slice(
    0,
    quiz.randomQuestionCount ?? quiz.questions.length,
  );
  const questions = selectedQuestions.map(
    ({ correctOptionId: _correctOptionId, ...question }) => ({
      ...question,
    }),
  );

  response.json({
    passingScore: quiz.passingScore,
    questionCount: questions.length,
    questionBankCount: quiz.questions.length,
    quizToken: createQuizToken(selectedQuestions.map((question) => question.id)),
    questions,
  });
});

applicationsRouter.post(
  '/applications/identity-check',
  applicationStatusRateLimiter,
  async (request, response) => {
    const result = applicationIdentitySchema.safeParse(request.body);
    if (!result.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', '玩家身份格式不正确');
    }

    try {
      await assertIdentityAvailable(
        result.data.qqNumber,
        result.data.minecraftId,
      );
      response.json({ available: true });
    } catch (error) {
      throw mapIdentityConflict(error);
    }
  },
);

applicationsRouter.post(
  '/applications/status',
  applicationStatusRateLimiter,
  async (request, response) => {
    const result = applicationIdentitySchema.safeParse(request.body);
    if (!result.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', '查询信息格式不正确');
    }

    const application = await queryApplicationStatus(
      result.data.qqNumber,
      result.data.minecraftId,
    );
    if (!application) {
      throw new HttpError(
        404,
        'APPLICATION_STATUS_NOT_FOUND',
        'QQ 号与 Minecraft ID 不匹配，或申请记录不存在',
      );
    }

    response.json({
      minecraftId: application.minecraftId,
      status: toPublicApplicationStatus(application.status),
      score: application.score,
      rejectReason:
        application.status === 'REJECTED' ? application.rejectReason : null,
      submittedAt: application.createdAt.toISOString(),
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
    });
  },
);

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

      if (error instanceof IdentityConflictError) {
        throw mapIdentityConflict(error);
      }

      if (error instanceof ApplicationSubmissionsDisabledError) {
        throw new HttpError(
          503,
          'APPLICATION_SUBMISSIONS_DISABLED',
          error.message,
        );
      }

      if (error instanceof ApplicationRateLimitError) {
        throw new HttpError(429, 'APPLICATION_RATE_LIMIT_ACTIVE', error.message, {
          dimension: error.dimension,
        });
      }

      if (error instanceof QuizSelectionInvalidError) {
        throw new HttpError(400, 'QUIZ_SELECTION_INVALID', error.message);
      }

      throw error;
    }
  },
);

function mapIdentityConflict(error: unknown) {
  if (!(error instanceof IdentityConflictError)) {
    return error;
  }

  return new HttpError(409, 'IDENTITY_CONFLICT', error.message, {
    qqNumberDuplicate: error.qqNumberDuplicate,
    minecraftIdDuplicate: error.minecraftIdDuplicate,
  });
}

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
