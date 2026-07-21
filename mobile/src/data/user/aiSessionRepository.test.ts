import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import type { SessionSummary } from '@/core/ai/aiSession.types';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  appendAiMessage,
  createAiSession,
  endAiSession,
  getAiSession,
  listAiMessages,
  listAiSessions,
  saveAiSessionSummary,
} from '@/data/user/aiSessionRepository';

async function freshDb() {
  const db = await openDatabaseAsync('user.db');
  runMigrations(db, migrations);
  return db;
}

describe('aiSessionRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('creates a session that starts un-ended and un-summarised', async () => {
    const db = await freshDb();

    const session = createAiSession(db, {
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      mode: 'role_play',
    });

    expect(session.endedAt).toBeNull();
    expect(session.endedReason).toBeNull();
    expect(session.summary).toBeNull();
    expect(session.summaryGeneratedAt).toBeNull();
    expect(session.turnCount).toBe(0);

    const loaded = getAiSession(db, session.id);
    expect(loaded?.provider).toBe('anthropic');
    expect(loaded?.mode).toBe('role_play');
  });

  it('appends messages in order and bumps the turn count with them', async () => {
    const db = await freshDb();
    const session = createAiSession(db, {
      provider: 'openai',
      model: 'gpt-4o-mini',
      mode: 'random',
    });

    appendAiMessage(db, session.id, 'user', 'こんにちは');
    appendAiMessage(db, session.id, 'assistant', 'こんにちは！');
    appendAiMessage(db, session.id, 'user', '元気です');

    const messages = listAiMessages(db, session.id);
    expect(messages.map((m) => m.content)).toEqual(['こんにちは', 'こんにちは！', '元気です']);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(getAiSession(db, session.id)?.turnCount).toBe(3);
  });

  it('scopes messages to their own session', async () => {
    const db = await freshDb();
    const first = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });
    const second = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });

    appendAiMessage(db, first.id, 'user', 'first session');
    appendAiMessage(db, second.id, 'user', 'second session');

    expect(listAiMessages(db, first.id).map((m) => m.content)).toEqual(['first session']);
    expect(listAiMessages(db, second.id).map((m) => m.content)).toEqual(['second session']);
  });

  it('records each of the three end reasons', async () => {
    const db = await freshDb();

    for (const reason of ['ai_wrap_up', 'user_end', 'abandoned'] as const) {
      const session = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });
      endAiSession(db, session.id, reason);

      const ended = getAiSession(db, session.id);
      expect(ended?.endedReason).toBe(reason);
      expect(ended?.endedAt).not.toBeNull();
    }
  });

  it('leaves an abandoned session un-summarised but still resumable (FR94)', async () => {
    const db = await freshDb();
    const session = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });
    appendAiMessage(db, session.id, 'user', 'こんにちは');

    endAiSession(db, session.id, 'abandoned');

    const ended = getAiSession(db, session.id);
    expect(ended?.endedReason).toBe('abandoned');
    // Ending never generates a summary — that is a separate, on-demand call.
    expect(ended?.summary).toBeNull();
    expect(ended?.summaryGeneratedAt).toBeNull();
    // The transcript survives, so the session can be reopened and summarised later.
    expect(listAiMessages(db, session.id)).toHaveLength(1);
  });

  it('caches a summary that later reads see without regenerating (FR96)', async () => {
    const db = await freshDb();
    const session = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });

    const summary: SessionSummary = {
      mistakes: [{ quote: '私は行く', correction: '私は行きます', note: 'Use polite form.' }],
      wordsMet: [
        { text: '学生', itemId: '42' },
        { text: 'ラーメン', itemId: null },
      ],
      grammarNotes: ['Practised ～ています.'],
    };

    saveAiSessionSummary(db, session.id, summary);

    const loaded = getAiSession(db, session.id);
    expect(loaded?.summary).toEqual(summary);
    expect(loaded?.summaryGeneratedAt).not.toBeNull();
  });

  it('caps a stored mistake list at five (FR95) even if the model returned more', async () => {
    const db = await freshDb();
    const session = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });

    saveAiSessionSummary(db, session.id, {
      mistakes: Array.from({ length: 9 }, (_, index) => ({
        quote: `q${index}`,
        correction: `c${index}`,
        note: `n${index}`,
      })),
      wordsMet: [],
      grammarNotes: [],
    });

    expect(getAiSession(db, session.id)?.summary?.mistakes).toHaveLength(5);
  });

  it('degrades a corrupt stored summary to null rather than throwing', async () => {
    const db = await freshDb();
    const session = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });

    db.runSync(
      'UPDATE ai_sessions SET summary_json = ?, summary_generated_at = ? WHERE id = ?',
      '{not json',
      new Date().toISOString(),
      session.id,
    );

    expect(() => getAiSession(db, session.id)).not.toThrow();
    expect(getAiSession(db, session.id)?.summary).toBeNull();
  });

  it('lists past sessions newest first for the history surface', async () => {
    const db = await freshDb();
    const first = createAiSession(db, { provider: 'openai', model: 'm', mode: 'random' });
    const second = createAiSession(db, { provider: 'openai', model: 'm', mode: 'role_play' });

    db.runSync(
      'UPDATE ai_sessions SET ended_at = ?, ended_reason = ? WHERE id = ?',
      '2026-01-01T00:00:00.000Z',
      'user_end',
      first.id,
    );

    const listed = listAiSessions(db);
    const ids = listed.map((session) => session.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
  });

  it('returns null for an unknown session id', async () => {
    const db = await freshDb();

    expect(getAiSession(db, 'does-not-exist')).toBeNull();
    expect(listAiMessages(db, 'does-not-exist')).toEqual([]);
  });
});
