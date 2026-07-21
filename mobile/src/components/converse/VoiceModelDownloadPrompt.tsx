import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import {
  downloadVoiceModels,
  getVoiceModelDownloadBytes,
} from '@/data/ai/voice/modelDownloadManager';

type VoiceModelDownloadPromptProps = {
  onCancel: () => void;
  onDownloaded: () => void;
};

/** GB to one decimal — the models are always far past the MB range. */
function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/**
 * The explicit, learner-initiated voice model download (AC5, NFR25, UX-DR23).
 *
 * Renders inline rather than as a modal on purpose: chat has to stay fully
 * usable while this is open and while the download runs. Voice is the only part
 * of the app waiting on it.
 *
 * The size shown is read from the server, never estimated — and if it cannot be
 * read, no Download button appears at all. Offering a download under a made-up
 * number would be worse than saying the host is unreachable, and a device that
 * cannot size the files cannot fetch them either.
 */
export function VoiceModelDownloadPrompt({
  onCancel,
  onDownloaded,
}: VoiceModelDownloadPromptProps) {
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getVoiceModelDownloadBytes().then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setError(result.error.userMessage ?? result.error.message);
        return;
      }
      setSizeBytes(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = useCallback(async () => {
    setError(null);
    setProgress(0);
    const result = await downloadVoiceModels(setProgress);
    if (!result.ok) {
      setProgress(null);
      setError(result.error.userMessage ?? result.error.message);
      return;
    }
    setProgress(null);
    onDownloaded();
  }, [onDownloaded]);

  const isDownloading = progress !== null;

  return (
    <View className="mx-space-md mb-space-sm rounded-radius-md border border-border bg-surface p-space-md">
      <Text accessibilityRole="header" className="text-body font-semibold text-primary">
        Speaking practice needs a one-time download
      </Text>
      <Text className="mt-space-sm text-body-sm text-secondary">
        The Japanese voice and speech models run entirely on this device, so nothing you say is
        uploaded. You can keep typing while they download.
      </Text>

      {sizeBytes !== null ? (
        <Text className="mt-space-sm text-body-sm text-secondary">
          Download size: {formatBytes(sizeBytes)}
        </Text>
      ) : null}

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-space-sm text-body-sm text-feedback-incorrect">
          {error}
        </Text>
      ) : null}

      {isDownloading ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-space-md text-body-sm text-secondary"
          testID="voice-model-progress">
          Downloading… {Math.round(progress * 100)}%
        </Text>
      ) : (
        <View className="mt-space-md flex-row gap-space-sm">
          {sizeBytes !== null ? (
            <Button
              className="flex-1"
              label="Download"
              onPress={() => {
                void handleDownload();
              }}
              testID="voice-model-download"
            />
          ) : null}
          <Button
            className="flex-1"
            label="Not now"
            onPress={onCancel}
            testID="voice-model-cancel"
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}
