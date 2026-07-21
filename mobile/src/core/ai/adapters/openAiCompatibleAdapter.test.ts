import { openAiCompatibleAdapter } from '@/core/ai/adapters/openAiCompatibleAdapter';
import type { AdapterRequest } from '@/core/ai/aiSession.types';

const request: AdapterRequest = {
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a Japanese conversation partner.',
  messages: [
    { role: 'user', content: 'こんにちは' },
    { role: 'assistant', content: 'こんにちは！' },
  ],
  maxTokens: 1024,
};

describe('openAiCompatibleAdapter.buildStreamRequest', () => {
  it('authenticates with a bearer token', () => {
    const built = openAiCompatibleAdapter.buildStreamRequest(request);

    expect(built.headers.authorization).toBe('Bearer sk-test');
    expect(built.headers['x-api-key']).toBeUndefined();
  });

  it('honours a user-configured base URL', () => {
    const built = openAiCompatibleAdapter.buildStreamRequest({
      ...request,
      baseUrl: 'https://my-proxy.example.com/v1',
    });

    expect(built.url).toBe('https://my-proxy.example.com/v1/chat/completions');
  });

  it('does not double the slash when the base URL has a trailing one', () => {
    const built = openAiCompatibleAdapter.buildStreamRequest({
      ...request,
      baseUrl: 'https://my-proxy.example.com/v1/',
    });

    expect(built.url).toBe('https://my-proxy.example.com/v1/chat/completions');
  });

  it('falls back to the documented default when no base URL is configured', () => {
    const built = openAiCompatibleAdapter.buildStreamRequest({ ...request, baseUrl: '   ' });

    expect(built.url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('puts the system prompt in the messages array as a system role', () => {
    const body = JSON.parse(openAiCompatibleAdapter.buildStreamRequest(request).body);

    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'You are a Japanese conversation partner.',
    });
    expect(body.messages).toHaveLength(3);
    expect(body.system).toBeUndefined();
    expect(body.stream).toBe(true);
  });
});

describe('openAiCompatibleAdapter.parseStreamData', () => {
  it('extracts text from a choices delta', () => {
    const event = openAiCompatibleAdapter.parseStreamData(
      JSON.stringify({ choices: [{ delta: { content: '元気' } }] }),
    );

    expect(event).toEqual({ type: 'delta', text: '元気' });
  });

  it('treats the [DONE] sentinel as completion', () => {
    expect(openAiCompatibleAdapter.parseStreamData('[DONE]')).toEqual({ type: 'done' });
  });

  it('treats a finish_reason as completion', () => {
    const event = openAiCompatibleAdapter.parseStreamData(
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
    );

    expect(event).toEqual({ type: 'done' });
  });

  it('ignores the role-only preamble frame', () => {
    const event = openAiCompatibleAdapter.parseStreamData(
      JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] }),
    );

    expect(event).toBeNull();
  });

  it('surfaces a provider error frame', () => {
    const event = openAiCompatibleAdapter.parseStreamData(
      JSON.stringify({ error: { message: 'insufficient_quota' } }),
    );

    expect(event).toEqual({ type: 'error', message: 'insufficient_quota' });
  });

  it('skips a malformed frame instead of throwing — the transcript must survive', () => {
    expect(() => openAiCompatibleAdapter.parseStreamData('{not json')).not.toThrow();
    expect(openAiCompatibleAdapter.parseStreamData('{not json')).toBeNull();
    expect(openAiCompatibleAdapter.parseStreamData('   ')).toBeNull();
  });
});

describe('openAiCompatibleAdapter.mapHttpError', () => {
  it.each([
    [401, 'ai_auth_failed'],
    [404, 'ai_endpoint_not_found'],
    [429, 'ai_rate_limited'],
    [503, 'ai_provider_unavailable'],
    [400, 'ai_request_failed'],
  ])('maps HTTP %i to %s', (status, code) => {
    expect(openAiCompatibleAdapter.mapHttpError(status, '').code).toBe(code);
  });
});
