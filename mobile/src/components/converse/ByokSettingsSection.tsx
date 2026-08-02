import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ToggleRow } from '@/components/common/ToggleRow';
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
  getWordTranslateOptIn,
  setAiActiveProvider,
  setCloudSttOptIn,
  setWordTranslateOptIn,
} from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';

const PROVIDER_LABELS: Record<ByokProvider, string> = {
  openai: 'OpenAI-compatible',
  anthropic: 'Anthropic',
};

const WORD_TRANSLATE_REASON =
  'Off, an unknown word still opens with its meaning left blank. On, each tap spends one provider call to translate it.';

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
  const [wordTranslate, setWordTranslateState] = useState(false);

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
    setWordTranslateState(getWordTranslateOptIn(userDb));
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
    <View className="mt-space-lg">
      <SectionHeading label="Conversation (AI key)" />
      <Text className="mt-space-xs text-caption font-ui-medium text-muted">
        Conversation practice uses an AI provider you choose. Keys are held in this device&apos;s
        secure storage and are only ever sent to the endpoint you configure.
      </Text>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-space-sm text-body-sm font-ui-semibold text-feedback-incorrect-deep">
          {error}
        </Text>
      ) : null}

      {listFailed ? (
        <Text className="mt-space-sm text-body-sm font-ui text-secondary">
          Could not access secure storage to list saved keys.
        </Text>
      ) : configured.length === 0 ? (
        <Text className="mt-space-sm text-body-sm font-ui text-secondary">No key saved yet.</Text>
      ) : (
        <View className="mt-space-sm gap-space-sm">
          {configured.map((provider) => (
            <View
              key={provider}
              className="flex-row items-center justify-between rounded-radius-md border border-border bg-surface px-space-md py-space-sm shadow-e1">
              <Text className="flex-1 pr-space-md text-body font-ui-semibold text-primary">
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
                <Text className="text-body-sm font-ui-bold text-feedback-incorrect-deep">
                  Remove
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {configured.length > 1 ? (
        <View className="mt-space-md">
          <Text className="text-body-sm font-ui-medium text-secondary">
            Which provider new conversations use:
          </Text>
          <View className="mt-space-sm flex-row flex-wrap gap-space-sm">
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
                    'min-h-[44px] min-w-[44px] flex-1 justify-center rounded-radius-lg p-space-md',
                    selected
                      ? 'border-2 border-brand-500 bg-brand-soft'
                      : 'border border-border bg-surface',
                  )}>
                  <Text
                    className={cn(
                      'text-body-sm font-ui-bold',
                      selected ? 'text-brand-text' : 'text-primary',
                    )}>
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
      <View className="mt-space-md rounded-radius-md border border-border bg-surface px-space-md shadow-e1">
        <ToggleRow
          label="Transcribe speech in the cloud"
          description={cloudSttReason}
          disabled={!cloudSttAvailable && !cloudStt}
          onValueChange={(next) => {
            setCloudSttOptIn(userDb, next);
            setCloudSttState(next);
          }}
          testID="cloud-stt-toggle"
          value={cloudStt}
        />
      </View>

      {/*
        Tapping a word the curriculum does not know can spend a provider call on
        a translation. Off, the word still opens and still says it is outside
        the curriculum — the toggle buys the billed round-trip, nothing else, so
        it is the learner's to opt into rather than a silent cost.
      */}
      <View className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md shadow-e1">
        <ToggleRow
          label="Translate unknown words"
          description={WORD_TRANSLATE_REASON}
          onValueChange={(next) => {
            setWordTranslateOptIn(userDb, next);
            setWordTranslateState(next);
          }}
          testID="word-translate-toggle"
          value={wordTranslate}
        />
      </View>

      {isEditing ? (
        <View className="mt-space-md">
          <KeySetup
            compact
            onSaved={() => {
              refresh();
              setIsEditing(false);
            }}
          />
          <Button
            className="mt-space-md w-full"
            label="Cancel"
            onPress={() => setIsEditing(false)}
            variant="ghost"
          />
        </View>
      ) : (
        <Button
          className="mt-space-md w-full"
          label={configured.length === 0 ? 'Add an API key' : 'Add or replace a key'}
          onPress={() => setIsEditing(true)}
          testID="byok-open-editor"
          variant="secondary"
        />
      )}
    </View>
  );
}
