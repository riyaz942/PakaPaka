import type { SQLiteDatabase } from 'expo-sqlite';

import type { ByokProvider } from '@/data/ai/byokCredential.types';
import { resolveAiConfigForSession } from '@/data/ai/aiConfig';
import { streamAssistantTurn } from '@/data/ai/streamingClient';
import type { Result } from '@/types/result.types';

/**
 * One-shot BYOK gloss for an off-curriculum word (FR92 / AC7).
 *
 * Local curriculum lookup is always tried first — this path only runs when the
 * surface form is absent from the bundled items. Never writes SRS state.
 *
 * The provider comes from the session the word was read in, not from live
 * preferences: the word is part of that conversation's transcript, so changing
 * the active provider in Settings must not redirect it to another endpoint.
 */

export type OffCurriculumTranslation = {
  text: string;
  reading: string;
  meaning: string;
};

const MAX_TRANSLATE_TOKENS = 128;

const TRANSLATE_SYSTEM_PROMPT = [
  'You translate a single Japanese word or short phrase for a language learner.',
  'Reply with ONLY compact JSON of the form {"reading":"...","meaning":"..."}.',
  'reading is kana (hiragana or katakana). meaning is a short English gloss.',
  'No markdown, no commentary, no furigana brackets.',
].join(' ');

function clampGloss(value: string, limit: number): string {
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit).trimEnd()}…` : trimmed;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/**
 * Asks the learner's configured provider for a reading + English gloss.
 * Display-only — the caller must not create SRS rows from the result.
 */
export async function translateOffCurriculumWord(
  userDb: SQLiteDatabase,
  text: string,
  session: { provider: ByokProvider; model: string },
  signal?: AbortSignal,
): Promise<Result<OffCurriculumTranslation>> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        code: 'ai_translate_empty',
        message: 'Empty word',
        userMessage: 'There is nothing to look up.',
      },
    };
  }

  const configResult = await resolveAiConfigForSession(userDb, session);
  if (!configResult.ok) {
    return configResult;
  }
  if (!configResult.value) {
    return {
      ok: false,
      error: {
        code: 'ai_not_configured',
        message: 'No BYOK provider configured',
        userMessage: 'Add an API key in Settings to look up words outside your curriculum.',
      },
    };
  }

  const config = configResult.value;
  const result = await streamAssistantTurn(
    config.adapter,
    {
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      systemPrompt: TRANSLATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: trimmed }],
      maxTokens: MAX_TRANSLATE_TOKENS,
    },
    { onDelta: () => {} },
    signal,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: {
        code: result.error.code,
        message: result.error.message,
        userMessage: result.error.userMessage,
        cause: result.error.cause,
      },
    };
  }

  const parsed = extractJsonObject(result.value.text);
  if (typeof parsed !== 'object' || parsed === null) {
    return {
      ok: false,
      error: {
        code: 'ai_translate_parse',
        message: 'Provider reply was not JSON',
        userMessage: 'Could not read a translation for that word. Try again.',
      },
    };
  }

  const record = parsed as { reading?: unknown; meaning?: unknown };
  // A model that ignores "compact JSON" can return an essay; this is a one-word
  // gloss, so trim it to something the sheet can lay out.
  const reading = typeof record.reading === 'string' ? clampGloss(record.reading, 64) : '';
  const meaning = typeof record.meaning === 'string' ? clampGloss(record.meaning, 200) : '';
  if (reading.length === 0 && meaning.length === 0) {
    return {
      ok: false,
      error: {
        code: 'ai_translate_parse',
        message: 'Provider JSON missing reading and meaning',
        userMessage: 'Could not read a translation for that word. Try again.',
      },
    };
  }

  return {
    ok: true,
    value: {
      text: trimmed,
      reading,
      meaning,
    },
  };
}
