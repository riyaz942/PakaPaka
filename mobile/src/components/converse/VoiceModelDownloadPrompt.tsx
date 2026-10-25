import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import {
  cancelVoiceModelDownload,
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
 * of the app waiting on it. The same card also opens from the pronunciation
 * button and Settings, so its copy names no single caller and the caller owns
 * the spacing around it.
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
  const downloadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Unmounting is not a reason to keep fetching hundreds of megabytes with
      // no progress display and no way to stop it.
      if (downloadingRef.current) {
        downloadingRef.current = false;
        void cancelVoiceModelDownload();
      }
    };
  }, []);

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
    if (downloadingRef.current) {
      return;
    }
    downloadingRef.current = true;
    setError(null);
    setProgress(0);
    const result = await downloadVoiceModels(setProgress);
    downloadingRef.current = false;
    if (!mountedRef.current) {
      return;
    }
    if (!result.ok) {
      setProgress(null);
      setError(result.error.userMessage ?? result.error.message);
      return;
    }
    setProgress(null);
    onDownloaded();
  }, [onDownloaded]);

  const handleCancel = useCallback(async () => {
    if (downloadingRef.current || progress !== null) {
      await cancelVoiceModelDownload();
      downloadingRef.current = false;
      if (mountedRef.current) {
        setProgress(null);
      }
    }
    onCancel();
  }, [onCancel, progress]);

  const isDownloading = progress !== null;

  return (
    <View className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <Text accessibilityRole="header" className="text-body font-ui-extrabold text-primary">
        Voice needs a one-time download
      </Text>
      <Text className="mt-space-sm text-body-sm font-ui text-secondary">
        The Japanese voice and speech models run on this device, so pronunciation and speaking
        practice need them on your phone first. Optional cloud transcription is a separate
        Settings toggle — it is never used unless you turn it on.
      </Text>

      {sizeBytes !== null ? (
        <Text className="mt-space-sm text-body-sm font-ui text-muted">
          Download size: {formatBytes(sizeBytes)}
        </Text>
      ) : null}

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-space-sm text-body-sm font-ui text-feedback-incorrect-deep">
          {error}
        </Text>
      ) : null}

      {isDownloading ? (
        <View className="mt-space-md gap-space-sm">
          <Text
            accessibilityLiveRegion="polite"
            className="text-body-sm font-ui text-secondary"
            testID="voice-model-progress">
            Downloading… {Math.round(progress * 100)}%
          </Text>
          <Button
            label="Cancel"
            onPress={() => {
              void handleCancel();
            }}
            testID="voice-model-cancel"
            variant="secondary"
          />
        </View>
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
            onPress={() => {
              void handleCancel();
            }}
            testID="voice-model-cancel"
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}
