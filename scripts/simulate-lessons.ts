/**
 * Lesson-mix acceptance simulator (spec docs/superpowers/specs/2026-10-24-lesson-mix-design.md §10).
 *
 * Drives the real `buildLessonPlan` over the seed curriculum.db for 30 days at
 * light / relaxed / immersive, with all answers correct and with 20% wrong,
 * prints a per-day R/K/V/G table per run, and exits 1 if a pass line fails.
 *
 * Run from the repo root:
 *   npx tsx --tsconfig mobile/tsconfig.json scripts/simulate-lessons.ts
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  grammarDailyCap,
  grammarPileLimit,
  summarizeGrammarStarts,
} from '@/core/lesson/grammarPace';
import { createInitialSrsState } from '@/core/srs/fsrsScheduler';
import { JLPT_LEVELS } from '@/data/curriculum/curriculum.types';
import { listItemsByLevelAndType, type ItemType } from '@/data/curriculum/itemRepository';
import { buildLessonPlan } from '@/data/lessonPlan';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import {
  countStartedOrKnownItems,
  listGrammarStarts,
} from '@/data/user/lessonLearnerRepository';
import {
  setLessonItemCount,
  setSessionIntensity,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { upsertSrsState } from '@/data/user/srsStateRepository';
import { createSeededRng } from '@/utils/seededRng';

const CURRICULUM_PATH = path.resolve(__dirname, '../mobile/assets/curriculum-seed/curriculum.db');
const DAYS = 30;
const GURU_AFTER_DAYS = 2;
const FAR_DUE = '2099-01-01T00:00:00.000Z';
const TYPES = ['radical', 'kanji', 'vocabulary', 'grammar'] as const;

type Preset = { name: 'light' | 'relaxed' | 'immersive'; daily: number; perLesson: number };
const PRESETS: Preset[] = [
  { name: 'light', daily: 8, perLesson: 5 },
  { name: 'relaxed', daily: 15, perLesson: 5 },
  { name: 'immersive', daily: 40, perLesson: 10 },
];

/** The sync subset of expo-sqlite the data layer calls, over better-sqlite3. */
class BetterSqliteAdapter {
  constructor(private readonly db: Database.Database) {}

  private static params(params: unknown[]): unknown[] {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return flat.map((value) =>
      value === undefined ? null : typeof value === 'boolean' ? Number(value) : value,
    );
  }

  execSync(source: string): void {
    this.db.exec(source);
  }

  runSync(source: string, ...params: unknown[]) {
    const result = this.db.prepare(source).run(...BetterSqliteAdapter.params(params));
    return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowid) };
  }

  getAllSync<T>(source: string, ...params: unknown[]): T[] {
    return this.db.prepare(source).all(...BetterSqliteAdapter.params(params)) as T[];
  }

  getFirstSync<T>(source: string, ...params: unknown[]): T | null {
    return (this.db.prepare(source).get(...BetterSqliteAdapter.params(params)) as T) ?? null;
  }

  withTransactionSync(task: () => void): void {
    this.db.transaction(task)();
  }
}

const asExpo = (db: Database.Database) => new BetterSqliteAdapter(db) as unknown as SQLiteDatabase;

type Counts = Record<(typeof TYPES)[number], number>;
const zero = (): Counts => ({ radical: 0, kanji: 0, vocabulary: 0, grammar: 0 });

type RunResult = {
  preset: Preset;
  wrong: boolean;
  days: Counts[];
  lessons: { day: number; key: string }[];
  brakeDays: number;
};

