import {
  __mockEnqueueHttpError,
  __mockEnqueueSseFailure,
  __mockEnqueueSseResponse,
  __mockGetFetchCalls,
  __mockResetFetch,
  __mockSetNetworkError,
} from '../../../__mocks__/expo-fetch';

import { anthropicAdapter } from '@/core/ai/adapters/anthropicAdapter';
import { openAiCompatibleAdapter } from '@/core/ai/adapters/openAiCompatibleAdapter';
import type { AdapterRequest } from '@/core/ai/aiSession.types';
import { streamAssistantTurn } from '@/data/ai/streamingClient';

const request: AdapterRequest = {
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  systemPrompt: 'system',
  messages: [{ role: 'user', content: 'こんにちは' }],
  maxTokens: 1024,
};

function sseFrame(payload: unknown, event?: string): string {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return `${event ? `event: ${event}\n` : ''}data: ${data}\n\n`;
}

describe('streamAssistantTurn', () => {
  beforeEach(() => {
    __mockResetFetch();
  });

  it('accumulates deltas in order and reports each one to the caller', async () => {
    __mockEnqueueSseResponse([
      sseFrame({ choices: [{ delta: { content: '元' } }] }),
      sseFrame({ choices: [{ delta: { content: '気' } }] }),
      sseFrame({ choices: [{ delta: { content: 'です' } }] }),
      sseFrame('[DONE]'),
    ]);

    const deltas: string[] = [];
    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: (text) => deltas.push(text),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('元気です');
    expect(result.value.complete).toBe(true);
    expect(deltas).toEqual(['元', '気', 'です']);
  });

  it('reassembles frames split across wire chunks', async () => {
    // The frame boundary falls mid-JSON — a naive per-chunk parse would lose it.
    const frame = sseFrame({ choices: [{ delta: { content: 'こんにちは' } }] });
    const split = Math.floor(frame.length / 2);

    __mockEnqueueSseResponse([frame.slice(0, split), frame.slice(split), sseFrame('[DONE]')]);

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('こんにちは');
  });

  it('ignores SSE comment keep-alives', async () => {
    __mockEnqueueSseResponse([
      ': keep-alive\n\n',
      sseFrame({ choices: [{ delta: { content: 'はい' } }] }),
      sseFrame('[DONE]'),
    ]);

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('はい');
  });

  it('reads Anthropic named events through the same path', async () => {
    __mockEnqueueSseResponse([
      sseFrame({ type: 'message_start' }, 'message_start'),
      sseFrame(
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'こんにちは' } },
        'content_block_delta',
      ),
      sseFrame({ type: 'message_stop' }, 'message_stop'),
    ]);

    const result = await streamAssistantTurn(
      anthropicAdapter,
      { ...request, model: 'claude-opus-4-8' },
      { onDelta: () => {} },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('こんにちは');
    expect(result.value.complete).toBe(true);
  });

  it('keeps the text that already streamed when the stream dies partway (NFR27)', async () => {
    __mockEnqueueSseFailure(
      [
        sseFrame({ choices: [{ delta: { content: '元気' } }] }),
        sseFrame({ choices: [{ delta: { content: 'です' } }] }),
      ],
      1,
    );

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The salvaged prefix is returned so the caller can commit it rather than
    // discarding a turn the learner already watched arrive.
    expect(result.error.partialText).toBe('元気');
    expect(result.error.code).toBe('ai_network_error');
  });

  it('surfaces a mid-stream provider error with the partial text intact', async () => {
    __mockEnqueueSseResponse([
      sseFrame({ choices: [{ delta: { content: '元気' } }] }),
      sseFrame({ error: { message: 'overloaded' } }),
    ]);

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ai_stream_error');
    expect(result.error.partialText).toBe('元気');
  });

  it('maps a non-2xx response through the adapter and never throws', async () => {
    __mockEnqueueHttpError(401, 'invalid key');

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ai_auth_failed');
    expect(result.error.partialText).toBe('');
  });

  it('returns a Result rather than throwing on a transport failure', async () => {
    __mockSetNetworkError(new Error('offline'));

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ai_network_error');
    expect(result.error.userMessage.length).toBeGreaterThan(0);
  });

  it('reports an abort distinctly from a network failure', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    __mockSetNetworkError(abortError);

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ai_stream_aborted');
  });

  it('sends the key only to the configured endpoint, over HTTPS', async () => {
    __mockEnqueueSseResponse([sseFrame('[DONE]')]);

    await streamAssistantTurn(
      openAiCompatibleAdapter,
      { ...request, baseUrl: 'https://my-proxy.example.com/v1' },
      { onDelta: () => {} },
    );

    const calls = __mockGetFetchCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://my-proxy.example.com/v1/chat/completions');
    expect(calls[0].headers.authorization).toBe('Bearer sk-test');
  });

  it('allows http:// only for localhost / loopback', async () => {
    __mockEnqueueSseResponse([sseFrame('[DONE]')]);

    const result = await streamAssistantTurn(
      openAiCompatibleAdapter,
      { ...request, baseUrl: 'http://localhost:11434/v1' },
      { onDelta: () => {} },
    );

    expect(result.ok).toBe(true);
    expect(__mockGetFetchCalls()[0].url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('refuses a remote http:// endpoint before the key is sent', async () => {
    const result = await streamAssistantTurn(
      openAiCompatibleAdapter,
      { ...request, baseUrl: 'http://evil.example.com/v1' },
      { onDelta: () => {} },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ai_insecure_endpoint');
    expect(__mockGetFetchCalls()).toHaveLength(0);
  });

  it('flushes a trailing SSE frame that lacks a final blank line', async () => {
    // No trailing `\n\n` — the leftover buffer must still be decoded on done.
    __mockEnqueueSseResponse([
      'data: {"choices":[{"delta":{"content":"はい"},"finish_reason":"stop"}]}\n',
    ]);

    const result = await streamAssistantTurn(openAiCompatibleAdapter, request, {
      onDelta: () => {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('はい');
    expect(result.value.complete).toBe(true);
  });
});
