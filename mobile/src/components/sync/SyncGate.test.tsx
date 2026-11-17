import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { SyncGate } from '@/components/sync/SyncGate';

let mockStatus: 'signed_out' | 'loading' | 'signed_in' = 'signed_out';
jest.mock('@/providers/AccountProvider', () => ({
  useAccount: () => ({ status: mockStatus }),
}));

const mockRunBeforeReview = jest.fn<Promise<void>, []>();
const mockBeginStudy = jest.fn();
const mockEndStudy = jest.fn();
jest.mock('@/providers/SyncProvider', () => ({
  useSync: () => ({
    runBeforeReview: mockRunBeforeReview,
    beginStudy: mockBeginStudy,
    endStudy: mockEndStudy,
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

function renderGate(mode: 'review' | 'lesson') {
  return render(
    <SyncGate mode={mode}>
      <Text>Session</Text>
    </SyncGate>,
  );
}

/** A promise the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'signed_out';
  mockRunBeforeReview.mockReturnValue(new Promise<void>(() => {}));
});

describe('SyncGate', () => {
  it('signed out renders children at once and calls nothing', () => {
    const { unmount } = renderGate('review');

    expect(screen.getByText('Session')).toBeTruthy();
    expect(screen.queryByText('Syncing your progress…')).toBeNull();
    unmount();
    expect(mockRunBeforeReview).not.toHaveBeenCalled();
    expect(mockBeginStudy).not.toHaveBeenCalled();
    expect(mockEndStudy).not.toHaveBeenCalled();
  });

  it('review mode waits for runBeforeReview then renders children', async () => {
    mockStatus = 'signed_in';
    const run = deferred();
    mockRunBeforeReview.mockReturnValue(run.promise);
    renderGate('review');

    expect(screen.getByText('Syncing your progress…')).toBeTruthy();
    expect(screen.queryByText('Session')).toBeNull();
    expect(mockRunBeforeReview).toHaveBeenCalledTimes(1);
    expect(mockBeginStudy).not.toHaveBeenCalled();

    await act(async () => run.resolve());

    expect(screen.getByText('Session')).toBeTruthy();
    expect(screen.queryByText('Syncing your progress…')).toBeNull();
    expect(mockBeginStudy).toHaveBeenCalledTimes(1);
  });

  it('Start now appears after 3 s and renders children', async () => {
    jest.useFakeTimers();
    try {
      mockStatus = 'signed_in';
      const run = deferred();
      mockRunBeforeReview.mockReturnValue(run.promise);
      renderGate('review');

      act(() => jest.advanceTimersByTime(2999));
      expect(screen.queryByText('Start now')).toBeNull();
      act(() => jest.advanceTimersByTime(1));
      fireEvent.press(screen.getByText('Start now'));

      expect(screen.getByText('Session')).toBeTruthy();
      expect(mockBeginStudy).toHaveBeenCalledTimes(1);

      // The run ending later does not start the study a second time.
      await act(async () => run.resolve());
      expect(mockBeginStudy).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('lesson mode renders at once and calls beginStudy', () => {
    mockStatus = 'signed_in';
    renderGate('lesson');

    expect(screen.getByText('Session')).toBeTruthy();
    expect(mockBeginStudy).toHaveBeenCalledTimes(1);
    expect(mockRunBeforeReview).not.toHaveBeenCalled();
  });

  it('unmount calls endStudy', async () => {
    mockStatus = 'signed_in';
    const run = deferred();
    mockRunBeforeReview.mockReturnValue(run.promise);
    const { unmount } = renderGate('review');
    await act(async () => run.resolve());

    unmount();

    expect(mockEndStudy).toHaveBeenCalledTimes(1);
  });
});
