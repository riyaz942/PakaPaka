import { useCallback, useEffect, useState } from 'react';

import type { SessionSummary } from '@/core/ai/aiSession.types';
import { parseSessionSummary } from '@/core/ai/summaryParser';
import { buildSummarySystemPrompt } from '@/core/ai/systemPrompt';
import { resolveAiConfig } from '@/data/ai/aiConfig';
import { streamAssistantTurn } from '@/data/ai/streamingClient';
import { lookupFlaggedWord } from '@/data/ai/wordLookupRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getAiSession,
  listAiMessages,
  saveAiSessionSummary,
} from '@/data/user/aiSessionRepository';
import type { AppError } from '@/types/result.types';

const MAX_SUMMARY_TOKENS = 1024;

type SummaryState = {
  summary: SessionSummary | null;
  /** True once a cached summary exists — the generate affordance disappears. */
  isCached: boolean;
  isGenerating: boolean;
  error: AppError | null;
  generate: () => Promise<void>;
};

/**
 * On-demand, once-only session summary (FR95, FR96).
 *
 * Generation costs one extra adapter call, so it never fires automatically and
 * never re-fires: once `summary_generated_at` is set the cached summary is what
 * every later view shows, even if it was disappointing. Word membership is
 * resolved locally after parsing (FR92) — the model is never asked which words
 * are in the curriculum.
 */
export function useSessionSummary(sessionId: string): SummaryState {
  const { userDb } = useDatabase();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    const session = getAiSession(userDb, sessionId);
    setSummary(session?.summary ?? null);
    setIsCached(session?.summaryGeneratedAt != null);
  }, [userDb, sessionId]);

  const generate = useCallback(async () => {
    if (isGenerating) {
      return;
    }

    const session = getAiSession(userDb, sessionId);
    if (!session) {
      return;
    }
    // Already generated: serve the cache, never spend a second call.
    if (session.summaryGeneratedAt != null) {
      setSummary(session.summary);
      setIsCached(true);
      return;
    }

    const transcript = listAiMessages(userDb, sessionId);
    if (transcript.length === 0) {
      setError({
        code: 'ai_summary_empty_session',
        message: 'Session has no messages to summarise',
        userMessage: 'There is nothing to summarise yet.',
      });
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const configResult = await resolveAiConfig(userDb);
      if (!configResult.ok) {
        setError(configResult.error);
        return;
      }
      if (!configResult.value) {
        setError({
          code: 'ai_not_configured',
          message: 'No BYOK provider configured',
          userMessage: 'Add an API key in Settings to generate a summary.',
        });
        return;
      }

      const config = configResult.value;
      const conversation = transcript
        .map((message) => `${message.role === 'user' ? 'Learner' : 'Partner'}: ${message.content}`)
        .join('\n');

      const result = await streamAssistantTurn(
        config.adapter,
        {
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          systemPrompt: buildSummarySystemPrompt(),
          messages: [{ role: 'user', content: conversation }],
          maxTokens: MAX_SUMMARY_TOKENS,
        },
        { onDelta: () => {} },
      );

      if (!result.ok) {
        setError({
          code: result.error.code,
          message: result.error.message,
          userMessage: result.error.userMessage,
        });
        return;
      }

      const parsed = parseSessionSummary(result.value.text);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }

      // Curriculum membership is decided here, locally and for free.
      const resolved: SessionSummary = {
        ...parsed.value,
        wordsMet: parsed.value.wordsMet.map((word) => {
          const lookup = lookupFlaggedWord(userDb, word.text);
          return {
            text: word.text,
            itemId: lookup.kind === 'curriculum' ? lookup.itemId : null,
          };
        }),
      };

      saveAiSessionSummary(userDb, sessionId, resolved);
      setSummary(resolved);
      setIsCached(true);
    } finally {
      setIsGenerating(false);
    }
  }, [userDb, sessionId, isGenerating]);

  return { summary, isCached, isGenerating, error, generate };
}
