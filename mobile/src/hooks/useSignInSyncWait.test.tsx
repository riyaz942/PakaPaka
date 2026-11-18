import { act, renderHook } from '@testing-library/react-native';

import { useSignInSyncWait } from '@/hooks/useSignInSyncWait';

let mockStatus: 'signed_out' | 'loading' | 'signed_in' = 'signed_out';
let mockFirstRun: 'none' | 'running' | 'ok' | 'failed' = 'none';
let mockAppliedVersion = 0;
let mockCompleted = false;

jest.mock('@/providers/AccountProvider', () => ({
  useAccount: () => ({ status: mockStatus }),
}));
jest.mock('@/providers/SyncProvider', () => ({
  useSync: () => ({ firstRun: mockFirstRun, appliedVersion: mockAppliedVersion }),
}));
jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: {}, curriculumDb: {} }),
}));
jest.mock('@/data/user/preferencesRepository', () => ({
  isOnboardingCompleted: () => mockCompleted,
}));

beforeEach(() => {
  mockStatus = 'signed_out';
  mockFirstRun = 'none';
  mockAppliedVersion = 0;
  mockCompleted = false;
});

describe('useSignInSyncWait', () => {
  it('signed out: no wait', () => {
    const { result } = renderHook(() => useSignInSyncWait());
    expect(result.current.wait).toBe('none');
  });

  it('onboarding completed: no wait even while the first run is running', () => {
    mockStatus = 'signed_in';
    mockFirstRun = 'running';
    mockCompleted = true;
    const { result } = renderHook(() => useSignInSyncWait());
    expect(result.current.wait).toBe('none');
  });

  it('signed in with onboarding not completed: syncing until the first run ends', () => {
    mockStatus = 'signed_in';
    mockFirstRun = 'none';
    const { result, rerender } = renderHook(() => useSignInSyncWait());
    expect(result.current.wait).toBe('syncing');

    mockFirstRun = 'running';
    rerender({});
    expect(result.current.wait).toBe('syncing');

    // The pull wrote the onboarding flag.
    mockCompleted = true;
    mockAppliedVersion = 1;
    mockFirstRun = 'ok';
    rerender({});
    expect(result.current.wait).toBe('none');
  });

  it('first run ok with onboarding still not completed: no wait', () => {
    mockStatus = 'signed_in';
    mockFirstRun = 'ok';
    const { result } = renderHook(() => useSignInSyncWait());
    expect(result.current.wait).toBe('none');
  });

  it('account loading: loading', () => {
    mockStatus = 'loading';
    const { result } = renderHook(() => useSignInSyncWait());
    expect(result.current.wait).toBe('loading');
  });

  it('first run failed: failed', () => {
    mockStatus = 'signed_in';
    mockFirstRun = 'failed';
    const { result } = renderHook(() => useSignInSyncWait());
    expect(result.current.wait).toBe('failed');
  });

  it('Start without sync ends the wait', () => {
    mockStatus = 'signed_in';
    mockFirstRun = 'failed';
    const { result, rerender } = renderHook(() => useSignInSyncWait());
    expect(result.current.wait).toBe('failed');

    act(() => result.current.startWithoutSync());
    expect(result.current.wait).toBe('none');

    // A later sign-in waits again.
    mockStatus = 'signed_out';
    mockFirstRun = 'none';
    rerender({});
    mockStatus = 'signed_in';
    mockFirstRun = 'running';
    rerender({});
    expect(result.current.wait).toBe('syncing');
  });
});
