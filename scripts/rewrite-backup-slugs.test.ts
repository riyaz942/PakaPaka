import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import Database from 'better-sqlite3';

import {
  type BackupBundle,
  findUnmatchedRefs,
  migratedPath,
  rewriteBackup,
  rewriteBackupFile,
} from './rewrite-backup-slugs';

const RENAMES: Record<string, string> = {
  'kanji:k-go': 'kanji:go-game',
  'grammar:sugiru': 'grammar:sugiru',
  'grammar:n4-sugiru': 'grammar:sugiru',
};

const kanji = { itemType: 'kanji', slug: 'k-go' };
const n5Sugiru = { itemType: 'grammar', slug: 'sugiru' };
const n4Sugiru = { itemType: 'grammar', slug: 'n4-sugiru' };
const vocab = { itemType: 'vocabulary', slug: 'ginkou' };

function srs(item: object, lastReviewedAt: string | null, stability: number) {
  return {
    item,
    stability,
    difficulty: 5,
    dueDate: '2026-10-20T00:00:00.000Z',
    fsrsState: 'review',
    reps: 3,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'guru',
    lastReviewedAt,
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function weakness(
  item: object,
  correctCount: number,
  lastErrorAt: string | null,
  lastErrorType: string | null,
) {
  return {
    item,
    correctCount,
    incorrectCount: 1,
    typoCount: 0,
    lastErrorAt,
    lastErrorType,
    patternTags: null,
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function fixture(): BackupBundle {
  return {
    format: 'kizamu-backup',
    formatVersion: 1,
    schemaVersion: 20,
    curriculumVersion: '19',
    exportedAt: '2026-10-11T00:00:00.000Z',
    includesConversations: true,
    data: {
      userPreferences: [{ key: 'session_intensity', value: 'light', updatedAt: 'x' }],
      itemStudyStatus: [
        { item: kanji, status: 'known', updatedAt: '2026-09-01T00:00:00.000Z' },
        { item: n5Sugiru, status: 'in_progress', updatedAt: '2026-09-01T00:00:00.000Z' },
        { item: n4Sugiru, status: 'known', updatedAt: '2026-09-02T00:00:00.000Z' },
        { item: vocab, status: 'not_started', updatedAt: '2026-09-01T00:00:00.000Z' },
      ],
      srsStates: [
        srs(n5Sugiru, '2026-09-10T00:00:00.000Z', 4),
        srs(n4Sugiru, '2026-09-10T00:00:00.000Z', 9),
        srs(kanji, null, 1),
      ],
      importMetadata: [],
      personalMnemonics: [
        { item: n5Sugiru, mnemonicText: 'old', updatedAt: '2026-09-01T00:00:00.000Z' },
        { item: n4Sugiru, mnemonicText: 'new', updatedAt: '2026-09-05T00:00:00.000Z' },
      ],
      relatedItemBoosts: [
        { item: n5Sugiru, boost: 0.2, updatedAt: '2026-09-01T00:00:00.000Z' },
        { item: n4Sugiru, boost: 0.45, updatedAt: '2026-09-01T00:00:00.000Z' },
      ],
      weaknessStats: [
        weakness(n5Sugiru, 2, '2026-09-08T00:00:00.000Z', 'wrong_meaning'),
        weakness(n4Sugiru, 3, '2026-09-03T00:00:00.000Z', 'typo'),
      ],
      cognitiveLoadHistory: [],
      streaks: [],
      userSynonyms: [
        { item: n5Sugiru, answerType: 'meaning', answerText: 'too much', createdAt: 'a' },
        { item: n4Sugiru, answerType: 'meaning', answerText: 'too much', createdAt: 'b' },
        { item: n4Sugiru, answerType: 'meaning', answerText: 'excess', createdAt: 'c' },
      ],
      dailyLessonLog: [],
      goalRingState: [],
      furiganaOverrides: [
        { item: n5Sugiru, displayMode: 'shown', updatedAt: '2026-09-09T00:00:00.000Z' },
        { item: n4Sugiru, displayMode: 'hidden', updatedAt: '2026-09-01T00:00:00.000Z' },
      ],
      cardSeen: [],
      passagePracticeResults: [],
      aiSessions: [
        {
          id: 's1',
          topicItem: n4Sugiru,
          topicItems: [n4Sugiru, n5Sugiru, kanji],
          summaryJson: JSON.stringify({ wordsMet: [{ surface: '碁', item: kanji }, { surface: 'x' }] }),
        },
      ],
      aiMessages: [],
    },
  };
}

describe('rewriteBackup', () => {
  const { bundle, counts } = rewriteBackup(fixture(), RENAMES);
  const data = bundle.data;

  it('renames a kanji and keeps an unchanged vocabulary item', () => {
    expect(data.itemStudyStatus).toContainEqual({
      item: { itemType: 'kanji', slug: 'go-game' },
      status: 'known',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(data.itemStudyStatus).toContainEqual({
      item: vocab,
      status: 'not_started',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('keeps one row for each item in each table after a merge', () => {
    expect(counts.itemStudyStatus).toEqual({ before: 4, after: 3 });
    expect(counts.srsStates).toEqual({ before: 3, after: 2 });
    expect(counts.userSynonyms).toEqual({ before: 3, after: 2 });
  });

  it('applies the merge rule of each table', () => {
    const sugiru = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => (row.item as { slug: string }).slug === 'sugiru');

    expect(sugiru(data.itemStudyStatus)).toEqual([
      { item: n5Sugiru, status: 'known', updatedAt: '2026-09-02T00:00:00.000Z' },
    ]);
    // Same lastReviewedAt: the higher stability wins.
    expect(sugiru(data.srsStates).map((row) => row.stability)).toEqual([9]);
    expect(sugiru(data.personalMnemonics)).toEqual([
      { item: n5Sugiru, mnemonicText: 'new', updatedAt: '2026-09-05T00:00:00.000Z' },
    ]);
    expect(sugiru(data.relatedItemBoosts).map((row) => row.boost)).toEqual([0.45]);
    expect(sugiru(data.weaknessStats)).toEqual([
      {
        ...weakness(n5Sugiru, 5, '2026-09-08T00:00:00.000Z', 'wrong_meaning'),
        incorrectCount: 2,
      },
    ]);
    expect(sugiru(data.userSynonyms).map((row) => row.answerText)).toEqual(['too much', 'excess']);
    expect(sugiru(data.furiganaOverrides)).toEqual([
      { item: n5Sugiru, displayMode: 'shown', updatedAt: '2026-09-09T00:00:00.000Z' },
    ]);
  });

  it('keeps the later lastReviewedAt over a higher stability', () => {
    const result = rewriteBackup(
      {
        ...fixture(),
        data: {
          ...fixture().data,
          srsStates: [srs(n5Sugiru, '2026-09-11T00:00:00.000Z', 1), srs(n4Sugiru, null, 50)],
        },
      },
      RENAMES,
    );
    expect(result.bundle.data.srsStates).toEqual([srs(n5Sugiru, '2026-09-11T00:00:00.000Z', 1)]);
  });

  it('rewrites AI session refs and summary words', () => {
    const session = data.aiSessions[0] as {
      topicItem: unknown;
      topicItems: unknown[];
      summaryJson: string;
    };
    expect(session.topicItem).toEqual(n5Sugiru);
    expect(session.topicItems).toEqual([n5Sugiru, { itemType: 'kanji', slug: 'go-game' }]);
    expect(JSON.parse(session.summaryJson).wordsMet).toEqual([
      { surface: '碁', item: { itemType: 'kanji', slug: 'go-game' } },
      { surface: 'x' },
    ]);
  });

  it('does not change the input bundle', () => {
    const input = fixture();
    rewriteBackup(input, RENAMES);
    expect(input).toEqual(fixture());
  });

  it('finds refs that the curriculum does not have', () => {
    const known = new Set(['kanji:go-game', 'grammar:sugiru']);
    expect(findUnmatchedRefs(bundle, known)).toEqual(['vocabulary:ginkou']);
  });
});

describe('rewriteBackupFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-backup-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeFixtures(itemRows: [string, string][]) {
    const input = path.join(dir, 'kizamu-backup-x.json.gz');
    fs.writeFileSync(input, zlib.gzipSync(JSON.stringify(fixture())));
    const renamesPath = path.join(dir, 'slug-renames.json');
    fs.writeFileSync(renamesPath, JSON.stringify(RENAMES));
    const dbPath = path.join(dir, 'curriculum.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, item_type TEXT, slug TEXT)');
    const insert = db.prepare('INSERT INTO items (item_type, slug) VALUES (?, ?)');
    for (const [itemType, slug] of itemRows) insert.run(itemType, slug);
    db.close();
    return { input, renamesPath, dbPath };
  }

  it('writes <name>-migrated.json.gz next to the input and leaves the input as it was', () => {
    const { input, renamesPath, dbPath } = writeFixtures([
      ['kanji', 'go-game'],
      ['grammar', 'sugiru'],
      ['vocabulary', 'ginkou'],
    ]);
    const before = fs.readFileSync(input);

    const report = rewriteBackupFile({ inputPath: input, renamesPath, dbPath, dryRun: false });

    expect(report.unmatched).toEqual([]);
    expect(report.outputPath).toBe(path.join(dir, 'kizamu-backup-x-migrated.json.gz'));
    expect(fs.readFileSync(input)).toEqual(before);
    const written = JSON.parse(zlib.gunzipSync(fs.readFileSync(report.outputPath!)).toString('utf8'));
    expect(written.data.itemStudyStatus).toHaveLength(3);
  });

  it('writes nothing on a dry run', () => {
    const { input, renamesPath, dbPath } = writeFixtures([
      ['kanji', 'go-game'],
      ['grammar', 'sugiru'],
      ['vocabulary', 'ginkou'],
    ]);
    const report = rewriteBackupFile({ inputPath: input, renamesPath, dbPath, dryRun: true });
    expect(report.outputPath).toBeNull();
    expect(fs.readdirSync(dir).filter((name) => name.includes('migrated'))).toEqual([]);
  });

  it('writes nothing when a ref is not in the curriculum', () => {
    const { input, renamesPath, dbPath } = writeFixtures([['kanji', 'go-game']]);
    const report = rewriteBackupFile({ inputPath: input, renamesPath, dbPath, dryRun: false });
    expect(report.unmatched).toEqual(['grammar:sugiru', 'vocabulary:ginkou']);
    expect(report.outputPath).toBeNull();
  });

  it('names the output after the input', () => {
    expect(migratedPath('/a/kizamu-backup-1.json.gz')).toBe('/a/kizamu-backup-1-migrated.json.gz');
  });
});
