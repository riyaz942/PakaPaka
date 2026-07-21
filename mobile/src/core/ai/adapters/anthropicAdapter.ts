import type {
  AdapterHttpRequest,
  AdapterRequest,
  AdapterStreamEvent,
  AiAdapter,
} from '@/core/ai/aiSession.types';

/**
 * Anthropic Messages API adapter (FR88).
 *
 * Same contract as `openAiCompatibleAdapter` — transport normalization only,
 * no state, no I/O. The three shape differences it absorbs:
 *   - auth is `x-api-key`, not a bearer token, plus a required version header
 *   - the system prompt is a top-level field, not a message role
 *   - deltas arrive as `content_block_delta` events, not `choices[].delta`
 *
 * The endpoint is fixed: unlike the OpenAI-compatible adapter there is no
 * user-editable base URL, because this shape is Anthropic's alone.
 */

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

function buildStreamRequest(request: AdapterRequest): AdapterHttpRequest {
  return {
    url: `${ANTHROPIC_BASE_URL}/messages`,
    headers: {
      'content-type': 'application/json',
      'x-api-key': request.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens,
      stream: true,
      // Top-level system field — the placement difference from the
      // OpenAI-compatible shape that this adapter exists to absorb.
      system: request.systemPrompt,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  };
}

function parseStreamData(data: string, eventName?: string): AdapterStreamEvent | null {
  const trimmed = data.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    // Skip a malformed frame rather than failing the turn — whatever already
    // streamed stays in the transcript (NFR27).
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const record = payload as {
    type?: string;
    delta?: { type?: string; text?: string };
    error?: { message?: string };
  };

  // Prefer the payload's own `type`; fall back to the SSE `event:` field, which
  // carries the same value.
  const type = record.type ?? eventName;

  if (type === 'error') {
    return { type: 'error', message: record.error?.message ?? 'Provider returned an error' };
  }

  if (type === 'content_block_delta') {
    const delta = record.delta;
    if (delta?.type === 'text_delta' && typeof delta.text === 'string' && delta.text.length > 0) {
      return { type: 'delta', text: delta.text };
    }
    // Thinking deltas and other block types carry no visible reply text.
    return null;
  }

  if (type === 'message_stop') {
    return { type: 'done' };
  }

  // message_start / content_block_start / content_block_stop / message_delta /
  // ping carry no reply text and no terminal signal.
  return null;
}

function mapHttpError(status: number, body: string): { code: string; userMessage: string } {
  if (status === 401 || status === 403) {
    return {
      code: 'ai_auth_failed',
      userMessage: 'That API key was rejected. Check it in Settings.',
    };
  }
  if (status === 404) {
    return {
      code: 'ai_endpoint_not_found',
      userMessage: 'That model was not found. Check the model name in Settings.',
    };
  }
  if (status === 429) {
    return {
      code: 'ai_rate_limited',
      userMessage: 'Your provider is rate limiting requests. Try again shortly.',
    };
  }
  if (status === 529 || status >= 500) {
    return {
      code: 'ai_provider_unavailable',
      userMessage: 'Your provider is unavailable right now. Try again shortly.',
    };
  }
  return {
    code: 'ai_request_failed',
    userMessage: body.trim().length > 0 ? 'The provider rejected the request.' : 'The request failed.',
  };
}

export const anthropicAdapter: AiAdapter = {
  provider: 'anthropic',
  buildStreamRequest,
  parseStreamData,
  mapHttpError,
};
