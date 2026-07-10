import { z } from 'zod';

export const defaultUiContent = {
  navigation: {
    systemStatus: '审核系统在线',
    stepIdentity: '填写资料',
    stepAgreement: '阅读规则',
    stepQuiz: '规则测试',
    stepResult: '提交结果',
    footerPrimary: 'Craft Pass · 公平、友善、长期生存',
    footerSecondary: '请勿在公共场合分享答题内容',
  },
  apply: {
    eyebrow: 'WELCOME, TRAVELER',
    title: '先读规则，再进入世界。',
    intro:
      '这是服务器白名单的唯一申请入口。请使用真实信息完成规则阅读和测试，审核通过后系统会自动处理入服资格。',
    featureOneTitle: '阅读完整规则',
    featureOneDescription: '了解生存世界的共同边界',
    featureTwoTitle: '完成规则测试',
    featureTwoDescription: '完成单选题并达到服务器设置的合格分数',
    featureTwoConfigured: '{count} 道单选题，达到 {score} 分合格',
    featureThreeTitle: '等待人工审核',
    featureThreeDescription: '管理员确认后加入服务器白名单',
    stepLabel: 'STEP 01',
    formTitle: '填写申请资料',
    qqLabel: 'QQ 号',
    qqHelp: '用于管理员联系与身份确认',
    qqPlaceholder: '例如：123456789',
    qqInvalidMessage: '请输入 5 至 12 位、且不以 0 开头的 QQ 号',
    minecraftLabel: 'Minecraft ID',
    minecraftHelp: '区分大小写，请与游戏内 ID 完全一致',
    minecraftPlaceholder: '例如：Steve_01',
    minecraftInvalidMessage: '请输入 3 至 16 位英文、数字或下划线组成的正版 ID',
    loadingButton: '正在连接服务器…',
    continueButton: '下一步：阅读服务器规则',
    privacyNote:
      '提交时将记录 IP、浏览器信息和协议版本，仅用于审核与安全追溯。',
  },
  agreement: {
    eyebrow: 'STEP 02 · AGREEMENT',
    intro:
      '请完整且仔细阅读以下内容，并且保证遵守。以下规定均是为了维护服务器健康长久运行而存在，还望理解。',
    versionPrefix: '版本',
    noticeTitle: '阅读提示',
    noticeBody:
      '答题内容部分来自于以下规则。正式提交后，签署时的基本信息将被保存。',
    signatureTitle: '签署确认',
    acceptanceLabel: '我已完整阅读并同意遵守以上服务器规则',
    backButton: '返回修改资料',
    continueButton: '开始规则测试',
  },
  quiz: {
    eyebrow: 'STEP 03 · QUIZ',
    title: '规则理解测试',
    intro: '每题只有一个正确答案。正确答案不会在提交后公开显示。',
    passingScoreLabel: '合格分数',
    fullScoreLabel: '满分 100 分',
    backRulesButton: '返回规则',
    previousButton: '上一题',
    nextButton: '下一题',
    submittingButton: '正在提交…',
    unansweredButton: '还有 {count} 题未答',
    answeredCountLabel: '已完成',
    submitButton: '提交全部答案',
  },
  result: {
    eyebrow: 'APPLICATION RESULT',
    passedTitle: '申请已进入审核队列',
    failedTitle: '本次测试未通过',
    passedDescription:
      '你已完成规则签署与测试。管理员审核通过后，会将你的 Minecraft ID 加入白名单。',
    failedDescription:
      '你的分数未达到合格线，请重新阅读规则后再次尝试。系统不会显示具体错题答案。',
    minecraftLabel: 'Minecraft ID',
    qqLabel: 'QQ 号',
    statusLabel: '申请状态',
    applicationIdLabel: '申请编号',
    pendingStatus: '等待管理员审核',
    failedStatus: '答题未通过',
    notice:
      '请妥善保存申请编号，无需重复提交。审核期间可留意管理员的 QQ 消息。',
    retryButton: '重新阅读服务器规则',
  },
} as const;

const shortText = (max: number, fallback: string) =>
  z.string().trim().min(1).max(max).default(fallback);

