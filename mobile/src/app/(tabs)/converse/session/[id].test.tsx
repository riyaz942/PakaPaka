import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
  __mockSetRemoteSize,
} from '../../../../../__mocks__/react-native-executorch-expo-resource-fetcher';
import { __mockResetExecutorch, __mockSetSynthesis } from '../../../../../__mocks__/react-native-executorch';
import { __mockResetAudioApi } from '../../../../../__mocks__/react-native-audio-api';

import { voiceModelSources } from '@/data/ai/voice/voiceModels';

import ConversationSessionScreen from './[id]';

const mockUserDb = {};
const mockSend = jest.fn().mockResolvedValue(true);

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'session-1' }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: mockUserDb }),
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
jest.mock('@/data/hooks/useAiConversation', () => ({
  useAiConversation: () => ({
    session: { id: 'session-1', mode: 'free_chat', endedAt: null },
    messages: mockMessages,
    pendingReply: '',
    isStreaming: false,
    wrapUpSignalled: false,
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

    fireEvent.press(screen.getByTestId('ptt-exit'));

    await waitFor(() => expect(screen.queryByTestId('ptt-overlay')).toBeNull());
    // The same message list the chat view had before — nothing reconciled.
    expect(screen.getByText('元気')).toBeTruthy();
  });
});
