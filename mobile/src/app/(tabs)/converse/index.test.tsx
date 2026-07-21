import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ConverseScreen from './index';

const mockUserDb = {};
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  // Stable reference: a fresh object per render would re-run [userDb] effects.
  useDatabase: () => ({ userDb: mockUserDb }),
}));

let mockOnline = true;
jest.mock('@/data/ai/connectivity', () => ({
  isOnline: () => Promise.resolve(mockOnline),
}));

let mockConfigured: string[] = [];
jest.mock('@/data/ai/byokCredentialStore', () => ({
  listConfiguredByokProviders: () => Promise.resolve({ ok: true, value: mockConfigured }),
  saveByokKey: jest.fn(),
}));

jest.mock('@/data/ai/recentGrammarRepository', () => ({
  listRecentGrammar: () => [],
}));

// The fake `userDb` has no query methods, so stub the preference reads the
// screen and KeySetup make on mount. Kept to the AI keys — everything else in
// the module stays real.
jest.mock('@/data/user/preferencesRepository', () => ({
  ...jest.requireActual('@/data/user/preferencesRepository'),
  getAiActiveProvider: () => null,
  getAiModel: () => null,
  getAiOpenAiBaseUrl: () => null,
  setAiActiveProvider: jest.fn(),
  setAiModel: jest.fn(),
  setAiOpenAiBaseUrl: jest.fn(),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <ConverseScreen />
    </SafeAreaProvider>,
  );
}

describe('ConverseScreen', () => {
  beforeEach(() => {
    mockOnline = true;
    mockConfigured = [];
  });

  it('shows key setup when no BYOK key is configured (FR87)', async () => {
    renderScreen();

    expect(await screen.findByLabelText(/API key/i)).toBeTruthy();
    // The start picker is the *configured* empty state, not this one.
    expect(screen.queryByTestId('start-random')).toBeNull();
  });

  it('shows the start picker once a key is configured (UX-DR21)', async () => {
    mockConfigured = ['openai'];

    renderScreen();

    expect(await screen.findByTestId('start-random')).toBeTruthy();
    expect(screen.getByTestId('start-practise_recent_grammar')).toBeTruthy();
    expect(screen.getByTestId('start-choose_grammar')).toBeTruthy();
    expect(screen.getByTestId('start-role_play')).toBeTruthy();
    expect(screen.queryByLabelText(/API key/i)).toBeNull();
  });

  it('shows a clear requires-internet state when offline (NFR24, UX-DR22)', async () => {
    mockOnline = false;
    mockConfigured = ['openai'];

    renderScreen();

    expect(await screen.findByText('Conversation needs internet')).toBeTruthy();
    expect(screen.getByText(/Everything else in the app still works offline/i)).toBeTruthy();
    // Offline takes precedence: no chat surface is offered.
    expect(screen.queryByTestId('start-random')).toBeNull();
  });

  it('offers past conversations from the header regardless of state', async () => {
    mockConfigured = ['openai'];

    renderScreen();

    await waitFor(() => expect(screen.getByTestId('converse-history-entry')).toBeTruthy());
    expect(screen.getByLabelText('Past conversations')).toBeTruthy();
  });

  it('does not offer a mic affordance — voice is Story 5.2', async () => {
    mockConfigured = ['openai'];

    renderScreen();

    await screen.findByTestId('start-random');
    expect(screen.queryByLabelText(/mic|microphone|push to talk/i)).toBeNull();
  });
});
