import type {
  CompleteSetupPayload,
  SetupStatus,
} from '../types/setup';
import { requestJson } from './client';

let setupStatusRequest: Promise<SetupStatus> | null = null;

export async function getSetupStatus() {
  setupStatusRequest ??= requestJson<SetupStatus>('/api/setup/status').catch(
    (error) => {
      setupStatusRequest = null;
      throw error;
    },
  );
  return setupStatusRequest;
}

export function completeSetup(payload: CompleteSetupPayload) {
  return requestJson<{
    setupCompleted: boolean;
    admin: { username: string };
  }>('/api/setup/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
