import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  __mockFailFetch,
  __mockFailSizeProbe,
  __mockFetchCallCount,
  __mockResetResourceFetcher,
  __mockSetRemoteSize,
} from '../../../__mocks__/react-native-executorch-expo-resource-fetcher';

import { VoiceModelDownloadPrompt } from '@/components/converse/VoiceModelDownloadPrompt';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

function sizeEverySourceAt(bytes: number) {
  for (const source of voiceModelSources()) {
    if (typeof source === 'string') {
      __mockSetRemoteSize(source, bytes);
    }
  }
}

describe('VoiceModelDownloadPrompt', () => {
  beforeEach(() => {
    __mockResetResourceFetcher();
  });

  it('discloses the real download size before offering to download (AC5)', async () => {
    // 8 sources x 150 MB = 1.2 GB
    sizeEverySourceAt(150_000_000);

    render(<VoiceModelDownloadPrompt onCancel={jest.fn()} onDownloaded={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/1\.2 GB/)).toBeTruthy());
  });

  it('never downloads without an explicit tap (NFR25)', async () => {
    sizeEverySourceAt(150_000_000);

    render(<VoiceModelDownloadPrompt onCancel={jest.fn()} onDownloaded={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    expect(__mockFetchCallCount()).toBe(0);
  });

  it('downloads on tap and reports completion', async () => {
    sizeEverySourceAt(150_000_000);
    const onDownloaded = jest.fn();

    render(<VoiceModelDownloadPrompt onCancel={jest.fn()} onDownloaded={onDownloaded} />);

    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-download'));

    await waitFor(() => expect(onDownloaded).toHaveBeenCalledTimes(1));
    expect(__mockFetchCallCount()).toBe(1);
  });

  it('shows progress while downloading', async () => {
    sizeEverySourceAt(150_000_000);

    render(<VoiceModelDownloadPrompt onCancel={jest.fn()} onDownloaded={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-download'));

    await waitFor(() => expect(screen.getByTestId('voice-model-progress')).toBeTruthy());
  });

  it('reports a failed download instead of leaving voice half-ready', async () => {
    sizeEverySourceAt(150_000_000);
    __mockFailFetch(new Error('connection lost'));
    const onDownloaded = jest.fn();

    render(<VoiceModelDownloadPrompt onCancel={jest.fn()} onDownloaded={onDownloaded} />);

    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-download'));

    await waitFor(() =>
      expect(screen.getByText(/download did not finish/i)).toBeTruthy(),
    );
    expect(onDownloaded).not.toHaveBeenCalled();
  });

  it('refuses to offer a download when the real size cannot be read', async () => {
    __mockFailSizeProbe(new Error('offline'));

    render(<VoiceModelDownloadPrompt onCancel={jest.fn()} onDownloaded={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/could not reach/i)).toBeTruthy());
    expect(screen.queryByTestId('voice-model-download')).toBeNull();
  });

  it('can be dismissed so the learner can carry on typing', async () => {
    sizeEverySourceAt(150_000_000);
    const onCancel = jest.fn();

    render(<VoiceModelDownloadPrompt onCancel={onCancel} onDownloaded={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('voice-model-cancel')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps Cancel available while downloading', async () => {
    sizeEverySourceAt(150_000_000);
    const onCancel = jest.fn();

    render(<VoiceModelDownloadPrompt onCancel={onCancel} onDownloaded={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    fireEvent.press(screen.getByTestId('voice-model-download'));

    await waitFor(() => expect(screen.getByTestId('voice-model-progress')).toBeTruthy());
    expect(screen.getByTestId('voice-model-cancel')).toBeTruthy();
  });

  it('does not claim speech is never uploaded', async () => {
    sizeEverySourceAt(150_000_000);

    render(<VoiceModelDownloadPrompt onCancel={jest.fn()} onDownloaded={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('voice-model-download')).toBeTruthy());
    expect(screen.queryByText(/nothing you say is uploaded/i)).toBeNull();
    expect(screen.getByText(/Settings toggle/i)).toBeTruthy();
  });
});