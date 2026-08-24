import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

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
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
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
});
