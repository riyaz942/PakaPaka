import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import {
  __mockPlayedBuffers,
  __mockResetAudioApi,
} from '../../../__mocks__/react-native-audio-api';
import {
  __mockExecutorchState,
  __mockFailSynthesize,
  __mockResetExecutorch,
  __mockSetSynthesis,
} from '../../../__mocks__/react-native-executorch';
import {
  __mockFetchCallCount,
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
  __mockSetRemoteSize,
} from '../../../__mocks__/react-native-executorch-expo-resource-fetcher';

import { PronunciationButton } from '@/components/learn/PronunciationButton';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

describe('PronunciationButton', () => {
  beforeEach(() => {
    __mockResetAudioApi();
    __mockResetExecutorch();
    __mockResetResourceFetcher();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    __mockSetSynthesis(new Float32Array([0.1, 0.2]));
  });

  it('speaks the given text through the on-device TTS pipeline', async () => {
    render(<PronunciationButton text="日" />);

    fireEvent.press(screen.getByTestId('pronunciation-button'));

    await waitFor(() => expect(__mockExecutorchState().synthesizeCalls).toEqual(['日']));
    await waitFor(() => expect(__mockPlayedBuffers()).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByTestId('pronunciation-button').props.accessibilityState.busy).toBe(false),
    );
  });

  it('shows a busy state while synthesis/playback is in flight', async () => {
    render(<PronunciationButton text="日" />);

    fireEvent.press(screen.getByTestId('pronunciation-button'));

    await waitFor(() => {
      const state = screen.getByTestId('pronunciation-button').props.accessibilityState;
      expect(state.busy).toBe(true);
      expect(state.disabled).toBe(true);
    });
  });

  it('surfaces a synthesis failure on the button rather than failing silently', async () => {
    __mockFailSynthesize(new Error('model not loaded'));
    render(<PronunciationButton text="日" />);

    fireEvent.press(screen.getByTestId('pronunciation-button'));

    await waitFor(() =>
      expect(screen.getByTestId('pronunciation-button-error')).toBeTruthy(),
    );
    expect(screen.getByTestId('pronunciation-button').props.accessibilityLabel).toMatch(
      /last attempt failed/i,
    );
    expect(__mockPlayedBuffers()).toHaveLength(0);
  });

  it('lets the learner retry after a failure', async () => {
    __mockFailSynthesize(new Error('model not loaded'));
    render(<PronunciationButton text="日" />);

    fireEvent.press(screen.getByTestId('pronunciation-button'));
    await waitFor(() => expect(screen.getByTestId('pronunciation-button-error')).toBeTruthy());

    __mockFailSynthesize(null as unknown as Error);
    fireEvent.press(screen.getByTestId('pronunciation-button'));

    await waitFor(() => expect(__mockPlayedBuffers()).toHaveLength(1));
    expect(screen.queryByTestId('pronunciation-button-error')).toBeNull();
  });

  describe('when the voice models are not downloaded', () => {
    beforeEach(() => {
      __mockResetResourceFetcher();
      for (const source of voiceModelSources()) {
        if (typeof source === 'string') {
          __mockSetRemoteSize(source, 150_000_000);
        }
      }
    });

    it('offers the download instead of only showing an error', async () => {
      render(<PronunciationButton text="日" />);

      fireEvent.press(screen.getByTestId('pronunciation-button'));

      await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
      expect(screen.queryByTestId('pronunciation-button-error')).toBeNull();
      expect(__mockFetchCallCount()).toBe(0);
    });

    it('plays the word once the learner downloads the models', async () => {
      render(<PronunciationButton text="日" />);

      fireEvent.press(screen.getByTestId('pronunciation-button'));
      await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
      fireEvent.press(screen.getByTestId('voice-model-download'));

      await waitFor(() => expect(__mockPlayedBuffers()).toHaveLength(1));
      expect(__mockFetchCallCount()).toBe(1);
      expect(screen.queryByTestId('voice-model-download')).toBeNull();
    });

    it('closes the download prompt on Not now without playing', async () => {
      render(<PronunciationButton text="日" />);

      fireEvent.press(screen.getByTestId('pronunciation-button'));
      await waitFor(() => expect(screen.getByTestId('voice-model-cancel')).toBeTruthy());
      fireEvent.press(screen.getByTestId('voice-model-cancel'));

      await waitFor(() => expect(screen.queryByTestId('voice-model-cancel')).toBeNull());
      expect(__mockPlayedBuffers()).toHaveLength(0);
    });
  });

  it('renders nothing on web, where there is no on-device voice', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      render(<PronunciationButton text="日" />);
      expect(screen.queryByTestId('pronunciation-button')).toBeNull();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    }
  });
});
