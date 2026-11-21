import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import StartScreen from './start';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

const mockSignIn = jest.fn();
const mockAccount: { status: string; error: string | null } = {
  status: 'signed_out',
  error: null,
};

jest.mock('@/providers/AccountProvider', () => ({
  useAccount: () => ({
    status: mockAccount.status,
    error: mockAccount.error,
    signIn: (...args: unknown[]) => mockSignIn(...args),
  }),
}));

function renderStart() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <StartScreen />
    </SafeAreaProvider>,
  );
}

describe('StartScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockSignIn.mockClear();
    mockAccount.status = 'signed_out';
    mockAccount.error = null;
  });

  it('shows the hero, the chain, the facts and both buttons', () => {
    renderStart();

    expect(screen.getByTestId('start-screen')).toBeTruthy();
    expect(screen.getByText('PakaPaka')).toBeTruthy();
    expect(screen.getByText('A FREE, OPEN-SOURCE JAPANESE COURSE')).toBeTruthy();
    expect(screen.getByText(/Every kanji is a story/)).toBeTruthy();
    expect(screen.getByText('you already know.')).toBeTruthy();
    expect(screen.getByText('One story, three steps')).toBeTruthy();
    expect(screen.getByText('士')).toBeTruthy();
    expect(screen.getByText('冖')).toBeTruthy();
    expect(screen.getByText('儿')).toBeTruthy();
    expect(screen.getByText('売')).toBeTruthy();
    expect(screen.getByText('売る')).toBeTruthy();
    expect(screen.getByText('Yours, with no strings')).toBeTruthy();
    expect(screen.getByText('Start without logging in')).toBeTruthy();
    expect(screen.getByText('Log in with Google')).toBeTruthy();
  });

  it('the buttons sit outside the scroll view', () => {
    renderStart();

    const scroll = within(screen.getByTestId('start-scroll'));
    expect(scroll.queryByTestId('start-begin')).toBeNull();
    expect(scroll.queryByTestId('start-login')).toBeNull();

    const actions = within(screen.getByTestId('start-actions'));
    expect(actions.getByTestId('start-begin')).toBeTruthy();
    expect(actions.getByTestId('start-login')).toBeTruthy();
  });

  it('the faint 話 does not grow with the system text size', () => {
    renderStart();

    expect(screen.getByText('話', { includeHiddenElements: true }).props.allowFontScaling).toBe(false);
  });

  it('the scroll content leaves room for the fixed bar', () => {
    renderStart();

    fireEvent(screen.getByTestId('start-actions'), 'layout', {
      nativeEvent: { layout: { height: 160 } },
    });

    expect(
      screen.getByTestId('start-scroll').props.contentContainerStyle.paddingBottom,
    ).toBeGreaterThanOrEqual(160);
  });

  it('Start learning opens the onboarding welcome', () => {
    renderStart();

    fireEvent.press(screen.getByTestId('start-begin'));

    expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
  });

  it('Log in calls signIn and is disabled unless signed out', () => {
    const view = renderStart();

    fireEvent.press(screen.getByTestId('start-login'));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    view.unmount();

    for (const status of ['loading', 'signed_in']) {
      mockSignIn.mockClear();
      mockAccount.status = status;
      const other = renderStart();
      expect(screen.getByTestId('start-login').props.accessibilityState.disabled).toBe(true);
      fireEvent.press(screen.getByTestId('start-login'));
      expect(mockSignIn).not.toHaveBeenCalled();
      other.unmount();
    }
  });

  it('a sign-in error shows under Log in', () => {
    mockAccount.error = 'Sign-in failed. Try again.';
    renderStart();

    expect(screen.getByTestId('start-login-error')).toHaveTextContent('Sign-in failed. Try again.');
  });

  it('signed in opens the onboarding welcome', () => {
    mockAccount.status = 'signed_in';
    const view = renderStart();

    expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
    expect(mockReplace).toHaveBeenCalledTimes(1);

    view.rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}>
        <StartScreen />
      </SafeAreaProvider>,
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});
