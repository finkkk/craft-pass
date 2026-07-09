export type ApplicationStatus =
  | 'quiz_failed'
  | 'pending_review'
  | 'rejected'
  | 'whitelisted'
  | 'rcon_failed';

export interface AdminIdentity {
  id: string;
  username: string;
  role: string;
}

export interface AdminSummary {
  pendingReview: number;
  whitelisted: number;
  rejected: number;
  quizFailed: number;
  rconFailed: number;
}

export interface AdminStatistics {
  overview: {
    totalApplications: number;
    recent7Days: number;
    quizPassRate: number | null;
    reviewApprovalRate: number | null;
    rconSuccessRate: number | null;
  };
  statusDistribution: {
    pendingReview: number;
    whitelisted: number;
    rejected: number;
    quizFailed: number;
    rconFailed: number;
  };
  rconAttempts: {
    succeeded: number;
    failed: number;
  };
  dailyTrend: Array<{
    date: string;
    submitted: number;
    quizPassed: number;
  }>;
  generatedAt: string;
}

export interface AdminContentConfig {
  ui: import('./application').UiContent;
  agreement: {
    version: string;
    title: string;
    sections: Array<{
      id: string;
      title: string;
      paragraphs: string[];
    }>;
    signatureStatements: string[];
  };
  quiz: {
    passingScore: number;
    questions: Array<{
      id: string;
      prompt: string;
      options: Array<{
        id: string;
        text: string;
      }>;
      correctOptionId: string;
    }>;
  };
}

export interface RconStatus {
  enabled: boolean;
  whitelistAddCommandConfigured: boolean;
  reloadAfterAdd: boolean;
}

export interface AdminLogoStatus {
  configured: boolean;
  url: string | null;
}

export interface ReviewActionResult {
  applicationId: string;
  status: ApplicationStatus;
}

export interface AdminSettings {
  source: 'runtime' | 'environment';
  site: {
    name: string;
    subtitle: string;
  };
  rcon: {
    enabled: boolean;
    host: string;
    port: number;
    passwordConfigured: boolean;
    timeoutMs: number;
    whitelistAddCommand: string;
    whitelistReloadCommand: string;
  };
}

export interface UpdateAdminSettings {
  site: AdminSettings['site'];
  rcon: Omit<AdminSettings['rcon'], 'passwordConfigured'> & {
    password?: string;
  };
}

export interface AdminApplicationRow {
  id: string;
  qqNumber: string;
  minecraftId: string;
  score: number;
  agreementVersion: string;
  ipAddress: string | null;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: { username: string } | null;
}

export interface AdminApplicationDetail extends AdminApplicationRow {
  passedQuiz: boolean;
  signedAt: string;
  rejectReason: string | null;
  userAgent: string | null;
  answersJson: {
    version?: number;
    answers?: Array<{
      questionId: string;
      questionPrompt?: string;
      selectedOptionId: string;
      selectedOptionText?: string;
      isCorrect: boolean;
    }>;
  };
  rconAttempts: Array<{
    id: string;
    status: string;
    response: string | null;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
    admin: { username: string };
  }>;
}
