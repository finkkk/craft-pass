import { createHmac, timingSafeEqual } from 'node:crypto';
import { getContentConfig } from '../config/contentConfig.js';
import { getApplicationSigningKey } from '../config/runtimeConfig.js';

interface QuizTokenPayload {
  version: 1;
  questionIds: string[];
  expiresAt: number;
}

const tokenLifetimeMs = 2 * 60 * 60 * 1_000;

export function createQuizToken(questionIds: readonly string[]) {
  const payload: QuizTokenPayload = {
    version: 1,
    questionIds: [...questionIds],
    expiresAt: Date.now() + tokenLifetimeMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function resolveQuizQuestionIds(
  token: string | undefined,
  answers: Readonly<Record<string, string>>,
) {
  const quiz = getContentConfig().quiz;
  const allQuestionIds = quiz.questions.map((question) => question.id);
  const randomSelectionEnabled =
    quiz.randomQuestionCount !== null &&
    quiz.randomQuestionCount < allQuestionIds.length;

  const expectedQuestionIds = token
    ? verifyQuizToken(token, new Set(allQuestionIds))
    : randomSelectionEnabled
      ? null
      : allQuestionIds;

  if (!expectedQuestionIds) {
    throw new QuizSelectionInvalidError('随机题目凭证缺失，请刷新页面重新答题');
  }

  const answerIds = Object.keys(answers);
  if (
    answerIds.length !== expectedQuestionIds.length ||
    expectedQuestionIds.some((questionId) => !(questionId in answers))
  ) {
    throw new QuizSelectionInvalidError('答题内容与本次随机题目不一致，请刷新后重试');
  }

  return expectedQuestionIds;
}

function verifyQuizToken(token: string, validQuestionIds: Set<string>) {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    throw new QuizSelectionInvalidError();
  }

  const expectedSignature = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new QuizSelectionInvalidError();
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as QuizTokenPayload;

    if (
      payload.version !== 1 ||
      payload.expiresAt < Date.now() ||
      !Array.isArray(payload.questionIds) ||
      payload.questionIds.length === 0 ||
      new Set(payload.questionIds).size !== payload.questionIds.length ||
      payload.questionIds.some((questionId) => !validQuestionIds.has(questionId))
    ) {
      throw new QuizSelectionInvalidError();
    }

    return payload.questionIds;
  } catch (error) {
    if (error instanceof QuizSelectionInvalidError) {
      throw error;
    }
    throw new QuizSelectionInvalidError();
  }
}

function sign(value: string) {
  return createHmac('sha256', getApplicationSigningKey())
    .update(value)
    .digest('base64url');
}

export class QuizSelectionInvalidError extends Error {
  constructor(message = '随机题目凭证无效或已过期，请刷新页面重新答题') {
    super(message);
    this.name = 'QuizSelectionInvalidError';
  }
}
