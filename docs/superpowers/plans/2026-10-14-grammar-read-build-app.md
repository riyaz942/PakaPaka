# Grammar Read + Build Cards — App (Plan 3 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the grammar cloze / multiple-choice review with two cards per grammar point — Read (type the meaning of the highlighted grammar) and Build (type the whole sentence in Japanese) — graded worst-of-both into one FSRS write.

**Architecture:** Pure logic first (`core/grammar`: Build-answer matcher, sentence picker, link policy). Then data: user.db migration 021 (saved Build answers + last-review history, keyed by sentence text), backup support, and a curriculum read of the sentence pool that Plans 1–2 compiled. The queue expands every grammar item into a Read + Build pair the same way kanji pairs work; the session provider's pair slots are generalised from `meaning`/`reading` to any two prompt types. The linked-word sentence renderer is extracted from `ExampleSentencesSection` into `LinkedSentence` with a grammar-span option, and two new card components render on top of it. Last, the old cloze / MC / hint code is removed and the compiled curriculum stops shipping cloze variants.

**Tech Stack:** Expo / React Native + TypeScript, NativeWind, jest + @testing-library/react-native, the hand-written `mobile/__mocks__/expo-sqlite.ts` fake; Python 3.12 pipeline (`curriculum/_build/.venv`) and TS compile scripts for Task 12 only.

**Spec:** `docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` (§3, §5, §6; decisions D1–D12). **Previous plans (done):** `docs/superpowers/plans/2026-10-13-grammar-pool-pipeline.md`, `docs/superpowers/plans/2026-10-14-grammar-pool-content.md`. The compiled `curriculum.db` (v32) already has `example_sentences.grammar_start / grammar_end / register`, the `grammar_sentence_answers` table, and grammar meanings in `accepted_answers`.

## Global Constraints

- Fallible operations return `Result<T, AppError>` (`mobile/src/types/result.types.ts`). Do not throw across async boundaries.
- Never write to `curriculum.db` at runtime. user.db changes only through migration `021`.
- A grammar sentence is identified by **grammar item id + its plain Japanese text** (`sentenceKey`), never by `example_sentences.id` (compile ids change between curriculum versions; spec §5.1).
- Grammar grades are Again (1) or Good (3) only. No hints and no multiple choice on grammar cards (D5, D7).
- Semantic NativeWind tokens only (`text-content-grammar-deep`, `bg-content-grammar-soft`, `text-primary`, …). No raw hex. Every linked word and the locked grammar span has an accessibility label.
- Exact copy: mode labels `Grammar · Read` and `Grammar · Build`; Read prompt `What does the highlighted grammar mean?`; Build button `My answer is correct too`; other-grammar nudge `That works, but it uses a different grammar point. Try again.`
- Path alias `@/*` → `mobile/src/*`.
- Commands (from `mobile/`): `npx jest <path>`, `npm run typecheck`, `npm run lint`. Repo root: `npx jest --config jest.config.cjs scripts/`. Python: `cd curriculum/_build && .venv/bin/python -m unittest`.
- The jest SQLite fake (`mobile/__mocks__/expo-sqlite.ts`) only answers SQL it has a branch for; a new table needs new branches (Tasks 3 and 5 add them).

## Review Focus

1. **Restoring a backup made before this plan** (no `grammarAnswers` / `grammarSentenceHistory` keys in the file) — must restore normally with both tables empty, not fail as "damaged". Test in Task 4.
2. **Build answers that differ only in script, spacing or punctuation** (`コーヒー` typed as `こーひー`, `寒い から コート…`, missing `。`) — must grade correct; a different kanji word (`僕` for `私`) must not. Test in Task 1.
3. **"My answer is correct too", then the failed card comes back in the same session** — the retry must accept the saved answer, because the Read and Build cards and the retry share one payload object. Test in Task 6.
4. **Read card: a word span that contains the grammar** (`食べた` where `た` is the grammar) — before answering, tapping `食べ` must not open the detail page with the `ta` inflection (that names the answer). Test in Task 8.
5. **Queue limit cutting a grammar pair** — the Build card is pulled in with its Read card (existing `applyQueueLimit`), never dropped alone. Test in Task 6.

---

## File structure

| File | Responsibility |
|------|----------------|
| `mobile/src/core/grammar/buildEvaluator.ts` (new) | Normalise and match a typed Build answer against furigana answers |
| `mobile/src/core/grammar/sentencePicker.ts` (new) | Pick two distinct sentences, excluding the last review's |
| `mobile/src/core/grammar/linkPolicy.ts` (new) | D12 link timing |
| `mobile/src/data/migrations/021_grammar_answers.ts` (new) | `user_grammar_answers`, `grammar_sentence_history` |
| `mobile/src/data/user/grammarAnswerRepository.ts` (new) | Read/write both tables |
| `mobile/src/core/backup/*`, `mobile/src/data/user/exportBackup.ts`, `restoreBackup.ts` | Back up both tables |
| `mobile/src/data/curriculum/grammarPoolRepository.ts` (new) | Read the compiled sentence pool + vocabulary forms |
| `mobile/src/data/grammarReviewCards.ts` (new) | Assemble the Read/Build payloads for one grammar item |
| `mobile/src/core/srs/srs.types.ts`, `queueBuilder.ts` | Payload types; grammar pair expansion |
| `mobile/src/providers/ReviewSessionProvider.tsx` | Generic pair slots; history write; save Build answer |
| `mobile/src/data/hooks/useReviewQueue.ts` | Attach payloads instead of cloze/MC |
| `mobile/src/core/content/passageBodyParts.ts` | Optional grammar span in sentence parts |
| `mobile/src/components/common/LinkedSentence.tsx` (new) | Linked-word sentence renderer (extracted) |
| `mobile/src/components/review/GrammarReadCard.tsx`, `GrammarBuildCard.tsx` (new) | The two cards |
| `mobile/src/core/answer/*`, `components/review/ReviewCard.tsx`, `IncorrectReveal.tsx`, `app/review/index.tsx` | Wiring |
| `mobile/__mocks__/expo-sqlite.ts` | Branches for the new tables |
| `scripts/*`, `curriculum/schema/curriculum.schema.json`, `curriculum/_build/generate.py` | Stop shipping cloze variants (Task 12) |

---

### Task 1: Build-answer evaluator

**Files:**
- Create: `mobile/src/core/grammar/buildEvaluator.ts`
- Test: `mobile/src/core/grammar/buildEvaluator.test.ts`

**Interfaces:**
- Consumes: `parseFurigana(annotated: string): FuriganaSegment[]` from `@/core/furigana/parseFurigana`.
- Produces:
  - `type GrammarBuildResult = 'correct' | 'other_grammar' | 'incorrect'`
  - `type GrammarBuildAnswers = { answers: readonly string[]; otherGrammarAnswers: readonly string[]; userAnswers: readonly string[] }`
  - `normalizeBuildText(text: string): string`
  - `matchesFuriganaAnswer(normalizedInput: string, furigana: string): boolean`
  - `evaluateGrammarBuild(input: string, key: GrammarBuildAnswers): GrammarBuildResult`

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/core/grammar/buildEvaluator.test.ts
import { evaluateGrammarBuild, matchesFuriganaAnswer, normalizeBuildText } from './buildEvaluator';

const MAIN = '寒[さむ]いから、コートを着[き]ます。';
const key = {
  answers: [MAIN, '寒[さむ]いですから、コートを着[き]ます。'],
  otherGrammarAnswers: ['寒[さむ]いので、コートを着[き]ます。'],
  userAnswers: [] as string[],
};

describe('normalizeBuildText', () => {
  it('folds katakana to hiragana and keeps the long-vowel mark', () => {
    expect(normalizeBuildText('コーヒー')).toBe('こーひー');
  });

  it('drops whitespace and sentence punctuation, full-width space included', () => {
    expect(normalizeBuildText(' 寒い、 から。！？!?,.　')).toBe('寒いから');
  });
});

describe('evaluateGrammarBuild', () => {
  it.each([
    ['all kana', 'さむいから、こーとをきます。'],
    ['kanji as written', '寒いから、コートを着ます。'],
    ['kanji and kana mixed per word', '寒いからこーとをきます'],
    ['katakana typed for hiragana', 'サムイカラコートヲキマス'],
    ['no punctuation, extra spaces', '寒い から コートを 着ます'],
    ['a valid alternate', '寒いですから、コートを着ます。'],
  ])('%s → correct', (_label, input) => {
    expect(evaluateGrammarBuild(input, key)).toBe('correct');
  });

  it('another kanji word is incorrect', () => {
    expect(evaluateGrammarBuild('暑いから、コートを着ます。', key)).toBe('incorrect');
  });

  it('a dropped word is incorrect', () => {
    expect(evaluateGrammarBuild('寒いから着ます', key)).toBe('incorrect');
  });

  it('a same-family grammar answer is other_grammar', () => {
    expect(evaluateGrammarBuild('さむいので、こーとをきます', key)).toBe('other_grammar');
  });

  it('a saved user answer matches by normalised text, kanji included', () => {
    const withUser = { ...key, userAnswers: [normalizeBuildText('寒いからコート着ます')] };
    expect(evaluateGrammarBuild('寒いから、コート着ます。', withUser)).toBe('correct');
  });

  it('empty or punctuation-only input is incorrect', () => {
    expect(evaluateGrammarBuild('  。', key)).toBe('incorrect');
  });
});

