import type { AccountErrorCode } from '@/core/account/account.types';
import { accountErrorMessage } from '@/core/account/errorMessages';
import type { AppError, Result } from '@/types/result.types';

function accountError(code: AccountErrorCode, cause?: unknown): AppError {
  return {
    code,
    message: `Account request failed: ${code}`,
    userMessage: accountErrorMessage(code) ?? undefined,
    cause,
  };
}

async function readErrorCode(res: Response): Promise<string | null> {
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === 'object' && 'error' in body) {
    const code = (body as { error: unknown }).error;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/** `null` means the fetch itself rejected (no response). */
export async function toAccountError(res: Response | null): Promise<AppError> {
  if (res === null) return accountError('network');

  const serverCode = await readErrorCode(res);
  if (serverCode === 'quota_exceeded') return accountError('paused');
  if (serverCode === 'rate_limited') return accountError('rate_limited');
  // Cloudflare's own limit pages are not JSON.
  if (serverCode === null && (res.status === 429 || res.status === 503)) {
    return accountError('paused');
  }
  if (res.status === 401) return accountError('session_ended');
  if (res.status === 404) return accountError('not_found');
  return accountError('server');
}

export type ApiRequestInit = RequestInit & { accessToken?: string };

export type ApiClient = {
  request(path: string, init: ApiRequestInit): Promise<Result<Response>>;
};

export function createApiClient(opts: { baseUrl: string; fetch: typeof fetch }): ApiClient {
  return {
    async request(path, init) {
      const { accessToken, ...rest } = init;
      const headers = new Headers(rest.headers);
      if (accessToken !== undefined) headers.set('Authorization', `Bearer ${accessToken}`);

      let res: Response;
      try {
        res = await opts.fetch(`${opts.baseUrl}${path}`, { ...rest, headers });
      } catch (cause) {
        return { ok: false, error: accountError('network', cause) };
      }

      if (!res.ok) return { ok: false, error: await toAccountError(res) };
      return { ok: true, value: res };
    },
  };
}
