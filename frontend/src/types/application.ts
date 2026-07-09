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
