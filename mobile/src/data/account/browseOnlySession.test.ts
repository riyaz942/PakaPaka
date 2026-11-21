import { browseOnlySession } from '@/data/account/browseOnlySession';

describe('browseOnlySession', () => {
  const originalFetch = global.fetch;
  let fetchSpy: jest.Mock;

  beforeEach(() => {
    fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('browseOnlySession reports signed out and never calls fetch', async () => {
    await expect(browseOnlySession.isSignedIn()).resolves.toBe(false);

    const results = await Promise.all([
      browseOnlySession.signIn(),
      browseOnlySession.getAccount(),
      browseOnlySession.removeDevice('d1'),
      browseOnlySession.signOut(),
      browseOnlySession.signOutEverywhere(),
      browseOnlySession.deleteAccount(),
      browseOnlySession.request('/api/sync', { method: 'GET' }),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('BROWSE_ONLY');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
