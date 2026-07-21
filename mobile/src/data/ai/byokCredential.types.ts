/**
 * The two BYOK adapters (FR88). Deliberately not four — every additional
 * provider that speaks the OpenAI chat-completions shape is reachable by
 * pointing `openai`'s editable base URL at it, so only genuinely different
 * transports earn their own adapter.
 */
export type ByokProvider = 'openai' | 'anthropic';

export const BYOK_PROVIDERS: readonly ByokProvider[] = ['openai', 'anthropic'];

/** Secure-store keys, namespaced per architecture §Format Patterns. */
export const BYOK_CREDENTIAL_KEYS: Record<ByokProvider, string> = {
  openai: 'byok.openai',
  anthropic: 'byok.anthropic',
};

export function isByokProvider(value: string): value is ByokProvider {
  return value === 'openai' || value === 'anthropic';
}

/** Shown when no base URL has been set for the OpenAI-compatible adapter. */
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const DEFAULT_MODELS: Record<ByokProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-opus-4-8',
};
