import type {
  AdminApplicationDetail,
  AdminApplicationRow,
  AdminIdentity,
  AdminLogoStatus,
  FactoryResetResult,
  AdminSummary,
  AdminStatistics,
  AdminContentConfig,
  AdminSettings,
  ApplicationStatus,
  RconCommandResult,
  RconStatus,
  ReviewActionResult,
  UpdateAdminSettings,
  BatchReviewResult,
  VersionStatus,
} from '../types/admin';
import { ApiClientError, requestJson } from './client';

export class AdminApiError extends ApiClientError {
  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message, status, code);
    this.name = 'AdminApiError';
  }
}

let adminSessionRequest: Promise<{ admin: AdminIdentity }> | null = null;
let versionStatusCache:
  | { value: VersionStatus; expiresAt: number }
  | null = null;
const adminReadCache = new Map<
  string,
  { expiresAt: number; request: Promise<unknown> }
>();

export async function loginAdmin(username: string, password: string) {
  const result = await adminRequest<{ admin: AdminIdentity; expiresAt: string }>(
    '/api/admin/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
  );
  adminSessionRequest = Promise.resolve({ admin: result.admin });
  return result;
}

export function getAdminSession() {
  adminSessionRequest ??= adminRequest<{ admin: AdminIdentity }>(
    '/api/admin/session',
  ).catch((error) => {
    adminSessionRequest = null;
    throw error;
  });
  return adminSessionRequest;
}

export function getAdminSummary() {
  return adminRequest<AdminSummary>('/api/admin/summary');
}

export function getAdminStatistics() {
  return adminRequest<AdminStatistics>('/api/admin/statistics');
}

export async function getAdminContent() {
  const response = await adminRequest<{ content: AdminContentConfig }>(
    '/api/admin/content',
  );
  return response.content;
}

export async function updateAdminContent(content: AdminContentConfig) {
  const response = await adminRequest<{ content: AdminContentConfig }>(
    '/api/admin/content',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    },
  );
  return response.content;
}

export async function updateAdminRulesQuizContent(
  content: Pick<AdminContentConfig, 'agreement' | 'quiz'>,
) {
  const response = await adminRequest<{ content: AdminContentConfig }>(
    '/api/admin/content/rules-quiz',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    },
  );
  return response.content;
}

export async function updateAdminUiContent(
  ui: AdminContentConfig['ui'],
) {
  const response = await adminRequest<{ content: AdminContentConfig }>(
    '/api/admin/content/ui',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ui),
    },
  );
  return response.content;
}

export function getRconStatus() {
  return adminRequest<RconStatus>('/api/admin/rcon/status');
}

export function executeRconCommand(command: string) {
  return adminRequest<RconCommandResult>('/api/admin/rcon/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
}

export function getAdminSettings() {
  return adminRequest<AdminSettings>('/api/admin/settings');
}

export function getAdminLogoStatus() {
  return adminRequest<AdminLogoStatus>('/api/admin/logo');
}

export function updateAdminLogo(dataUrl: string) {
  return adminRequest<AdminLogoStatus>('/api/admin/logo', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  });
}

export function deleteAdminLogo() {
  return adminRequest<AdminLogoStatus>('/api/admin/logo', {
    method: 'DELETE',
  });
}

export function factoryResetSystem(confirmation: string) {
  return adminRequest<FactoryResetResult>('/api/admin/system/factory-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
}

export function updateAdminSettings(settings: UpdateAdminSettings) {
  return adminRequest<AdminSettings>('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function getAdminVersionStatus() {
  if (versionStatusCache && versionStatusCache.expiresAt > Date.now()) {
    return versionStatusCache.value;
  }
  const value = await adminRequest<VersionStatus>('/api/admin/version');
  versionStatusCache = { value, expiresAt: Date.now() + 5 * 60 * 1_000 };
  return value;
}

export async function getAdminApplications(status: ApplicationStatus) {
  const response = await adminRequest<{
    applications: AdminApplicationRow[];
  }>(`/api/admin/applications?status=${status}`);
  return response.applications;
}

export async function getAdminApplication(applicationId: string) {
  const response = await adminRequest<{
    application: AdminApplicationDetail;
  }>(`/api/admin/applications/${applicationId}`);
  return response.application;
}

export async function logoutAdmin() {
  try {
    return await adminRequest<void>('/api/admin/logout', {
      method: 'POST',
    });
  } finally {
    adminSessionRequest = null;
    versionStatusCache = null;
  }
}

export function approveAdminApplication(applicationId: string) {
  return adminRequest<ReviewActionResult>(
    `/api/admin/applications/${applicationId}/approve`,
    { method: 'POST' },
  );
}

export function rejectAdminApplication(
  applicationId: string,
  reason: string,
) {
  return adminRequest<ReviewActionResult>(
    `/api/admin/applications/${applicationId}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
}

export function retryAdminApplicationRcon(applicationId: string) {
  return adminRequest<ReviewActionResult>(
    `/api/admin/applications/${applicationId}/retry-rcon`,
    { method: 'POST' },
  );
}

export function batchReviewAdminApplications(input: {
  action: 'approve' | 'reject' | 'retry';
  applicationIds: string[];
  reason?: string;
}) {
  return adminRequest<BatchReviewResult>('/api/admin/applications/batch-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateAdminApplication(
  applicationId: string,
  input: { qqNumber: string; minecraftId: string },
) {
  const response = await adminRequest<{
    application: AdminApplicationDetail;
  }>(`/api/admin/applications/${applicationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.application;
}

export function deleteAdminApplication(applicationId: string) {
  return adminRequest<void>(
    `/api/admin/applications/${applicationId}`,
    { method: 'DELETE' },
  );
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET') {
    const cached = adminReadCache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.request as Promise<T>;
    }
  }

  const request = performAdminRequest<T>(path, init);
  if (method === 'GET') {
    adminReadCache.set(path, {
      expiresAt: Date.now() + 3_000,
      request,
    });
    request.catch(() => adminReadCache.delete(path));
  } else {
    adminReadCache.clear();
    request.then(() => adminReadCache.clear()).catch(() => undefined);
  }

  return request;
}

async function performAdminRequest<T>(path: string, init?: RequestInit) {
  try {
    return await requestJson<T>(path, {
      ...init,
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new AdminApiError(error.message, error.status, error.code);
    }
    throw error;
  }
}
