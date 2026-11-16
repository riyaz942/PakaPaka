import { createAccountSession } from '@/data/account/session.web';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

let fetchMock: jest.Mock;
let assign: jest.Mock;
let cookie: string;

const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => String(url) === path);

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  assign = jest.fn();
  cookie = '';
  Object.defineProperty(globalThis, 'document', {
    value: {
      get cookie() {
        return cookie;
      },
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: { location: { assign } },
    configurable: true,
  });
});

describe('createAccountSession (web)', () => {
  it('isSignedIn reads the pp_signed_in cookie', async () => {
    const session = createAccountSession();
    cookie = 'theme=dark';
    expect(await session.isSignedIn()).toBe(false);
    cookie = 'theme=dark; pp_signed_in=1';
    expect(await session.isSignedIn()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signIn goes to the server sign-in page', async () => {
    const result = await createAccountSession().signIn();

    expect(result.ok).toBe(true);
    expect(assign).toHaveBeenCalledWith('/auth/signin');
  });

  it('getAccount calls a relative URL', async () => {
    const info = { provider: 'google', devices: [] };
    fetchMock.mockResolvedValue(json(200, info));

    const result = await createAccountSession().getAccount();

    expect(result).toEqual({ ok: true, value: info });
    expect(calls('/api/account')).toHaveLength(1);
  });

  it('refreshes once and retries once after a 401', async () => {
    const info = { provider: 'google', devices: [] };
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(json(204))
      .mockResolvedValueOnce(json(200, info));

    const result = await createAccountSession().getAccount();

    expect(result).toEqual({ ok: true, value: info });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/account',
      '/api/auth/refresh',
      '/api/account',
    ]);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('refreshes once for concurrent calls', async () => {
    let releaseRefresh: (res: Response) => void = () => {};
    const accountCalls: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/auth/refresh') {
        return new Promise<Response>((resolve) => {
          releaseRefresh = resolve;
        });
      }
      accountCalls.push(url);
      // The first request of each call has the expired cookie; the retry works.
      return Promise.resolve(
        accountCalls.length <= 2
          ? json(401, { error: 'unauthorized' })
          : json(200, { provider: 'google', devices: [] }),
      );
    });
    const session = createAccountSession();

    const both = Promise.all([session.getAccount(), session.getAccount()]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRefresh(json(204));
    const [a, b] = await both;

    expect(a.ok && b.ok).toBe(true);
    expect(calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('refresh 401 ends the session without retrying the call', async () => {
    fetchMock.mockImplementation(async () => json(401, { error: 'unauthorized' }));

    const result = await createAccountSession().getAccount();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('session_ended');
    expect(calls('/api/account')).toHaveLength(1);
    expect(calls('/api/auth/refresh')).toHaveLength(1);
  });

  it('a 401 after a good refresh is a server error, not a sign-out', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(json(204))
      .mockResolvedValueOnce(json(401, { error: 'unauthorized' }));

    const result = await createAccountSession().getAccount();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
  });

  it('signOut works after the access cookie expired', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(json(204))
      .mockResolvedValueOnce(json(204));

    const result = await createAccountSession().signOut();

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/auth/signout',
      '/api/auth/refresh',
      '/api/auth/signout',
    ]);
  });

  it('signOut reports a server failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));

    const result = await createAccountSession().signOut();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('network');
  });

  it('removeDevice, signOutEverywhere and deleteAccount use the right routes', async () => {
    fetchMock.mockImplementation(async () => json(204));
    const session = createAccountSession();

    await session.removeDevice('dev 1');
    await session.signOutEverywhere();
    await session.deleteAccount();

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${String(url)}`)).toEqual([
      'DELETE /api/account/devices/dev%201',
      'POST /api/account/signout-all',
      'DELETE /api/account',
    ]);
  });

  it('maps a network failure to the network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));

    const result = await createAccountSession().deleteAccount();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('network');
  });
});
