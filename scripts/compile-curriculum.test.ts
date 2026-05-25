import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { assignItemIds, compileCurriculum } from './compile-curriculum';

const FIXTURE_DIR = path.join(__dirname, '__fixtures__', 'valid');

describe('compile-curriculum', () => {
  it('assigns deterministic item ids by type then slug', () => {
    const ids = assignItemIds(
      [{ slug: 'b', primary_form: 'B', meaning: 'b', visual_mnemonic_url: 'https://a.example/b.png' }],
      [{ slug: 'a', primary_form: 'A', meaning: 'a' }],
      [],
      [],
    );
    expect(ids.get('radical:b')).toBe(1);
    expect(ids.get('kanji:a')).toBe(2);
  });

  it('compiles fixture JSON to sqlite with metadata and relationships', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const dbPath = path.join(tempDir, 'curriculum.db');

    compileCurriculum(dbPath, FIXTURE_DIR);

    const db = new Database(dbPath, { readonly: true });
    try {
      const metadata = db
        .prepare('SELECT version, content_hash, item_count FROM curriculum_metadata')
        .get() as { version: string; content_hash: string; item_count: number };

      expect(metadata.version).toBe('0.0.1-test');
      expect(metadata.content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.item_count).toBe(4);

      const itemCount = db.prepare('SELECT COUNT(*) AS count FROM items').get() as { count: number };
      const relationshipCount = db
        .prepare('SELECT COUNT(*) AS count FROM item_relationships')
        .get() as { count: number };

      expect(itemCount.count).toBe(4);
      expect(relationshipCount.count).toBe(2);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
