import type {
  Agreement,
  ApplicationResult,
  ApplicationSubmission,
  Quiz,
  UiContent,
} from '../types/application';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function getAgreement() {
  return request<{
    agreement: Agreement;
    ui: UiContent;
    application: { submissionsEnabled: boolean };
  }>('/api/agreement');
}

export function getQuiz() {
  return request<Quiz>('/api/quiz');
}

export function submitApplication(payload: ApplicationSubmission) {
  return request<ApplicationResult>('/api/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch {
    throw new Error('无法连接服务器，请确认后端服务已经启动。');
  }

  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body
        ? body.error?.message
        : undefined;
    throw new Error(message ?? `请求失败（HTTP ${response.status}）`);
  }

  if (!body) {
    throw new Error('服务器返回了无法识别的响应。');
  }

  return body as T;
}
