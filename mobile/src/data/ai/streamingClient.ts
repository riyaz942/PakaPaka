import { fetch } from 'expo/fetch';

import type {
  AdapterRequest,
  AdapterStreamEvent,
  AiAdapter,
} from '@/core/ai/aiSession.types';
import { isAllowedByokRequestUrl } from '@/data/ai/byokCredential.types';
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

/**
 * Cap on the *residual* SSE block — the trailing fragment left after every
 * complete frame has been split off. A peer that never emits a blank-line
 * delimiter must not grow this without bound. Measured after the split so a
 * proxy that flushes many well-formed frames in one read is not punished for
 * the size of a legitimate reply.
 */
const MAX_SSE_RESIDUAL_CHARS = 256 * 1024;

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

type FrameHandlerResult =
  | { kind: 'continue'; complete: boolean }
  | { kind: 'fail'; error: StreamFailure };

function handleParsedFrame(
  parsed: AdapterStreamEvent,
  accumulated: string,
  onDelta: (text: string) => void,
): { accumulated: string; result: FrameHandlerResult } {
  if (parsed.type === 'delta') {
    const next = accumulated + parsed.text;
    onDelta(parsed.text);
    return {
      accumulated: next,
      result: { kind: 'continue', complete: Boolean(parsed.done) },
    };
  }
  if (parsed.type === 'done') {
    return { accumulated, result: { kind: 'continue', complete: true } };
  }
  return {
    accumulated,
    result: {
      kind: 'fail',
      error: {
        code: 'ai_stream_error',
        message: parsed.message,
        userMessage: 'The reply stopped early.',
        partialText: accumulated,
      },
    },
  };
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

  // NFR24: never attach the key to a non-HTTPS (non-loopback) endpoint.
  if (!isAllowedByokRequestUrl(httpRequest.url)) {
    return {
      ok: false,
      error: {
        code: 'ai_insecure_endpoint',
        message: `Refusing non-HTTPS endpoint: ${httpRequest.url}`,
        userMessage:
          'That endpoint is not HTTPS. Use https://, or http:// only for localhost.',
        partialText: '',
      },
    };
  }

  try {
    const response = await fetch(httpRequest.url, {
      method: 'POST',
      headers: httpRequest.headers,
      body: httpRequest.body,
      signal,
      // NFR24 again: the pre-flight check above only sees the first URL. Left
      // to itself, fetch would follow a 302 to http:// and replay the key on
      // the redirect, which is the exact thing that check exists to stop.
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      return {
        ok: false,
        error: {
          code: 'ai_insecure_endpoint',
          message: `Refusing redirect (HTTP ${response.status}) from ${httpRequest.url}`,
          userMessage:
            'Your provider endpoint redirected somewhere else. Point the base URL straight at the API.',
          partialText: '',
        },
      };
    }

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

    const processBlock = (block: string): StreamFailure | null => {
      const frame = decodeSseBlock(block);
      if (!frame) {
        return null;
      }

      const parsed = adapter.parseStreamData(frame.data, frame.event);
      if (!parsed) {
        return null;
      }

      const handled = handleParsedFrame(parsed, accumulated, callbacks.onDelta);
      accumulated = handled.accumulated;
      if (handled.result.kind === 'fail') {
        return handled.result.error;
      }
      if (handled.result.complete) {
        complete = true;
      }
      return null;
    };

    try {
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

        // Only the leftover fragment is capped — the complete frames just
        // split off are legitimate however many arrived in one read.
        if (buffer.length > MAX_SSE_RESIDUAL_CHARS) {
          return {
            ok: false,
            error: {
              code: 'ai_stream_error',
              message: 'SSE frame exceeded maximum size without a delimiter',
              userMessage: 'The reply stopped early.',
              partialText: accumulated,
            },
          };
        }

        for (const block of blocks) {
          const failure = processBlock(block);
          if (failure) {
            return { ok: false, error: failure };
          }
        }
      }

      // Flush a trailing multi-byte sequence and any final SSE frame that
      // lacked a terminating blank line.
      buffer += decoder.decode();
      if (buffer.trim().length > 0) {
        const failure = processBlock(buffer);
        if (failure) {
          return { ok: false, error: failure };
        }
      }
    } finally {
      // Every exit above leaves the body open otherwise — including the plain
      // `break`, where cancelling an already-drained stream is a no-op.
      void reader.cancel().catch(() => {});
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
