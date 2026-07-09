import type {
  CompleteSetupPayload,
  SetupStatus,
} from '../types/setup';

interface ErrorResponse {
  error?: {
    message?: string;
  };
}

export async function getSetupStatus() {
  return setupRequest<SetupStatus>('/api/setup/status');
}

export function completeSetup(payload: CompleteSetupPayload) {
  return setupRequest<{
    setupCompleted: boolean;
    admin: { username: string };
  }>('/api/setup/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function setupRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch {
    throw new Error('无法连接后端服务，请确认后端已经启动');
  }

  const body = (await response.json().catch(() => null)) as
    | T
    | ErrorResponse
    | null;

  if (!response.ok) {
    const errorBody =
      body && typeof body === 'object' && 'error' in body
        ? body.error
        : undefined;
    throw new Error(
      errorBody?.message ?? `部署请求失败（HTTP ${response.status}）`,
    );
  }

  if (!body) {
    throw new Error('服务器返回了空响应');
  }

  return body as T;
}
