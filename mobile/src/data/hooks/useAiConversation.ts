import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AdapterMessage,
  AiSessionRecord,
  ChatMessage,
  SessionEndReason,
} from '@/core/ai/aiSession.types';
import { displayableStreamText, stripControlMarkers } from '@/core/ai/markers';
import { buildConversationSystemPrompt, type GrammarPromptTopic } from '@/core/ai/systemPrompt';
import { computeTurnBudget } from '@/core/ai/turnBudget';
import { resolveAiConfigForSession } from '@/data/ai/aiConfig';
import { streamAssistantTurn } from '@/data/ai/streamingClient';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  appendAiMessage,
  endAiSession,
  getAiSession,
  listAiMessages,
} from '@/data/user/aiSessionRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import type { AppError } from '@/types/result.types';

const MAX_REPLY_TOKENS = 1024;

type ConversationState = {
  session: AiSessionRecord | null;
  messages: ChatMessage[];
  /** Text streaming in right now; not yet persisted. Markers already stripped for display. */
  pendingReply: string;
  isStreaming: boolean;
  /** Set once the AI signals the scene should end (FR97). Cleared by dismissWrapUp. */
  wrapUpSignalled: boolean;
  error: AppError | null;
  /** Resolves true once the learner turn was persisted (draft may clear). */
  send: (text: string) => Promise<boolean>;
  /**
   * Re-requests a reply for the transcript as it stands, without adding another
   * turn. The visible recovery after a failed stream.
   */
  retry: () => Promise<void>;
  /** True when the last turn is the learner's and nothing is in flight. */
  canRetry: boolean;
  /** Aborts any in-flight stream, waits for its commit, then ends the session. */
  end: (reason: SessionEndReason) => Promise<void>;
  dismissWrapUp: () => void;
  dismissError: () => void;
};

/**
 * Wire shape for the transcript.
 *
 * Consecutive same-role turns are merged because Anthropic's Messages API
 * rejects back-to-back `user` entries outright — a protocol constraint, not a
 * recovery strategy. The recovery the learner sees is `retry`, which re-sends
 * the existing transcript instead of stacking another turn onto it, so this
 * merge is a floor for a transcript that already went wrong rather than the
 * normal path after a failed stream.
 */
