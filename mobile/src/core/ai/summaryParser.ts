import { MAX_SUMMARY_MISTAKES, type SessionSummary } from '@/core/ai/aiSession.types';
import type { Result } from '@/types/result.types';

/**
 * Parses the summary call's JSON reply (FR95).
 *
 * Defensive by design: this is model-authored text, so every field is validated
 * and a bad shape becomes a `Result` error the caller renders as "no summary"
 * — never a thrown exception mid-render, and never a silent retry.
 *
 * `wordsMet` comes back with `itemId: null`; curriculum membership is resolved
 * locally afterwards (FR92), never by asking the model.
 */

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(asString).filter((entry) => entry.length > 0);
}

/**
 * Extracts the JSON object from a reply, tolerating a code fence or a stray
 * sentence around it — models add both often enough that failing on them would
 * lose otherwise-good summaries.
 */
function extractJsonObject(reply: string): string | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return reply.slice(start, end + 1);
}

export function parseSessionSummary(reply: string): Result<SessionSummary> {
  const json = extractJsonObject(reply);
  if (!json) {
    return {
      ok: false,
      error: {
        code: 'ai_summary_unparseable',
        message: 'Summary reply contained no JSON object',
        userMessage: 'The summary could not be read.',
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'ai_summary_unparseable',
        message: 'Summary reply was not valid JSON',
        userMessage: 'The summary could not be read.',
        cause,
      },
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      error: {
        code: 'ai_summary_unparseable',
        message: 'Summary reply was not a JSON object',
        userMessage: 'The summary could not be read.',
      },
    };
  }

  const record = parsed as Record<string, unknown>;

  const mistakes = (Array.isArray(record.mistakes) ? record.mistakes : [])
    .map((entry) => {
      const item = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
        string,
        unknown
      >;
      return {
        quote: asString(item.quote),
        correction: asString(item.correction),
        note: asString(item.note),
      };
    })
    // A mistake with no correction teaches nothing — drop it rather than
    // rendering an empty row.
    .filter((mistake) => mistake.correction.length > 0)
    .slice(0, MAX_SUMMARY_MISTAKES);

  const seenWords = new Set<string>();
  const wordsMet: SessionSummary['wordsMet'] = [];
  const rawWords = Array.isArray(record.wordsMet) ? record.wordsMet : [];
  for (const entry of rawWords) {
    const text =
      typeof entry === 'string'
        ? asString(entry)
        : asString((entry as Record<string, unknown> | null)?.text);
    if (text.length === 0 || seenWords.has(text)) {
      continue;
    }
    seenWords.add(text);
    // Membership is decided locally, so it is deliberately null here.
    wordsMet.push({ text, itemId: null });
  }

  return {
    ok: true,
    value: { mistakes, wordsMet, grammarNotes: asStringArray(record.grammarNotes) },
  };
}
