import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockPlayedBuffers,
  __mockResetAudioApi,
  __mockSetPermission,
  __mockSetPermissionRequestResult,
  __mockSetRecordedChunks,
} from '../../../__mocks__/react-native-audio-api';
import {
  __mockExecutorchState,
  __mockFailTranscribe,
  __mockResetExecutorch,
  __mockSetSynthesis,
  __mockSetTranscription,
} from '../../../__mocks__/react-native-executorch';
import {
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
} from '../../../__mocks__/react-native-executorch-expo-resource-fetcher';

import { PttOverlay } from '@/components/converse/PttOverlay';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: {} }),
}));

// Cloud opt-in defaults off, so the overlay's transcription path is the
// on-device model — the cloud routing itself is covered in transcription.test.
jest.mock('@/data/user/preferencesRepository', () => ({
  getCloudSttOptIn: () => false,
}));

function renderOverlay(overrides: Partial<React.ComponentProps<typeof PttOverlay>> = {}) {
  const props = {
    assistantText: '元気[げんき]ですか。' as string | null,
    conversationError: null as string | null,
    isStreaming: false,
    onSend: jest.fn().mockResolvedValue(true),
    onExit: jest.fn(),
    ...overrides,
  };
  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <PttOverlay {...props} />
    </SafeAreaProvider>,
  );
  return { ...props, ...result };
}

/** Hold is disabled while TTS plays — wait until the mic is interactive again. */
async function awaitMicReady() {
  await waitFor(() =>
    expect(screen.getByTestId('ptt-button').props.accessibilityState.disabled).toBe(false),
  );
}

async function holdAndRelease() {
  await awaitMicReady();
  const button = screen.getByTestId('ptt-button');
  fireEvent(button, 'pressIn');
  await waitFor(() => expect(screen.getByTestId('ptt-button').props.accessibilityState.busy).toBe(true));
  fireEvent(button, 'pressOut');
}

/** The transcript arrives asynchronously; the buttons stay disabled until it does. */
async function awaitTranscript(expected: string) {
  await waitFor(() =>
    expect(screen.getByLabelText('Your spoken message').props.value).toBe(expected),
  );
}

