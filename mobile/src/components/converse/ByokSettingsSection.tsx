import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { KeySetup } from '@/components/converse/KeySetup';
import {
  BYOK_PROVIDERS,
  type ByokProvider,
} from '@/data/ai/byokCredential.types';
import { resolveActiveProvider } from '@/data/ai/aiConfig';
import {
  discardByokKey,
  listConfiguredByokProviders,
} from '@/data/ai/byokCredentialStore';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getAiActiveProvider,
  getCloudSttOptIn,
  setAiActiveProvider,
  setCloudSttOptIn,
} from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';

const PROVIDER_LABELS: Record<ByokProvider, string> = {
  openai: 'OpenAI-compatible',
  anthropic: 'Anthropic',
};

/**
 * BYOK key management in Settings (FR88, NFR24).
 *
 * When both providers hold a key the active one is an explicit choice shown
 * here — the app never silently switches provider behind the learner's back.
 */
export function ByokSettingsSection() {
  const { userDb } = useDatabase();
  const [configured, setConfigured] = useState<ByokProvider[]>([]);
  const [activeProvider, setActiveProviderState] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [cloudStt, setCloudSttState] = useState(false);

  const refresh = useCallback(() => {
    void listConfiguredByokProviders().then((result) => {
      if (!result.ok) {
        setListFailed(true);
        setError(result.error.userMessage ?? result.error.message);
        setConfigured([]);
        return;
      }
      setListFailed(false);
      setError(null);
      setConfigured(result.value);
    });
    setActiveProviderState(getAiActiveProvider(userDb));
    setCloudSttState(getCloudSttOptIn(userDb));
  }, [userDb]);

  useEffect(refresh, [refresh]);

  function handleSelectActive(provider: ByokProvider) {
    setAiActiveProvider(userDb, provider);
    setActiveProviderState(provider);
  }

  async function handleRemove(provider: ByokProvider) {
    setError(null);
    const result = await discardByokKey(provider);
    if (!result.ok) {
      setError(result.error.userMessage ?? result.error.message);
      return;
    }
    if (provider === 'openai') {
      // The opt-in must not outlive the only key that can honour it, or the
      // learner is left opted into an upload path that can never run.
      setCloudSttOptIn(userDb, false);
    }
    refresh();
  }

  // Cloud STT rides on whichever provider a new turn would actually use, which
  // is what `transcribeTurn` asks for — gating on "an OpenAI key exists" would
  // offer a switch the transcription path then refuses.
  const cloudSttAvailable = resolveActiveProvider(userDb, configured) === 'openai';
  const cloudSttReason = cloudSttAvailable
    ? 'Off by default: speaking practice is transcribed on this device and your voice never leaves it. Turn this on to send recordings to your OpenAI-compatible provider instead.'
    : configured.includes('openai')
      ? 'Only the active provider can transcribe, and Anthropic has no transcription endpoint. Make OpenAI-compatible the active provider above to use this. Speaking practice is transcribed on this device.'
      : 'Needs an OpenAI-compatible key — Anthropic has no transcription endpoint. Speaking practice is transcribed on this device.';

  return (
    <View className="mt-8">
      <Text className="text-body font-semibold text-primary">Conversation (AI key)</Text>
      <Text className="mt-1 text-body-sm text-secondary">
        Conversation practice uses an AI provider you choose. Keys are held in this device&apos;s
        secure storage and are only ever sent to the endpoint you configure.
      </Text>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-4 text-body-sm text-feedback-incorrect">
          {error}
        </Text>
      ) : null}

      {listFailed ? (
        <Text className="mt-4 text-body-sm text-secondary">
          Could not access secure storage to list saved keys.
        </Text>
      ) : configured.length === 0 ? (
        <Text className="mt-4 text-body-sm text-secondary">No key saved yet.</Text>
      ) : (
        <View className="mt-4 gap-3">
          {configured.map((provider) => (
            <View
              key={provider}
              className="flex-row items-center justify-between rounded-radius-md border border-border bg-surface p-4">
              <Text className="flex-1 pr-space-md text-body text-primary">
                {PROVIDER_LABELS[provider]}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${PROVIDER_LABELS[provider]} key`}
                onPress={() => {
                  void handleRemove(provider);
                }}
                testID={`byok-remove-${provider}`}
                className="min-h-[44px] justify-center px-space-sm">
                <Text className="text-body-sm text-feedback-error">Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {configured.length > 1 ? (
        <View className="mt-4">
          <Text className="text-body-sm text-secondary">
            Which provider new conversations use:
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-3">
            {BYOK_PROVIDERS.filter((provider) => configured.includes(provider)).map((provider) => {
              const selected = activeProvider === provider;
              return (
                <Pressable
                  key={provider}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Use ${PROVIDER_LABELS[provider]} for new conversations`}
                  onPress={() => handleSelectActive(provider)}
                  testID={`byok-active-${provider}`}
                  className={cn(
                    'min-h-[44px] min-w-[44px] flex-1 justify-center rounded-radius-md bg-surface p-4',
                    selected ? 'border-2 border-feedback-info' : 'border border-border',
                  )}>
                  <Text className="text-body-sm font-semibold text-primary">
                    {PROVIDER_LABELS[provider]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/*
        Speech is transcribed on-device by default. This is the only switch that
        sends a learner's voice anywhere, so it is visible, off by default, and
        never flipped automatically — a poor on-device result stays a poor
        on-device result rather than quietly becoming an upload.

        Only the OpenAI-compatible adapter has a transcription endpoint at all;
        Anthropic has none. When it is not the active provider the switch is
        shown disabled with the reason rather than hidden, so the option does
        not appear to vanish — but an opt-in that is already on stays operable,
        so turning it back off is never a dead end.
      */}
      <View className="mt-8 border-t border-border pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-space-md text-body text-primary">
            Transcribe speech in the cloud
          </Text>
          <Switch
            accessibilityHint={cloudSttReason}
            accessibilityLabel="Transcribe speech in the cloud"
            accessibilityState={{ disabled: !cloudSttAvailable && !cloudStt }}
            disabled={!cloudSttAvailable && !cloudStt}
            onValueChange={(next) => {
              setCloudSttOptIn(userDb, next);
              setCloudSttState(next);
            }}
            testID="cloud-stt-toggle"
            value={cloudStt}
          />
        </View>
        <Text className="mt-1 text-body-sm text-secondary">{cloudSttReason}</Text>
      </View>

      {isEditing ? (
        <View className="mt-4">
          <KeySetup
            compact
            onSaved={() => {
              refresh();
              setIsEditing(false);
            }}
          />
          <Button
            className="mt-4 w-full"
            label="Cancel"
            onPress={() => setIsEditing(false)}
            variant="ghost"
          />
        </View>
      ) : (
        <Button
          className="mt-4 w-full"
          label={configured.length === 0 ? 'Add an API key' : 'Add or replace a key'}
          onPress={() => setIsEditing(true)}
          testID="byok-open-editor"
          variant="secondary"
        />
      )}
    </View>
  );
}