function toAdapterMessages(messages: ChatMessage[]): AdapterMessage[] {
  const adapted: AdapterMessage[] = [];
  for (const message of messages) {
    const previous = adapted[adapted.length - 1];
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n${message.content}`;
      continue;
    }
    adapted.push({ role: message.role, content: message.content });
  }
  return adapted;
}

function toAppError(cause: unknown, code: string, userMessage: string): AppError {
  return {
    code,
    message: cause instanceof Error ? cause.message : String(cause),
    userMessage,
    cause,
  };
}

/**
 * Drives one chat session (FR89–FR91, FR97, NFR27).
 *
 * Persistence rule throughout: a turn is written only once it exists. The
 * learner's message is committed before the request goes out, and a partial or
 * failed stream still commits whatever text arrived — the transcript is never
 * rewound or wiped by a failure.
 */
export function useAiConversation(
  sessionId: string,
  grammarTopics: GrammarPromptTopic[] = [],
): ConversationState {
  const { userDb } = useDatabase();
  const [session, setSession] = useState<AiSessionRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingReply, setPendingReply] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [wrapUpSignalled, setWrapUpSignalled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const messagesRef = useRef(messages);
  const grammarTopicsRef = useRef(grammarTopics);

  messagesRef.current = messages;
  grammarTopicsRef.current = grammarTopics;

  useEffect(() => {
    setSession(getAiSession(userDb, sessionId));
    setMessages(listAiMessages(userDb, sessionId));
  }, [userDb, sessionId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  /**
   * Commits an assistant turn, stripping control markers before persisting.
   * Returns false when the reply held no text worth keeping, so the caller can
   * say so instead of leaving the learner staring at an unanswered turn.
   */
  const commitAssistantTurn = useCallback(
    (rawText: string): boolean => {
      const scanned = stripControlMarkers(rawText);
      if (scanned.wrapUp) {
        setWrapUpSignalled(true);
      }
      if (scanned.text.length === 0) {
        return false;
      }
      const committed = appendAiMessage(userDb, sessionId, 'assistant', scanned.text);
      setMessages((previous) => [...previous, committed]);
      return true;
    },
    [userDb, sessionId],
  );

  /** Streams one reply for `history`. Every failure lands as state, not a throw. */
  const streamReply = useCallback(
    async (
      history: ChatMessage[],
      currentSession: AiSessionRecord,
      controller: AbortController,
    ) => {
      const configResult = await resolveAiConfigForSession(userDb, currentSession);
      if (!configResult.ok) {
        setError(configResult.error);
        return;
      }
      if (!configResult.value) {
        setError({
          code: 'ai_not_configured',
          message: 'No BYOK provider configured',
          userMessage: 'Add an API key in Settings to start chatting.',
        });
        return;
      }
      if (controller.signal.aborted) {
        return;
      }

      const config = configResult.value;
      const level = getStartingJlptLevel(userDb) ?? 'N5';
      const systemPrompt = buildConversationSystemPrompt({
        mode: currentSession.mode,
        turnBudget: computeTurnBudget(level, { studiedItems: 0, totalItems: 0 }),
        grammarTopics: grammarTopicsRef.current,
      });

      let raw = '';
      const result = await streamAssistantTurn(
        config.adapter,
        {
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          systemPrompt,
          messages: toAdapterMessages(history),
          maxTokens: MAX_REPLY_TOKENS,
        },
        {
          onDelta: (delta) => {
            raw += delta;
            setPendingReply(displayableStreamText(raw));
          },
        },
        controller.signal,
      );

      if (result.ok) {
        const committed = commitAssistantTurn(result.value.text);
        if (!committed) {
          setError({
            code: 'ai_empty_reply',
            message: 'Provider returned no usable text',
            userMessage: 'Your provider sent an empty reply. Try again.',
          });
          return;
        }
        if (!result.value.complete) {
          // The turn is real and kept, but the provider never signalled the end
          // of it — say so rather than passing a cut-off sentence off as final.
          setError({
            code: 'ai_stream_truncated',
            message: 'Stream ended without a completion signal',
            userMessage: 'That reply was cut off. You can ask again for the rest.',
          });
        }
        return;
      }

      // A deliberate stop is not a failure to report — `end()` already aborted
      // on the learner's behalf, and the salvaged text is kept either way.
      if (result.error.partialText.length > 0) {
        commitAssistantTurn(result.error.partialText);
      }
      if (result.error.code === 'ai_stream_aborted' || controller.signal.aborted) {
        return;
      }
      setError({
        code: result.error.code,
        message: result.error.message,
        userMessage: result.error.userMessage,
        cause: result.error.cause,
      });
    },
    [userDb, commitAssistantTurn],
  );

  /**
   * Shared entry for both send and retry. The controller is live before the
   * first await so `end()` can always reach it, and every synchronous DB call
   * inside is caught — this hook returns state, it does not throw at callers.
   */
  const runTurn = useCallback(
    async (prepare: () => ChatMessage[] | null): Promise<boolean> => {
      if (sendingRef.current) {
        return false;
      }

      let currentSession: AiSessionRecord | null;
      try {
        currentSession = getAiSession(userDb, sessionId);
      } catch (cause) {
        setError(toAppError(cause, 'ai_session_read_failed', 'This conversation could not be read.'));
        return false;
      }
      if (!currentSession) {
        setError({
          code: 'ai_session_not_found',
          message: `Session ${sessionId} not found`,
          userMessage: 'This conversation could not be found.',
        });
        return false;
      }
      if (currentSession.endedAt) {
        setError({
          code: 'ai_session_ended',
          message: `Session ${sessionId} already ended`,
          userMessage: 'This conversation has already finished.',
        });
        return false;
      }

      sendingRef.current = true;
      setError(null);
      setIsStreaming(true);
      setPendingReply('');

      const controller = new AbortController();
      abortRef.current = controller;

      let accepted = false;
      const work = (async () => {
        try {
          const history = prepare();
          if (!history) {
            return;
          }
          accepted = true;
          await streamReply(history, currentSession, controller);
        } catch (cause) {
          setError(
            toAppError(
              cause,
              'ai_turn_failed',
              'Something went wrong saving this conversation. Try again.',
            ),
          );
        }
      })();

      inFlightRef.current = work;
      try {
        await work;
      } finally {
        sendingRef.current = false;
        abortRef.current = null;
        setIsStreaming(false);
        setPendingReply('');
        inFlightRef.current = null;
      }

      return accepted;
    },
    [userDb, sessionId, streamReply],
  );

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        return false;
      }
      return runTurn(() => {
        // Commit the learner's turn first: it happened regardless of what the
        // network does next.
        const userMessage = appendAiMessage(userDb, sessionId, 'user', trimmed);
        const history = [...messagesRef.current, userMessage];
        setMessages(history);
        return history;
      });
    },
    [userDb, sessionId, runTurn],
  );

  const retry = useCallback(async () => {
    await runTurn(() => {
      const history = messagesRef.current;
      if (history.length === 0 || history[history.length - 1].role !== 'user') {
        return null;
      }
      return history;
    });
  }, [runTurn]);

  const end = useCallback(
    async (reason: SessionEndReason) => {
      abortRef.current?.abort();
      if (inFlightRef.current) {
        try {
          await inFlightRef.current;
        } catch {
          // Stream failures are already surfaced via setError; ending still proceeds.
        }
      }
      try {
        endAiSession(userDb, sessionId, reason);
        setSession(getAiSession(userDb, sessionId));
      } catch (cause) {
        setError(toAppError(cause, 'ai_session_end_failed', 'This conversation could not be closed.'));
      }
    },
    [userDb, sessionId],
  );

  return {
    session,
    messages,
    pendingReply,
    isStreaming,
    wrapUpSignalled,
    error,
    send,
    retry,
    canRetry:
      !isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user',
    end,
    dismissWrapUp: () => setWrapUpSignalled(false),
    dismissError: () => setError(null),
  };
}
