import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AdapterMessage,
  AiSessionRecord,
  ChatMessage,
  SessionEndReason,
} from '@/core/ai/aiSession.types';
import { stripControlMarkers } from '@/core/ai/markers';
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
  /** Aborts any in-flight stream, waits for its commit, then ends the session. */
  end: (reason: SessionEndReason) => Promise<void>;
  dismissWrapUp: () => void;
  dismissError: () => void;
};

/**
 * Collapses consecutive same-role turns. A failed stream that committed only
 * the learner message leaves two `user` rows back-to-back; Anthropic's Messages
 * API rejects that, and OpenAI-compatible endpoints are happier with a single
 * merged user turn than with a silent empty assistant placeholder.
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
  const sessionRef = useRef(session);
  const grammarTopicsRef = useRef(grammarTopics);

  messagesRef.current = messages;
  sessionRef.current = session;
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

  /** Commits an assistant turn, stripping control markers before persisting. */
  const commitAssistantTurn = useCallback(
    (rawText: string) => {
      const scanned = stripControlMarkers(rawText);
      if (scanned.wrapUp) {
        setWrapUpSignalled(true);
      }
      if (scanned.text.length === 0) {
        return;
      }
      const committed = appendAiMessage(userDb, sessionId, 'assistant', scanned.text);
      setMessages((previous) => [...previous, committed]);
    },
    [userDb, sessionId],
  );

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || sendingRef.current) {
        return false;
      }

      const currentSession = sessionRef.current ?? getAiSession(userDb, sessionId);
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

      let accepted = false;
      const work = (async () => {
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

        const config = configResult.value;

        // Commit the learner's turn first: it happened regardless of what the
        // network does next.
        const userMessage = appendAiMessage(userDb, sessionId, 'user', trimmed);
        const history = [...messagesRef.current, userMessage];
        setMessages(history);
        accepted = true;

        const level = getStartingJlptLevel(userDb) ?? 'N5';
        const systemPrompt = buildConversationSystemPrompt({
          mode: currentSession.mode,
          turnBudget: computeTurnBudget(level, { studiedItems: 0, totalItems: 0 }),
          grammarTopics: grammarTopicsRef.current,
        });

        const controller = new AbortController();
        abortRef.current = controller;

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
              setPendingReply((previous) => stripControlMarkers(previous + delta).text);
            },
          },
          controller.signal,
        );

        abortRef.current = null;

        if (result.ok) {
          commitAssistantTurn(result.value.text);
          return;
        }

        // Degrade without corrupting the transcript (NFR27): keep the salvaged
        // prefix as a real turn, then report the failure.
        if (result.error.partialText.length > 0) {
          commitAssistantTurn(result.error.partialText);
        }
        setError({
          code: result.error.code,
          message: result.error.message,
          userMessage: result.error.userMessage,
          cause: result.error.cause,
        });
      })();

      inFlightRef.current = work;
      try {
        await work;
      } finally {
        sendingRef.current = false;
        setIsStreaming(false);
        setPendingReply('');
        inFlightRef.current = null;
      }

      return accepted;
    },
    [userDb, sessionId, commitAssistantTurn],
  );

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
      endAiSession(userDb, sessionId, reason);
      setSession(getAiSession(userDb, sessionId));
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
    end,
    dismissWrapUp: () => setWrapUpSignalled(false),
    dismissError: () => setError(null),
  };
}
