import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  isConversationMode,
  MAX_SUMMARY_MISTAKES,
  type AiSessionRecord,
  type ChatMessage,
  type ConversationMode,
  type SessionEndReason,
  type SessionSummary,
} from '@/core/ai/aiSession.types';
import { isByokProvider, type ByokProvider } from '@/data/ai/byokCredential.types';

/**
 * AI conversation persistence (NFR28). `user.db` state like every other
 * `data/user/*Repository.ts` — the curriculum database is never touched here.
 */

type SessionRow = {
  id: string;
  provider: string;
  model: string;
  mode: string;
  topic_item_id: string | null;
  topic_item_ids: string | null;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
  turn_count: number;
  summary_json: string | null;
  summary_generated_at: string | null;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
};

function isEndReason(value: string | null): value is SessionEndReason {
  return value === 'ai_wrap_up' || value === 'user_end' || value === 'abandoned';
}

/**
 * Parses a stored summary defensively: it is model-authored JSON, so a shape
 * change on the provider's side must degrade to "no summary yet" rather than
 * crash the history list.
 */
function parseSummary(json: string | null): SessionSummary | null {
  if (!json) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Partial<SessionSummary>;
    return {
      mistakes: Array.isArray(record.mistakes)
        ? record.mistakes.slice(0, MAX_SUMMARY_MISTAKES)
        : [],
      wordsMet: Array.isArray(record.wordsMet) ? record.wordsMet : [],
      grammarNotes: Array.isArray(record.grammarNotes) ? record.grammarNotes : [],
    };
  } catch {
    return null;
  }
}

/**
 * The grammar set the session was started with. Stored as JSON so the ids
 * survive a resume unchanged; a corrupt or pre-migration value degrades to the
 * single `topic_item_id`, which is what every row written before 018 has.
 */
function parseTopicItemIds(json: string | null, fallback: string | null): string[] {
  if (json) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((entry): entry is string => typeof entry === 'string');
        if (ids.length > 0) {
          return ids;
        }
      }
    } catch {
      // Fall through to the single-id form below.
    }
  }
  return fallback ? [fallback] : [];
}

function toSessionRecord(row: SessionRow): AiSessionRecord {
  return {
    id: row.id,
    provider: isByokProvider(row.provider) ? row.provider : 'openai',
    model: row.model,
    mode: isConversationMode(row.mode) ? row.mode : 'random',
    topicItemId: row.topic_item_id,
    topicItemIds: parseTopicItemIds(row.topic_item_ids, row.topic_item_id),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endedReason: isEndReason(row.ended_reason) ? row.ended_reason : null,
    turnCount: Number(row.turn_count ?? 0),
    summary: parseSummary(row.summary_json),
    summaryGeneratedAt: row.summary_generated_at,
  };
}

/**
 * Clears a corrupt once-only cache in place so a later generate can write
 * (FR96). Returns the row as it should be read after healing.
 */
function withHealedSummaryCache(userDb: SQLiteDatabase, row: SessionRow): SessionRow {
  if (row.summary_json == null || parseSummary(row.summary_json) !== null) {
    return row;
  }
  userDb.runSync(
    'UPDATE ai_sessions SET summary_json = NULL, summary_generated_at = NULL WHERE id = ?',
    row.id,
  );
  return { ...row, summary_json: null, summary_generated_at: null };
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    createdAt: row.created_at,
  };
}

export function createAiSession(
  userDb: SQLiteDatabase,
  options: {
    provider: ByokProvider;
    model: string;
    mode: ConversationMode;
    topicItemId?: string | null;
    /** The full grammar set this session is grounded in, pinned at start. */
    topicItemIds?: string[];
  },
): AiSessionRecord {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const topicItemIds =
    options.topicItemIds && options.topicItemIds.length > 0
      ? options.topicItemIds
      : options.topicItemId
        ? [options.topicItemId]
        : [];

  userDb.runSync(
    `INSERT INTO ai_sessions
       (id, provider, model, mode, topic_item_id, topic_item_ids, started_at, ended_at,
        ended_reason, turn_count, summary_json, summary_generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, NULL)`,
    id,
    options.provider,
    options.model,
    options.mode,
    options.topicItemId ?? null,
    topicItemIds.length > 0 ? JSON.stringify(topicItemIds) : null,
    startedAt,
  );

  return {
    id,
    provider: options.provider,
    model: options.model,
    mode: options.mode,
    topicItemId: options.topicItemId ?? null,
    topicItemIds,
    startedAt,
    endedAt: null,
    endedReason: null,
    turnCount: 0,
    summary: null,
    summaryGeneratedAt: null,
  };
}

/**
 * Appends one turn and bumps the session's turn count in a single transaction —
 * a message written without its count bump would make the turn budget drift.
 */
export function appendAiMessage(
  userDb: SQLiteDatabase,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
): ChatMessage {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  userDb.withTransactionSync(() => {
    userDb.runSync(
      `INSERT INTO ai_messages (id, session_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      id,
      sessionId,
      role,
      content,
      createdAt,
    );
    userDb.runSync(
      'UPDATE ai_sessions SET turn_count = turn_count + 1 WHERE id = ?',
      sessionId,
    );
  });

  return { id, sessionId, role, content, createdAt };
}

export function getAiSession(userDb: SQLiteDatabase, sessionId: string): AiSessionRecord | null {
  const row = userDb.getFirstSync<SessionRow>(
    'SELECT * FROM ai_sessions WHERE id = ?',
    sessionId,
  );
  return row ? toSessionRecord(withHealedSummaryCache(userDb, row)) : null;
}

/** Past threads for the history surface (FR89), newest first. */
export function listAiSessions(userDb: SQLiteDatabase): AiSessionRecord[] {
  const rows = userDb.getAllSync<SessionRow>(
    'SELECT * FROM ai_sessions ORDER BY started_at DESC',
  );
  return rows.map((row) => toSessionRecord(withHealedSummaryCache(userDb, row)));
}

export function listAiMessages(userDb: SQLiteDatabase, sessionId: string): ChatMessage[] {
  const rows = userDb.getAllSync<MessageRow>(
    'SELECT * FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC',
    sessionId,
  );
  return rows.map(toChatMessage);
}

/**
 * Marks a session ended. Does **not** generate a summary: summaries are
 * on-demand and once-only (FR96), so abandoning stays silent and un-summarised
 * while remaining resumable.
 */
export function endAiSession(
  userDb: SQLiteDatabase,
  sessionId: string,
  reason: SessionEndReason,
): void {
  userDb.runSync(
    'UPDATE ai_sessions SET ended_at = ?, ended_reason = ? WHERE id = ?',
    new Date().toISOString(),
    reason,
    sessionId,
  );
}

/**
 * Writes the generated summary once. The `summary_generated_at IS NULL` guard
 * is the DB-level once-only cache (FR96) — concurrent callers cannot overwrite.
 */
export function saveAiSessionSummary(
  userDb: SQLiteDatabase,
  sessionId: string,
  summary: SessionSummary,
): void {
  userDb.runSync(
    `UPDATE ai_sessions
       SET summary_json = ?, summary_generated_at = ?
     WHERE id = ? AND summary_generated_at IS NULL`,
    JSON.stringify({
      ...summary,
      mistakes: summary.mistakes.slice(0, MAX_SUMMARY_MISTAKES),
    }),
    new Date().toISOString(),
    sessionId,
  );
}
