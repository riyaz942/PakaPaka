import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { SectionHeading } from '@/components/common/SectionHeading';
import { VoiceModelDownloadPrompt } from '@/components/converse/VoiceModelDownloadPrompt';
import { areVoiceModelsDownloaded } from '@/data/ai/voice/modelDownloadManager';

type Status =
  | { kind: 'checking' }
  | { kind: 'ready'; downloaded: boolean }
  | { kind: 'error'; message: string };

/**
 * Settings home for the on-device voice models: whether they are on disk, and
 * the same explicit download prompt Talk's mic and the pronunciation button use.
 *
 * Presence is re-read from disk on every focus, not remembered — a download
 * started from a pronunciation button has to show up here too.
 */
export function VoiceModelsSettingsSection() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [showPrompt, setShowPrompt] = useState(false);

  const refresh = useCallback(() => {
    let cancelled = false;
    void areVoiceModelsDownloaded().then((result) => {
      if (cancelled) {
        return;
      }
      setStatus(
        result.ok
          ? { kind: 'ready', downloaded: result.value }
          : { kind: 'error', message: result.error.userMessage ?? result.error.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(refresh);

  const downloaded = status.kind === 'ready' && status.downloaded;

  return (
    <View className="mt-space-lg">
      <SectionHeading label="Voice" />
      <Text className="mt-space-xs text-caption font-ui-medium text-muted">
        Pronunciation buttons and speaking practice use Japanese voice and speech models that run
        on this device.
      </Text>

      <View className="mt-space-sm rounded-radius-md border border-border bg-surface p-space-md shadow-e1">
        {status.kind === 'checking' ? (
          <Text className="text-body font-ui-medium text-secondary">Checking…</Text>
        ) : status.kind === 'error' ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-body font-ui text-feedback-incorrect-deep">
            {status.message}
          </Text>
        ) : (
          <Text className="text-body font-ui-medium text-primary">
            {downloaded ? 'Downloaded — voice works offline.' : 'Not downloaded'}
          </Text>
        )}

        {status.kind === 'ready' && !downloaded && !showPrompt ? (
          <Button
            className="mt-space-md"
            label="Download voice models"
            onPress={() => setShowPrompt(true)}
            testID="settings-voice-download"
          />
        ) : null}
      </View>

      {showPrompt ? (
        <View className="mt-space-sm">
          <VoiceModelDownloadPrompt
            onCancel={() => setShowPrompt(false)}
            onDownloaded={() => {
              setShowPrompt(false);
              refresh();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