describe('matchesFuriganaAnswer', () => {
  const SENTENCE = '私[わたし]は学[がく]生[せい]です。';

  it('accepts the reading of each annotated run', () => {
    expect(matchesFuriganaAnswer(normalizeBuildText('わたしはがくせいです'), SENTENCE)).toBe(true);
  });

  it('accepts kanji and kana mixed inside one word (学せい)', () => {
    expect(matchesFuriganaAnswer(normalizeBuildText('私は学せいです'), SENTENCE)).toBe(true);
  });

  it('rejects a different word in the same slot (僕 for 私)', () => {
    expect(matchesFuriganaAnswer(normalizeBuildText('僕は学生です'), SENTENCE)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `mobile/`): `npx jest src/core/grammar/buildEvaluator.test.ts`
Expected: FAIL — `Cannot find module './buildEvaluator'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// mobile/src/core/grammar/buildEvaluator.ts
import { parseFurigana } from '@/core/furigana/parseFurigana';

export type GrammarBuildResult = 'correct' | 'other_grammar' | 'incorrect';

/** What a Build card grades against (spec §5.2). */
export type GrammarBuildAnswers = {
  /** Furigana notation: the sentence itself, then its `valid` alternates. */
  answers: readonly string[];
  /** Furigana notation: same meaning with a same-family grammar point (D6). */
  otherGrammarAnswers: readonly string[];
  /** The learner's saved answers, already normalised. */
  userAnswers: readonly string[];
};

const IGNORED_RE = /[\s、。！？!?,.　]/g;

/** Katakana → hiragana by code point. ー is left alone (wanakana would turn it into a vowel). */
function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** Katakana folded to hiragana; whitespace and sentence punctuation removed. */
export function normalizeBuildText(text: string): string {
  return toHiragana(text).replace(IGNORED_RE, '');
}

/**
 * Whether `normalizedInput` spells `furigana`, each annotated run written as
 * its kanji or as its reading. Runs match independently, so kanji and kana
 * can mix (寒いからこーとをきます). A different word (僕 for 私) does not match.
 */
export function matchesFuriganaAnswer(normalizedInput: string, furigana: string): boolean {
  const slots = parseFurigana(furigana)
    .map((segment) => {
      const forms = [normalizeBuildText(segment.text)];
      if (segment.reading) forms.push(normalizeBuildText(segment.reading));
      return forms.filter((form) => form.length > 0);
    })
    .filter((forms) => forms.length > 0);

  const failed = new Set<string>();
  const walk = (slot: number, offset: number): boolean => {
    if (slot === slots.length) return offset === normalizedInput.length;
    const memo = `${slot}:${offset}`;
    if (failed.has(memo)) return false;
    for (const form of slots[slot]) {
      if (normalizedInput.startsWith(form, offset) && walk(slot + 1, offset + form.length)) {
        return true;
      }
    }
    failed.add(memo);
    return false;
  };
  return walk(0, 0);
}

/** No typo tolerance: a sentence is right, a same-family swap, or wrong (spec §3.2). */
export function evaluateGrammarBuild(input: string, key: GrammarBuildAnswers): GrammarBuildResult {
  const normalized = normalizeBuildText(input);
  if (!normalized) return 'incorrect';
  if (key.userAnswers.some((answer) => normalizeBuildText(answer) === normalized)) return 'correct';
  if (key.answers.some((answer) => matchesFuriganaAnswer(normalized, answer))) return 'correct';
  if (key.otherGrammarAnswers.some((answer) => matchesFuriganaAnswer(normalized, answer))) {
    return 'other_grammar';
  }
  return 'incorrect';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/core/grammar/buildEvaluator.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/grammar/buildEvaluator.ts mobile/src/core/grammar/buildEvaluator.test.ts
git commit -m "Grammar Build card: answer evaluator with per-word kanji/kana matching"
```

---

### Task 2: Sentence picker and link policy

**Files:**
- Create: `mobile/src/core/grammar/sentencePicker.ts`, `mobile/src/core/grammar/linkPolicy.ts`
- Test: `mobile/src/core/grammar/sentencePicker.test.ts`, `mobile/src/core/grammar/linkPolicy.test.ts`

**Interfaces:**
- Produces:
  - `pickGrammarSentences<T extends { japanese: string }>(pool: readonly T[], lastKeys: readonly string[], rng?: () => number): { read: T; build: T }` — throws `Error` when fewer than 2 candidates remain (spec §5.2: no fallback; the queue build surfaces it).
  - `type GrammarCardKind = 'read' | 'build'`
  - `isWordLinked(args: { card: GrammarCardKind; answered: boolean; wordStarted: boolean }): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// mobile/src/core/grammar/sentencePicker.test.ts
import { pickGrammarSentences } from './sentencePicker';

const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((japanese) => ({ japanese }));

describe('pickGrammarSentences', () => {
  it('returns two different sentences', () => {
    for (let i = 0; i < 20; i += 1) {
      const { read, build } = pickGrammarSentences(pool, []);
      expect(read.japanese).not.toBe(build.japanese);
    }
  });

  it('never picks a sentence from the last review', () => {
    expect(pickGrammarSentences(pool, ['a', 'b'], () => 0)).toEqual({
      read: { japanese: 'c' },
      build: { japanese: 'd' },
    });
    expect(pickGrammarSentences(pool, ['a', 'b'], () => 0.999)).toEqual({
      read: { japanese: 'h' },
      build: { japanese: 'g' },
    });
  });

  it('fails loudly when fewer than two sentences remain', () => {
    expect(() => pickGrammarSentences(pool.slice(0, 3), ['a', 'b'])).toThrow(/at least 2/);
  });
});
```

```ts
// mobile/src/core/grammar/linkPolicy.test.ts
import { isWordLinked } from './linkPolicy';

describe('isWordLinked (D12)', () => {
  it.each([
    ['read', false, true, true],
    ['read', false, false, true],
    ['read', true, true, true],
    ['build', false, true, false],
    ['build', false, false, true],
    ['build', true, true, true],
    ['build', true, false, true],
  ] as const)('%s card, answered=%s, started=%s → %s', (card, answered, wordStarted, expected) => {
    expect(isWordLinked({ card, answered, wordStarted })).toBe(expected);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/core/grammar/sentencePicker.test.ts src/core/grammar/linkPolicy.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// mobile/src/core/grammar/sentencePicker.ts
/**
 * Two distinct pool sentences for one grammar review — Read and Build — that
 * were not used in the previous review (D9). A sentence is keyed by its plain
 * Japanese (spec §5.1).
 *
 * Validator rule 4 guarantees ≥ 8 sentences per point, so with at most 2
 * excluded ≥ 6 remain. Fewer than 2 is a content error: it throws, and the
 * queue build reports it rather than reviewing with a repeated sentence.
 */
export function pickGrammarSentences<T extends { japanese: string }>(
  pool: readonly T[],
  lastKeys: readonly string[],
  rng: () => number = Math.random,
): { read: T; build: T } {
  const last = new Set(lastKeys);
  const candidates = pool.filter((sentence) => !last.has(sentence.japanese));
  if (candidates.length < 2) {
    throw new Error(
      `Grammar pool has ${candidates.length} unused sentence(s); need at least 2`,
    );
  }
  const readIndex = Math.floor(rng() * candidates.length);
  const read = candidates[readIndex];
  const rest = candidates.filter((_, index) => index !== readIndex);
  const build = rest[Math.floor(rng() * rest.length)];
  return { read, build };
}
```

```ts
// mobile/src/core/grammar/linkPolicy.ts
export type GrammarCardKind = 'read' | 'build';

/**
 * D12 — when a vocabulary word on a grammar card opens its detail page.
 * Read: always (the grammar span has its own lock). Build: a word the learner
 * has started only after answering (before, its detail would hand over the
 * sentence); a word not started yet links at once, with no grade penalty.
 */
export function isWordLinked({
  card,
  answered,
  wordStarted,
}: {
  card: GrammarCardKind;
  answered: boolean;
  wordStarted: boolean;
}): boolean {
  if (card === 'read') return true;
  return answered || !wordStarted;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/core/grammar/sentencePicker.test.ts src/core/grammar/linkPolicy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/grammar/sentencePicker.ts mobile/src/core/grammar/sentencePicker.test.ts mobile/src/core/grammar/linkPolicy.ts mobile/src/core/grammar/linkPolicy.test.ts
git commit -m "Grammar cards: sentence picker and word-link policy"
```

---

### Task 3: user.db migration 021 and grammar answer repository

**Files:**
- Create: `mobile/src/data/migrations/021_grammar_answers.ts`, `mobile/src/data/user/grammarAnswerRepository.ts`
- Modify: `mobile/src/data/migrations/index.ts` (register after `migration020LessonOptIns`), `mobile/__mocks__/expo-sqlite.ts`
- Test: `mobile/src/data/migrations/021_grammar_answers.test.ts`, `mobile/src/data/user/grammarAnswerRepository.test.ts`

**Interfaces:**
- Produces:
  - `migration021GrammarAnswers: Migration` (version 21, name `021_grammar_answers`)
  - `listGrammarAnswers(userDb: SQLiteDatabase, itemId: string): Map<string, string[]>` — sentenceKey → saved answers
  - `addGrammarAnswer(userDb, itemId: string, sentenceKey: string, answerText: string): Result<void, AppError>`
  - `getGrammarSentenceHistory(userDb, itemId: string): string[]`
  - `setGrammarSentenceHistory(userDb, itemId: string, sentenceKeys: string[]): Result<void, AppError>`

- [ ] **Step 1: Write the failing tests**

```ts
// mobile/src/data/migrations/021_grammar_answers.test.ts
import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migrations } from '@/data/migrations';
import { migration021GrammarAnswers } from '@/data/migrations/021_grammar_answers';

describe('021_grammar_answers', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('claims version 21 and is registered in version order', () => {
    expect(migration021GrammarAnswers.version).toBe(21);
    expect(migration021GrammarAnswers.name).toBe('021_grammar_answers');
    expect(migrations[20]).toBe(migration021GrammarAnswers);
  });

  it('creates both tables and is idempotent on re-run', async () => {
    const db = await openDatabaseAsync('user.db');

    migration021GrammarAnswers.up(db);
    for (const table of ['user_grammar_answers', 'grammar_sentence_history']) {
      expect(
        db.getAllSync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table),
      ).toHaveLength(1);
    }

    db.runSync(
      `INSERT INTO user_grammar_answers (item_id, sentence_key, answer_text, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id, sentence_key, answer_text) DO NOTHING`,
      7,
      '寒いから、コートを着ます。',
      'さむいからこーとをきます',
      'then',
    );
    migration021GrammarAnswers.up(db);
    expect(db.getAllSync('SELECT * FROM user_grammar_answers')).toHaveLength(1);
  });
});
```

```ts
// mobile/src/data/user/grammarAnswerRepository.test.ts
import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration021GrammarAnswers } from '@/data/migrations/021_grammar_answers';
import {
  addGrammarAnswer,
  getGrammarSentenceHistory,
  listGrammarAnswers,
  setGrammarSentenceHistory,
} from '@/data/user/grammarAnswerRepository';

async function userDb() {
  const db = await openDatabaseAsync('user.db');
  migration021GrammarAnswers.up(db);
  return db;
}

describe('grammarAnswerRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('groups saved answers by sentence and ignores a duplicate', async () => {
    const db = await userDb();
    expect(addGrammarAnswer(db, '7', 'S1', 'a1').ok).toBe(true);
    expect(addGrammarAnswer(db, '7', 'S1', 'a1').ok).toBe(true);
    expect(addGrammarAnswer(db, '7', 'S2', 'a2').ok).toBe(true);
    expect(addGrammarAnswer(db, '8', 'S1', 'other item').ok).toBe(true);

    const answers = listGrammarAnswers(db, '7');
    expect(answers.get('S1')).toEqual(['a1']);
    expect(answers.get('S2')).toEqual(['a2']);
  });

  it('returns [] before any review and the last saved keys after', async () => {
    const db = await userDb();
    expect(getGrammarSentenceHistory(db, '7')).toEqual([]);

    expect(setGrammarSentenceHistory(db, '7', ['S1', 'S2']).ok).toBe(true);
    expect(setGrammarSentenceHistory(db, '7', ['S3', 'S4']).ok).toBe(true);

    expect(getGrammarSentenceHistory(db, '7')).toEqual(['S3', 'S4']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/data/migrations/021_grammar_answers.test.ts src/data/user/grammarAnswerRepository.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the migration and register it**

```ts
// mobile/src/data/migrations/021_grammar_answers.ts
import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Grammar Read + Build cards (spec §5.1). A sentence is keyed by its plain
 * Japanese, not by `example_sentences.id`: compile assigns those ids in insert
 * order, so they move whenever a curriculum update adds or removes a sentence.
 *
 * - `user_grammar_answers`: Build answers the learner marked "My answer is
 *   correct too", normalised (buildEvaluator.normalizeBuildText).
 * - `grammar_sentence_history`: the last review's two sentence keys (JSON), so
 *   the next review uses different ones (D9).
 */
export const migration021GrammarAnswers: Migration = {
  version: 21,
  name: '021_grammar_answers',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS user_grammar_answers (
        item_id INTEGER NOT NULL,
        sentence_key TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (item_id, sentence_key, answer_text)
      );
      CREATE TABLE IF NOT EXISTS grammar_sentence_history (
        item_id INTEGER PRIMARY KEY,
        sentence_keys TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
```

In `mobile/src/data/migrations/index.ts` add `import { migration021GrammarAnswers } from '@/data/migrations/021_grammar_answers';` after the 020 import, and `migration021GrammarAnswers,` after `migration020LessonOptIns,` in the `migrations` array.

- [ ] **Step 4: Write the repository**

```ts
// mobile/src/data/user/grammarAnswerRepository.ts
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError, Result } from '@/types/result.types';

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

/** Saved Build answers for one grammar item: sentence key → answers. */
export function listGrammarAnswers(userDb: SQLiteDatabase, itemId: string): Map<string, string[]> {
  const rows = userDb.getAllSync<{ sentence_key: string; answer_text: string }>(
    'SELECT sentence_key, answer_text FROM user_grammar_answers WHERE item_id = ?',
    parseItemId(itemId),
  );
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const answers = result.get(row.sentence_key) ?? [];
    answers.push(row.answer_text);
    result.set(row.sentence_key, answers);
  }
  return result;
}

export function addGrammarAnswer(
  userDb: SQLiteDatabase,
  itemId: string,
  sentenceKey: string,
  answerText: string,
): Result<void, AppError> {
  try {
    userDb.runSync(
      `INSERT INTO user_grammar_answers (item_id, sentence_key, answer_text, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id, sentence_key, answer_text) DO NOTHING`,
      parseItemId(itemId),
      sentenceKey,
      answerText,
      new Date().toISOString(),
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: { code: 'grammar_answer_write_failed', message: 'Failed to save grammar answer', cause },
    };
  }
}

/** The previous review's sentence keys, or [] before the first review. */
export function getGrammarSentenceHistory(userDb: SQLiteDatabase, itemId: string): string[] {
  const row = userDb.getFirstSync<{ sentence_keys: string }>(
    'SELECT sentence_keys FROM grammar_sentence_history WHERE item_id = ?',
    parseItemId(itemId),
  );
  if (!row) return [];
  const parsed: unknown = JSON.parse(row.sentence_keys);
  return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
}

export function setGrammarSentenceHistory(
  userDb: SQLiteDatabase,
  itemId: string,
  sentenceKeys: string[],
): Result<void, AppError> {
  try {
    userDb.runSync(
      `INSERT INTO grammar_sentence_history (item_id, sentence_keys, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET sentence_keys = excluded.sentence_keys, updated_at = excluded.updated_at`,
      parseItemId(itemId),
      JSON.stringify(sentenceKeys),
      new Date().toISOString(),
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: { code: 'grammar_history_write_failed', message: 'Failed to save grammar history', cause },
    };
  }
}
```

- [ ] **Step 5: Teach the SQLite fake the two tables**

In `mobile/__mocks__/expo-sqlite.ts`, inside `applySql`, next to the `INSERT INTO lesson_opt_ins … ON CONFLICT` branch, add:

```ts
  if (/^INSERT INTO user_grammar_answers/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [itemId, sentenceKey, answerText, createdAt] = params;
    const rows = state.tables.get('user_grammar_answers') ?? [];
    // DO NOTHING on conflict: one row per (item, sentence, answer).
    if (
      !rows.some(
        (row) =>
          row.item_id === itemId && row.sentence_key === sentenceKey && row.answer_text === answerText,
      )
    ) {
      rows.push({ item_id: itemId, sentence_key: sentenceKey, answer_text: answerText, created_at: createdAt });
    }
    state.tables.set('user_grammar_answers', rows);
    return;
  }

  if (/^INSERT INTO grammar_sentence_history/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [itemId, sentenceKeys, updatedAt] = params;
    const rows = (state.tables.get('grammar_sentence_history') ?? []).filter(
      (row) => row.item_id !== itemId,
    );
    rows.push({ item_id: itemId, sentence_keys: sentenceKeys, updated_at: updatedAt });
    state.tables.set('grammar_sentence_history', rows);
    return;
  }
```

Inside `queryRows`, next to the `FROM lesson_opt_ins` branch, add:

```ts
  if (/FROM user_grammar_answers/i.test(trimmed)) {
    let rows = [...(state.tables.get('user_grammar_answers') ?? [])];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.item_id === params[0]);
    }
    return rows;
  }

  if (/FROM grammar_sentence_history/i.test(trimmed)) {
    let rows = [...(state.tables.get('grammar_sentence_history') ?? [])];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.item_id === params[0]);
    }
    return rows;
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/data/migrations src/data/user/grammarAnswerRepository.test.ts`
Expected: PASS, including the existing migration tests.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/data/migrations/021_grammar_answers.ts mobile/src/data/migrations/021_grammar_answers.test.ts mobile/src/data/migrations/index.ts mobile/src/data/user/grammarAnswerRepository.ts mobile/src/data/user/grammarAnswerRepository.test.ts mobile/__mocks__/expo-sqlite.ts
git commit -m "user.db 021: saved grammar Build answers and sentence history"
```

---

### Task 4: Back up the two new tables

**Files:**
- Modify: `mobile/src/core/backup/backup.types.ts`, `backupSerializer.ts`, `backupValidator.ts`; `mobile/src/data/user/exportBackup.ts`, `restoreBackup.ts`
- Test: `mobile/src/core/backup/backupSerializer.test.ts`, `mobile/src/data/user/exportBackup.test.ts`, `mobile/src/data/user/restoreBackup.test.ts`

**Interfaces:**
- Consumes: tables from Task 3.
- Produces: `BackupData.grammarAnswers: GrammarAnswerEntry[]`, `BackupData.grammarSentenceHistory: GrammarSentenceHistoryEntry[]`.

- [ ] **Step 1: Write the failing tests**

Append to `mobile/src/core/backup/backupSerializer.test.ts`:

```ts
describe('parseBackupBundle — files from before 021', () => {
  it('reads a file with no grammar answer tables as empty tables', () => {
    const data = Object.fromEntries(BACKUP_DATA_KEYS.map((key) => [key, []])) as unknown as BackupData;
    const json = JSON.parse(
      serializeBackupBundle(
        buildBackupBundle(
          { schemaVersion: 20, curriculumVersion: '31', exportedAt: '2026-10-01T00:00:00.000Z', includesConversations: false },
          data,
        ),
      ),
    );
    delete json.data.grammarAnswers;
    delete json.data.grammarSentenceHistory;

    const parsed = parseBackupBundle(JSON.stringify(json));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.data.grammarAnswers).toEqual([]);
    expect(parsed.value.data.grammarSentenceHistory).toEqual([]);
  });
});
```

(Add `BACKUP_DATA_KEYS` and `type BackupData` to that file's imports from `@/core/backup/backup.types`, and `buildBackupBundle`, `parseBackupBundle`, `serializeBackupBundle` from `./backupSerializer` if not already imported.)

In `mobile/src/data/user/exportBackup.test.ts`, add two matchers to `tableMatchers` in `fakeUserDb`:

```ts
    [/FROM user_grammar_answers/i, tables.user_grammar_answers ?? []],
    [/FROM grammar_sentence_history/i, tables.grammar_sentence_history ?? []],
```

and append inside `describe('exportBackup', …)`:

```ts
  it('exports saved grammar answers and sentence history by item slug', async () => {
    const db = fakeUserDb({
      curriculumItems: [...CURRICULUM_ITEMS, { id: 3, item_type: 'grammar', slug: 'kara-because' }],
      tables: {
        user_grammar_answers: [
          { item_id: 3, sentence_key: '寒いから、コートを着ます。', answer_text: 'さむいからこーときます', created_at: '2026-10-13T00:00:00.000Z' },
        ],
        grammar_sentence_history: [
          { item_id: 3, sentence_keys: '["S1","S2"]', updated_at: '2026-10-13T00:00:00.000Z' },
        ],
      },
    });

    const result = await exportBackup(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = parseBackupBundle(await readWrittenJson(result.value.fileUri));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const item = { itemType: 'grammar', slug: 'kara-because' };
    expect(parsed.value.data.grammarAnswers).toEqual([
      { item, sentenceKey: '寒いから、コートを着ます。', answerText: 'さむいからこーときます', createdAt: '2026-10-13T00:00:00.000Z' },
    ]);
    expect(parsed.value.data.grammarSentenceHistory).toEqual([
      { item, sentenceKeys: ['S1', 'S2'], updatedAt: '2026-10-13T00:00:00.000Z' },
    ]);
  });
```

In `mobile/src/data/user/restoreBackup.test.ts`, add `grammarAnswers: [],` and `grammarSentenceHistory: [],` to `emptyData()`, and append inside the `describe('restoreBackup', …)` block (the one holding "writes furigana override item ids as TEXT"):

```ts
  it('restores grammar answers and sentence history on the current item id', async () => {
    const userDb = await createUserDb([...CURRICULUM_ITEMS, { id: 3, item_type: 'grammar', slug: 'kara-because' }]);
    const item = { itemType: 'grammar' as const, slug: 'kara-because' };
    writeBackupFixture(
      makeBundle({
        grammarAnswers: [{ item, sentenceKey: 'S1', answerText: 'A1', createdAt: '2026-10-13T00:00:00.000Z' }],
        grammarSentenceHistory: [{ item, sentenceKeys: ['S1', 'S2'], updatedAt: '2026-10-13T00:00:00.000Z' }],
      }),
    );

    const preview = await previewOrThrow(userDb);
    expect(restoreBackup(userDb, preview, 'settings').ok).toBe(true);

    expect(rows(userDb, 'user_grammar_answers')).toEqual([
      { item_id: 3, sentence_key: 'S1', answer_text: 'A1', created_at: '2026-10-13T00:00:00.000Z' },
    ]);
    expect(rows(userDb, 'grammar_sentence_history')).toEqual([
      { item_id: 3, sentence_keys: '["S1","S2"]', updated_at: '2026-10-13T00:00:00.000Z' },
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/core/backup src/data/user/exportBackup.test.ts src/data/user/restoreBackup.test.ts`
Expected: FAIL — new keys missing (TypeScript-free jest still runs; the assertions fail on `undefined`).

- [ ] **Step 3: Implement**

`backup.types.ts` — after `UserSynonymEntry` add:

```ts
/** A Build answer the learner marked correct (021). The sentence is keyed by its plain Japanese. */
export type GrammarAnswerEntry = {
  item: ItemRef;
  sentenceKey: string;
  answerText: string;
  createdAt: string;
};

/** The last review's two sentence keys for one grammar item (021). */
export type GrammarSentenceHistoryEntry = {
  item: ItemRef;
  sentenceKeys: string[];
  updatedAt: string;
};
```

and add `grammarAnswers: GrammarAnswerEntry[];` and `grammarSentenceHistory: GrammarSentenceHistoryEntry[];` to `BackupData` (after `passagePracticeResults`), and `'grammarAnswers', 'grammarSentenceHistory',` to `BACKUP_DATA_KEYS` (after `'passagePracticeResults'`).

`backupSerializer.ts` — above `parseBackupBundle`:

```ts
/**
 * Tables added after files were already being written: a file from an older
 * app has no key for them, which is "no rows", not a damaged file.
 */
const OPTIONAL_DATA_KEYS: ReadonlySet<keyof BackupData> = new Set([
  'grammarAnswers',
  'grammarSentenceHistory',
]);
```

and change the key loop to:

```ts
  for (const key of BACKUP_DATA_KEYS) {
    if (data[key] === undefined && OPTIONAL_DATA_KEYS.has(key)) {
      data[key] = [];
      continue;
    }
    if (!Array.isArray(data[key])) {
      return invalidShape(`Missing or invalid table: ${key}`);
    }
  }
```

(import `type BackupData` if the file does not already.)

`backupValidator.ts` — add `'grammarAnswers', 'grammarSentenceHistory',` to `ITEM_KEYED_KEYS`.

`exportBackup.ts` — after `readUserSynonyms` add:

```ts
function readGrammarAnswers(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['grammarAnswers'][number]> {
  const rows = userDb.getAllSync<{
    item_id: number | string;
    sentence_key: string;
    answer_text: string;
    created_at: string;
  }>('SELECT item_id, sentence_key, answer_text, created_at FROM user_grammar_answers');
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    sentenceKey: row.sentence_key,
    answerText: row.answer_text,
    createdAt: row.created_at,
  }));
}

function readGrammarSentenceHistory(
  userDb: SQLiteDatabase,
  idToRef: ReadonlyMap<number, ItemRef>,
): MappedRows<BackupData['grammarSentenceHistory'][number]> {
  const rows = userDb.getAllSync<{ item_id: number | string; sentence_keys: string; updated_at: string }>(
    'SELECT item_id, sentence_keys, updated_at FROM grammar_sentence_history',
  );
  return mapItemRows(rows, idToRef, (row) => row.item_id, (row, item) => ({
    item,
    sentenceKeys: JSON.parse(row.sentence_keys) as string[],
    updatedAt: row.updated_at,
  }));
}
```

In `readExportSnapshot`: `const grammarAnswers = readGrammarAnswers(userDb, idToRef);` and `const grammarSentenceHistory = readGrammarSentenceHistory(userDb, idToRef);` after `furiganaOverrides`; add `+ grammarAnswers.omitted + grammarSentenceHistory.omitted` to `omittedCount`; add `grammarAnswers: grammarAnswers.entries, grammarSentenceHistory: grammarSentenceHistory.entries,` to `data` after `passagePracticeResults`.

`restoreBackup.ts` — add `'user_grammar_answers', 'grammar_sentence_history',` to `RESTORE_TABLES` (after `'passage_practice_results'`); add `...data.grammarAnswers.map((row) => row.item), ...data.grammarSentenceHistory.map((row) => row.item),` to `collectItemRefs`; and in `writeRestore`, after the `passage_practice_results` insert:

```ts
  writtenRows += insertRows(
    userDb,
    'user_grammar_answers',
    ['item_id', 'sentence_key', 'answer_text', 'created_at'],
    resolvedRows(data.grammarAnswers, refToId).map(({ row, itemId }) => [
      itemId,
      row.sentenceKey,
      row.answerText,
      row.createdAt,
    ]),
  );

  writtenRows += insertRows(
    userDb,
    'grammar_sentence_history',
    ['item_id', 'sentence_keys', 'updated_at'],
    resolvedRows(data.grammarSentenceHistory, refToId).map(({ row, itemId }) => [
      itemId,
      JSON.stringify(row.sentenceKeys),
      row.updatedAt,
    ]),
  );
```

Fix every other `BackupData` literal the type checker now flags (test fixtures such as `backupValidator.test.ts` and `backupSerializer.test.ts`) by adding `grammarAnswers: [], grammarSentenceHistory: []`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/core/backup src/data/user/exportBackup.test.ts src/data/user/restoreBackup.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/backup mobile/src/data/user/exportBackup.ts mobile/src/data/user/exportBackup.test.ts mobile/src/data/user/restoreBackup.ts mobile/src/data/user/restoreBackup.test.ts
git commit -m "Backup: include grammar Build answers and sentence history"
```

---

### Task 5: Read the compiled sentence pool

**Files:**
- Create: `mobile/src/data/curriculum/grammarPoolRepository.ts`
- Modify: `mobile/__mocks__/expo-sqlite.ts`
- Test: `mobile/src/data/curriculum/grammarPoolRepository.test.ts`

**Interfaces:**
- Consumes: `getExampleSentences(db, itemId): ExampleSentence[]` (`@/data/curriculum/itemRepository`).
- Produces:
  - `type GrammarPoolSentence = ExampleSentence & { grammarStart: number; grammarEnd: number; register: 'polite' | 'plain'; validAnswers: string[]; otherGrammarAnswers: string[] }`
  - `getGrammarSentencePool(db: SQLiteDatabase, itemId: string): GrammarPoolSentence[]` — only rows with a grammar span; answers in `sort_order`.
  - `type ItemForm = { primaryForm: string; furigana: string | null }`
  - `getItemFormsByIds(db: SQLiteDatabase, itemIds: string[]): Map<string, ItemForm>`

- [ ] **Step 1: Add the fake's support**

In `mobile/__mocks__/expo-sqlite.ts` `queryRows`, next to the `FROM example_sentence_spans` branch (before `FROM example_sentences`), add:

```ts
  if (/FROM grammar_sentence_answers/i.test(trimmed)) {
    let rows = [...(state.tables.get('grammar_sentence_answers') ?? [])];
    if (/WHERE sentence_id IN/i.test(trimmed)) {
      rows = rows.filter((row) => params.includes(row.sentence_id as never));
    }
    rows.sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0));
    return rows;
  }