function simulate(curriculumDb: SQLiteDatabase, preset: Preset, wrong: boolean): RunResult {
  const userDb = asExpo(new Database(':memory:'));
  const migrated = runMigrations(userDb, migrations);
  if (!migrated.ok) throw new Error(`migrations failed: ${migrated.error.message}`);
  setSessionIntensity(userDb, preset.name);
  setLessonItemCount(userDb, preset.perLesson);
  setStartingJlptLevel(userDb, 'N5');

  const idsOf = (type: ItemType) =>
    JLPT_LEVELS.flatMap((level) =>
      listItemsByLevelAndType(curriculumDb, level, type).map((item) => item.id),
    );
  const grammarIds = idsOf('grammar');
  const vocabIds = idsOf('vocabulary');

  const rng = createSeededRng(`${preset.name}:${wrong ? 'wrong' : 'correct'}`);
  /** Day index (0-based) on whose morning an item is at Guru. */
  const guruDay = new Map<string, number>();
  const result: RunResult = { preset, wrong, days: [], lessons: [], brakeDays: 0 };

  for (let day = 0; day < DAYS; day++) {
    const morning = new Date(2026, 10, 2 + day, 9, 0);

    // Review model: each Guru check that comes due today passes, or with
    // "20% wrong" fails with p = 0.2 and moves the item 2 days later.
    for (const [itemId, due] of guruDay) {
      if (due !== day) continue;
      if (wrong && rng() < 0.2) guruDay.set(itemId, day + GURU_AFTER_DAYS);
    }
    for (const [itemId, due] of guruDay) {
      userDb.runSync(
        'UPDATE srs_states SET srs_stage_label = ? WHERE item_id = ?',
        day >= due ? 'guru' : 'apprentice',
        Number(itemId),
      );
    }

    const pace = summarizeGrammarStarts(listGrammarStarts(userDb, grammarIds), morning);
    const grammarReady =
      countStartedOrKnownItems(userDb, vocabIds) >= 10 &&
      grammarIds.some((id) => !guruDay.has(id));
    if (grammarReady && pace.recentApprentice >= grammarPileLimit(preset.daily)) {
      result.brakeDays++;
    }

    const counts = zero();
    for (let lesson = 0; lesson < 100; lesson++) {
      const now = new Date(morning.getTime() + lesson * 60_000);
      const plan = buildLessonPlan(curriculumDb, userDb, { now });
      if (plan.items.length === 0) break;

      const lessonCounts = zero();
      userDb.withTransactionSync(() => {
        for (const item of plan.items) {
          userDb.runSync(
            `INSERT INTO item_study_status (item_id, status, updated_at) VALUES (?, 'in_progress', ?)
             ON CONFLICT(item_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
            Number(item.id),
            now.toISOString(),
          );
          const upserted = upsertSrsState(userDb, {
            ...createInitialSrsState(item.id, now),
            dueDate: FAR_DUE,
            srsStageLabel: 'apprentice',
          });
          if (!upserted.ok) throw new Error(upserted.error.message);
          guruDay.set(item.id, day + GURU_AFTER_DAYS);
          lessonCounts[item.itemType]++;
          counts[item.itemType]++;
        }
        userDb.runSync(
          `INSERT INTO daily_lesson_log (date, items_started) VALUES (?, ?)
           ON CONFLICT(date) DO UPDATE SET items_started = items_started + excluded.items_started`,
          todayKey(now),
          plan.items.length,
        );
      });
      result.lessons.push({
        day: day + 1,
        key: TYPES.map((type) => lessonCounts[type]).join('/'),
      });
    }
    result.days.push(counts);
  }
  return result;
}

function share(days: Counts[], type: keyof Counts): number {
  const total = days.reduce((sum, d) => sum + TYPES.reduce((s, t) => s + d[t], 0), 0);
  return total === 0 ? 0 : days.reduce((sum, d) => sum + d[type], 0) / total;
}

function check(run: RunResult): string[] {
  const failures: string[] = [];
  const { days, preset } = run;
  const firstDay = (type: keyof Counts) => days.findIndex((d) => d[type] > 0) + 1 || Infinity;
  const cap = grammarDailyCap(preset.daily);

  days.forEach((d, i) => {
    if (d.grammar > cap) failures.push(`day ${i + 1}: ${d.grammar} grammar > cap ${cap}`);
  });

  if (run.wrong) {
    if (run.brakeDays > 3) failures.push(`grammar brake held ${run.brakeDays} of ${DAYS} days (> 3)`);
    return failures;
  }

  for (const i of [0, 1]) {
    const d = days[i];
    if (d.kanji + d.vocabulary + d.grammar > 0) failures.push(`day ${i + 1} is not radicals only`);
  }
  if (firstDay('kanji') > 3) failures.push(`first kanji on day ${firstDay('kanji')} (> 3)`);
  if (firstDay('vocabulary') > 4) failures.push(`first word on day ${firstDay('vocabulary')} (> 4)`);
  if (firstDay('grammar') > 7) failures.push(`first grammar on day ${firstDay('grammar')} (> 7)`);

  const later = run.lessons.filter((lesson) => lesson.day > 4);
  let pairs = 0;
  let differ = 0;
  for (let i = 1; i < later.length; i++) {
    pairs++;
    if (later[i].key !== later[i - 1].key) differ++;
  }
  if (pairs > 0 && differ / pairs < 0.8) {
    failures.push(`only ${differ}/${pairs} consecutive lessons differ after day 4 (< 80%)`);
  }

  const week1 = days.slice(0, 7);
  const week4 = days.slice(21, 28);
  if (!(share(week1, 'radical') > share(week4, 'radical'))) {
    failures.push('radical share did not fall from week 1 to week 4');
  }
  if (!(share(week1, 'vocabulary') < share(week4, 'vocabulary'))) {
    failures.push('vocabulary share did not rise from week 1 to week 4');
  }
  return failures;
}

function printTable(run: RunResult): void {
  const label = `${run.preset.name} (${run.preset.daily}/day, ${run.preset.perLesson}/lesson), ${
    run.wrong ? '20% wrong' : 'all correct'
  }`;
  console.log(`\n${label}`);
  console.log('Day |  R |  K |  V | G');
  run.days.forEach((d, i) => {
    const cell = (n: number) => String(n).padStart(2);
    console.log(
      `${String(i + 1).padStart(3)} | ${cell(d.radical)} | ${cell(d.kanji)} | ${cell(d.vocabulary)} | ${d.grammar}`,
    );
  });
  const sample = run.lessons.filter((lesson) => lesson.day >= 5 && lesson.day <= 9);
  console.log(`Lessons days 5–9 (R/K/V/G): ${sample.map((lesson) => lesson.key).join('  ')}`);
  if (run.wrong) console.log(`Grammar brake days: ${run.brakeDays}/${DAYS}`);
}

function main(): void {
  const curriculumDb = asExpo(new Database(CURRICULUM_PATH, { readonly: true, fileMustExist: true }));
  let failed = false;
  for (const wrong of [false, true]) {
    for (const preset of PRESETS) {
      const run = simulate(curriculumDb, preset, wrong);
      printTable(run);
      const failures = check(run);
      for (const failure of failures) console.log(`  FAIL: ${failure}`);
      if (failures.length === 0) console.log('  PASS');
      failed ||= failures.length > 0;
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
