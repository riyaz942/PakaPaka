import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SignInSyncWait } from '@/components/sync/SignInSyncWait';

let mockError: string | null = null;
jest.mock('@/providers/SyncProvider', () => ({
  useSync: () => ({ error: mockError }),
}));

beforeEach(() => {
  mockError = null;
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('SignInSyncWait', () => {
  it('renders nothing when there is no wait', () => {
    render(<SignInSyncWait wait="none" onRetry={jest.fn()} onStartWithoutSync={jest.fn()} />);
    expect(screen.queryByTestId('signin-sync-wait')).toBeNull();
  });

  it('loading shows a spinner and no text', () => {
    render(<SignInSyncWait wait="loading" onRetry={jest.fn()} onStartWithoutSync={jest.fn()} />);
    expect(screen.getByTestId('signin-sync-wait')).toBeTruthy();
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByText('Getting your progress…')).toBeNull();
    expect(screen.queryByText('Start without sync')).toBeNull();
  });

  it('syncing shows Getting your progress…', () => {
    render(<SignInSyncWait wait="syncing" onRetry={jest.fn()} onStartWithoutSync={jest.fn()} />);
    expect(screen.getByText('Getting your progress…')).toBeTruthy();
    expect(screen.queryByText('Start without sync')).toBeNull();
  });

  it('failed shows the error and both buttons call their handlers', () => {
    mockError = 'No connection.';
    const onRetry = jest.fn();
    const onStart = jest.fn();
    render(<SignInSyncWait wait="failed" onRetry={onRetry} onStartWithoutSync={onStart} />);
    expect(screen.getByText('No connection.')).toBeTruthy();
    fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Start without sync'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('failed without an error text shows Sync did not finish.', () => {
    render(<SignInSyncWait wait="failed" onRetry={jest.fn()} onStartWithoutSync={jest.fn()} />);
    expect(screen.getByText('Sync did not finish.')).toBeTruthy();
  });

  it('after 10 s of waiting, Start without sync shows', () => {
    const onStart = jest.fn();
    render(<SignInSyncWait wait="syncing" onRetry={jest.fn()} onStartWithoutSync={onStart} />);
    expect(screen.queryByText('Start without sync')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    fireEvent.press(screen.getByText('Start without sync'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