```

and after `__mockSetExampleSentences`:

```ts
export function __mockSetGrammarSentenceAnswers(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('grammar_sentence_answers', rows.map((row) => ({ ...row })));
}
```

- [ ] **Step 2: Write the failing test**

```ts
// mobile/src/data/curriculum/grammarPoolRepository.test.ts
import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetExampleSentences,
  __mockSetExampleSentenceSpans,
  __mockSetGrammarSentenceAnswers,
  __mockSetItems,
} from '../../../__mocks__/expo-sqlite';

import { getGrammarSentencePool, getItemFormsByIds } from '@/data/curriculum/grammarPoolRepository';

describe('grammarPoolRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('returns only pool rows, with span, register and both answer kinds', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetExampleSentences('curriculum.db.test', [
      {
        id: 1, item_id: 50, japanese: '寒いから、コートを着ます。',
        furigana: '寒[さむ]いから、コートを着[き]ます。', english: "Because it's cold, I'll wear a coat.",
        sort_order: 0, grammar_start: 2, grammar_end: 4, register: 'polite',
      },
      { id: 2, item_id: 50, japanese: '古い例。', furigana: null, english: 'Old.', sort_order: 1 },
    ]);
    __mockSetExampleSentenceSpans('curriculum.db.test', [
      { sentence_id: 1, item_id: 20, start_offset: 0, end_offset: 2, inflection: null, sort_order: 0 },
    ]);
    __mockSetGrammarSentenceAnswers('curriculum.db.test', [
      { id: 2, sentence_id: 1, answer_furigana: '寒[さむ]いので、コートを着[き]ます。', kind: 'other_grammar', sort_order: 1 },
      { id: 1, sentence_id: 1, answer_furigana: '寒[さむ]いですから、コートを着[き]ます。', kind: 'valid', sort_order: 0 },
    ]);

    const pool = getGrammarSentencePool(db, '50');

    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({
      id: '1',
      japanese: '寒いから、コートを着ます。',
      grammarStart: 2,
      grammarEnd: 4,
      register: 'polite',
      validAnswers: ['寒[さむ]いですから、コートを着[き]ます。'],
      otherGrammarAnswers: ['寒[さむ]いので、コートを着[き]ます。'],
    });
    expect(pool[0].spans).toEqual([
      { vocabularyItemId: '20', startOffset: 0, endOffset: 2, inflection: null },
    ]);
  });

  it('maps vocabulary ids to dictionary form and furigana', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', [
      { id: 20, item_type: 'vocabulary', jlpt_level: 'N5', slug: 'samui', primary_form: '寒い', furigana: '寒[さむ]い', meaning: 'cold', mnemonic_text: null, visual_mnemonic_url: null, sort_order: 1 },
      { id: 21, item_type: 'vocabulary', jlpt_level: 'N5', slug: 'kooto', primary_form: 'コート', furigana: null, meaning: 'coat', mnemonic_text: null, visual_mnemonic_url: null, sort_order: 2 },
    ]);

    const forms = getItemFormsByIds(db, ['20', '21']);

    expect(forms.get('20')).toEqual({ primaryForm: '寒い', furigana: '寒[さむ]い' });
    expect(forms.get('21')).toEqual({ primaryForm: 'コート', furigana: null });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/data/curriculum/grammarPoolRepository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the repository**

```ts
// mobile/src/data/curriculum/grammarPoolRepository.ts
import type { SQLiteDatabase } from 'expo-sqlite';

import { getExampleSentences, type ExampleSentence } from '@/data/curriculum/itemRepository';

/** A grammar example sentence that is also a review card (spec §4–§5.1). */
export type GrammarPoolSentence = ExampleSentence & {
  grammarStart: number;
  grammarEnd: number;
  register: 'polite' | 'plain';
  /** Furigana notation, `valid` alternates, in authored order. */
  validAnswers: string[];
  /** Furigana notation, `other_grammar` alternates, in authored order. */
  otherGrammarAnswers: string[];
};

/**
 * The review pool of one grammar item. Only sentences with a compiled grammar
 * span are pool sentences; the compile gate guarantees ≥ 8 of them per point.
 */
export function getGrammarSentencePool(db: SQLiteDatabase, itemId: string): GrammarPoolSentence[] {
  const sentences = getExampleSentences(db, itemId);
  if (sentences.length === 0) return [];

  const grammarRows = db.getAllSync<{
    id: number | string;
    grammar_start: number | null;
    grammar_end: number | null;
    register: 'polite' | 'plain' | null;
  }>(
    'SELECT id, grammar_start, grammar_end, register FROM example_sentences WHERE item_id = ? ORDER BY sort_order ASC',
    Number(itemId),
  );
  const grammarById = new Map(
    grammarRows
      .filter((row) => row.grammar_start != null && row.grammar_end != null && row.register != null)
      .map((row) => [String(row.id), row]),
  );
  const poolSentences = sentences.filter((sentence) => grammarById.has(sentence.id));
  if (poolSentences.length === 0) return [];

  const placeholders = poolSentences.map(() => '?').join(', ');
  const answerRows = db.getAllSync<{
    sentence_id: number | string;
    answer_furigana: string;
    kind: 'valid' | 'other_grammar';
  }>(
    `SELECT sentence_id, answer_furigana, kind FROM grammar_sentence_answers
     WHERE sentence_id IN (${placeholders}) ORDER BY sort_order ASC`,
    ...poolSentences.map((sentence) => Number(sentence.id)),
  );

  return poolSentences.map((sentence) => {
    const row = grammarById.get(sentence.id)!;
    const answers = answerRows.filter((answer) => String(answer.sentence_id) === sentence.id);
    return {
      ...sentence,
      grammarStart: row.grammar_start!,
      grammarEnd: row.grammar_end!,
      register: row.register!,
      validAnswers: answers.filter((a) => a.kind === 'valid').map((a) => a.answer_furigana),
      otherGrammarAnswers: answers
        .filter((a) => a.kind === 'other_grammar')
        .map((a) => a.answer_furigana),
    };
  });
}

export type ItemForm = { primaryForm: string; furigana: string | null };

/** Dictionary form + bracket furigana per item id, for the Build card's word list. */
export function getItemFormsByIds(db: SQLiteDatabase, itemIds: string[]): Map<string, ItemForm> {
  const result = new Map<string, ItemForm>();
  if (itemIds.length === 0) return result;
  const placeholders = itemIds.map(() => '?').join(', ');
  const rows = db.getAllSync<{ id: number | string; primary_form: string; furigana: string | null }>(
    `SELECT id, primary_form, furigana FROM items WHERE id IN (${placeholders})`,
    ...itemIds.map(Number),
  );
  for (const row of rows) {
    result.set(String(row.id), { primaryForm: row.primary_form, furigana: row.furigana ?? null });
  }
  return result;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/data/curriculum`
