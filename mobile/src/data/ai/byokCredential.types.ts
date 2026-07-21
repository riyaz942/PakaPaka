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

/**
 * BYOK keys may only leave the device toward HTTPS endpoints (NFR24), except
 * plain HTTP to loopback — local OpenAI-compatible proxies (Ollama, LM Studio)
 * almost always speak `http://localhost` and are the reason the base URL is
 * editable at all.
 */
export function isAllowedByokRequestUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'http:') {
      const host = parsed.hostname.toLowerCase();
      // Node's URL keeps brackets on IPv6 hostnames (`[::1]`); browsers may not.
      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '[::1]'
      );
    }
    return false;
  } catch {
    return false;
  }
}

/** Validates a user-entered OpenAI-compatible base URL (scheme required). */
export function isAllowedOpenAiBaseUrl(baseUrl: string): boolean {
  return isAllowedByokRequestUrl(baseUrl.trim());
}
