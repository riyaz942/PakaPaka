import { fetchWaniKaniAssignments, WaniKaniClient } from '@/data/import/wanikaniClient';

describe('wanikaniClient', () => {
  const apiKey = 'wk-test-api-key-12345';
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  function assertCredentialNeverLogged(): void {
    const allCalls = [
      ...consoleLogSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ];

    for (const call of allCalls) {
      for (const arg of call) {
        if (typeof arg === 'string') {
          expect(arg).not.toContain(apiKey);
        }
      }
    }
  }

  it('paginates assignments successfully', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'RateLimit-Remaining': '59',
          'RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
        }),
        json: async () => ({
          object: 'collection',
          pages: { next_url: 'https://api.wanikani.com/v2/assignments?page=2' },
          data: [
            {
              object: 'assignment',
              data: {
                id: 1,
                subject_id: 42,
                srs_stage: 3,
                srs_stage_name: 'apprentice',
                burned_at: null,
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'RateLimit-Remaining': '58',
        }),
        json: async () => ({
          object: 'collection',
          pages: { next_url: null },
          data: [
            {
              object: 'assignment',
              data: {
                id: 2,
                subject_id: 43,
                srs_stage: 9,
                srs_stage_name: 'burned',
                burned_at: '2026-01-01T00:00:00.000Z',
              },
            },
          ],
        }),
      });

    const result = await fetchWaniKaniAssignments(apiKey, { fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[1]?.srs_stage).toBe(9);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers.Authorization).toBe(`Bearer ${apiKey}`);
    assertCredentialNeverLogged();
  });

  it('returns readable auth errors for invalid keys', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({}),
    });

    const result = await fetchWaniKaniAssignments(apiKey, { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('wanikani_invalid_key');
      expect(result.error.userMessage).toContain('invalid');
    }
  });

  it('returns readable auth errors for forbidden keys', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({}),
    });

    const result = await fetchWaniKaniAssignments(apiKey, { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('wanikani_invalid_key');
      expect(result.error.userMessage).toContain('invalid');
    }
  });

  it('retries rate-limited responses using rate-limit headers', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
        }),
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'RateLimit-Remaining': '59',
        }),
        json: async () => ({
          object: 'collection',
          pages: { next_url: null },
          data: [],
        }),
      });

    const result = await fetchWaniKaniAssignments(apiKey, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalled();
  });

  it('returns rate-limit error after retry exhaustion', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        'RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
      }),
      json: async () => ({}),
    });

    const client = new WaniKaniClient(apiKey, { fetchImpl, sleep });
    const result = await client.fetchAllAssignments();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('wanikani_rate_limited');
    }
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
  });

  it('retries server errors with bounded backoff and succeeds', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'RateLimit-Remaining': '59',
        }),
        json: async () => ({
          object: 'collection',
          pages: { next_url: null },
          data: [],
        }),
      });

    const result = await fetchWaniKaniAssignments(apiKey, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('returns server error after retry exhaustion on 5xx', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers(),
      json: async () => ({}),
    });

    const result = await fetchWaniKaniAssignments(apiKey, { fetchImpl, sleep });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('wanikani_server_error');
      expect(result.error.userMessage).toContain('temporarily unavailable');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('returns network unavailable errors', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));

    const result = await fetchWaniKaniAssignments(apiKey, { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('wanikani_network_error');
      expect(result.error.userMessage).toContain('connection');
    }
  });
});