Expected: PASS (new file and the existing `itemRepository.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/data/curriculum/grammarPoolRepository.ts mobile/src/data/curriculum/grammarPoolRepository.test.ts mobile/__mocks__/expo-sqlite.ts
git commit -m "Read the compiled grammar sentence pool"
```

---

### Task 6: Grammar pairs in the queue and the session

**Files:**
- Modify: `mobile/src/core/srs/srs.types.ts`, `mobile/src/core/srs/queueBuilder.ts`, `mobile/src/providers/ReviewSessionProvider.tsx`
- Test: `mobile/src/core/srs/queueBuilder.test.ts`, `mobile/src/providers/ReviewSessionProvider.test.tsx`

**Interfaces:**
- Consumes: `normalizeBuildText` (Task 1); `addGrammarAnswer`, `setGrammarSentenceHistory` (Task 3); `PassageWordSpan` (`@/data/curriculum/passageSpans`).
- Produces:
  - `type GrammarVocabEntry = { itemId: string; primaryForm: string; furigana: string | null; started: boolean }`
  - `type GrammarSentenceCard = { sentenceKey: string; japanese: string; furigana: string | null; english: string; spans: PassageWordSpan[]; grammarSpan: { start: number; end: number }; register: 'polite' | 'plain'; vocabulary: GrammarVocabEntry[]; answers: string[]; otherGrammarAnswers: string[]; userAnswers: string[] }`
  - `ReviewItem.grammarRead?: GrammarSentenceCard`, `ReviewItem.grammarBuild?: GrammarSentenceCard`; same two fields on `QueueInputItem`.
  - Session: `addGrammarAnswerForCurrentItem(answerText: string): AddGrammarAnswerOutcome` where `type AddGrammarAnswerOutcome = { status: 'added' } | { status: 'error' }`.

- [ ] **Step 1: Add the types**

In `srs.types.ts`, add `import type { PassageWordSpan } from '@/data/curriculum/passageSpans';` and, above `ReviewItem`:

```ts
/** One word of a grammar sentence, as the Build card lists it (dictionary form). */
export type GrammarVocabEntry = {
  itemId: string;
  primaryForm: string;
  /** Bracket furigana of the dictionary form; null for kana-only words. */
  furigana: string | null;
  /** The learner has started this word (in_progress or known) — drives D12 link timing. */
  started: boolean;
};

/** The sentence one grammar card asks about (spec §5.3). */
export type GrammarSentenceCard = {
  /** The sentence's plain Japanese — its identity in user.db (spec §5.1). */
  sentenceKey: string;
  japanese: string;
  furigana: string | null;
  english: string;
  spans: PassageWordSpan[];
  grammarSpan: { start: number; end: number };
  register: 'polite' | 'plain';
  /** Distinct span words in sentence order. */
  vocabulary: GrammarVocabEntry[];
  /** Furigana notation graded correct: the sentence, then its `valid` alternates. */
  answers: string[];
  /** Furigana notation that triggers the same-family nudge (D6). */
  otherGrammarAnswers: string[];
  /**
   * Normalised answers the learner saved for this sentence. Mutable on
   * purpose: "My answer is correct too" appends here so a same-session retry
   * of this card (same object) accepts it at once.
   */
  userAnswers: string[];
};
```

and inside `ReviewItem` (after `isTwoCardItem`):

```ts
  /** Grammar pair only: the Read card's sentence (spec §3.1). Set on both cards of the pair. */
  grammarRead?: GrammarSentenceCard;
  /** Grammar pair only: the Build card's sentence (spec §3.2). Set on both cards of the pair. */
  grammarBuild?: GrammarSentenceCard;
```

Update the `isTwoCardItem` doc comment to "True on both cards of a two-card pair (kanji meaning + on'yomi, vocabulary meaning + reading, grammar Read + Build)."

- [ ] **Step 2: Write the failing queue tests**

In `queueBuilder.test.ts`, add `import type { GrammarSentenceCard } from './srs.types';` and append inside `describe('buildReviewQueue', …)`:

```ts
  describe('grammar Read + Build pair (spec §5.3)', () => {
    function card(key: string): GrammarSentenceCard {
      return {
        sentenceKey: key, japanese: key, furigana: null, english: 'e', spans: [],
        grammarSpan: { start: 0, end: 1 }, register: 'polite', vocabulary: [],
        answers: [key], otherGrammarAnswers: [], userAnswers: [],
      };
    }
    const grammarInput = (id: string) =>
      makeQueueItem(id, 'grammar', PAST, { grammarRead: card(`${id}-r`), grammarBuild: card(`${id}-b`) });

    it('emits a Read (meaning) and a Build (production) card sharing srsState and payloads', () => {
      const result = buildReviewQueue([grammarInput('g1')], { now: NOW });

      expect(result.map((c) => c.promptType)).toEqual(['meaning', 'production']);
      expect(result.every((c) => c.isTwoCardItem)).toBe(true);
      expect(result[0].srsState).toBe(result[1].srsState);
      expect(result[0].grammarBuild).toBe(result[1].grammarBuild);
      expect(result[0].grammarRead?.sentenceKey).toBe('g1-r');
    });

    it('a limit that cuts the pair pulls the Build card in', () => {
      const items = [
        grammarInput('g1'),
        makeQueueItem('r1', 'radical', PAST),
        makeQueueItem('r2', 'radical', PAST),
      ];
      const result = buildReviewQueue(items, { now: NOW, limit: 1 });

      expect(result.map((c) => `${c.itemId}:${c.promptType}`)).toEqual(['g1:meaning', 'g1:production']);
    });
  });
```

Existing tests that count a grammar item as one card now see two. Change them as follows (the Build cards are deferred insertions, so dropping them restores the original order exactly):
- `'interleaves content types with documented INTERLEAVE_WEIGHTS'` and `'interleaving structure is preserved when bias is enabled'`: change the `const result = buildReviewQueue(…)` line to end with `.filter((card) => card.promptType !== 'production');` and add the comment `// Build cards are deferred partners; the pair tests cover them.`
- `'handles missing type bucket gracefully (no kanji due)'` and `'default QueueBuildOptions (no weaknessScores) still works (backward compat)'`: `toHaveLength(2)` → `toHaveLength(3)`.
- `'keeps vocabulary and grammar single-card with existing prompt behavior'`: rename to `'keeps kana-only vocabulary single-card'`, remove the `g1` input and the two `grammar` lines, and change `toHaveLength(2)` to `toHaveLength(1)`.

- [ ] **Step 3: Run the queue tests to verify the new ones fail**

Run: `npx jest src/core/srs/queueBuilder.test.ts`
Expected: FAIL in the two new tests (grammar is still one card).

- [ ] **Step 4: Implement the queue change**

In `queueBuilder.ts`:
- Add to `QueueInputItem` (after `mcOptions`):

```ts
  /** Grammar pair payloads (spec §5.3); grammar only. */
  grammarRead?: GrammarSentenceCard;
  grammarBuild?: GrammarSentenceCard;
```

  and import `GrammarSentenceCard` with the other `./srs.types` imports.
- In `isTwoCardInput`, add `if (item.curriculumItem.itemType === 'grammar') return true;` as the first line, and extend its doc comment: "Every grammar item is a Read + Build pair at every stage (D1, D7)."
- Rename `pendingReadingCards` → `pendingSecondCards` and `flushReadyReadingCards` → `flushReadySecondCards`, and emit the second card's prompt by type:

```ts
    if (isTwoCardInput(input)) {
      result.push(mapToReviewItem(input, { promptType: 'meaning', isTwoCardItem: true }));
      pendingSecondCards.push({
        earliestIndex: result.length + PAIR_MIN_GAP,
        card: mapToReviewItem(input, {
          promptType: input.curriculumItem.itemType === 'grammar' ? 'production' : 'reading',
          isTwoCardItem: true,
        }),
      });
    } else {
```

  Update the comment above the loop: "each grammar item becomes a Read (meaning) card plus a Build (production) card."
- `mapToReviewItem`'s `overrides` type becomes `{ promptType: ReviewItem['promptType']; isTwoCardItem: boolean }`, and the returned object gains `grammarRead: item.grammarRead, grammarBuild: item.grammarBuild,` after `isTwoCardItem`.

Run: `npx jest src/core/srs/queueBuilder.test.ts` → PASS.

- [ ] **Step 5: Write the failing session tests**

In `ReviewSessionProvider.test.tsx`, next to the other `jest.mock` calls, add:

```ts
const mockSetGrammarSentenceHistory = jest.fn();
const mockAddGrammarAnswer = jest.fn();

jest.mock('@/data/user/grammarAnswerRepository', () => ({
  setGrammarSentenceHistory: (...args: unknown[]) => mockSetGrammarSentenceHistory(...args),
  addGrammarAnswer: (...args: unknown[]) => mockAddGrammarAnswer(...args),
}));
```

In the outer `beforeEach`, add `mockSetGrammarSentenceHistory.mockReset().mockReturnValue({ ok: true, value: undefined });` and `mockAddGrammarAnswer.mockReset().mockReturnValue({ ok: true, value: undefined });`. Add `import type { GrammarSentenceCard } from '@/core/srs/srs.types';`. Then, after the `describe('two-card kanji worst-of-both grading …')` block and inside the outer describe:

```ts
  describe('grammar Read + Build pair', () => {
    function sentence(key: string): GrammarSentenceCard {
      return {
        sentenceKey: key, japanese: key, furigana: null, english: 'e', spans: [],
        grammarSpan: { start: 0, end: 1 }, register: 'polite', vocabulary: [],
        answers: [key], otherGrammarAnswers: [], userAnswers: [],
      };
    }

    function mockGrammarPair() {
      const base = {
        ...makeReviewItem('g1', 'grammar'),
        isTwoCardItem: true,
        grammarRead: sentence('READ'),
        grammarBuild: sentence('BUILD'),
      };
      mockUseReviewQueue.mockReturnValue({
        queue: [
          { ...base, promptType: 'meaning' },
          { ...base, promptType: 'production' },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        queueBuildMs: 12,
      });
    }

    it('Read wrong + Build right → one Again write and the two sentences saved as history', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockGrammarPair();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      act(() => {
        result.current.gradeCurrentItem(1);
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockUpsertSrsState).not.toHaveBeenCalled();
      expect(mockSetGrammarSentenceHistory).not.toHaveBeenCalled();

      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
      expect(mockUpsertSrsState.mock.calls[0][1].fsrsState).toBe('relearning');
      expect(mockSetGrammarSentenceHistory).toHaveBeenCalledWith(db, 'g1', ['READ', 'BUILD']);
    });

    it('a saved Build answer is patched into the card object the retry reuses', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockGrammarPair();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });
      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('production');
      });

      let outcome: { status: string } = { status: 'idle' };
      act(() => {
        outcome = result.current.addGrammarAnswerForCurrentItem('寒い から、コート着ます。');
      });

      expect(outcome).toEqual({ status: 'added' });
      expect(mockAddGrammarAnswer).toHaveBeenCalledWith(db, 'g1', 'BUILD', '寒いからこーと着ます');
      expect(result.current.currentItem?.grammarBuild?.userAnswers).toEqual(['寒いからこーと着ます']);
    });
  });
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx jest src/providers/ReviewSessionProvider.test.tsx`
Expected: FAIL — the pair never completes (slots are `meaning`/`reading` only) and `addGrammarAnswerForCurrentItem` is undefined.

- [ ] **Step 7: Implement the session change**

In `ReviewSessionProvider.tsx`:
- Imports: `import { normalizeBuildText } from '@/core/grammar/buildEvaluator';` and `import { addGrammarAnswer, setGrammarSentenceHistory } from '@/data/user/grammarAnswerRepository';`.
- Types: add to `ReviewSessionState`:

```ts
  /**
   * "My answer is correct too" on a grammar Build card (D4): save the answer
   * for this sentence and patch it into the card so a same-session retry
   * accepts it. The screen regrades the card itself.
   */
  addGrammarAnswerForCurrentItem: (answerText: string) => AddGrammarAnswerOutcome;
```

  and export `export type AddGrammarAnswerOutcome = { status: 'added' } | { status: 'error' };`.
- `pairGradesRef`: type becomes `useRef<Map<string, Partial<Record<ReviewItem['promptType'], ReviewGrade>>>>(new Map())`; update its comment to "First-attempt terminal grades per two-card item (kanji, vocabulary, grammar), keyed by the card's promptType, held until both cards are terminal…".
- In `gradeCurrentItem`, replace the three lines from `const entry = …` through the `if (entry.meaning !== undefined && entry.reading !== undefined) {…}` block with:

```ts
        const entry = pairGradesRef.current.get(itemId) ?? {};
        entry[currentItem.promptType] = grade;
        pairGradesRef.current.set(itemId, entry);

        const grades = Object.values(entry).filter(
          (value): value is ReviewGrade => value !== undefined,
        );
        if (grades.length === 2) {
          pairGradesRef.current.delete(itemId);
          applyItemGrade(currentItem, combinePairGrades(grades[0], grades[1]), {
            recordWeakness: false,
          });
        }
```

- In `peekStageTransition`, replace the `otherGrade` line with:

```ts
        const otherGrade = Object.entries(entry ?? {}).find(
          ([prompt]) => prompt !== item.promptType,
        )?.[1];
```

- In `applyItemGrade`, inside the `.then(() => { … })` after the `clearBoosts` block:

```ts
          // D9: the next review of this grammar point avoids both sentences.
          if (item.grammarRead && item.grammarBuild) {
            const historyResult = setGrammarSentenceHistory(userDb, itemId, [
              item.grammarRead.sentenceKey,
              item.grammarBuild.sentenceKey,
            ]);
            if (!historyResult.ok && __DEV__) {
              console.warn('[ReviewSession] grammar history write failed', historyResult.error);
            }
          }
```

- Add, after `addSynonymForCurrentItem`:

```ts
  const addGrammarAnswerForCurrentItem = useCallback(
    (answerText: string): AddGrammarAnswerOutcome => {
      const item = currentEntry?.item;
      const card = item?.promptType === 'production' ? item.grammarBuild : undefined;
      if (!item || !card) return { status: 'error' };
      const normalized = normalizeBuildText(answerText);
      if (!normalized) return { status: 'error' };

      const result = addGrammarAnswer(userDb, item.itemId, card.sentenceKey, normalized);
      if (!result.ok) return { status: 'error' };
      // Same object the retry re-queues (see addSynonymForCurrentItem).
      card.userAnswers.push(normalized);
      return { status: 'added' };
    },
    [currentEntry, userDb],
  );
```

  and add `addGrammarAnswerForCurrentItem,` to `value`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/core/srs src/providers/ReviewSessionProvider.test.tsx && npm run typecheck`
Expected: PASS, including every existing kanji pair test.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/core/srs/srs.types.ts mobile/src/core/srs/queueBuilder.ts mobile/src/core/srs/queueBuilder.test.ts mobile/src/providers/ReviewSessionProvider.tsx mobile/src/providers/ReviewSessionProvider.test.tsx
git commit -m "Grammar Read + Build pair: queue expansion, generic pair grading, history, saved answers"
```

---

### Task 7: Build the grammar payloads in the queue

**Files:**
- Create: `mobile/src/data/grammarReviewCards.ts`
- Modify: `mobile/src/data/hooks/useReviewQueue.ts`
- Test: `mobile/src/data/grammarReviewCards.test.ts`

**Interfaces:**
- Consumes: `getGrammarSentencePool`, `getItemFormsByIds` (Task 5); `getGrammarSentenceHistory`, `listGrammarAnswers` (Task 3); `pickGrammarSentences` (Task 2); `listStudyStatusesForItems` (`@/data/user/itemStudyStatusRepository`).
- Produces: `buildGrammarCards(curriculumDb: SQLiteDatabase, userDb: SQLiteDatabase, itemId: string, rng?: () => number): { grammarRead: GrammarSentenceCard; grammarBuild: GrammarSentenceCard }`.

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/data/grammarReviewCards.test.ts
import type { SQLiteDatabase } from 'expo-sqlite';

import { buildGrammarCards } from '@/data/grammarReviewCards';

const mockPool = jest.fn();
const mockForms = jest.fn();
const mockHistory = jest.fn();
const mockAnswers = jest.fn();
const mockStatuses = jest.fn();

jest.mock('@/data/curriculum/grammarPoolRepository', () => ({
  getGrammarSentencePool: (...args: unknown[]) => mockPool(...args),
  getItemFormsByIds: (...args: unknown[]) => mockForms(...args),
}));
jest.mock('@/data/user/grammarAnswerRepository', () => ({
  getGrammarSentenceHistory: (...args: unknown[]) => mockHistory(...args),
  listGrammarAnswers: (...args: unknown[]) => mockAnswers(...args),
}));
jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  listStudyStatusesForItems: (...args: unknown[]) => mockStatuses(...args),
}));

