import {
  DEFAULT_OPENAI_BASE_URL,
  isAllowedByokRequestUrl,
  isAllowedOpenAiBaseUrl,
} from '@/data/ai/byokCredential.types';

describe('isAllowedByokRequestUrl', () => {
  it('allows https endpoints', () => {
    expect(isAllowedByokRequestUrl('https://api.openai.com/v1/chat/completions')).toBe(true);
    expect(isAllowedByokRequestUrl(`${DEFAULT_OPENAI_BASE_URL}/chat/completions`)).toBe(true);
  });

  it('allows http only for localhost and loopback', () => {
    expect(isAllowedByokRequestUrl('http://localhost:11434/v1/chat/completions')).toBe(true);
    expect(isAllowedByokRequestUrl('http://127.0.0.1:1234/v1/chat/completions')).toBe(true);
    expect(isAllowedByokRequestUrl('http://[::1]/v1/chat/completions')).toBe(true);
  });

  it('rejects remote http and other schemes', () => {
    expect(isAllowedByokRequestUrl('http://evil.example.com/v1/chat/completions')).toBe(false);
    expect(isAllowedByokRequestUrl('ws://localhost/v1')).toBe(false);
    expect(isAllowedOpenAiBaseUrl('http://evil.example.com/v1')).toBe(false);
    expect(isAllowedOpenAiBaseUrl('https://my-proxy.example.com/v1')).toBe(true);
    expect(isAllowedOpenAiBaseUrl('http://localhost:11434/v1')).toBe(true);
  });
});
