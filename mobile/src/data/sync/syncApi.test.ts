import type { AccountSession } from '@/core/account/account.types';
import { accountError } from '@/core/account/apiClient';
import { createSyncApi } from '@/data/sync/syncApi';
import type { Result } from '@/types/result.types';

type Request = AccountSession['request'];

const okResponse = (res: Response): Result<Response> => ({
  ok: true,
  value: res,
});

function fakeRequest(res: Result<Response>): jest.MockedFunction<Request> {
  return jest.fn<ReturnType<Request>, Parameters<Request>>().mockResolvedValue(res);
}

describe('createSyncApi', () => {
  it('pull 204 → bytes null and the header revision', async () => {
    const request = fakeRequest(
      okResponse(
        new Response(null, {
          status: 204,
          headers: { 'X-Sync-Revision': '7' },
        }),
      ),
    );

    const result = await createSyncApi(request).pull(7);

    expect(result).toEqual({ ok: true, value: { revision: 7, bytes: null } });
    const [path, init] = request.mock.calls[0];
    expect(path).toBe('/api/sync?have=7');
    expect(init.method).toBe('GET');
  });

  it('pull 200 → bytes and revision', async () => {
    const body = new Uint8Array([31, 139, 8, 0, 1, 2, 3]);
    const request = fakeRequest(
      okResponse(
        new Response(body, {
          status: 200,
          headers: { 'X-Sync-Revision': '9' },
        }),
      ),
    );

    const result = await createSyncApi(request).pull(3);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revision).toBe(9);
      expect(result.value.bytes).toBeInstanceOf(Uint8Array);
      expect(Array.from(result.value.bytes ?? [])).toEqual(Array.from(body));
    }
  });

  it('pull without the header → server', async () => {
    const request = fakeRequest(okResponse(new Response(null, { status: 204 })));

    const result = await createSyncApi(request).pull(0);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
  });

  it('push sends base_revision, the gzip content type and the same bytes', async () => {
    const bytes = new Uint8Array([31, 139, 8, 0, 9]);
    const request = fakeRequest(
      okResponse(new Response(JSON.stringify({ revision: 5 }), { status: 200 })),
    );

    const result = await createSyncApi(request).push(4, bytes);

    expect(result).toEqual({ ok: true, value: { revision: 5 } });
    const [path, init] = request.mock.calls[0];
    expect(path).toBe('/api/sync?base_revision=4');
    expect(init.method).toBe('PUT');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/gzip');
    expect(init.body).toBe(bytes);
  });

  it('push with a non-integer revision in the body → server', async () => {
    const request = fakeRequest(
      okResponse(new Response(JSON.stringify({ revision: 'x' }), { status: 200 })),
    );

    const result = await createSyncApi(request).push(0, new Uint8Array([1]));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
  });

  it('push 409 → revision_conflict', async () => {
    // The real session maps the 409 body; here the fake returns what the api client returns.
    const request = fakeRequest({
      ok: false,
      error: accountError('revision_conflict'),
    });

    const result = await createSyncApi(request).push(1, new Uint8Array([1]));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('revision_conflict');
  });

  it('a request that never answers → network after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const request = jest.fn<ReturnType<Request>, Parameters<Request>>(
        (_path, init) =>
          new Promise((resolve) => {
            init.signal?.addEventListener('abort', () => {
              resolve({ ok: false, error: accountError('network') });
            });
          }),
      );

      const pending = createSyncApi(request, 15_000).pull(0);
      await jest.advanceTimersByTimeAsync(14_999);
      expect(request.mock.calls[0][1].signal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const result = await pending;

      expect(request.mock.calls[0][1].signal?.aborted).toBe(true);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('network');
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears the timer when the request settles', async () => {
    jest.useFakeTimers();
    try {
      const request = fakeRequest(
        okResponse(
          new Response(null, {
            status: 204,
            headers: { 'X-Sync-Revision': '1' },
          }),
        ),
      );

      await createSyncApi(request).pull(1);

      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