describe('PttOverlay', () => {
  beforeEach(() => {
    __mockResetAudioApi();
    __mockResetExecutorch();
    __mockResetResourceFetcher();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    __mockSetSynthesis(new Float32Array([0.1, 0.2]));
    __mockSetRecordedChunks([new Float32Array([0.3, 0.4])]);
  });

  it('shows the AI line as readable text, not bracket markup (FR98)', async () => {
    renderOverlay();

    await waitFor(() => expect(screen.getByTestId('ptt-assistant-line')).toBeTruthy());
    expect(screen.getByText('元気ですか。')).toBeTruthy();
    expect(screen.queryByText(/\[げんき\]/)).toBeNull();
  });

  it('speaks the AI line as well as showing it (FR98)', async () => {
    renderOverlay();

    await waitFor(() => expect(__mockExecutorchState().synthesizeCalls).toEqual(['元気ですか。']));
    await waitFor(() => expect(__mockPlayedBuffers()).toHaveLength(1));
  });

  it('speaks each new AI line once, not on every render', async () => {
    const { rerender, onSend, onExit } = renderOverlay();

    await waitFor(() => expect(__mockExecutorchState().synthesizeCalls).toHaveLength(1));

    rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <PttOverlay
          assistantText="元気[げんき]ですか。"
          conversationError={null}
          isStreaming={false}
          onSend={onSend}
          onExit={onExit}
        />
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(__mockExecutorchState().synthesizeCalls).toHaveLength(1));
    expect(__mockExecutorchState().synthesizeCalls).toHaveLength(1);
  });

  it('puts the transcript in an editable field instead of sending it (FR99)', async () => {
    const props = renderOverlay();
    __mockSetTranscription('げんきです');

    await holdAndRelease();

    await waitFor(() =>
      expect(screen.getByLabelText('Your spoken message').props.value).toBe('げんきです'),
    );
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('transcribes at 16 kHz Japanese', async () => {
    renderOverlay();
    __mockSetTranscription('はい');

    await holdAndRelease();

    await waitFor(() => expect(__mockExecutorchState().transcribeCalls).toHaveLength(1));
    expect(__mockExecutorchState().transcribeCalls[0].language).toBe('ja');
  });

  it('sends the confirmed transcript through the shared send path', async () => {
    const props = renderOverlay();
    __mockSetTranscription('げんきです');

    await holdAndRelease();
    await awaitTranscript('げんきです');
    fireEvent.press(screen.getByTestId('ptt-send'));

    await waitFor(() => expect(props.onSend).toHaveBeenCalledWith('げんきです'));
  });

  it('lets the learner edit the transcript before sending', async () => {
    const props = renderOverlay();
    __mockSetTranscription('げんきでず');

    await holdAndRelease();
    await awaitTranscript('げんきでず');
    fireEvent.changeText(screen.getByLabelText('Your spoken message'), 'げんきです');
    fireEvent.press(screen.getByTestId('ptt-send'));

    await waitFor(() => expect(props.onSend).toHaveBeenCalledWith('げんきです'));
  });

  it('lets the learner discard a bad transcript and try again', async () => {
    renderOverlay();
    __mockSetTranscription('まちがい');

    await holdAndRelease();
    await awaitTranscript('まちがい');
    fireEvent.press(screen.getByTestId('ptt-clear'));

    expect(screen.getByLabelText('Your spoken message').props.value).toBe('');
  });

  it('clears the field after a sent turn is accepted', async () => {
    renderOverlay();
    __mockSetTranscription('げんきです');

    await holdAndRelease();
    await awaitTranscript('げんきです');
    fireEvent.press(screen.getByTestId('ptt-send'));

    await awaitTranscript('');
  });

  it('surfaces a transcription failure rather than sending nothing', async () => {
    const props = renderOverlay();
    __mockFailTranscribe(new Error('decode error'));

    await holdAndRelease();

    await waitFor(() => expect(screen.getByText(/could not transcribe/i)).toBeTruthy());
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('hints when transcription succeeds with empty text', async () => {
    renderOverlay();
    __mockSetTranscription('   ');

    await holdAndRelease();

    await waitFor(() => expect(screen.getByText(/didn't catch any speech/i)).toBeTruthy());
    expect(screen.getByLabelText('Your spoken message').props.value).toBe('');
  });

  it('surfaces a denied microphone rather than recording silently', async () => {
    __mockSetPermission('Undetermined');
    __mockSetPermissionRequestResult('Denied');
    renderOverlay({ assistantText: null });

    fireEvent(screen.getByTestId('ptt-button'), 'pressIn');

    await waitFor(() => expect(screen.getByText(/microphone access/i)).toBeTruthy());
  });

  it('offers an explicit exit back to the chat view', async () => {
    const props = renderOverlay();

    fireEvent.press(screen.getByTestId('ptt-exit'));

    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  it('hides the chat history — only the latest line is on screen', async () => {
    renderOverlay();

    await waitFor(() => expect(screen.getByTestId('ptt-assistant-line')).toBeTruthy());
    expect(screen.queryByTestId('chat-bubble-lookup')).toBeNull();
  });

  it('shows the conversation error here, since the chat banner is under this Modal', async () => {
    renderOverlay({ conversationError: 'Add an API key in Settings to start chatting.' });

    expect(screen.getByTestId('ptt-error')).toBeTruthy();
    expect(screen.getByText('Add an API key in Settings to start chatting.')).toBeTruthy();
  });

  it('puts the learner’s own voice fault ahead of a stale conversation error', async () => {
    __mockSetPermission('Undetermined');
    __mockSetPermissionRequestResult('Denied');
    renderOverlay({ assistantText: null, conversationError: 'That reply did not arrive.' });

    fireEvent(screen.getByTestId('ptt-button'), 'pressIn');

    await waitFor(() => expect(screen.getByText(/microphone access/i)).toBeTruthy());
    expect(screen.queryByText('That reply did not arrive.')).toBeNull();
  });

  it('disables hold-to-speak while a reply is streaming', async () => {
    renderOverlay({ isStreaming: true });

    expect(screen.getByTestId('ptt-button').props.accessibilityState.disabled).toBe(true);
  });
});
