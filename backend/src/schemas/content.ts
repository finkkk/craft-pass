import { z } from 'zod';

const identifierSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,32}$/, '标识只能包含英文、数字、下划线或连字符');

const optionSchema = z
  .object({
    id: identifierSchema,
    text: z.string().trim().min(1).max(200),
  })
  .strict();

const questionSchema = z
  .object({
    id: identifierSchema,
    prompt: z.string().trim().min(2).max(500),
    options: z.array(optionSchema).min(2).max(6),
    correctOptionId: identifierSchema,
  })
  .strict()
  .superRefine((question, context) => {
    const optionIds = question.options.map((option) => option.id);

    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: '同一道题的选项标识不能重复',
      });
    }

    if (!optionIds.includes(question.correctOptionId)) {
      context.addIssue({
        code: 'custom',
        path: ['correctOptionId'],
        message: '正确答案必须是当前题目的一个选项',
      });
    }
  });

export const contentConfigSchema = z
  .object({
    agreement: z
      .object({
        version: z.string().trim().min(1).max(64),
        title: z.string().trim().min(2).max(100),
        sections: z
          .array(
            z
              .object({
                id: identifierSchema,
                title: z.string().trim().min(1).max(100),
                paragraphs: z.array(z.string().trim().min(1).max(2_000)).min(1).max(20),
              })
              .strict(),
          )
          .min(1)
          .max(30),
        signatureStatements: z
          .array(z.string().trim().min(1).max(500))
          .min(1)
          .max(20),
      })
      .strict(),
    quiz: z
      .object({
        passingScore: z.number().int().min(1).max(100),
        questions: z.array(questionSchema).min(1).max(50),
      })
      .strict(),
  })
  .strict()
  .superRefine((content, context) => {
    const sectionIds = content.agreement.sections.map(
      (section) => section.id,
    );
    const questionIds = content.quiz.questions.map(
      (question) => question.id,
    );

    if (new Set(sectionIds).size !== sectionIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['agreement', 'sections'],
        message: '服规章节标识不能重复',
      });
    }

    if (new Set(questionIds).size !== questionIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['quiz', 'questions'],
        message: '题目标识不能重复',
      });
    }
  });

export type ContentConfig = z.infer<typeof contentConfigSchema>;