export const uiContentSchema = z
  .object({
    navigation: z
      .object({
        systemStatus: shortText(24, defaultUiContent.navigation.systemStatus),
        stepIdentity: shortText(12, defaultUiContent.navigation.stepIdentity),
        stepAgreement: shortText(12, defaultUiContent.navigation.stepAgreement),
        stepQuiz: shortText(12, defaultUiContent.navigation.stepQuiz),
        stepResult: shortText(12, defaultUiContent.navigation.stepResult),
        footerPrimary: shortText(60, defaultUiContent.navigation.footerPrimary),
        footerSecondary: shortText(
          60,
          defaultUiContent.navigation.footerSecondary,
        ),
      })
      .strict()
      .default(defaultUiContent.navigation),
    apply: z
      .object({
        eyebrow: shortText(40, defaultUiContent.apply.eyebrow),
        title: shortText(40, defaultUiContent.apply.title),
        intro: shortText(240, defaultUiContent.apply.intro),
        featureOneTitle: shortText(24, defaultUiContent.apply.featureOneTitle),
        featureOneDescription: shortText(
          60,
          defaultUiContent.apply.featureOneDescription,
        ),
        featureTwoTitle: shortText(24, defaultUiContent.apply.featureTwoTitle),
        featureTwoDescription: shortText(
          60,
          defaultUiContent.apply.featureTwoDescription,
        ),
        featureTwoConfigured: shortText(
          80,
          defaultUiContent.apply.featureTwoConfigured,
        ),
        featureThreeTitle: shortText(
          24,
          defaultUiContent.apply.featureThreeTitle,
        ),
        featureThreeDescription: shortText(
          60,
          defaultUiContent.apply.featureThreeDescription,
        ),
        stepLabel: shortText(20, defaultUiContent.apply.stepLabel),
        formTitle: shortText(30, defaultUiContent.apply.formTitle),
        qqLabel: shortText(20, defaultUiContent.apply.qqLabel),
        qqHelp: shortText(60, defaultUiContent.apply.qqHelp),
        qqPlaceholder: shortText(30, defaultUiContent.apply.qqPlaceholder),
        qqInvalidMessage: shortText(
          80,
          defaultUiContent.apply.qqInvalidMessage,
        ),
        minecraftLabel: shortText(30, defaultUiContent.apply.minecraftLabel),
        minecraftHelp: shortText(80, defaultUiContent.apply.minecraftHelp),
        minecraftPlaceholder: shortText(
          30,
          defaultUiContent.apply.minecraftPlaceholder,
        ),
        minecraftInvalidMessage: shortText(
          100,
          defaultUiContent.apply.minecraftInvalidMessage,
        ),
        loadingButton: shortText(30, defaultUiContent.apply.loadingButton),
        continueButton: shortText(30, defaultUiContent.apply.continueButton),
        privacyNote: shortText(160, defaultUiContent.apply.privacyNote),
      })
      .strict()
      .default(defaultUiContent.apply),
    agreement: z
      .object({
        eyebrow: shortText(40, defaultUiContent.agreement.eyebrow),
        intro: shortText(240, defaultUiContent.agreement.intro),
        versionPrefix: shortText(
          12,
          defaultUiContent.agreement.versionPrefix,
        ),
        noticeTitle: shortText(20, defaultUiContent.agreement.noticeTitle),
        noticeBody: shortText(200, defaultUiContent.agreement.noticeBody),
        signatureTitle: shortText(
          30,
          defaultUiContent.agreement.signatureTitle,
        ),
        acceptanceLabel: shortText(
          80,
          defaultUiContent.agreement.acceptanceLabel,
        ),
        backButton: shortText(30, defaultUiContent.agreement.backButton),
        continueButton: shortText(
          30,
          defaultUiContent.agreement.continueButton,
        ),
      })
      .strict()
      .default(defaultUiContent.agreement),
    quiz: z
      .object({
        eyebrow: shortText(40, defaultUiContent.quiz.eyebrow),
        title: shortText(40, defaultUiContent.quiz.title),
        intro: shortText(160, defaultUiContent.quiz.intro),
        passingScoreLabel: shortText(
          20,
          defaultUiContent.quiz.passingScoreLabel,
        ),
        fullScoreLabel: shortText(20, defaultUiContent.quiz.fullScoreLabel),
        backRulesButton: shortText(24, defaultUiContent.quiz.backRulesButton),
        previousButton: shortText(24, defaultUiContent.quiz.previousButton),
        nextButton: shortText(24, defaultUiContent.quiz.nextButton),
        submittingButton: shortText(30, defaultUiContent.quiz.submittingButton),
        unansweredButton: shortText(40, defaultUiContent.quiz.unansweredButton),
        answeredCountLabel: shortText(
          20,
          defaultUiContent.quiz.answeredCountLabel,
        ),
        submitButton: shortText(30, defaultUiContent.quiz.submitButton),
      })
      .strict()
      .default(defaultUiContent.quiz),
    result: z
      .object({
        eyebrow: shortText(40, defaultUiContent.result.eyebrow),
        passedTitle: shortText(50, defaultUiContent.result.passedTitle),
        failedTitle: shortText(50, defaultUiContent.result.failedTitle),
        passedDescription: shortText(
          200,
          defaultUiContent.result.passedDescription,
        ),
        failedDescription: shortText(
          200,
          defaultUiContent.result.failedDescription,
        ),
        minecraftLabel: shortText(30, defaultUiContent.result.minecraftLabel),
        qqLabel: shortText(20, defaultUiContent.result.qqLabel),
        statusLabel: shortText(30, defaultUiContent.result.statusLabel),
        applicationIdLabel: shortText(
          30,
          defaultUiContent.result.applicationIdLabel,
        ),
        pendingStatus: shortText(30, defaultUiContent.result.pendingStatus),
        failedStatus: shortText(30, defaultUiContent.result.failedStatus),
        notice: shortText(160, defaultUiContent.result.notice),
        retryButton: shortText(30, defaultUiContent.result.retryButton),
      })
      .strict()
      .default(defaultUiContent.result),
  })
  .strict();

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
    ui: uiContentSchema.default(defaultUiContent),
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
export type UiContentConfig = z.infer<typeof uiContentSchema>;
