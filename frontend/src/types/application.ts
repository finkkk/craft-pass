export interface AgreementSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface Agreement {
  version: string;
  title: string;
  sections: AgreementSection[];
  signatureStatements: string[];
}

export interface UiContent {
  navigation: {
    systemStatus: string;
    stepIdentity: string;
    stepAgreement: string;
    stepQuiz: string;
    stepResult: string;
    footerPrimary: string;
    footerSecondary: string;
  };
  apply: {
    eyebrow: string;
    title: string;
    intro: string;
    featureOneTitle: string;
    featureOneDescription: string;
    featureTwoTitle: string;
    featureTwoDescription: string;
    featureTwoConfigured: string;
    featureThreeTitle: string;
    featureThreeDescription: string;
    stepLabel: string;
    formTitle: string;
    qqLabel: string;
    qqHelp: string;
    qqPlaceholder: string;
    qqInvalidMessage: string;
    minecraftLabel: string;
    minecraftHelp: string;
    minecraftPlaceholder: string;
    minecraftInvalidMessage: string;
    loadingButton: string;
    continueButton: string;
    privacyNote: string;
  };
  agreement: {
    eyebrow: string;
    intro: string;
    versionPrefix: string;
    noticeTitle: string;
    noticeBody: string;
    signatureTitle: string;
    acceptanceLabel: string;
    backButton: string;
    continueButton: string;
  };
  quiz: {
    eyebrow: string;
    title: string;
    intro: string;
    passingScoreLabel: string;
    fullScoreLabel: string;
    backRulesButton: string;
    previousButton: string;
    nextButton: string;
    submittingButton: string;
    unansweredButton: string;
    answeredCountLabel: string;
    submitButton: string;
  };
  result: {
    eyebrow: string;
    passedTitle: string;
    failedTitle: string;
    passedDescription: string;
    failedDescription: string;
    minecraftLabel: string;
    qqLabel: string;
    statusLabel: string;
    applicationIdLabel: string;
    pendingStatus: string;
    failedStatus: string;
    notice: string;
    retryButton: string;
  };
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export interface Quiz {
  passingScore: number;
  questionCount: number;
  questions: QuizQuestion[];
}

export interface ApplicationSubmission {
  qqNumber: string;
  minecraftId: string;
  agreementVersion: string;
  agreementAccepted: boolean;
  answers: Record<string, string>;
}

export interface ApplicationResult {
  applicationId: string;
  minecraftId: string;
  qqNumber: string;
  status: 'quiz_failed' | 'pending_review';
  score: number;
  passed: boolean;
  submittedAt: string;
}
