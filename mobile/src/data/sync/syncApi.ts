import type { AccountSession } from '@/core/account/account.types';
import { accountError } from '@/core/account/apiClient';
import type { Result } from '@/types/result.types';

export type SyncApi = {
  pull(have: number): Promise<Result<{ revision: number; bytes: Uint8Array | null }>>;
  push(baseRevision: number, bytes: Uint8Array): Promise<Result<{ revision: number }>>;
};

const DEFAULT_TIMEOUT_MS = 15_000;

const failure = (code: 'network' | 'server', cause?: unknown): Result<never> => ({
  ok: false,
  error: accountError(code, cause),
});

function toRevision(value: unknown): number | null {
  const text = typeof value === 'string' ? value : null;
  if (text === null || !/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

export function createSyncApi(
  request: AccountSession['request'],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): SyncApi {
  /** One request with its own timeout. The timer lives until `read` has finished with the body. */
  async function send<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await request(path, { ...init, signal: controller.signal });
      return res.ok ? await read(res.value) : res;
    } catch (cause) {
      // A body read cut short by the timeout rejects here.
      return failure('network', cause);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    pull(have) {
      return send<{ revision: number; bytes: Uint8Array | null }>(
        `/api/sync?have=${have}`,
        { method: 'GET' },
        async (res) => {
          const revision = toRevision(res.headers.get('X-Sync-Revision'));
          if (revision === null) return failure('server');
          if (res.status === 204) return { ok: true, value: { revision, bytes: null } };
          return {
            ok: true,
            value: { revision, bytes: new Uint8Array(await res.arrayBuffer()) },
          };
        },
      );
    },

    push(baseRevision, bytes) {
      return send(
        `/api/sync?base_revision=${baseRevision}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/gzip' },
          body: bytes as BodyInit,
        },
        async (res) => {
          const body: unknown = await res.json().catch(() => null);
          const revision =
            body && typeof body === 'object' ? (body as { revision?: unknown }).revision : null;
          if (typeof revision !== 'number' || !Number.isInteger(revision)) return failure('server');
          return { ok: true, value: { revision } };
        },
      );
    },
  };
}
