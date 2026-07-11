import type {
  Agreement,
  ApplicationProgress,
  ApplicationResult,
  ApplicationSubmission,
  Quiz,
  UiContent,
} from '../types/application';
import { requestJson } from './client';

export async function getAgreement() {
  return requestJson<{
    agreement: Agreement;
    ui: UiContent;
    application: { submissionsEnabled: boolean };
  }>('/api/agreement');
}

export function getQuiz() {
  return requestJson<Quiz>('/api/quiz');
}

export function submitApplication(payload: ApplicationSubmission) {
  return requestJson<ApplicationResult>('/api/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function queryApplicationProgress(
  qqNumber: string,
  minecraftId: string,
) {
  return requestJson<ApplicationProgress>('/api/applications/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qqNumber, minecraftId }),
  });
}

export function checkApplicationIdentity(
  qqNumber: string,
  minecraftId: string,
) {
  return requestJson<{ available: true }>('/api/applications/identity-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qqNumber, minecraftId }),
  });
}