function poolSentence(japanese: string) {
  return {
    id: japanese, japanese, furigana: `${japanese}[f]`, english: `${japanese}-en`, sortOrder: 0,
    vocabularyLinks: [],
    // Out of order on purpose: the card lists words in sentence order.
    spans: [
      { vocabularyItemId: '21', startOffset: 5, endOffset: 8, inflection: null },
      { vocabularyItemId: '20', startOffset: 0, endOffset: 2, inflection: null },
      { vocabularyItemId: '20', startOffset: 9, endOffset: 11, inflection: null },
    ],
    grammarStart: 2, grammarEnd: 4, register: 'polite' as const,
    validAnswers: [`${japanese}-valid`], otherGrammarAnswers: [`${japanese}-other`],
  };
}

const db = {} as SQLiteDatabase;

describe('buildGrammarCards', () => {
  beforeEach(() => {
    mockPool.mockReturnValue(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(poolSentence));
    mockForms.mockReturnValue(
      new Map([
        ['20', { primaryForm: '寒い', furigana: '寒[さむ]い' }],
        ['21', { primaryForm: 'コート', furigana: null }],
      ]),
    );
    mockHistory.mockReturnValue(['A', 'B']);
    mockAnswers.mockReturnValue(new Map([['C', ['saved']]]));
    mockStatuses.mockReturnValue(new Map([['20', 'in_progress']]));
  });

  it('picks two new sentences and fills each card', () => {
    const { grammarRead, grammarBuild } = buildGrammarCards(db, db, '50', () => 0);

    expect(grammarRead.sentenceKey).toBe('C');
    expect(grammarBuild.sentenceKey).toBe('D');
    expect(grammarRead).toMatchObject({
      japanese: 'C',
      english: 'C-en',
      grammarSpan: { start: 2, end: 4 },
      register: 'polite',
      answers: ['C[f]', 'C-valid'],
      otherGrammarAnswers: ['C-other'],
      userAnswers: ['saved'],
    });
    expect(grammarBuild.userAnswers).toEqual([]);
  });

  it('lists each word once, in sentence order, with its started flag', () => {
    const { grammarRead } = buildGrammarCards(db, db, '50', () => 0);

    expect(grammarRead.vocabulary).toEqual([
      { itemId: '20', primaryForm: '寒い', furigana: '寒[さむ]い', started: true },
      { itemId: '21', primaryForm: 'コート', furigana: null, started: false },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/grammarReviewCards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the assembly**

```ts
// mobile/src/data/grammarReviewCards.ts
import type { SQLiteDatabase } from 'expo-sqlite';

import { pickGrammarSentences } from '@/core/grammar/sentencePicker';
import type { GrammarSentenceCard, GrammarVocabEntry } from '@/core/srs/srs.types';
import {
  getGrammarSentencePool,
  getItemFormsByIds,
  type GrammarPoolSentence,
} from '@/data/curriculum/grammarPoolRepository';
import { getGrammarSentenceHistory, listGrammarAnswers } from '@/data/user/grammarAnswerRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';

/**
 * The Read and Build sentences for one due grammar item (spec §5.3): two
 * pool sentences the previous review did not use, each with its word list,
 * answers and the learner's saved answers.
 */
export function buildGrammarCards(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  itemId: string,
  rng: () => number = Math.random,
): { grammarRead: GrammarSentenceCard; grammarBuild: GrammarSentenceCard } {
  const pool = getGrammarSentencePool(curriculumDb, itemId);
  const { read, build } = pickGrammarSentences(pool, getGrammarSentenceHistory(userDb, itemId), rng);
  const saved = listGrammarAnswers(userDb, itemId);

  const wordIds = [...new Set([read, build].flatMap((s) => s.spans.map((span) => span.vocabularyItemId)))];
  const forms = getItemFormsByIds(curriculumDb, wordIds);
  const statuses = listStudyStatusesForItems(userDb, wordIds);

  const toCard = (sentence: GrammarPoolSentence): GrammarSentenceCard => {
    const vocabulary: GrammarVocabEntry[] = [];
    const seen = new Set<string>();
    const inOrder = [...sentence.spans].sort((a, b) => a.startOffset - b.startOffset);
    for (const span of inOrder) {
      if (seen.has(span.vocabularyItemId)) continue;
      seen.add(span.vocabularyItemId);
      const form = forms.get(span.vocabularyItemId);
      // Spans reference items(id) in curriculum.db; a miss is a broken compile.
      if (!form) throw new Error(`Grammar sentence word ${span.vocabularyItemId} has no item row`);
      const status = statuses.get(span.vocabularyItemId);
      vocabulary.push({
        itemId: span.vocabularyItemId,
        primaryForm: form.primaryForm,
        furigana: form.furigana,
        started: status === 'in_progress' || status === 'known',
      });
    }
    return {
      sentenceKey: sentence.japanese,
      japanese: sentence.japanese,
      furigana: sentence.furigana,
      english: sentence.english,
      spans: sentence.spans,
      grammarSpan: { start: sentence.grammarStart, end: sentence.grammarEnd },
      register: sentence.register,
      vocabulary,
      answers: [sentence.furigana ?? sentence.japanese, ...sentence.validAnswers],
      otherGrammarAnswers: sentence.otherGrammarAnswers,
      userAnswers: [...(saved.get(sentence.japanese) ?? [])],
    };
  };

  return { grammarRead: toCard(read), grammarBuild: toCard(build) };
}
```

- [ ] **Step 4: Wire it into `useReviewQueue`**

In `mobile/src/data/hooks/useReviewQueue.ts`:
- Add `import { buildGrammarCards } from '@/data/grammarReviewCards';` and `import type { GrammarSentenceCard } from '@/core/srs/srs.types';` (merge with the existing `srs.types` import).
- Replace the whole block that starts at the comment `// Grammar cloze contract (Plan 07)` and ends with the closing brace of `if (curriculumItem.itemType === 'grammar' && answerKey.grammar) { … }` with:

```ts
        // Grammar Read + Build pair (spec §5.3). A pool below two unused
        // sentences throws here and fails the build visibly (no fallback).
        let grammarRead: GrammarSentenceCard | undefined;
        let grammarBuild: GrammarSentenceCard | undefined;
        if (curriculumItem.itemType === 'grammar') {
          ({ grammarRead, grammarBuild } = buildGrammarCards(curriculumDb, userDb, srsState.itemId));
        }
```

- In the `queueInputs.push({ … })` call, delete `clozePrompt, clozePromptFurigana, clozeAnswer, clozeNudge, clozeEnglish, inputMode, mcOptions,` and add `grammarRead, grammarBuild,`.
- Delete the imports this leaves unused: `buildGrammarCloze`, `buildMcOptions`, `INTERIM_PARTICLE_POOL`, `pickGrammarDistractors`, `resolveGrammarInputMode`, `GrammarInputMode`, `getExampleSentences`, `getGrammarClozeVariants`, `getGrammarDistractorPools`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/data && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/data/grammarReviewCards.ts mobile/src/data/grammarReviewCards.test.ts mobile/src/data/hooks/useReviewQueue.ts
git commit -m "Review queue: attach grammar Read + Build sentences instead of cloze/MC"
```

---

### Task 8: Grammar span in sentence parts; extract `LinkedSentence`

**Files:**
- Modify: `mobile/src/core/content/passageBodyParts.ts`, `mobile/src/components/learn/ExampleSentencesSection.tsx`
- Create: `mobile/src/components/common/LinkedSentence.tsx`
- Test: `mobile/src/core/content/passageBodyParts.grammar.test.ts`, `mobile/src/components/common/LinkedSentence.test.tsx`; regression: `mobile/src/components/learn/ExampleSentencesSection.test.tsx` (unchanged, must pass)

**Interfaces:**
- Produces:
  - `buildPassageBodyParts(body, bodyFurigana, spans, grammarSpan?: { start: number; end: number }): PassageBodyPart[]`; `PassageBodyPart` gains optional `isGrammar?: true` and `overlapsGrammar?: true` (set only when true, so existing `toEqual` assertions are unaffected).
  - `LinkedSentence` props: `{ japanese: string; furigana: string | null; spans: PassageWordSpan[]; testIDPrefix: string; sentenceId: string; textClassName?: string; isLinked?: (vocabularyItemId: string) => boolean; grammarSpan?: { start: number; end: number; locked: boolean; itemId: string } }`.

- [ ] **Step 1: Write the failing parts test**

```ts
// mobile/src/core/content/passageBodyParts.grammar.test.ts
import { buildPassageBodyParts } from './passageBodyParts';

describe('buildPassageBodyParts with a grammar span', () => {
  it('cuts the grammar out of a word span that contains it', () => {
    // もう食べた。 — 食べた is one word span (ta); た is the grammar.
    const parts = buildPassageBodyParts(
      'もう食べた。',
      'もう食[た]べた。',
      [
        { vocabularyItemId: '1', startOffset: 0, endOffset: 2, inflection: null },
        { vocabularyItemId: '2', startOffset: 2, endOffset: 5, inflection: 'ta' },
      ],
      { start: 4, end: 5 },
    );

    expect(parts.map((p) => [p.surface, p.vocabularyItemId, !!p.isGrammar, !!p.overlapsGrammar])).toEqual([
      ['もう', '1', false, false],
      ['食べ', '2', false, true],
      ['た', null, true, false],
      ['。', null, false, false],
    ]);
  });

  it('marks a free-standing grammar span', () => {
    const parts = buildPassageBodyParts('今日は暑い。', null, [], { start: 2, end: 3 });
    expect(parts.filter((p) => p.isGrammar).map((p) => p.surface)).toEqual(['は']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/core/content/passageBodyParts.grammar.test.ts`
Expected: FAIL — no `isGrammar` parts.

- [ ] **Step 3: Implement the parts change**

In `passageBodyParts.ts`:
- Extend `PassageBodyPart`:

```ts
  /** The grammar span of a grammar sentence (Read card highlight). Set only when true. */
  isGrammar?: true;
  /** A word span cut short by the grammar span (食べ of 食べた). Set only when true. */
  overlapsGrammar?: true;
```

- Add the parameter `grammarSpan?: { start: number; end: number }` to `buildPassageBodyParts`, and replace `const validSpans = …sort(…)` with:

```ts
  type Run = PassageWordSpan & { isGrammar?: true; overlapsGrammar?: true };

  const wordSpans: Run[] = spans.filter(
    (span) =>
      span.startOffset >= 0 &&
      span.endOffset <= body.length &&
      span.startOffset < span.endOffset,
  );

  // The grammar span wins over any word span it overlaps: the word keeps
  // only the part outside it, so the grammar is never hidden inside a link.
  let runs: Run[] = wordSpans;
  if (grammarSpan) {
    const { start, end } = grammarSpan;
    runs = [];
    for (const span of wordSpans) {
      if (span.endOffset <= start || span.startOffset >= end) {
        runs.push(span);
        continue;
      }
      if (span.startOffset < start) runs.push({ ...span, endOffset: start, overlapsGrammar: true });
      if (span.endOffset > end) runs.push({ ...span, startOffset: end, overlapsGrammar: true });
    }
    runs.push({ vocabularyItemId: '', startOffset: start, endOffset: end, isGrammar: true });
  }
  const validSpans = runs.sort((left, right) => left.startOffset - right.startOffset);
```

- Change `let runSpan: PassageWordSpan | null` to `let runSpan: Run | null`, the `push` parameter type to `Run | null`, and `flush` to:

```ts
  const flush = (): void => {
    if (runSegments.length === 0) return;
    parts.push({
      vocabularyItemId: runSpan && !runSpan.isGrammar ? runSpan.vocabularyItemId : null,
      text: toAnnotated(runSegments),
      surface: toSurface(runSegments),
      inflection: runSpan && !runSpan.isGrammar ? (runSpan.inflection ?? null) : null,
      ...(runSpan?.isGrammar ? { isGrammar: true as const } : {}),
      ...(runSpan?.overlapsGrammar ? { overlapsGrammar: true as const } : {}),
    });
    runSegments = [];
  };
```

Run: `npx jest src/core/content` → PASS (new file and the existing passage tests).

- [ ] **Step 4: Write the failing component test**

```tsx
// mobile/src/components/common/LinkedSentence.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LinkedSentence } from '@/components/common/LinkedSentence';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    modeForItem: () => 'shown',
    setOverride: jest.fn(),
  }),
}));
jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: { getFirstSync: jest.fn(() => null) }, curriculumDb: {} };
  return { useDatabase: () => databases };
});

const SPANS = [
  { vocabularyItemId: '1', startOffset: 0, endOffset: 2, inflection: null },
  { vocabularyItemId: '2', startOffset: 2, endOffset: 5, inflection: 'ta' as const },
];

function renderSentence(locked: boolean, isLinked?: (id: string) => boolean) {
  render(
    <LinkedSentence
      japanese="もう食べた。"
      furigana="もう食[た]べた。"
      spans={SPANS}
      testIDPrefix="t"
      sentenceId="s1"
      isLinked={isLinked}
      grammarSpan={{ start: 4, end: 5, locked, itemId: '99' }}
    />,
  );
}

describe('LinkedSentence', () => {
  beforeEach(() => mockPush.mockReset());

  it('a locked grammar span is not a button and says it is locked', () => {
    renderSentence(true);
    const grammar = screen.getByTestId('t-grammar');
    expect(grammar.props.accessibilityLabel).toBe('た, grammar, answer first to open it');
    fireEvent.press(grammar);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('an unlocked grammar span opens the grammar point', () => {
    renderSentence(false);
    fireEvent.press(screen.getByTestId('t-grammar'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/99');
  });

  it('while the grammar is locked, a word cut by it opens without its inflection', () => {
    renderSentence(true);
    fireEvent.press(screen.getByTestId('t-word-2-1'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/2');
  });

  it('after answering, the same word opens with its inflection', () => {
    renderSentence(false);
    fireEvent.press(screen.getByTestId('t-word-2-1'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/browse/item/2',
      params: { surface: '食べ', inflection: 'ta' },
    });
  });

  it('a word that is not linked is plain text', () => {
    renderSentence(false, (id) => id !== '1');
    expect(screen.queryByTestId('t-word-1-0')).toBeNull();
    expect(screen.getByText('もう')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx jest src/components/common/LinkedSentence.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 6: Create `LinkedSentence` by moving `ExampleSentenceJapanese`**

```tsx
// mobile/src/components/common/LinkedSentence.tsx
import { router, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { type AccessibilityActionEvent, Pressable, View } from 'react-native';

import { FuriganaText, isWordFuriganaVisible } from '@/components/common/FuriganaText';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import { buildPassageBodyParts } from '@/core/content/passageBodyParts';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';
import { cn } from '@/utils/cn';

type LinkedSentenceProps = {
  japanese: string;
  furigana: string | null;
  spans: PassageWordSpan[];
  /** Prefix for testIDs: `${prefix}-${sentenceId}-linked`, `${prefix}-word-${id}-${index}`, `${prefix}-grammar`. */
  testIDPrefix: string;
  sentenceId: string;
  /** Size and weight classes for the Japanese; colour is set per part. */
  textClassName?: string;
  /** Whether a word span opens its detail page; default: every word. */
  isLinked?: (vocabularyItemId: string) => boolean;
  /** Grammar cards: the highlighted grammar, not pressable while `locked`. */
  grammarSpan?: { start: number; end: number; locked: boolean; itemId: string };
};

const ALWAYS_LINKED = (): boolean => true;

/**
 * A Japanese sentence with linked vocabulary (Plan 11.6 / 14.1): tap opens the
 * word's detail page, long-press toggles its furigana, and furigana follows
 * that word's own mastery (FR78). Shared by example sentences and the grammar
 * review cards (spec §5.4).
 */
export function LinkedSentence({
  japanese,
  furigana,
  spans,
  testIDPrefix,
  sentenceId,
  textClassName = 'text-body-lg font-jp-medium',
  isLinked = ALWAYS_LINKED,
  grammarSpan,
}: LinkedSentenceProps) {
  const { userDb } = useDatabase();
  const { mode: furiganaMode, knownKanji, modeForItem, setOverride } = useFuriganaPreference();
  const hrefFor = useItemHref();
  const grammarStart = grammarSpan?.start;
  const grammarEnd = grammarSpan?.end;
  const parts = useMemo(
    () =>
      buildPassageBodyParts(
        japanese,
        furigana,
        spans,
        grammarStart !== undefined && grammarEnd !== undefined
          ? { start: grammarStart, end: grammarEnd }
          : undefined,
      ),
    [japanese, furigana, spans, grammarStart, grammarEnd],
  );

  const hasLinks = parts.some((part) => part.vocabularyItemId !== null);
  if (!hasLinks && !grammarSpan) {
    return (
      <FuriganaText
        text={furigana ?? japanese}
        mode={furiganaMode}
        knownKanji={knownKanji}
        className={cn(textClassName, 'text-primary')}
      />
    );
  }

  return (
    <View className="flex-row flex-wrap items-end" testID={`${testIDPrefix}-${sentenceId}-linked`}>
      {parts.map((part, index) => {
        const key = `${index}-${part.surface}`;

        if (part.isGrammar && grammarSpan) {
          const grammarText = (
            <View className="rounded-radius-sm bg-content-grammar-soft">
              <FuriganaText
                text={part.text}
                mode={furiganaMode}
                knownKanji={knownKanji}
                interactive={false}
                className={cn(textClassName, 'font-jp-bold text-content-grammar-deep')}
              />
            </View>
          );
          if (grammarSpan.locked) {
            return (
              <View
                key={key}
                accessible
                accessibilityLabel={`${part.surface}, grammar, answer first to open it`}
                testID={`${testIDPrefix}-grammar`}>
                {grammarText}
              </View>
            );
          }
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${part.surface}, show grammar details`}
              onPress={() => router.push(hrefFor(grammarSpan.itemId) as Href)}
              testID={`${testIDPrefix}-grammar`}>
              {grammarText}
            </Pressable>
          );
        }

        if (part.vocabularyItemId === null) {
          return (
            <FuriganaText
              key={key}
              text={part.text}
              mode={furiganaMode}
              knownKanji={knownKanji}
              className={cn(textClassName, 'text-primary')}
            />
          );
        }

        const vocabularyItemId = part.vocabularyItemId;
        // A linked span *is* one vocabulary item, so its own mastery is the
        // whole answer (Tier 1) rather than a per-kanji check (Tier 2) — the
        // same distinction the word's own hero already uses (FR78 / BUG6).
        const isKnownWord = isVocabularyItemKnown(userDb, vocabularyItemId);

        if (!isLinked(vocabularyItemId)) {
          return (
            <FuriganaText
              key={key}
              text={part.text}
              mode={modeForItem(vocabularyItemId)}
              knownKanji={knownKanji}
              isKnownWord={isKnownWord}
              interactive={false}
              className={cn(textClassName, 'text-primary')}
            />
          );
        }

        // While the grammar is locked, a word cut by it must not name its
        // inflection: "食べた is the た-form" would hand over the answer.
        const inflection = grammarSpan?.locked && part.overlapsGrammar ? null : part.inflection;
        const handlePress = (): void => {
          const pathname = hrefFor(vocabularyItemId);
          // A conjugated span opens the *base* word, so the detail screen is
          // told which surface sent the learner there (14.1).
          if (inflection) {
            router.push({ pathname, params: { surface: part.surface, inflection } } as Href);
            return;
          }
          router.push(pathname as Href);
        };
        const handleToggleFurigana = (): void => {
          const visible = isWordFuriganaVisible(
            part.text,
            modeForItem(vocabularyItemId),
            knownKanji,
            isKnownWord,
          );
          setOverride(vocabularyItemId, visible ? 'hidden' : 'shown');
        };
        const handleAccessibilityAction = (event: AccessibilityActionEvent): void => {
          if (event.nativeEvent.actionName === 'toggleFurigana') {
            handleToggleFurigana();
            return;
          }
          handlePress();
        };

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${part.surface}, show word details`}
            accessibilityActions={[
              { name: 'activate', label: 'Show word details' },
              { name: 'toggleFurigana', label: 'Toggle furigana' },
            ]}
            onAccessibilityAction={handleAccessibilityAction}
            onPress={handlePress}
            onLongPress={handleToggleFurigana}
            testID={`${testIDPrefix}-word-${vocabularyItemId}-${index}`}>
            <FuriganaText
              text={part.text}
              // A linked span *is* one vocabulary item, so its per-word
              // override applies here just as it does on the word's own hero.
              mode={modeForItem(vocabularyItemId)}
              knownKanji={knownKanji}
              isKnownWord={isKnownWord}
              // Nested furigana toggles would steal the span tap (NFR29).
              interactive={false}
              className={cn(textClassName, 'text-content-vocabulary-deep underline')}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
```

Check that `rounded-radius-sm` exists in `mobile/tailwind.config.js` (`grep -n "radius-sm" mobile/tailwind.config.js`); if it does not, use the smallest `rounded-radius-*` token that does.

In `ExampleSentencesSection.tsx`: delete the `ExampleSentenceJapanese` function and replace its use with

```tsx
            <LinkedSentence
              japanese={sentence.japanese}
              furigana={sentence.furigana}
              spans={sentence.spans}
              testIDPrefix={testIDPrefix}
              sentenceId={sentence.id}
            />
```

Remove the imports this leaves unused (`router`, `Href`, `useMemo`, `AccessibilityActionEvent`, `Pressable`, `FuriganaText`, `isWordFuriganaVisible`, `useItemHref`, `buildPassageBodyParts`, `useDatabase`, `isVocabularyItemKnown`, and the `useFuriganaPreference` call/`hrefFor` in the section body if nothing else uses them) and the `EXAMPLE_JAPANESE` constant (its classes are `LinkedSentence`'s default plus `text-primary`). Add `import { LinkedSentence } from '@/components/common/LinkedSentence';`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/components/common/LinkedSentence.test.tsx src/components/learn src/core/content && npm run typecheck && npm run lint`
Expected: PASS. `ExampleSentencesSection.test.tsx` passes unchanged (behaviour and testIDs are the same).

- [ ] **Step 8: Commit**

```bash
git add mobile/src/core/content/passageBodyParts.ts mobile/src/core/content/passageBodyParts.grammar.test.ts mobile/src/components/common/LinkedSentence.tsx mobile/src/components/common/LinkedSentence.test.tsx mobile/src/components/learn/ExampleSentencesSection.tsx
git commit -m "Extract LinkedSentence with a lockable grammar span"
```

---

### Task 9: `GrammarReadCard` and `GrammarBuildCard`

**Files:**
- Create: `mobile/src/components/review/GrammarReadCard.tsx`, `mobile/src/components/review/GrammarBuildCard.tsx`
- Modify: `mobile/src/components/review/index.ts` (export both)
- Test: `mobile/src/components/review/GrammarReadCard.test.tsx`, `mobile/src/components/review/GrammarBuildCard.test.tsx`

**Interfaces:**
- Consumes: `LinkedSentence` (Task 8), `isWordLinked` (Task 2), `GrammarSentenceCard` (Task 6).
- Produces: `GrammarReadCard({ item: ReviewItem; answered: boolean })`, `GrammarBuildCard({ item: ReviewItem; answered: boolean })`. Both render nothing when their payload is missing.

- [ ] **Step 1: Write the failing tests**

Shared fixture (repeat it in each test file):

```tsx
import type { GrammarSentenceCard, ReviewItem } from '@/core/srs/srs.types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    modeForItem: () => 'shown',
    setOverride: jest.fn(),
  }),
}));
jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: { getFirstSync: jest.fn(() => null) }, curriculumDb: {} };
  return { useDatabase: () => databases };
});

const SENTENCE: GrammarSentenceCard = {
  sentenceKey: '寒いから、コートを着ます。',
  japanese: '寒いから、コートを着ます。',
  furigana: '寒[さむ]いから、コートを着[き]ます。',
  english: "Because it's cold, I'll wear a coat.",
  spans: [
    { vocabularyItemId: '20', startOffset: 0, endOffset: 2, inflection: null },
    { vocabularyItemId: '21', startOffset: 5, endOffset: 8, inflection: null },
  ],
  grammarSpan: { start: 2, end: 4 },
  register: 'polite',
  vocabulary: [
    { itemId: '20', primaryForm: '寒い', furigana: '寒[さむ]い', started: true },
    { itemId: '21', primaryForm: 'コート', furigana: null, started: false },
  ],
  answers: ['寒[さむ]いから、コートを着[き]ます。'],
  otherGrammarAnswers: [],
  userAnswers: [],
};

function grammarItem(promptType: 'meaning' | 'production'): ReviewItem {
  return {
    itemId: '99', itemType: 'grammar', primaryForm: 'から', displayMeaning: 'because',
    meanings: ['because'], promptType, isTwoCardItem: true,
    grammarRead: SENTENCE, grammarBuild: SENTENCE,
    answerKey: { acceptedMeanings: ['because'], acceptedReadings: [] },
    relatedItems: [], reinforcementLink: null,
    srsState: {
      itemId: '99', stability: 1, difficulty: 5, dueDate: '2026-10-13T00:00:00.000Z',
      fsrsState: 'review', reps: 2, lapses: 0, learningSteps: 0, isBurned: false,
      srsStageLabel: 'apprentice', lastReviewedAt: null, updatedAt: '2026-10-13T00:00:00.000Z',
    },
  };
}
```

```tsx
// mobile/src/components/review/GrammarReadCard.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { GrammarReadCard } from './GrammarReadCard';
// …shared fixture…

describe('GrammarReadCard', () => {
  beforeEach(() => mockPush.mockReset());

  it('asks for the highlighted grammar and keeps it locked before answering', () => {
    render(<GrammarReadCard item={grammarItem('meaning')} answered={false} />);
    expect(screen.getByText('What does the highlighted grammar mean?')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-read-grammar'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText(SENTENCE.english)).toBeNull();
  });

  it('links every word before answering', () => {
    render(<GrammarReadCard item={grammarItem('meaning')} answered={false} />);
    fireEvent.press(screen.getByTestId('grammar-read-word-20-0'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/20');
  });

  it('after answering shows the English and unlocks the grammar', () => {
    render(<GrammarReadCard item={grammarItem('meaning')} answered />);
    expect(screen.getByText(SENTENCE.english)).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-read-grammar'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/99');
  });
});
```

```tsx
// mobile/src/components/review/GrammarBuildCard.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { GrammarBuildCard } from './GrammarBuildCard';
// …shared fixture…

describe('GrammarBuildCard', () => {
  beforeEach(() => mockPush.mockReset());

  it('shows the English, the polite tag and the word list, but not the sentence', () => {
    render(<GrammarBuildCard item={grammarItem('production')} answered={false} />);
    expect(screen.getByText(SENTENCE.english)).toBeTruthy();
    expect(screen.getByText('polite')).toBeTruthy();
    expect(screen.getByTestId('grammar-build-vocab-20')).toBeTruthy();
    expect(screen.queryByTestId('grammar-build-answer-' + SENTENCE.sentenceKey + '-linked')).toBeNull();
  });

  it('before answering, only a word not started yet is a link (D12)', () => {
    render(<GrammarBuildCard item={grammarItem('production')} answered={false} />);
    fireEvent.press(screen.getByTestId('grammar-build-vocab-20'));
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('grammar-build-vocab-21'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/21');
  });

  it('after answering, every word links and the correct sentence is shown', () => {
    render(<GrammarBuildCard item={grammarItem('production')} answered />);
    fireEvent.press(screen.getByTestId('grammar-build-vocab-20'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/20');
    expect(screen.getByTestId(`grammar-build-answer-${SENTENCE.sentenceKey}-linked`)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/components/review/GrammarReadCard.test.tsx src/components/review/GrammarBuildCard.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the Read card**

```tsx
// mobile/src/components/review/GrammarReadCard.tsx
import { Text, View } from 'react-native';

import { LinkedSentence } from '@/components/common/LinkedSentence';
import type { ReviewItem } from '@/core/srs/srs.types';

type GrammarReadCardProps = {
  item: ReviewItem;
  /** True once the card has a terminal result: the grammar unlocks and the English shows. */
  answered: boolean;
};

/**
 * Read card (spec §3.1): a sentence with the grammar highlighted; the learner
 * types what the grammar means. Every word links at all times (D12); the
 * grammar span itself stays locked until the card is answered.
 */
export function GrammarReadCard({ item, answered }: GrammarReadCardProps) {
  const sentence = item.grammarRead;
  if (!sentence) return null;
  return (
    <View className="w-full items-center gap-space-md">
      <LinkedSentence
        japanese={sentence.japanese}
        furigana={sentence.furigana}
        spans={sentence.spans}
        testIDPrefix="grammar-read"
        sentenceId={sentence.sentenceKey}
        textClassName="text-title-lg font-jp-medium"
        grammarSpan={{ ...sentence.grammarSpan, locked: !answered, itemId: item.itemId }}
      />
      {answered ? (
        <Text className="text-body font-ui text-secondary text-center">{sentence.english}</Text>
      ) : (
        <Text className="text-body font-ui-semibold text-secondary text-center">
          What does the highlighted grammar mean?
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Implement the Build card**

```tsx
// mobile/src/components/review/GrammarBuildCard.tsx
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { LinkedSentence } from '@/components/common/LinkedSentence';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import { isWordLinked } from '@/core/grammar/linkPolicy';
import type { GrammarVocabEntry, ReviewItem } from '@/core/srs/srs.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';

type GrammarBuildCardProps = {
  item: ReviewItem;
  /** True once the card has a terminal result: every word links and the sentence shows. */
  answered: boolean;
};

/**
 * Build card (spec §3.2): the English sentence, its words in dictionary form
 * and a polite/plain tag; the learner types the whole sentence in Japanese.
 * Link timing follows D12 (isWordLinked).
 */
export function GrammarBuildCard({ item, answered }: GrammarBuildCardProps) {
  const sentence = item.grammarBuild;
  if (!sentence) return null;
  return (
    <View className="w-full items-center gap-space-md">
      <Text className="text-title font-ui-semibold text-primary text-center">{sentence.english}</Text>
      <View className="rounded-radius-md border border-border px-space-sm">
        <Text className="text-caption font-ui-semibold text-secondary">{sentence.register}</Text>
      </View>
      <View className="flex-row flex-wrap items-end justify-center gap-space-sm">
        {sentence.vocabulary.map((entry) => (
          <VocabWord
            key={entry.itemId}
            entry={entry}
            linked={isWordLinked({ card: 'build', answered, wordStarted: entry.started })}
          />
        ))}
      </View>
      {answered ? (
        <LinkedSentence
          japanese={sentence.japanese}
          furigana={sentence.furigana}
          spans={sentence.spans}
          testIDPrefix="grammar-build-answer"
          sentenceId={sentence.sentenceKey}
          grammarSpan={{ ...sentence.grammarSpan, locked: false, itemId: item.itemId }}
        />
      ) : null}
    </View>
  );
}

function VocabWord({ entry, linked }: { entry: GrammarVocabEntry; linked: boolean }) {
  const { userDb } = useDatabase();
  const { knownKanji, modeForItem } = useFuriganaPreference();
  const hrefFor = useItemHref();
  const word = (
    <FuriganaText
      text={entry.furigana ?? entry.primaryForm}
      mode={modeForItem(entry.itemId)}
      knownKanji={knownKanji}
      // Per-word mastery: a word not learned yet always shows its reading.
      isKnownWord={isVocabularyItemKnown(userDb, entry.itemId)}
      interactive={false}
      className={
        linked
          ? 'text-body-lg font-jp-medium text-content-vocabulary-deep underline'
          : 'text-body-lg font-jp-medium text-primary'
      }
    />
  );
  if (!linked) {
    return (
      <View accessible accessibilityLabel={entry.primaryForm} testID={`grammar-build-vocab-${entry.itemId}`}>
        {word}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.primaryForm}, show word details`}
      onPress={() => router.push(hrefFor(entry.itemId) as Href)}
      testID={`grammar-build-vocab-${entry.itemId}`}>
      {word}
    </Pressable>
  );
}
```

Add `export { GrammarReadCard } from './GrammarReadCard';` and `export { GrammarBuildCard } from './GrammarBuildCard';` to `components/review/index.ts`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/components/review/GrammarReadCard.test.tsx src/components/review/GrammarBuildCard.test.tsx && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/review/GrammarReadCard.tsx mobile/src/components/review/GrammarReadCard.test.tsx mobile/src/components/review/GrammarBuildCard.tsx mobile/src/components/review/GrammarBuildCard.test.tsx mobile/src/components/review/index.ts
git commit -m "Grammar Read and Build card components"
```

---

### Task 10: Wire the cards into the review screen

**Files:**
- Modify: `mobile/src/core/answer/answer.types.ts`, `mobile/src/core/answer/reviewAnswerEvaluator.ts`, `mobile/src/components/review/ReviewCard.tsx`, `mobile/src/components/review/IncorrectReveal.tsx`, `mobile/src/app/review/index.tsx`
- Test: `mobile/src/core/answer/reviewAnswerEvaluator.test.ts`, `mobile/src/components/review/ReviewCard.test.tsx`, `mobile/src/app/review/index.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 6, 9.
- Produces: `AnswerResult` gains `'other_grammar'` (non-terminal, no grade); `ReviewCardState` gains `'other_grammar'`; `ReviewCard` props gain `onSaveGrammarAnswer?: () => void` and `grammarAnswerError?: boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `reviewAnswerEvaluator.test.ts` (reuse its item factory; if it has none, build a `ReviewItem` literal like `grammarItem` in Task 9):

```ts
describe('grammar Build card', () => {
  const build = {
    sentenceKey: 'k', japanese: '寒いから、コートを着ます。', furigana: '寒[さむ]いから、コートを着[き]ます。',
    english: 'e', spans: [], grammarSpan: { start: 2, end: 4 }, register: 'polite' as const, vocabulary: [],
    answers: ['寒[さむ]いから、コートを着[き]ます。'],
    otherGrammarAnswers: ['寒[さむ]いので、コートを着[き]ます。'],
    userAnswers: [],
  };
  const item = {
    itemId: '99', itemType: 'grammar' as const, primaryForm: 'から', displayMeaning: 'because',
    meanings: ['because'], promptType: 'production' as const, grammarBuild: build,
    answerKey: { acceptedMeanings: ['because'], acceptedReadings: [] },
    relatedItems: [], reinforcementLink: null,
    srsState: { itemId: '99', stability: 1, difficulty: 5, dueDate: '', fsrsState: 'review' as const, reps: 1, lapses: 0, learningSteps: 0, isBurned: false, srsStageLabel: 'apprentice' as const, lastReviewedAt: null, updatedAt: '' },
  };

  it('grades the sentence', () => {
    expect(evaluateReviewAnswer(item, 'さむいからこーとをきます').result).toBe('correct');
  });

  it('nudges a same-family grammar answer without grading', () => {
    expect(evaluateReviewAnswer(item, '寒いので、コートを着ます').result).toBe('other_grammar');
    expect(gradeForResult('other_grammar')).toBeNull();
  });

  it('a wrong sentence reveals the plain sentence', () => {
    expect(evaluateReviewAnswer(item, '暑いから')).toEqual({
      result: 'incorrect',
      displayAnswer: '寒いから、コートを着ます。',
    });
  });
});
```

Append to `ReviewCard.test.tsx` (add `useDatabase` and the full `useFuriganaPreference` mock shape from Task 9 if the file's mocks lack `modeForItem`/`setOverride`/`getFirstSync`; add `import type { GrammarSentenceCard } from '@/core/srs/srs.types';` and the Task 9 `SENTENCE` constant):

```tsx
describe('ReviewCard — grammar pair', () => {
  const grammar = (promptType: 'meaning' | 'production') =>
    makeItem({
      itemType: 'grammar', primaryForm: 'から', promptType, isTwoCardItem: true,
      grammarRead: SENTENCE, grammarBuild: SENTENCE,
    });

  it('labels the Read and Build cards', () => {
    render(<ReviewCard item={grammar('meaning')} state="prompting" />);
    expect(screen.getByText('Grammar · Read')).toBeTruthy();
    render(<ReviewCard item={grammar('production')} state="prompting" />);
    expect(screen.getByText('Grammar · Build')).toBeTruthy();
  });

  it('shows the other-grammar nudge', () => {
    render(<ReviewCard item={grammar('production')} state="other_grammar" />);
    expect(screen.getByText('That works, but it uses a different grammar point. Try again.')).toBeTruthy();
  });

  it('offers "My answer is correct too" on a wrong Build answer', () => {
    const onSave = jest.fn();
    render(
      <ReviewCard
        item={grammar('production')}
        state="incorrect"
        displayAnswer={SENTENCE.japanese}
        rejectedAnswer="さむいからこーと"
        onSaveGrammarAnswer={onSave}
      />,
    );
    fireEvent.press(screen.getByText('My answer is correct too'));
    expect(onSave).toHaveBeenCalled();
  });
});
```

Append to `app/review/index.test.tsx`: add `const mockAddGrammarAnswerForCurrentItem = jest.fn().mockReturnValue({ status: 'added' });` next to the other session mocks, add `addGrammarAnswerForCurrentItem: mockAddGrammarAnswerForCurrentItem,` to the mocked `useReviewSession` return, add `setOverride: jest.fn(),` to the `useFuriganaPreference` mock, change `userDb: {}` in `mockDatabaseHandles` to `userDb: { getFirstSync: () => null }`, and add (with the Task 9 `SENTENCE` constant copied in):

```tsx
describe('grammar Build card', () => {
  beforeEach(() => {
    mockGradeCurrentItem.mockReset();
    mockAddGrammarAnswerForCurrentItem.mockClear();
    mockCurrentItem = makeReviewItem({
      itemId: '99', itemType: 'grammar', primaryForm: 'から', promptType: 'production',
      isTwoCardItem: true, grammarRead: SENTENCE, grammarBuild: SENTENCE,
      answerKey: { acceptedMeanings: ['because'], acceptedReadings: [] },
    });
  });

  it('"My answer is correct too" saves the answer and grades the card Good', async () => {
    render(<ReviewScreen />);
    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'さむいからこーと');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('My answer is correct too'));
    });
    expect(mockAddGrammarAnswerForCurrentItem).toHaveBeenCalledWith('さむいからこーと');

    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });
    expect(mockGradeCurrentItem).toHaveBeenCalledWith(3);
  });

  it('an other-grammar answer keeps the typed text and grades nothing', async () => {
    const withOther = { ...SENTENCE, otherGrammarAnswers: ['寒[さむ]いので、コートを着[き]ます。'] };
    mockCurrentItem = { ...mockCurrentItem!, grammarBuild: withOther };
    render(<ReviewScreen />);
    fireEvent.changeText(screen.getByTestId('review-answer-input'), 'さむいので、こーとをきます');
    await act(async () => {
      fireEvent(screen.getByTestId('review-answer-input'), 'submitEditing');
    });

    expect(screen.getByText('That works, but it uses a different grammar point. Try again.')).toBeTruthy();
    expect(screen.getByTestId('review-answer-input').props.value).toBe('さむいので、こーとをきます');
    expect(mockGradeCurrentItem).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/core/answer src/components/review/ReviewCard.test.tsx src/app/review/index.test.tsx`
Expected: FAIL in the new tests.

- [ ] **Step 3: Evaluator routing**

`answer.types.ts`: add `| 'other_grammar'` to `AnswerResult` with the comment `/** Grammar Build: same meaning with a same-family grammar point (D6) — non-terminal, no grade. */`.

`reviewAnswerEvaluator.ts`: add `import { evaluateGrammarBuild } from '@/core/grammar/buildEvaluator';` and, as the first statement after `const { promptType, answerKey } = item;`:

```ts
  // Grammar Build card (spec §5.2): the whole sentence, no typo tolerance.
  // The Read card is a meaning prompt and takes the meaning path below.
  if (promptType === 'production' && item.grammarBuild) {
    const result = evaluateGrammarBuild(userAnswer, item.grammarBuild);
    return result === 'incorrect'
      ? { result, displayAnswer: item.grammarBuild.japanese }
      : { result };
  }
```

Update the `gradeForResult` doc comment: "typo, wrong_script, wrong_reading_type and other_grammar → no grade (non-terminal)."

- [ ] **Step 4: `ReviewCard` routing**

In `ReviewCard.tsx`:
- Imports: `GrammarBuildCard`, `GrammarReadCard` from `./GrammarBuildCard` / `./GrammarReadCard`.
- `ReviewCardState`: add `| 'other_grammar'`.
- Props: add

```ts
  /** Grammar Build, incorrect state: "My answer is correct too" (D4) */
  onSaveGrammarAnswer?: () => void;
  /** The last save attempt failed */
  grammarAnswerError?: boolean;
```

  and destructure both.
- After the `accent` line:

```ts
  // Grammar pair (spec §3): the Read card asks about one sentence, the Build
  // card about another; both payloads ride on both cards of the pair.
  const grammarCard =
    itemType === 'grammar'
      ? promptType === 'production'
        ? item.grammarBuild
        : item.grammarRead
      : undefined;
```

- `modeLabel`: replace the `itemType === 'grammar' ? 'Grammar'` arm with `itemType === 'grammar' ? (grammarCard ? (promptType === 'production' ? 'Grammar · Build' : 'Grammar · Read') : 'Grammar')`.
- `resolveCorrectReveal`: insert as the first statement inside the function:

```ts
  if (item.itemType === 'grammar' && item.promptType === 'production' && item.grammarBuild) {
    return { label: 'Answer', value: item.grammarBuild.japanese };
  }
  if (item.itemType === 'grammar' && item.promptType === 'meaning' && item.grammarRead) {
    return { label: 'Meaning', value: item.displayMeaning };
  }
```

- Add `const OTHER_GRAMMAR_NUDGE = 'That works, but it uses a different grammar point. Try again.';` next to `TYPO_NUDGE`, and add the arm `: state === 'other_grammar' ? OTHER_GRAMMAR_NUDGE` to the `nudge` chain (before `wrong_script`).
- `promptNode`: wrap the existing expression so a grammar card wins:

```ts
  const promptNode = grammarCard ? (
    promptType === 'production' ? (
      <GrammarBuildCard item={item} answered={state === 'correct'} />
    ) : (
      <GrammarReadCard item={item} answered={state === 'correct'} />
    )
  ) : correctReveal && isGrammarCloze
    ? renderPrompt(resolveCompletedSentence(promptDisplay, correctReveal.value) ?? promptDisplay)
    : grammarPrompt;
```

- Hint ladder: change the condition to `itemType === 'grammar' && !grammarCard && !correctReveal` (Task 11 deletes it).
- Pass `onSaveGrammarAnswer={onSaveGrammarAnswer}` and `grammarAnswerError={grammarAnswerError}` to `IncorrectReveal`.

- [ ] **Step 5: `IncorrectReveal` grammar variant**

In `IncorrectReveal.tsx`:
- Imports: `GrammarBuildCard`, `GrammarReadCard`.
- Props: add `onSaveGrammarAnswer?: () => void;` and `grammarAnswerError?: boolean;`, destructure both.
- After `const isGrammar = …`:

```ts
  const grammarCard =
    item.itemType === 'grammar'
      ? item.promptType === 'production'
        ? item.grammarBuild
        : item.grammarRead
      : undefined;
  const canSaveGrammarAnswer =
    item.itemType === 'grammar' &&
    item.promptType === 'production' &&
    Boolean(onSaveGrammarAnswer) &&
    Boolean(rejectedAnswer?.trim());
```

- The result region (`<View ref={resultRef} accessible …>`) is one accessible element, so links inside it would be hidden from screen readers. Put the grammar card and the structure line **after** that `View` closes, before the `stageTransition` block:

```tsx
      {grammarCard ? (
        <View className="w-full items-center gap-space-sm">
          {item.promptType === 'production' ? (
            <GrammarBuildCard item={item} answered />
          ) : (
            <GrammarReadCard item={item} answered />
          )}
          {item.answerKey.grammar?.structure ? (
            <Text className="text-body font-ui text-secondary text-center">
              {item.answerKey.grammar.structure}
            </Text>
          ) : null}
        </View>
      ) : null}
```

- Replace the synonym block's outer conditional so Build gets its own button:

```tsx
      {canSaveGrammarAnswer ? (
        <View className="items-center gap-space-xs">
          {grammarAnswerError ? (
            <Text className="text-center text-body-sm font-ui text-feedback-incorrect-deep">
              Couldn&apos;t save your answer. Try again.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`My answer ${rejectedAnswer} is correct too`}
            onPress={onSaveGrammarAnswer}
            className="min-h-[44px] justify-center px-space-md">
            <Text className="text-body font-ui-semibold text-brand-text">My answer is correct too</Text>
          </Pressable>
        </View>
      ) : synonymState.status === 'added' ? (
```

  (the rest of the existing chain — the `added` text, `canOfferSynonym` block, `: null` — stays as it is).

- [ ] **Step 6: Review screen**

In `app/review/index.tsx`:
- Import `ItemLinkProvider` from `@/components/learn/ItemLinkContext`.
- Replace `const GRAMMAR_PLACEHOLDER = 'Type the missing piece...';` (and its comment) with:

```ts
// Grammar pair (spec §3): Read asks for the grammar's meaning; Build for the
// whole sentence in Japanese.
const GRAMMAR_PLACEHOLDER: Record<PromptType, string> = {
  meaning: 'Type what the highlighted grammar means...',
  production: 'Type the sentence in Japanese...',
  reading: 'Type the sentence in Japanese...',
};
```

  and change both `GRAMMAR_PLACEHOLDER` uses to `GRAMMAR_PLACEHOLDER[currentItem.promptType]`.
- Destructure `addGrammarAnswerForCurrentItem` from `useReviewSession()`.
- State: `const [grammarAnswerError, setGrammarAnswerError] = useState(false);`, reset with `setGrammarAnswerError(false);` in the `[cursor]` effect.
- `canSubmitAnswer`: add `|| cardState === 'other_grammar'`.
- The `[cardState]` focus effect: add `cardState !== 'other_grammar' &&` to the early-return condition and `|| cardState === 'other_grammar'` to the re-focus condition.
- In `submitAnswer`, after the `wrong_reading_type` branch:

```ts
    if (evaluation.result === 'other_grammar') {
      // Same meaning with a same-family grammar point (D6): nudge, no grade.
      // The typed sentence stays so only the grammar needs changing.
      setCardState('other_grammar');
      isSubmittingRef.current = false;
      return;
    }
```

- `inputState`: the `'wrong-script'` arm becomes `cardState === 'wrong_script' || cardState === 'wrong_reading_type' || cardState === 'other_grammar'`.
- After `handleAddSynonym`:

```ts
  // "My answer is correct too" (D4): save the rejected sentence, then regrade
  // this card Good. The incorrect grade has not been written yet — Continue
  // writes it — so the regrade simply replaces it.
  function handleSaveGrammarAnswer() {
    if (cardState !== 'incorrect' || !rejectedAnswer) return;
    if (addGrammarAnswerForCurrentItem(rejectedAnswer).status !== 'added') {
      setGrammarAnswerError(true);
      return;
    }
    const grade = gradeForResult('correct') ?? 3;
    setStageTransition(peekStageTransition(grade));
    pendingGradeRef.current = grade;
    isSubmittingRef.current = false;
    setCardState('correct');
  }
```

- Wrap `<ReviewCard … />` in `<ItemLinkProvider base="/review/item"> … </ItemLinkProvider>` and pass `onSaveGrammarAnswer={handleSaveGrammarAnswer}` and `grammarAnswerError={grammarAnswerError}`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/core/answer src/components/review src/app/review && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/core/answer mobile/src/components/review mobile/src/app/review
git commit -m "Review screen: grammar Read/Build cards, other-grammar nudge, My answer is correct too"
```

---

### Task 11: Remove the cloze, multiple-choice and hint code

**Files:**
- Delete: `mobile/src/core/grammar/{clozeBuilder,distractors,inputMode,nearMiss,answerEvaluator,conjugationParser}.ts` and their `.test.ts`; `mobile/src/components/review/{GrammarMcOptions,ProgressiveHint}.tsx` and their `.test.tsx`; `mobile/src/core/content/hintLevels.ts` and `hintLevels.test.ts`; `mobile/src/core/grammar/grammar.types.ts` if nothing imports it after the deletions.
- Modify: `components/review/index.ts`, `core/srs/srs.types.ts`, `core/srs/queueBuilder.ts`, `core/answer/answer.types.ts`, `core/answer/reviewAnswerEvaluator.ts`, `components/review/ReviewCard.tsx`, `components/review/IncorrectReveal.tsx`, `app/review/index.tsx`, `data/curriculum/itemRepository.ts`, `data/hooks/useReviewQueue.test.ts`; tests listed in Step 3.

**Interfaces:**
- Produces: `ReviewItem` without `clozePrompt`, `clozeAnswer`, `clozePromptFurigana`, `clozeNudge`, `clozeEnglish`, `inputMode`, `mcOptions` (spec §5.3); `EvaluationResult` without `feedbackKind`.

- [ ] **Step 1: Delete the files**

```bash
cd mobile/src
git rm core/grammar/clozeBuilder.ts core/grammar/clozeBuilder.test.ts core/grammar/distractors.ts core/grammar/distractors.test.ts core/grammar/inputMode.ts core/grammar/inputMode.test.ts core/grammar/nearMiss.ts core/grammar/nearMiss.test.ts core/grammar/answerEvaluator.ts core/grammar/answerEvaluator.test.ts core/grammar/conjugationParser.ts core/grammar/conjugationParser.test.ts components/review/GrammarMcOptions.tsx components/review/GrammarMcOptions.test.tsx components/review/ProgressiveHint.tsx components/review/ProgressiveHint.test.tsx core/content/hintLevels.ts core/content/hintLevels.test.ts
grep -rn "grammar.types" . || git rm core/grammar/grammar.types.ts
```

- [ ] **Step 2: Remove the references**

- `components/review/index.ts`: drop the `GrammarMcOptions` and `ProgressiveHint` exports.
- `srs.types.ts`: delete the seven fields listed above from `ReviewItem` with their comments.
- `queueBuilder.ts`: delete `clozePrompt`, `clozePromptFurigana`, `clozeAnswer`, `clozeNudge`, `clozeEnglish`, `inputMode`, `mcOptions` from `QueueInputItem` and from `mapToReviewItem`'s returned object.
- `answer.types.ts`: delete `feedbackKind` and its comment.
- `reviewAnswerEvaluator.ts`: delete the `if (answerKey.grammar) { … }` block and the `evaluateGrammarAnswer` / `assessGrammarNearMiss` imports.
- `ReviewCard.tsx`: delete `isGrammarCloze`, the cloze `promptDisplay` arm (`const promptDisplay = primaryForm;`), the cloze arm of `renderPrompt`, `grammarPromptClass`, `structureNudge`, `hintLevels`, the `ProgressiveHint` element, the `onHintReveal` and `incompleteAnswer` props, the old cloze arm of `resolveCorrectReveal` (`clozeAnswer`), and the imports of `buildGrammarHintLevels`, `blankFormsInStructure`, `englishHintsAllowed`, `resolveCompletedSentence`, `ProgressiveHint`. `modeLabel`'s grammar arm becomes `promptType === 'production' ? 'Grammar · Build' : 'Grammar · Read'`; `promptNode` becomes `grammarCard ? (…) : grammarPrompt`.
- `IncorrectReveal.tsx`: delete `incompleteAnswer`, `isIncomplete`, `clozeSentence`, `completedSentence`, the "Not quite" branch, and the cloze `FuriganaText`; the verdict is always `<VerdictLine label="Incorrect" />`; the accessibility label is always `` `Incorrect, correct answer is ${displayAnswer}` ``; drop the `resolveCompletedSentence` import and any import left unused.
- `app/review/index.tsx`: delete `isMcCard` and its whole `: isMcCard ? (…)` branch, the `!isMcCard ?` guard in the correct branch (keep the input), `options?.fromMc` handling in `submitAnswer` (signature becomes `(submittedAnswer: string)`), the `incompleteAnswer` state/prop, and the `GrammarMcOptions` import.
- `data/curriculum/itemRepository.ts`: delete `GrammarClozeVariant`, `getGrammarClozeVariants`, `getGrammarDistractorPools`.
- `data/hooks/useReviewQueue.test.ts`: delete the `getGrammarClozeVariants` and `getGrammarDistractorPools` mock keys.

- [ ] **Step 3: Delete the tests of removed behaviour**

Run: `cd mobile && grep -rln "clozePrompt\|clozeAnswer\|clozeNudge\|clozeEnglish\|mcOptions\|inputMode: 'mc'\|incompleteAnswer\|feedbackKind\|Hint" src --include=*.test.ts --include=*.test.tsx`
In each file listed (expected: `components/review/ReviewCard.test.tsx`, `app/review/index.test.tsx`, `core/answer/reviewAnswerEvaluator.test.ts`, `core/srs/queueBuilder.test.ts`), delete the `it(…)` cases that set or assert those fields (cloze prompt rendering, MC options, hint ladder, near-miss "Not quite", `clozePrompt` pass-through). Keep every other case.

- [ ] **Step 4: Verify**

Run (from `mobile/`): `npm run typecheck && npm run lint && npx jest`
Expected: all clean and green. Then `grep -rn "cloze\|GrammarMcOptions\|ProgressiveHint\|hintLevels" src` prints nothing except unrelated words (inspect each hit).

- [ ] **Step 5: Commit**

```bash
git add -A mobile/src mobile/__mocks__
git commit -m "Remove grammar cloze, multiple choice and hint ladder"
```

---

### Task 12: Stop shipping cloze variants in the curriculum

**Files:**
- Modify: `curriculum/_build/generate.py`, `curriculum/_build/generate_content/test_generate_grammar_level.py`, `curriculum/schema/curriculum.schema.json`, `scripts/curriculum-schema.ts`, `scripts/compile-curriculum.ts`, `scripts/compile-curriculum.test.ts`, `scripts/validate-schema.ts`, `scripts/validate-schema.test.ts`, `docs/workflows/README.md`; script fixtures that still carry `cloze_variants`
- Delete: `curriculum/_build/generate_content/check_cloze.py`, `curriculum/_build/generate_content/promote_cloze.py`
- Content: regenerated `curriculum/grammar/n5.json`, `n4.json`; `curriculum/metadata.json`; `mobile/assets/curriculum-seed/`

The authoring source (`cloze_variants` keys in `_build/n5_grammar.py` / `n4_grammar.py`, the lesson lane's cloze candidates, `_cloze_derived_examples`) stays: it is input, not shipped, and every point now takes its pool from `pool.json`.

- [ ] **Step 1: Write the failing pipeline test**

In `test_generate_grammar_level.py`, replace `test_cloze_variants_still_ship` with:

```python
    def test_cloze_variants_do_not_ship(self):
        self.assertNotIn("cloze_variants", build([entry()]))
```

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level`
Expected: FAIL.

- [ ] **Step 2: Stop emitting them**

In `generate.py`, delete the `if g.get("cloze_variants"):` block in `_build_grammar_level` (it builds `variants` and sets `item["cloze_variants"]`), then delete `_cloze_furigana` and `CLOZE_BLANK` if `grep -n "_cloze_furigana\|CLOZE_BLANK" generate.py` shows no other use.

Run the full suite: `.venv/bin/python -m unittest` → PASS.

- [ ] **Step 3: Remove the cloze tools**

```bash
git rm curriculum/_build/generate_content/check_cloze.py curriculum/_build/generate_content/promote_cloze.py
grep -rn "check_cloze\|promote_cloze" curriculum docs scripts .github
```

Delete the cloze paragraph and its command lines in `docs/workflows/README.md` (the block starting "Grammar **cloze variants** have no lane of their own"), and fix any other hit the grep prints (a reference in an import or a doc line). Run `.venv/bin/python -m unittest` again → PASS.

- [ ] **Step 4: Drop the field from schema, compile and validate**

- `curriculum/schema/curriculum.schema.json`: delete the `grammarClozeVariant` definition and the `cloze_variants` property of `grammarItem`.
- `scripts/curriculum-schema.ts`: delete `CREATE TABLE grammar_cloze_variants (…);` and `CREATE INDEX idx_grammar_cloze_variants_item …;`.
- `scripts/compile-curriculum.ts`: delete the `GrammarClozeVariant` type, the `cloze_variants?` field, the `INSERT INTO grammar_cloze_variants` statement and the loop that runs it.
- `scripts/compile-curriculum.test.ts`: in `'compiles fixture JSON to sqlite with metadata and relationships'`, replace the `const variant = …` query and its four `expect`s with:

```ts
      const clozeTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'grammar_cloze_variants'")
        .get();
      expect(clozeTable).toBeUndefined();
```

  and change the comment above to `// Plan 09: family lands on grammar_rules.`
- `scripts/validate-schema.ts`: delete `runClozeVariantChecks`, its call, `CLOZE_BLANK_RE` if unused, and the `cloze_variants?` field in the inline grammar type.
- `scripts/validate-schema.test.ts`: delete the three cloze-variant tests (`'accepts a consistent variant'`, `'errors when the variant answer is not an accepted form'`, `'rejects a jp_cloze without a blank via the schema'`) and their `describe` if it becomes empty.
- Fixtures: `grep -rln "cloze_variants" scripts curriculum/schema` and delete the `cloze_variants` arrays it finds in fixture JSON.

Run (repo root): `npx jest --config jest.config.cjs scripts/` → PASS.

- [ ] **Step 5: Regenerate and compile**

```bash
cd curriculum/_build && .venv/bin/python generate.py --level n5 && .venv/bin/python generate.py --level n4 && cd ../..
grep -c cloze_variants curriculum/grammar/n5.json curriculum/grammar/n4.json   # expect 0 and 0
npm run validate-schema && npm run compile-curriculum
```

Expected: both levels generate (the pool gate still passes), validate passes, compile writes a new `curriculum.db` and bumps `metadata.json`.

- [ ] **Step 6: Commit**

```bash
git add -A curriculum/_build curriculum/grammar curriculum/schema curriculum/metadata.json scripts docs/workflows/README.md mobile/assets/curriculum-seed
git commit -m "Curriculum: stop shipping grammar cloze variants"
```

---

### Task 13: Docs and the simulator check

**Files:**
- Modify: `docs/working-history.md`, `docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` (Status line)

- [ ] **Step 1: Full verification**

Run (from `mobile/`): `npm run typecheck && npm run lint && npx jest`. Repo root: `npm run check-contrast && npx jest --config jest.config.cjs scripts/`. Python: `cd curriculum/_build && .venv/bin/python -m unittest`. All must pass; paste the summary lines into the final report.

- [ ] **Step 2: Update the docs**

- Spec line 4: `**Status:** Plans 1–3 done`.
- `docs/working-history.md`: set the grammar Read + Build row to Done with today's date and this plan's path, and update the At-a-glance counts the same way earlier rows were updated.

- [ ] **Step 3: Commit**

```bash
git add docs/working-history.md docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md
git commit -m "Grammar Read + Build cards: docs"
```

- [ ] **Step 4: Hand the simulator checklist to the user (do not mark done yourself)**

Report these manual checks (spec §6) for the user to run on a simulator:
1. A due grammar point shows `Grammar · Read`, then (≥ 2 cards later) `Grammar · Build` with a different sentence.
2. Read: tap a word → detail page → back: the typed text is still in the field. The highlighted grammar does nothing before answering and opens the grammar point after.
3. Build: a started word in the list is plain text before answering; an unstarted word opens its detail page. After answering, every word links and the correct sentence shows.
4. Build: type a same-family form (e.g. ので for から) → the nudge shows, the text stays, nothing is graded.
5. Build: type a correct-but-different sentence → Incorrect → `My answer is correct too` → Correct; Continue advances.
6. Next review of that point uses two other sentences; typing the saved answer on that sentence later is graded correct.
7. Settings → back up, then restore: both new tables round-trip.

---

## Self-review notes

- Spec coverage: D1 (Task 6 pair), D2 (Task 10 meaning path + synonym), D3 (Tasks 1, 10), D4 (Tasks 3, 6, 10), D5/D7 (Tasks 10–11), D6 (Tasks 1, 10), D8–D10 (Plans 1–2; pool read in Task 5), D9 (Tasks 2, 6, 7), D11/D12 (Tasks 2, 8, 9); §5.1 data (Tasks 3–5, 12), §5.4 UI (Tasks 8–10), §5.5 removals (Task 11), §6 tests (each task; manual list in Task 13).
- Sentence identity follows the corrected spec §5.1 (text key, not compile id).
</content>
</invoke>
