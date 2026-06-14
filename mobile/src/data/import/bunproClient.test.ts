import { BunproClient, fetchBunproGrammarProgress } from '@/data/import/bunproClient';

describe('bunproClient', () => {
  const token = 'bunpro-frontend-token-test';
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
          expect(arg).not.toContain(token);
        }
      }
    }
  }

  function buildGrammarPageResponse(grammarPointId: number) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: grammarPointId }],
        meta: { next_page: null },
      }),
    };
  }

  it('fetches grammar progress successfully', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockImplementation((url: string) => {
      if (url.includes('apprentice_1')) {
        return Promise.resolve(buildGrammarPageResponse(42));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { next_page: null } }),
      });
    });

    const result = await fetchBunproGrammarProgress(token, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            grammarPointId: '42',
            srsStage: 1,
            srsStageName: 'apprentice',
          }),
        ]),
      );
      expect(result.value.unavailableLevelCount).toBe(0);
    }
    expect(fetchImpl.mock.calls[0]?.[1]?.headers.Authorization).toBe(`Token token=${token}`);
    assertCredentialNeverLogged();
  });

  it('returns readable auth errors for invalid tokens', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const result = await fetchBunproGrammarProgress(token, { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('bunpro_invalid_token');
      expect(result.error.userMessage).toContain('frontend_api_token');
    }
  });

  it('returns readable auth errors for forbidden tokens', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    const result = await fetchBunproGrammarProgress(token, { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('bunpro_invalid_token');
    }
  });

  it('treats 500 responses as endpoint unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const client = new BunproClient(token, { fetchImpl });
    const result = await client.fetchGrammarProgress();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('bunpro_endpoint_unavailable');
      expect(result.error.userMessage).toContain('mark grammar items manually');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(9);
  });

  it('returns network unavailable errors', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));

    const result = await fetchBunproGrammarProgress(token, { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('bunpro_network_error');
      expect(result.error.userMessage).toContain('connection');
    }
  });

  it('returns partial progress when some SRS levels are unavailable', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockImplementation((url: string) => {
      if (url.includes('apprentice_1')) {
        return Promise.resolve(buildGrammarPageResponse(42));
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({}),
      });
    });

    const result = await fetchBunproGrammarProgress(token, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]?.grammarPointId).toBe('42');
      expect(result.value.unavailableLevelCount).toBe(8);
    }
  });

  it('returns no-data error when all levels respond with no grammar items', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: { next_page: null } }),
    });

    const result = await fetchBunproGrammarProgress(token, { fetchImpl, sleep });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('bunpro_no_grammar_data');
      expect(result.error.userMessage).toContain('No Bunpro grammar progress');
    }
  });

  it('does not paginate when the API omits next_page metadata', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest.fn().mockImplementation((url: string) => {
      if (url.includes('apprentice_1') && url.includes('page=1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 42 }],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { next_page: null } }),
      });
    });

    const result = await fetchBunproGrammarProgress(token, { fetchImpl, sleep });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(1);
    }
    const apprenticeCalls = fetchImpl.mock.calls.filter(([requestUrl]) =>
      String(requestUrl).includes('apprentice_1'),
    );
    expect(apprenticeCalls).toHaveLength(1);
  });
});
