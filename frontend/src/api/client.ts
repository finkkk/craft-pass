interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
    readonly requestId?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiClientError('无法连接后端服务，请确认服务已经启动', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const error =
      body && typeof body === 'object' && 'error' in body
        ? body.error
        : undefined;
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ApiClientError(
      error?.message ?? `请求失败（HTTP ${response.status}）`,
      response.status,
      error?.code,
      error?.details,
      error?.requestId,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }

  if (!body) {
    throw new ApiClientError('服务器返回了空响应', response.status);
  }

  return body as T;
}
