import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import {
  BYOK_PROVIDERS,
  DEFAULT_MODELS,
  DEFAULT_OPENAI_BASE_URL,
  type ByokProvider,
} from '@/data/ai/byokCredential.types';
import { saveByokKey } from '@/data/ai/byokCredentialStore';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getAiModel,
  getAiOpenAiBaseUrl,
  setAiActiveProvider,
  setAiModel,
  setAiOpenAiBaseUrl,
} from '@/data/user/preferencesRepository';

const PROVIDER_LABELS: Record<ByokProvider, string> = {
  openai: 'OpenAI-compatible',
  anthropic: 'Anthropic',
};

type KeySetupProps = {
  /** Called after a key is saved so the parent can re-check configured providers. */
  onSaved: () => void;
  /** Rendered inside Settings rather than as the tab's empty state. */
  compact?: boolean;
};

/**
 * BYOK credential entry (FR88, NFR24).
 *
 * The key goes to platform secure storage; the base URL and model are ordinary
 * preferences. Nothing here reaches the network — the first request happens when
 * the learner starts a session.
 */
export function KeySetup({ onSaved, compact = false }: KeySetupProps) {
  const { userDb } = useDatabase();
  const [provider, setProvider] = useState<ByokProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(
    () => getAiOpenAiBaseUrl(userDb) ?? DEFAULT_OPENAI_BASE_URL,
  );
  const [model, setModel] = useState(() => getAiModel(userDb, 'openai') ?? DEFAULT_MODELS.openai);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleProviderChange(next: ByokProvider) {
    setProvider(next);
    setStatus(null);
    setModel(getAiModel(userDb, next) ?? DEFAULT_MODELS[next]);
  }

  async function handleSave() {
    setStatus(null);
    setIsSaving(true);

    try {
      const result = await saveByokKey(provider, apiKey);
      if (!result.ok) {
        setStatus(result.error.userMessage ?? result.error.message);
        return;
      }

      if (provider === 'openai' && baseUrl.trim().length > 0) {
        setAiOpenAiBaseUrl(userDb, baseUrl);
      }
      if (model.trim().length > 0) {
        setAiModel(userDb, provider, model);
      }
      setAiActiveProvider(userDb, provider);

      setApiKey('');
      setStatus('Key saved.');
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName={compact ? undefined : 'p-space-lg'}
      keyboardShouldPersistTaps="handled">
      {!compact ? (
        <>
          <Text accessibilityRole="header" className="text-title-lg text-primary">
            Bring your own key
          </Text>
          <Text className="mt-space-sm text-body text-secondary">
            Conversation practice uses an AI provider you choose. Your key is stored in this
            device&apos;s secure storage and is only ever sent to the endpoint you configure
            below.
          </Text>
        </>
      ) : null}

      <View className="mt-space-lg flex-row gap-space-sm">
        {BYOK_PROVIDERS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={`Use ${PROVIDER_LABELS[option]}`}
            accessibilityState={{ selected: provider === option }}
            disabled={isSaving}
            onPress={() => handleProviderChange(option)}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-radius-md border px-space-md py-space-sm ${
              provider === option ? 'border-feedback-info bg-surface-elevated' : 'border-border'
            }`}>
            <Text className="text-body font-semibold text-primary">
              {PROVIDER_LABELS[option]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-space-lg">
        <Text className="text-body font-semibold text-primary">API key</Text>
        <TextInput
          accessibilityLabel={`${PROVIDER_LABELS[provider]} API key`}
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md py-space-sm text-body text-primary"
          editable={!isSaving}
          onChangeText={setApiKey}
          placeholder="Paste your API key"
          secureTextEntry
          value={apiKey}
        />
      </View>

      {provider === 'openai' ? (
        <View className="mt-space-lg">
          <Text className="text-body font-semibold text-primary">Base URL</Text>
          <Text className="mt-space-xs text-body-sm text-secondary">
            Any endpoint that speaks the OpenAI chat-completions format. Must be HTTPS.
          </Text>
          <TextInput
            accessibilityLabel="OpenAI-compatible base URL"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md py-space-sm text-body text-primary"
            editable={!isSaving}
            keyboardType="url"
            onChangeText={setBaseUrl}
            placeholder={DEFAULT_OPENAI_BASE_URL}
            value={baseUrl}
          />
        </View>
      ) : null}

      <View className="mt-space-lg">
        <Text className="text-body font-semibold text-primary">Model</Text>
        <TextInput
          accessibilityLabel="Model name"
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md py-space-sm text-body text-primary"
          editable={!isSaving}
          onChangeText={setModel}
          placeholder={DEFAULT_MODELS[provider]}
          value={model}
        />
      </View>

      {status ? (
        <Text accessibilityLiveRegion="polite" className="mt-space-md text-body text-secondary">
          {status}
        </Text>
      ) : null}

      <Button
        className="mt-space-lg"
        disabled={isSaving || apiKey.trim().length === 0}
        label="Save key"
        onPress={() => {
          void handleSave();
        }}
        testID="byok-save-key"
      />
    </ScrollView>
  );
}
