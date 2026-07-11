import { z } from 'zod';
import { getContentConfig } from '../config/contentConfig.js';

const answersSchema = z
  .record(z.string(), z.string())
  .superRefine((answers, context) => {
    const questions = getContentConfig().quiz.questions;
    const optionIdsByQuestion = new Map(
      questions.map((question) => [
        question.id,
        new Set(question.options.map((option) => option.id)),
      ]),
    );

    if (Object.keys(answers).length === 0) {
      context.addIssue({
        code: 'custom',
        message: '至少需要回答一道题',
      });
    }

    for (const [questionId, optionId] of Object.entries(answers)) {
      const validOptionIds = optionIdsByQuestion.get(questionId);

      if (!validOptionIds) {
        context.addIssue({
          code: 'custom',
          path: [questionId],
          message: '包含未知题目',
        });
        continue;
      }

      if (!validOptionIds.has(optionId)) {
        context.addIssue({
          code: 'custom',
          path: [questionId],
          message: '选项不存在',
        });
      }
    }
  });

export const createApplicationSchema = z
  .object({
    qqNumber: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{4,11}$/, 'QQ 号格式不正确'),
    minecraftId: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9_]{3,16}$/,
        'Minecraft ID 只能包含英文、数字和下划线，长度为 3 至 16 位',
      ),
    agreementVersion: z.string().trim().min(1).max(64),
    agreementAccepted: z
      .boolean()
      .refine((accepted) => accepted, '必须阅读并同意服务器协议'),
    answers: answersSchema,
    quizToken: z.string().min(1).max(4_096).optional(),
  })
  .strict();

export type CreateApplicationBody = z.infer<
  typeof createApplicationSchema
>;

export const applicationIdentitySchema = z
  .object({
    qqNumber: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{4,11}$/, 'QQ 号格式不正确'),
    minecraftId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{3,16}$/),
  })
  .strict();
