import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockFailListDownloaded,
  __mockFetchCallCount,
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
  __mockSetRemoteSize,
} from '../../../../../__mocks__/react-native-executorch-expo-resource-fetcher';
import { __mockResetExecutorch, __mockSetSynthesis } from '../../../../../__mocks__/react-native-executorch';
import { __mockResetAudioApi } from '../../../../../__mocks__/react-native-audio-api';

import { voiceModelSources } from '@/data/ai/voice/voiceModels';

import ConversationSessionScreen from './[id]';

const mockUserDb = {};
// An empty curriculum: these tests are about voice promotion, so no reply word
// links off the chat word index (15.1).
const mockCurriculumDb = { getAllSync: () => [] };
// Commits the turn the way the real hook does, so "the transcript survives the
// exit" can be asserted against a list the test actually changed.
const mockSend = jest.fn(async (text: string) => {
  mockMessages = [...mockMessages, { id: `u${mockMessages.length}`, role: 'user', content: text }];
  return true;
});

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'session-1' }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: mockUserDb, curriculumDb: mockCurriculumDb }),
}));

jest.mock('@/data/ai/connectivity', () => ({
  isOnline: () => Promise.resolve(true),
}));

jest.mock('@/data/ai/recentGrammarRepository', () => ({
  listRecentGrammar: () => [],
  getGrammarTopicById: () => null,
}));

jest.mock('@/data/user/aiSessionRepository', () => ({
  getAiSession: () => ({
    id: 'session-1',
    mode: 'free_chat',
    provider: 'openai',
    model: 'gpt-4o-mini',
    endedAt: null,
  }),
  listAiMessages: () => [],
}));

let mockMessages: { id: string; role: string; content: string }[] = [];
let mockWrapUpSignalled = false;
jest.mock('@/data/hooks/useAiConversation', () => ({
  useAiConversation: () => ({
    session: { id: 'session-1', mode: 'free_chat', endedAt: null },
    messages: mockMessages,
    pendingReply: '',
    isStreaming: false,
    get wrapUpSignalled() {
      return mockWrapUpSignalled;
    },
    error: null,
    send: mockSend,
    end: jest.fn(),
    dismissWrapUp: jest.fn(),
    dismissError: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({ mode: 'auto', knownKanji: new Set<string>() }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <ConversationSessionScreen />
    </SafeAreaProvider>,
  );
}

function rerenderScreen(rerender: (ui: React.ReactElement) => void) {
  rerender(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <ConversationSessionScreen />
    </SafeAreaProvider>,
  );
}

function markModelsPresent() {
  __mockMarkDownloaded(...(voiceModelSources() as string[]));
}

function sizeModels() {
  for (const source of voiceModelSources()) {
    if (typeof source === 'string') {
      __mockSetRemoteSize(source, 150_000_000);
    }
  }
}

describe('ConversationSessionScreen voice promotion', () => {
  beforeEach(() => {
    __mockResetResourceFetcher();
    __mockResetExecutorch();
    __mockResetAudioApi();
    __mockSetSynthesis(new Float32Array([0.1]));
    mockMessages = [{ id: 'm1', role: 'assistant', content: '元気[げんき]ですか。' }];
    mockWrapUpSignalled = false;
    mockSend.mockClear();
  });

  it('starts in chat mode with no conversation-mode surface (AC1)', async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    expect(screen.queryByTestId('ptt-overlay')).toBeNull();
  });

  it('promotes to conversation mode when the models are already downloaded (AC1)', async () => {
    markModelsPresent();
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));

    await waitFor(() => expect(screen.getByTestId('ptt-overlay')).toBeTruthy());
  });

  it('prompts for the download instead when the models are missing (AC5)', async () => {
    sizeModels();
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));

    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    expect(screen.queryByTestId('ptt-overlay')).toBeNull();
  });

  it('keeps the composer usable while the download prompt is open (NFR25)', async () => {
    sizeModels();
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));
    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText('Your message'), 'まだ打てます');
    fireEvent.press(screen.getByTestId('composer-send'));

    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('まだ打てます'));
  });

  it('enters conversation mode once the download finishes', async () => {
    sizeModels();
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));
    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-download'));

    await waitFor(() => expect(screen.getByTestId('ptt-overlay')).toBeTruthy());
  });

  it('returns to the chat view with the transcript intact on exit (AC3)', async () => {
    markModelsPresent();
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));
    await waitFor(() => expect(screen.getByTestId('ptt-overlay')).toBeTruthy());

    // A turn confirmed and sent from conversation mode, through the same send.
    fireEvent.changeText(screen.getByLabelText('Your spoken message'), 'げんきです');
    fireEvent.press(screen.getByTestId('ptt-send'));
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('げんきです'));

    fireEvent.press(screen.getByTestId('ptt-exit'));

    await waitFor(() => expect(screen.queryByTestId('ptt-overlay')).toBeNull());
    // Both turns are in the chat below, unchanged — nothing reconciled.
    expect(screen.getByText('元気')).toBeTruthy();
    expect(screen.getByText('げんきです')).toBeTruthy();
  });

  it('starts no download by itself — the mic only ever asks (AC5)', async () => {
    sizeModels();
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    expect(__mockFetchCallCount()).toBe(0);

    fireEvent.press(screen.getByTestId('composer-mic'));
    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());

    expect(__mockFetchCallCount()).toBe(0);
  });

  it('shows why voice is unavailable when the presence check fails', async () => {
    __mockFailListDownloaded(new Error('EPERM: permission denied'));
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));

    await waitFor(() =>
      expect(screen.getByText(/could not check whether the voice models/i)).toBeTruthy(),
    );
    expect(screen.queryByTestId('ptt-overlay')).toBeNull();
    expect(screen.queryByTestId('voice-model-download')).toBeNull();
  });

  it('drops the download prompt when wrap-up arrives', async () => {
    sizeModels();
    const { rerender } = renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));
    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());

    mockWrapUpSignalled = true;
    rerenderScreen(rerender);

    await waitFor(() => expect(screen.queryByTestId('voice-model-download')).toBeNull());
    expect(screen.getByTestId('confirm-end-session')).toBeTruthy();
  });

  it('drops conversation mode when wrap-up arrives so Finish is reachable', async () => {
    markModelsPresent();
    const { rerender } = renderScreen();

    await waitFor(() => expect(screen.getByTestId('composer-mic')).toBeTruthy());
    fireEvent.press(screen.getByTestId('composer-mic'));
    await waitFor(() => expect(screen.getByTestId('ptt-overlay')).toBeTruthy());

    mockWrapUpSignalled = true;
    rerenderScreen(rerender);

    await waitFor(() => expect(screen.queryByTestId('ptt-overlay')).toBeNull());
    expect(screen.getByTestId('confirm-end-session')).toBeTruthy();
  });
});
