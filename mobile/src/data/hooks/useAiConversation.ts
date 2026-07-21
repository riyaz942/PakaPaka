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
import { resolveAiConfig } from '@/data/ai/aiConfig';
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
  /** Text streaming in right now; not yet persisted. */
  pendingReply: string;
  isStreaming: boolean;
  /** Set once the AI signals the scene should end (FR97). */
  wrapUpSignalled: boolean;
  error: AppError | null;
  send: (text: string) => Promise<void>;
  end: (reason: SessionEndReason) => void;
  dismissError: () => void;
};

function toAdapterMessages(messages: ChatMessage[]): AdapterMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
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
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || isStreaming) {
        return;
      }

      setError(null);

      const configResult = await resolveAiConfig(userDb);
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
      const history = [...messages, userMessage];
      setMessages(history);

      const level = getStartingJlptLevel(userDb) ?? 'N5';
      const systemPrompt = buildConversationSystemPrompt({
        mode: session?.mode ?? 'random',
        turnBudget: computeTurnBudget(level, { studiedItems: 0, totalItems: 0 }),
        grammarTopics,
      });

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setPendingReply('');

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
            setPendingReply((previous) => previous + delta);
          },
        },
        controller.signal,
      );

      setIsStreaming(false);
      setPendingReply('');
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
    },
    [userDb, sessionId, messages, session, grammarTopics, isStreaming, commitAssistantTurn],
  );

  const end = useCallback(
    (reason: SessionEndReason) => {
      abortRef.current?.abort();
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
    dismissError: () => setError(null),
  };
}
