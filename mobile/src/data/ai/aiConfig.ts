import type { SQLiteDatabase } from 'expo-sqlite';

import { anthropicAdapter } from '@/core/ai/adapters/anthropicAdapter';
import { openAiCompatibleAdapter } from '@/core/ai/adapters/openAiCompatibleAdapter';
import type { AiAdapter } from '@/core/ai/aiSession.types';
import {
  DEFAULT_MODELS,
  DEFAULT_OPENAI_BASE_URL,
  isByokProvider,
  type ByokProvider,
} from '@/data/ai/byokCredential.types';
import { getByokKey, listConfiguredByokProviders } from '@/data/ai/byokCredentialStore';
import {
  getAiActiveProvider,
  getAiModel,
  getAiOpenAiBaseUrl,
} from '@/data/user/preferencesRepository';
import type { Result } from '@/types/result.types';

/**
 * Resolves which adapter a new session uses, and the settings it needs.
 *
 * Both providers can hold a key at once (FR88), so the active one is an
 * explicit, visible preference. There is deliberately no silent fallback: if
 * the chosen provider's key is missing we say so and send the learner to
 * Settings, rather than quietly switching to the other provider — a swap the
 * learner never asked for and cannot see.
 */

const ADAPTERS: Record<ByokProvider, AiAdapter> = {
  openai: openAiCompatibleAdapter,
  anthropic: anthropicAdapter,
};

export function getAdapter(provider: ByokProvider): AiAdapter {
  return ADAPTERS[provider];
}

export type ResolvedAiConfig = {
  provider: ByokProvider;
  adapter: AiAdapter;
  apiKey: string;
  model: string;
  baseUrl?: string;
};

/**
 * Which provider new sessions should use, given the saved preference and the
 * keys actually present. Returns null when nothing is configured — the caller
 * shows `KeySetup`.
 */
export function resolveActiveProvider(
  userDb: SQLiteDatabase,
  configured: ByokProvider[],
): ByokProvider | null {
  if (configured.length === 0) {
    return null;
  }

  const preferred = getAiActiveProvider(userDb);
  if (preferred && isByokProvider(preferred) && configured.includes(preferred)) {
    return preferred;
  }

  // Exactly one key configured is not a hidden fallback — there is no choice
  // to make. With two, the preference above decides; landing here means it was
  // never set, so the first is used and Settings shows which is active.
  return configured[0];
}

export async function resolveAiConfig(
  userDb: SQLiteDatabase,
): Promise<Result<ResolvedAiConfig | null>> {
  const configuredResult = await listConfiguredByokProviders();
  if (!configuredResult.ok) {
    return configuredResult;
  }

  const provider = resolveActiveProvider(userDb, configuredResult.value);
  if (!provider) {
    return { ok: true, value: null };
  }

  const keyResult = await getByokKey(provider);
  if (!keyResult.ok) {
    return keyResult;
  }
  if (!keyResult.value) {
    return {
      ok: false,
      error: {
        code: 'ai_key_missing',
        message: `No stored key for ${provider}`,
        userMessage: 'That provider has no API key saved. Add one in Settings.',
      },
    };
  }

  return {
    ok: true,
    value: {
      provider,
      adapter: getAdapter(provider),
      apiKey: keyResult.value,
      model: getAiModel(userDb, provider) ?? DEFAULT_MODELS[provider],
      baseUrl:
        provider === 'openai'
          ? getAiOpenAiBaseUrl(userDb) ?? DEFAULT_OPENAI_BASE_URL
          : undefined,
    },
  };
}
