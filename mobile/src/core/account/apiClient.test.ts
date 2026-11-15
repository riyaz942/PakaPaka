import { createApiClient, toAccountError } from '@/core/account/apiClient';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('toAccountError', () => {
  it('fetch rejection → network', async () => {
    const err = await toAccountError(null);
    expect(err.code).toBe('network');
    expect(err.userMessage).toBe("Can't reach the server. Check your connection and try again.");
  });

  it('non-JSON 429 → paused', async () => {
    const err = await toAccountError(new Response('Too Many Requests', { status: 429 }));
    expect(err.code).toBe('paused');
    expect(err.userMessage).toContain('Sync is paused');
  });

  it('non-JSON 503 → paused', async () => {
    const err = await toAccountError(new Response('<html>busy</html>', { status: 503 }));
    expect(err.code).toBe('paused');
  });

  it('JSON quota_exceeded → paused', async () => {
    const err = await toAccountError(json(503, { error: 'quota_exceeded' }));
    expect(err.code).toBe('paused');
  });

  it('JSON rate_limited → rate_limited', async () => {
    const err = await toAccountError(json(429, { error: 'rate_limited' }));
    expect(err.code).toBe('rate_limited');
  });

  it('401 → session_ended', async () => {
    const err = await toAccountError(json(401, { error: 'unauthorized' }));
    expect(err.code).toBe('session_ended');
  });

  it('404 → not_found, other → server', async () => {
    expect((await toAccountError(json(404, { error: 'not_found' }))).code).toBe('not_found');
    expect((await toAccountError(json(500, { error: 'server_error' }))).code).toBe('server');
  });
});

describe('createApiClient', () => {
  it('adds bearer header', async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, {}));
    const api = createApiClient({ baseUrl: 'https://x.test', fetch: fetchFn });

    const res = await api.request('/api/thing', { method: 'POST', accessToken: 'tok' });

    expect(res.ok).toBe(true);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://x.test/api/thing');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(init.method).toBe('POST');
    expect(init).not.toHaveProperty('accessToken');
  });

  it('sends no Authorization header without a token', async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, {}));
    const api = createApiClient({ baseUrl: 'https://x.test', fetch: fetchFn });
    await api.request('/api/thing', {});
    expect(new Headers(fetchFn.mock.calls[0][1].headers).has('Authorization')).toBe(false);
  });

  it('maps a rejected fetch to network', async () => {
    const api = createApiClient({
      baseUrl: 'https://x.test',
      fetch: jest.fn().mockRejectedValue(new Error('offline')),
    });
    const res = await api.request('/api/thing', {});
    expect(res).toMatchObject({ ok: false, error: { code: 'network' } });
  });

  it('maps a non-2xx response through toAccountError', async () => {
    const api = createApiClient({
      baseUrl: 'https://x.test',
      fetch: jest.fn().mockResolvedValue(json(429, { error: 'rate_limited' })),
    });
    const res = await api.request('/api/thing', {});
    expect(res).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
  });
});
