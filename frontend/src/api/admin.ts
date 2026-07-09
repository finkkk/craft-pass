import type {
  AdminApplicationDetail,
  AdminApplicationRow,
  AdminIdentity,
  AdminLogoStatus,
  AdminSummary,
  AdminStatistics,
  AdminContentConfig,
  AdminSettings,
  ApplicationStatus,
  RconStatus,
  ReviewActionResult,
  UpdateAdminSettings,
} from '../types/admin';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function loginAdmin(username: string, password: string) {
  return adminRequest<{ admin: AdminIdentity; expiresAt: string }>(
    '/api/admin/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
  );
}

export function getAdminSession() {
  return adminRequest<{ admin: AdminIdentity }>('/api/admin/session');
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

export function getRconStatus() {
  return adminRequest<RconStatus>('/api/admin/rcon/status');
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

export function updateAdminSettings(settings: UpdateAdminSettings) {
  return adminRequest<AdminSettings>('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
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

export function logoutAdmin() {
  return adminRequest<void>('/api/admin/logout', {
    method: 'POST',
  });
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
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
    });
  } catch {
    throw new AdminApiError('无法连接后端服务', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const errorBody =
      body && typeof body === 'object' && 'error' in body
        ? body.error
        : undefined;
    throw new AdminApiError(
      errorBody?.message ?? `请求失败（HTTP ${response.status}）`,
      response.status,
      errorBody?.code,
    );
  }

  if (!body) {
    throw new AdminApiError('服务器返回了空响应', response.status);
  }

  return body as T;
}
