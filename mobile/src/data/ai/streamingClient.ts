import { fetch } from 'expo/fetch';

import type {
  AdapterRequest,
  AiAdapter,
} from '@/core/ai/aiSession.types';
import type { Result } from '@/types/result.types';

/**
 * SSE streaming over `expo/fetch` (NFR27).
 *
 * React Native's built-in `fetch` has no streaming body, so `expo/fetch` is the
 * only way to consume Server-Sent Events without a polyfill. This is the first
 * use of it in the codebase.
 *
 * Partial-failure contract: whatever text arrived before a failure is returned
 * alongside the error, so the caller commits the completed portion of the turn
 * and leaves the rest of the transcript untouched. Nothing here ever wipes
 * messages that are already written.
 */

export type StreamCallbacks = {
  /** Called with each decoded text delta, in order. */
  onDelta: (text: string) => void;
};

export type StreamOutcome = {
  /** Everything that streamed successfully, markers included. */
  text: string;
  /** True when the provider signalled a clean end of turn. */
  complete: boolean;
};

/** Carries the salvaged partial text alongside the failure (NFR27). */
export type StreamFailure = {
  code: string;
  message: string;
  userMessage: string;
  partialText: string;
  cause?: unknown;
};

const SSE_FIELD_SEPARATOR = /\r?\n/;

function decodeSseBlock(block: string): { event?: string; data: string } | null {
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const line of block.split(SSE_FIELD_SEPARATOR)) {
    if (line.startsWith(':')) {
      // Comment / keep-alive.
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join('\n') };
}

async function readErrorBody(response: { text: () => Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

/**
 * Streams one assistant turn. Resolves with the accumulated text, or with a
 * failure that still carries whatever text arrived first.
 */
export async function streamAssistantTurn(
  adapter: AiAdapter,
  request: AdapterRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<Result<StreamOutcome, StreamFailure>> {
  const httpRequest = adapter.buildStreamRequest(request);
  let accumulated = '';

  try {
    const response = await fetch(httpRequest.url, {
      method: 'POST',
      headers: httpRequest.headers,
      body: httpRequest.body,
      signal,
    });

    if (!response.ok) {
      const body = await readErrorBody(response);
      const mapped = adapter.mapHttpError(response.status, body);
      return {
        ok: false,
        error: { ...mapped, message: `HTTP ${response.status}`, partialText: '' },
      };
    }

    if (!response.body) {
      return {
        ok: false,
        error: {
          code: 'ai_stream_unavailable',
          message: 'Response carried no readable body',
          userMessage: 'The reply could not be read. Try again.',
          partialText: '',
        },
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let complete = false;

    // Drained via the reader's `done` break below.
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE blocks are separated by a blank line; keep the trailing partial.
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const frame = decodeSseBlock(block);
        if (!frame) {
          continue;
        }

        const parsed = adapter.parseStreamData(frame.data, frame.event);
        if (!parsed) {
          continue;
        }

        if (parsed.type === 'delta') {
          accumulated += parsed.text;
          callbacks.onDelta(parsed.text);
        } else if (parsed.type === 'done') {
          complete = true;
        } else {
          return {
            ok: false,
            error: {
              code: 'ai_stream_error',
              message: parsed.message,
              userMessage: 'The reply stopped early.',
              partialText: accumulated,
            },
          };
        }
      }
    }

    return { ok: true, value: { text: accumulated, complete } };
  } catch (cause) {
    const aborted =
      typeof cause === 'object' &&
      cause !== null &&
      (cause as { name?: string }).name === 'AbortError';

    return {
      ok: false,
      error: {
        code: aborted ? 'ai_stream_aborted' : 'ai_network_error',
        message: aborted ? 'Stream aborted' : 'Network request failed',
        userMessage: aborted
          ? 'The reply was stopped.'
          : 'Could not reach your provider. Check your connection.',
        partialText: accumulated,
        cause,
      },
    };
  }
}
