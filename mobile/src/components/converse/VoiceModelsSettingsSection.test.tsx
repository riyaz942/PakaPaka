import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  __mockDownloadCallCount,
  __mockMarkDownloaded,
  __mockResetModelFiles,
  __mockSetRemoteSize,
} from '../../../__mocks__/react-native-blob-util';

import { VoiceModelsSettingsSection } from '@/components/converse/VoiceModelsSettingsSection';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

jest.mock('expo-router', () => ({
  // Status is re-read on every focus — run the callback as an effect.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(cb, [cb]);
  },
}));

describe('VoiceModelsSettingsSection', () => {
  beforeEach(() => {
    __mockResetModelFiles();
    for (const source of voiceModelSources()) {
      if (typeof source === 'string') {
        __mockSetRemoteSize(source, 150_000_000);
      }
    }
  });

  it('shows that the models are downloaded, with no download offer', async () => {
    __mockMarkDownloaded(...(voiceModelSources() as string[]));

    render(<VoiceModelsSettingsSection />);

    await waitFor(() => expect(screen.getByText(/^Downloaded/)).toBeTruthy());
    expect(screen.queryByTestId('settings-voice-download')).toBeNull();
  });

  it('lets the learner download the models from Settings', async () => {
    render(<VoiceModelsSettingsSection />);

    await waitFor(() => expect(screen.getByText(/Not downloaded/)).toBeTruthy());
    expect(__mockDownloadCallCount()).toBe(0);

    fireEvent.press(screen.getByTestId('settings-voice-download'));
    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-download'));

    await waitFor(() => expect(screen.getByText(/^Downloaded/)).toBeTruthy());
    expect(__mockDownloadCallCount()).toBe(1);
    expect(screen.queryByTestId('voice-model-download')).toBeNull();
  });

  it('hides the prompt again on Not now', async () => {
    render(<VoiceModelsSettingsSection />);

    await waitFor(() => expect(screen.getByTestId('settings-voice-download')).toBeTruthy());
    fireEvent.press(screen.getByTestId('settings-voice-download'));
    await waitFor(() => expect(screen.getByTestId('voice-model-cancel')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-cancel'));

    await waitFor(() => expect(screen.getByTestId('settings-voice-download')).toBeTruthy());
    expect(__mockDownloadCallCount()).toBe(0);
  });
});
