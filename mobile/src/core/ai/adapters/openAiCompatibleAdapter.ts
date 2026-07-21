import type {
  AdapterHttpRequest,
  AdapterRequest,
  AdapterStreamEvent,
  AiAdapter,
} from '@/core/ai/aiSession.types';
import { DEFAULT_OPENAI_BASE_URL } from '@/data/ai/byokCredential.types';

/**
 * OpenAI-compatible chat-completions adapter (FR88).
 *
 * Normalizes transport only — auth header shape, system-prompt placement, SSE
 * frame shape, error mapping. It holds no conversation state and reaches no
 * network itself; `data/ai/streamingClient.ts` does the I/O.
 *
 * The base URL is user-editable precisely so this one adapter covers every
 * endpoint that speaks this shape, rather than shipping a provider list the
 * learner cannot extend.
 */

/** Trims a trailing slash so `${base}/chat/completions` never doubles up. */
function normalizeBaseUrl(baseUrl: string | undefined): string {
  const raw = (baseUrl ?? '').trim() || DEFAULT_OPENAI_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function buildStreamRequest(request: AdapterRequest): AdapterHttpRequest {
  return {
    url: `${normalizeBaseUrl(request.baseUrl)}/chat/completions`,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${request.apiKey}`,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens,
      stream: true,
      // System is a message role here — the shape difference from Anthropic
      // that this adapter exists to absorb.
      messages: [
        { role: 'system', content: request.systemPrompt },
        ...request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
  };
}

function parseStreamData(data: string): AdapterStreamEvent | null {
  const trimmed = data.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed === '[DONE]') {
    return { type: 'done' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    // A malformed frame is not fatal: the transcript keeps whatever streamed
    // successfully (NFR27), so skip the frame rather than failing the turn.
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const record = payload as {
    error?: { message?: string };
    choices?: { delta?: { content?: unknown }; finish_reason?: string | null }[];
  };

  if (record.error) {
    return { type: 'error', message: record.error.message ?? 'Provider returned an error' };
  }

  const choice = record.choices?.[0];
  if (!choice) {
    return null;
  }

  const content = choice.delta?.content;
  if (typeof content === 'string' && content.length > 0) {
    return { type: 'delta', text: content };
  }

  if (choice.finish_reason) {
    return { type: 'done' };
  }

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
      userMessage: 'That endpoint or model was not found. Check the base URL and model in Settings.',
    };
  }
  if (status === 429) {
    return {
      code: 'ai_rate_limited',
      userMessage: 'Your provider is rate limiting requests. Try again shortly.',
    };
  }
  if (status >= 500) {
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

export const openAiCompatibleAdapter: AiAdapter = {
  provider: 'openai',
  buildStreamRequest,
  parseStreamData,
  mapHttpError,
};
