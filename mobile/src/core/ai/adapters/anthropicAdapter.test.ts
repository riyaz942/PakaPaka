import { anthropicAdapter } from '@/core/ai/adapters/anthropicAdapter';
import type { AdapterRequest } from '@/core/ai/aiSession.types';

const request: AdapterRequest = {
  apiKey: 'sk-ant-test',
  model: 'claude-opus-4-8',
  systemPrompt: 'You are a Japanese conversation partner.',
  messages: [
    { role: 'user', content: 'こんにちは' },
    { role: 'assistant', content: 'こんにちは！' },
    { role: 'user', content: '元気ですか' },
  ],
  maxTokens: 1024,
};

describe('anthropicAdapter.buildStreamRequest', () => {
  it('authenticates with x-api-key and the required version header, not a bearer token', () => {
    const built = anthropicAdapter.buildStreamRequest(request);

    expect(built.headers['x-api-key']).toBe('sk-ant-test');
    expect(built.headers['anthropic-version']).toBe('2023-06-01');
    expect(built.headers.authorization).toBeUndefined();
  });

  it('targets the messages endpoint over HTTPS', () => {
    const built = anthropicAdapter.buildStreamRequest(request);

    expect(built.url).toBe('https://api.anthropic.com/v1/messages');
    expect(built.url.startsWith('https://')).toBe(true);
  });

  it('puts the system prompt in a top-level field, never in the messages array', () => {
    const body = JSON.parse(anthropicAdapter.buildStreamRequest(request).body);

    expect(body.system).toBe('You are a Japanese conversation partner.');
    expect(body.messages).toHaveLength(3);
    expect(body.messages.some((m: { role: string }) => m.role === 'system')).toBe(false);
    expect(body.stream).toBe(true);
  });
});

describe('anthropicAdapter.parseStreamData', () => {
  it('extracts text from a content_block_delta', () => {
    const event = anthropicAdapter.parseStreamData(
      JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: '元気' },
      }),
    );

    expect(event).toEqual({ type: 'delta', text: '元気' });
  });

  it('falls back to the SSE event name when the payload omits its type', () => {
    const event = anthropicAdapter.parseStreamData(
      JSON.stringify({ delta: { type: 'text_delta', text: 'です' } }),
      'content_block_delta',
    );

    expect(event).toEqual({ type: 'delta', text: 'です' });
  });

  it('signals completion on message_stop', () => {
    expect(anthropicAdapter.parseStreamData(JSON.stringify({ type: 'message_stop' }))).toEqual({
      type: 'done',
    });
  });

  it('ignores bookkeeping frames that carry no reply text', () => {
    for (const type of [
      'message_start',
      'content_block_start',
      'content_block_stop',
      'message_delta',
      'ping',
    ]) {
      expect(anthropicAdapter.parseStreamData(JSON.stringify({ type }))).toBeNull();
    }
  });

  it('ignores non-text deltas such as thinking blocks', () => {
    const event = anthropicAdapter.parseStreamData(
      JSON.stringify({
        type: 'content_block_delta',
        delta: { type: 'thinking_delta', thinking: 'hmm' },
      }),
    );

    expect(event).toBeNull();
  });

  it('surfaces a provider error frame', () => {
    const event = anthropicAdapter.parseStreamData(
      JSON.stringify({ type: 'error', error: { message: 'overloaded_error' } }),
    );

    expect(event).toEqual({ type: 'error', message: 'overloaded_error' });
  });

  it('skips a malformed frame instead of throwing — the transcript must survive', () => {
    expect(() => anthropicAdapter.parseStreamData('{not json')).not.toThrow();
    expect(anthropicAdapter.parseStreamData('{not json')).toBeNull();
    expect(anthropicAdapter.parseStreamData('')).toBeNull();
  });
});

describe('anthropicAdapter.mapHttpError', () => {
  it.each([
    [401, 'ai_auth_failed'],
    [403, 'ai_auth_failed'],
    [404, 'ai_endpoint_not_found'],
    [429, 'ai_rate_limited'],
    [500, 'ai_provider_unavailable'],
    [529, 'ai_provider_unavailable'],
    [400, 'ai_request_failed'],
  ])('maps HTTP %i to %s', (status, code) => {
    expect(anthropicAdapter.mapHttpError(status, '').code).toBe(code);
  });

  it('uses lowercase snake_case codes and always supplies a user-facing message', () => {
    const mapped = anthropicAdapter.mapHttpError(401, '');

    expect(mapped.code).toMatch(/^[a-z0-9_]+$/);
    expect(mapped.userMessage.length).toBeGreaterThan(0);
  });
});
