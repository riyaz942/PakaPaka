import { migrations } from '@/data/migrations';
import { migration018AiSessionTopicIds } from '@/data/migrations/018_ai_session_topic_ids';

describe('018_ai_session_topic_ids', () => {
  it('claims version 18 and is registered last', () => {
    expect(migration018AiSessionTopicIds.version).toBe(18);
    expect(migration018AiSessionTopicIds.name).toBe('018_ai_session_topic_ids');
    expect(migrations[migrations.length - 1]).toBe(migration018AiSessionTopicIds);
  });

  it('adds the column only when it is not already there', () => {
    const statements: string[] = [];
    let columns = [{ name: 'id' }, { name: 'topic_item_id' }];
    const db = {
      getAllSync: () => columns,
      execSync: (sql: string) => statements.push(sql),
    } as never;

    migration018AiSessionTopicIds.up(db);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('ADD COLUMN topic_item_ids');

    // Re-running against a database that already has it must be a no-op —
    // SQLite has no `ADD COLUMN IF NOT EXISTS`.
    columns = [...columns, { name: 'topic_item_ids' }];
    migration018AiSessionTopicIds.up(db);
    expect(statements).toHaveLength(1);
  });
});
