---
baseline_commit: 7cd29eb2c768d861f6477c69fb7cd37aee044ab8
---

# Story 4.4: Reading passages with comprehension prompts

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **JLPT-tagged reading passages with questions**,
so that **I can practice comprehension in context (FR8b, FR8c)**.

## Acceptance Criteria

1. **Read tab passage list by JLPT level (FR8b, FR8c)**

   **Given** bundled `curriculum.db` with N5 reading passages (4 rows in `reading_passages`, each with ≥1 row in `passage_questions`)  
   **When** I open the **Read** tab  
   **Then** the Epic 1 `TabPlaceholderScreen` placeholder is replaced with a **JLPT passage list hub**  
   **And** I can select a JLPT level (N5→N1) via `JlptLevelPicker`  
   **And** the picker defaults to my `starting_jlpt_level` from `user.db` when set (onboarding), else **N5**  
   **And** for the selected level I see a scrollable list of passages (`title`, optional question count) loaded from `curriculum.db` via `listPassagesByLevel`  
   **And** passages are ordered by `sort_order` ascending  
   **And** tapping a row navigates to `/read/[id]` for that passage  
   **And** empty state copy appears when a level has zero passages (e.g. N4–N1 not yet seeded) — never a blank screen

2. **Passage reader with comprehension prompts (FR8b)**

   **Given** a valid `reading_passages.id`  
   **When** I open `/read/[id]`  
   **Then** the screen shows:
   - **Title** — passage `title` at `text-title` size
   - **Body** — full Japanese `body` at `text-body-lg` (readable at arm's length per UX typography)
   - **Comprehension questions** — each `passage_questions` row rendered in `sort_order` with `prompt` text and a text input + submit affordance
   **And** a **Back** affordance returns to the passage list (`router.back()`, `read-passage-back` testID)  
   **And** invalid or unknown `id` shows error copy with Back — never a blank screen or crash  
   **And** queries complete within architecture **<100ms** budget (indexed PK / FK lookups on N5 seed)

3. **Answer validation and immediate feedback**

   **Given** a comprehension question with `accepted_answers` stored as JSON TEXT in `passage_questions`  
   **When** I submit an answer  
   **Then** the answer is evaluated via a **pure** `evaluatePassageAnswer(userAnswer, acceptedAnswers)` function in `core/answer/` (trim whitespace; exact match against any accepted form; ASCII answers compared case-insensitively)  
   **And** correct → `feedback-correct` styling + brief confirmation (accepted answer shown)  
   **And** incorrect → `feedback-incorrect` styling + show primary accepted answer(s)  
   **And** evaluation is synchronous and returns within **<100ms** (no network, no async I/O on submit path)  
   **And** **defer** Levenshtein typo tolerance and WanaKana romaji conversion to Epic 5 shared `readingEvaluator` / `meaningEvaluator` — do not duplicate full review-loop evaluators in this story

4. **Minimal practice result persistence in user.db**

   **Given** I answer a comprehension question  
   **When** evaluation completes  
   **Then** the result is written to `user.db` via migration `004_passage_practice_results`:
   ```sql
   CREATE TABLE passage_practice_results (
     passage_id INTEGER NOT NULL,
     question_id INTEGER NOT NULL,
     is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
     user_answer TEXT NOT NULL,
     answered_at TEXT NOT NULL,
     PRIMARY KEY (passage_id, question_id)
   );
   ```
   **And** re-answering the same question **upserts** (replaces prior row for that passage+question pair)  
   **And** on revisit, previously answered questions show their last result state (correct/incorrect indicator) without requiring re-submission  
   **And** curriculum.db is **never** written — practice state lives only in `user.db` (NFR10)

5. **JLPT content alignment (FR8c — content constraint)**

   **Given** N5 seed passages in `curriculum/readings/n5.json`  
   **When** this story ships  
   **Then** bundled passages are tagged `jlpt_level = 'N5'` and use vocabulary/grammar appropriate to N5 (verified by existing seed — no dynamic content filtering UI required)  
   **And** list queries filter `WHERE jlpt_level = ?` so future N4+ passage files compile into separate level rows automatically

6. **Navigation, layout, and accessibility**

   **Given** the Read tab stack (mirror Learn tab pattern from Stories 4.1–4.3)  
   **When** nested read routes are added  
   **Then** convert `(tabs)/read.tsx` → `(tabs)/read/_layout.tsx` + `(tabs)/read/index.tsx` + `(tabs)/read/[id].tsx`  
   **And** register `index` and `[id]` screens in the Read tab Stack (`headerShown: false`)  
   **And** drill-down depth stays ≤ 2: tab hub → passage reader  
   **And** layout uses `SafeAreaView`, `MaxContentWidth`, `BottomTabInset`, NativeWind tokens, 44px touch targets on Back, list rows, and submit buttons  
   **And** passage list rows use `content-reading` accent token where type badges are shown (UX content-type accent table)  
   **And** screen reader: list announces passage title; question prompt announced before input; result announced on submit

7. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** `passageRepository.test.ts` covers `listPassagesByLevel`, `getPassageById`, `getPassageQuestions`  
   **And** `passagePracticeRepository.test.ts` covers upsert + read-back  
   **And** `evaluatePassageAnswer.test.ts` covers exact match, trim, case-insensitive ASCII, multiple accepted forms  
   **And** screen tests cover: Read hub renders N5 passages; navigation to reader; question submit shows correct/incorrect feedback; persistence restores state on remount  
   **And** existing Learn tab tests (Stories 4.1–4.3) remain green

## Tasks / Subtasks

- [x] **AC1 — Replace Read tab placeholder with passage list hub**
  - [x] Delete `mobile/src/app/(tabs)/read.tsx`
  - [x] Create `mobile/src/app/(tabs)/read/_layout.tsx` (Stack, `headerShown: false`)
  - [x] Create `mobile/src/app/(tabs)/read/index.tsx` — `JlptLevelPicker`, `FlatList` of passages, default level from `getStartingJlptLevel`
  - [x] Create `mobile/src/components/read/PassageListRow.tsx` — title, optional question count, 44px touch target
  - [x] Create `mobile/src/data/hooks/usePassagesByLevel.ts`

- [x] **AC2 — Passage reader screen**
  - [x] Create `mobile/src/app/(tabs)/read/[id].tsx` — title, body, questions section
  - [x] Create `mobile/src/components/read/PassageReader.tsx` — layout wrapper for body + questions
  - [x] Create `mobile/src/components/read/PassageQuestion.tsx` — prompt, `TextInput`, submit, result state
  - [x] Create `mobile/src/data/hooks/usePassageDetail.ts` — passage + questions + practice results

- [x] **AC3 — Data layer (curriculum.db)**
  - [x] Create `mobile/src/data/curriculum/passageRepository.ts` with types + queries (see Dev Notes)
  - [x] Create `mobile/src/data/curriculum/passageRepository.test.ts`
  - [x] Extend `mobile/__mocks__/expo-sqlite.ts` with `reading_passages` + `passage_questions` table support

- [x] **AC4 — Answer evaluation (core/)**
  - [x] Create `mobile/src/core/answer/evaluatePassageAnswer.ts` + test
  - [x] Create `mobile/src/core/answer/answer.types.ts` if not exists — reuse `AnswerResult` shape (`'correct' | 'incorrect'` only for this story)

- [x] **AC5 — Practice persistence (user.db)**
  - [x] Create `mobile/src/data/migrations/004_passage_practice_results.ts`
  - [x] Register in `mobile/src/data/migrations/index.ts`
  - [x] Create `mobile/src/data/user/passagePracticeRepository.ts` + test

- [x] **AC6 — Tests**
  - [x] `read/index.test.tsx` — hub list, level filter, navigation
  - [x] `read/[id].test.tsx` — reader render, submit feedback, persisted state
  - [x] Run full CI: `npm run lint && npm run typecheck && npm test`

## Dev Notes

### Epic context (Epic 4)

Epic 4 delivers structured curriculum browsing outside the review loop. Stories 4.1–4.3 shipped the Learn tab (hub, per-type lists, item detail screens). **This story (4.4)** adds the **Read tab** — a separate route family for JLPT-tagged passages with comprehension practice.

| Story | Scope | Relationship to 4.4 |
| --- | --- | --- |
| 4.1 | JLPT Learn hub + per-type lists | Pattern reference for hub + level picker |
| 4.2 | Radical detail + mnemonic image | Established nested tab stack pattern |
| 4.3 | Kanji/vocab/grammar detail | Item detail on Learn — passages are **not** items |
| **4.4** | **Reading passages + comprehension** | New Read tab stack, `passageRepository` |
| 4.5 | Dependency graph unlock visibility | Deferred — no lock badges on passages |
| 4.6 | Personal mnemonics editor | Deferred |

### Current state — what exists vs what to build

**Already implemented (reuse, do not rebuild):**

| Asset | Location | Reuse for 4.4 |
| --- | --- | --- |
| `reading_passages` + `passage_questions` DDL | `scripts/curriculum-schema.ts` | Schema already compiled into seed DB |
| N5 passage seed data | `curriculum/readings/n5.json` | 4 passages, 1 question each |
| Compile pipeline | `scripts/compile-curriculum.ts` | Inserts passages + questions — **no changes needed** |
| `JlptLevelPicker` | `components/common/JlptLevelPicker.tsx` | Level selection on Read hub |
| `getStartingJlptLevel` | `data/user/preferencesRepository.ts` | Default Read hub level |
| `useDatabase` | `data/hooks/useDatabase.ts` | `curriculumDb` + `userDb` handles |
| Learn tab stack pattern | `(tabs)/learn/_layout.tsx` | Mirror for Read tab |
| `TabPlaceholderScreen` | `components/common/TabPlaceholderScreen.tsx` | **Remove** from Read tab |
| Theme tokens | `tailwind.config.js` | `content-reading`, `feedback-correct/incorrect`, typography scale |
| Migration runner | `data/migrations/migrationRunner.ts` | Add migration 004 |

**Gaps this story must fill:**

1. Read tab is a placeholder (`TabPlaceholderScreen`) — no passage UI
2. No `passageRepository.ts` — cannot query passages
3. No Read tab nested routes (`read/_layout`, `read/[id]`)
4. No passage reader components
5. No answer evaluation for comprehension questions
6. No `user.db` table for practice results
7. expo-sqlite mock lacks `reading_passages` / `passage_questions` tables

### Database schema reference (curriculum.db)

```sql
-- reading_passages
id INTEGER PRIMARY KEY
jlpt_level TEXT NOT NULL          -- e.g. 'N5'
title TEXT NOT NULL
body TEXT NOT NULL                 -- full Japanese passage text
sort_order INTEGER NOT NULL DEFAULT 0

-- passage_questions
id INTEGER PRIMARY KEY
passage_id INTEGER NOT NULL REFERENCES reading_passages(id)
prompt TEXT NOT NULL               -- question in Japanese
accepted_answers TEXT NOT NULL     -- JSON array, e.g. '["学生","がくせい"]'
sort_order INTEGER NOT NULL DEFAULT 0
```

**Seed data observations (`curriculum/readings/n5.json`):**
- 4 passages: 自己紹介, 買い物, 学校, 時間
- Each has 1 comprehension question
- Accepted answers include both kanji and hiragana forms
- All tagged N5; vocabulary aligns with N5 items in seed (学生, 本, 水, 学校, 先生, 朝, etc.)

### Recommended repository additions

```ts
// mobile/src/data/curriculum/passageRepository.ts

export type PassageListItem = {
  id: string;
  title: string;
  jlptLevel: JLPTLevel;
  sortOrder: number;
  questionCount: number;
};

export type PassageDetail = {
  id: string;
  title: string;
  body: string;
  jlptLevel: JLPTLevel;
  sortOrder: number;
};

export type PassageQuestion = {
  id: string;
  passageId: string;
  prompt: string;
  acceptedAnswers: string[];
  sortOrder: number;
};

export function listPassagesByLevel(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
): PassageListItem[] {
  const rows = db.getAllSync<PassageListRow>(
    `SELECT rp.id, rp.title, rp.jlpt_level, rp.sort_order,
            (SELECT COUNT(*) FROM passage_questions pq WHERE pq.passage_id = rp.id) AS question_count
     FROM reading_passages rp
     WHERE rp.jlpt_level = ?
     ORDER BY rp.sort_order ASC`,
    jlptLevel,
  );
  return rows.map(mapPassageListRow);
}

export function getPassageById(db: SQLiteDatabase, id: string): PassageDetail | null {
  const row = db.getFirstSync<PassageDetailRow>(
    `SELECT id, title, body, jlpt_level, sort_order FROM reading_passages WHERE id = ?`,
    Number(id),
  );
  return row ? mapPassageDetailRow(row) : null;
}

export function getPassageQuestions(db: SQLiteDatabase, passageId: string): PassageQuestion[] {
  const rows = db.getAllSync<PassageQuestionRow>(
    `SELECT id, passage_id, prompt, accepted_answers, sort_order
     FROM passage_questions WHERE passage_id = ? ORDER BY sort_order ASC`,
    Number(passageId),
  );
  return rows.map((row) => ({
    id: String(row.id),
    passageId: String(row.passage_id),
    prompt: row.prompt,
    acceptedAnswers: JSON.parse(row.accepted_answers) as string[],
    sortOrder: row.sort_order,
  }));
}
```

```ts
// mobile/src/core/answer/evaluatePassageAnswer.ts

export type PassageAnswerResult = 'correct' | 'incorrect';

export function evaluatePassageAnswer(
  userAnswer: string,
  acceptedAnswers: string[],
): PassageAnswerResult {
  const normalized = userAnswer.trim();
  if (!normalized) return 'incorrect';

  for (const accepted of acceptedAnswers) {
    const trimmed = accepted.trim();
    if (!trimmed) continue;
    // Exact match for Japanese; case-insensitive for ASCII/romaji entries
    if (normalized === trimmed) return 'correct';
    if (/^[\x00-\x7F]+$/.test(trimmed) && normalized.toLowerCase() === trimmed.toLowerCase()) {
      return 'correct';
    }
  }
  return 'incorrect';
}
```

```ts
// mobile/src/data/user/passagePracticeRepository.ts

export type PassagePracticeResult = {
  passageId: string;
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  answeredAt: string;
};

export function upsertPassagePracticeResult(
  userDb: SQLiteDatabase,
  result: Omit<PassagePracticeResult, 'answeredAt'> & { answeredAt?: string },
): void { /* INSERT OR REPLACE */ }

export function getPassagePracticeResults(
  userDb: SQLiteDatabase,
  passageId: string,
): PassagePracticeResult[] { /* SELECT by passage_id */ }
```

### Technical requirements (must follow)

- **Monorepo path:** All code under `mobile/`.
- **Dual-DB separation:** Passage content from `curriculumDb` only; practice results in `userDb` only. Never write to `curriculum.db`.
- **Data layer:** Repository functions in `data/curriculum/passageRepository.ts` and `data/user/passagePracticeRepository.ts`; sync `getFirstSync` / `getAllSync`; snake_case → camelCase mapping; **no React in repositories**.
- **Core layer:** `evaluatePassageAnswer` in `core/answer/` — **zero React/RN imports**.
- **JSON parsing:** `accepted_answers` parsed in repository mapper, not in components.
- **Hooks:** Thin wrappers in `data/hooks/` using `useDatabase()`.
- **Named exports** for components/hooks; **default export** for route files.
- **Token-only styling:** NativeWind classes; `content-reading` for Read accents; `text-body-lg` for passage body.
- **FlatList** for passage list (virtualization, same as Learn level lists).
- **Route conversion:** Delete standalone `(tabs)/read.tsx` before adding `(tabs)/read/` folder — Expo Router conflicts if both exist.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| `passageRepository.ts` | New file per architecture tree |
| Read tab routes | `(tabs)/read/index.tsx` + `(tabs)/read/[id].tsx` (architecture shows `read.tsx` at tabs level — **follow Learn tab nested stack**, not root-level `app/read/`) |
| Dual-DB separation | curriculum reads + user writes for practice |
| FR8b Pre-seeded passages + questions | Seed data + reader UI |
| FR8c JLPT-aligned content | `jlpt_level` filter + verified N5 seed |
| NFR2 <100ms | PK/FK indexed queries; sync evaluation |
| NFR10 Progress survives curriculum swap | Practice in `user.db` only |
| Epic 5 evaluators | Defer `readingEvaluator`/`meaningEvaluator`/`WanaKanaInput` — build minimal passage evaluator only |

### File structure guidance

**Create:**

| Path | Purpose |
| --- | --- |
| `mobile/src/app/(tabs)/read/_layout.tsx` | Read tab Stack navigator |
| `mobile/src/app/(tabs)/read/index.tsx` | JLPT passage list hub |
| `mobile/src/app/(tabs)/read/[id].tsx` | Passage reader route |
| `mobile/src/data/curriculum/passageRepository.ts` | Passage + question queries |
| `mobile/src/data/curriculum/passageRepository.test.ts` | Repository tests |
| `mobile/src/data/user/passagePracticeRepository.ts` | Practice result upsert/read |
| `mobile/src/data/user/passagePracticeRepository.test.ts` | Practice persistence tests |
| `mobile/src/data/migrations/004_passage_practice_results.ts` | user.db migration |
| `mobile/src/data/hooks/usePassagesByLevel.ts` | Hub list hook |
| `mobile/src/data/hooks/usePassageDetail.ts` | Reader hook (passage + questions + practice) |
| `mobile/src/core/answer/evaluatePassageAnswer.ts` | Pure answer evaluation |
| `mobile/src/core/answer/evaluatePassageAnswer.test.ts` | Evaluator tests |
| `mobile/src/components/read/PassageListRow.tsx` | List row component |
| `mobile/src/components/read/PassageReader.tsx` | Reader layout |
| `mobile/src/components/read/PassageQuestion.tsx` | Question prompt + input + feedback |
| `mobile/src/app/(tabs)/read/index.test.tsx` | Hub screen tests |
| `mobile/src/app/(tabs)/read/[id].test.tsx` | Reader screen tests |

**Modify:**

| Path | Change |
| --- | --- |
| `mobile/src/data/migrations/index.ts` | Register migration 004 |
| `mobile/__mocks__/expo-sqlite.ts` | Add `reading_passages`, `passage_questions`, `passage_practice_results` mock support |

**Delete:**

| Path | Reason |
| --- | --- |
| `mobile/src/app/(tabs)/read.tsx` | Replaced by `read/index.tsx` + `_layout.tsx` |

**Do NOT create/modify in 4.4:**

| Path | Deferred to |
| --- | --- |
| `core/answer/levenshtein.ts`, `readingEvaluator.ts`, `meaningEvaluator.ts` | Epic 5 (Story 5.3) |
| `components/review/WanaKanaInput.tsx` | Epic 5 — use plain `TextInput` for passage answers |
| `components/review/ReinforcementHighlight.tsx` | Epic 5/6 — known-vocab highlighting in passage body |
| `core/content/reinforcementResolver.ts` | Epic 5/6 — FR12 visible reinforcement |
| `core/content/dependencyGraph.ts` | Story 4.5 |
| Passage lock/unlock by dependency graph | Story 4.5 |
| AI-generated reading stories | Epic 8 |
| Time compression / session summary for reading | Epic 6 |
| Weakness stats from passage errors | Epic 6 |

### UX references (must follow)

- **Content-type accent:** Reading uses `content-reading` (`#EEAA22` amber) per UX token table.
- **Typography:** Passage body `text-body-lg text-primary`; title `text-title text-primary`; question prompts `text-body-lg`; feedback uses `feedback-correct` / `feedback-incorrect`.
- **Drill-down:** Tab hub → passage reader, max depth 2; Back returns to list.
- **Touch targets:** 44px minimum on list rows, Back, and submit buttons.
- **Empty states:** "No reading passages at {level} yet." — mirror Learn empty copy pattern.
- **Offline:** Fully offline after seed bundle — no network calls (FR47).
- **Answer clarity:** Show question prompt clearly above input; after submit, show whether answer was correct and display accepted answer on incorrect (UX "Confidence vs. Confusion" principle applied to comprehension).

### Previous story intelligence (4.3)

**Critical learnings from Story 4.3 implementation:**

1. **Nested tab stacks work** — Learn uses `(tabs)/learn/_layout.tsx` with `index`, `[level]`, `item/[id]`. Mirror exactly for Read.
2. **Back button pattern** — `learn-item-back` testID, Pressable with `min-h-[44px]`, `router.back()`. Use `read-passage-back` for Read.
3. **Layout shell** — `SafeAreaView` + `MaxContentWidth` + `BottomTabInset` applied in route file; child components render content only.
4. **`useItemDetail` stale-flash fix** — when `id` param changes, reset state before loading. Apply same pattern in `usePassageDetail`.
5. **expo-sqlite mock** — extend with table-specific query handlers + `__mockSet*` helpers (see `__mockSetKanjiReadings` pattern).
6. **JSON.parse in repository** — grammar rules pattern applies to `accepted_answers` on questions.
7. **Review patches from 4.3** — ensure Pressables have 44px min dimensions; screen tests assert full rendered content, not just presence.

### Design decisions for developer

**Why minimal `evaluatePassageAnswer` instead of Epic 5 evaluators:**
Epic 5 Story 5.3 builds `readingEvaluator`, `meaningEvaluator`, `levenshtein.ts`, and `WanaKanaInput` as part of the review loop. Passage questions accept kanji or hiragana strings — exact match after trim is sufficient for N5 seed. Wire passage submit to call `evaluatePassageAnswer` now; refactor to shared evaluators in Epic 5 when they exist (same function signature swap).

**Why `passage_practice_results` table (not session-only):**
Epic AC explicitly requires storing practice results in `user.db`. Minimal upsert per question lets learners see prior attempts on revisit without building full SRS integration. Do not add FSRS fields — passages are practice, not review items.

**Why no reinforcement highlighting in passage body:**
PRD describes "known kanji highlighted" in reading passages (FR12 / visible reinforcement), but Story 4.4 AC does not include it. `ReinforcementHighlight` and `reinforcementResolver` are Epic 5–6 scope. Ship plain passage text now; highlighting is a follow-up once relationship layer exists.

**Route location note:**
Architecture diagram shows `src/app/read/[id].tsx` at root and `(tabs)/read.tsx` at tabs. **Actual codebase convention (Stories 4.1–4.3):** nested stacks live under `(tabs)/learn/`. Place Read routes at `(tabs)/read/` — do not add root-level `app/read/` stack (would hide tab bar inconsistently).

**Question input:**
Use standard `TextInput` with `autoCapitalize="none"`, `autoCorrect={false}`. Japanese IME handles kanji/hiragana entry. Do not import OS Japanese keyboard switching logic.

### Git intelligence summary

Latest commits:
- `7cd29eb` — Story 4.3: kanji/vocabulary/grammar detail screens, enriched `useItemDetail`, five new repository queries
- `f49198d` — Story 4.2: radical detail, `getItemById`, `item/[id]` route
- `3ec6801` — Story 4.1: JLPT Learn hub, per-type lists, nested learn stack

Build on Learn tab patterns. Passage work is parallel route family — no changes to `itemRepository.ts` or item detail screens unless fixing unrelated regressions.

### Scope boundaries

**In scope:**
- Read tab passage list filtered by JLPT level
- Passage reader with body text + comprehension questions
- Answer submit with immediate correct/incorrect feedback
- Minimal practice result persistence in `user.db`
- `passageRepository` + hooks + components + tests
- Migration 004 for practice results

**Out of scope (defer):**
- Known vocabulary highlighting in passage body (Epic 5/6, FR12)
- WanaKana romaji input / Levenshtein typo tolerance (Epic 5)
- Passage lock/unlock by dependency graph (Story 4.5)
- SRS scheduling for passages
- Weakness tracking from passage errors (Epic 6)
- Reading count on Home / time compression summary (Epic 6)
- Tappable vocabulary words in passage body → item detail
- Multi-question pagination / "next question" animation — show all questions in scroll view
- Furigana / ruby text rendering

### Latest tech information

- **Expo SDK 55** + **expo-router** — nested tab stacks under `(tabs)/{tabName}/` established in 4.1–4.3.
- **expo-sqlite** sync API — same patterns as `itemRepository.ts`.
- **No new npm dependencies** — `fast-levenshtein` exists transitively but defer usage to Epic 5.
- **JSON.parse** — safe for `accepted_answers` since `compile-curriculum` validates schema integrity.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.4 AC]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR8b, FR8c, reading passage MVP]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — passageRepository, read routes, dual-DB, answer evaluators]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — content-reading token, typography, empty states, offline]
- [Source: `scripts/curriculum-schema.ts` — `reading_passages`, `passage_questions` DDL]
- [Source: `curriculum/readings/n5.json` — N5 passage seed data]
- [Source: `scripts/compile-curriculum.ts` — passage insert logic]
- [Source: `mobile/src/app/(tabs)/read.tsx` — current placeholder to replace]
- [Source: `mobile/src/app/(tabs)/learn/_layout.tsx` — stack pattern to mirror]
- [Source: `mobile/src/app/(tabs)/learn/index.tsx` — hub + level picker pattern]
- [Source: `mobile/src/app/(tabs)/learn/item/[id].tsx` — detail route layout pattern]
- [Source: `_bmad-output/implementation-artifacts/4-3-item-detail-screens-kanji-vocabulary-grammar.md` — previous story patterns]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Fixed expo-sqlite mock: `reading_passages` list query handler must run before `passage_questions` (subquery in `listPassagesByLevel` was matching the wrong handler).
- Updated `database.test.ts` migration count expectation from 3 → 4 for migration 004.

### Completion Notes List

- Replaced Read tab placeholder with nested stack (`read/_layout`, `index`, `[id]`) mirroring Learn tab pattern.
- Added `passageRepository` for curriculum.db reads (`listPassagesByLevel`, `getPassageById`, `getPassageQuestions`).
- Added pure `evaluatePassageAnswer` in `core/answer/` with trim, exact match, and case-insensitive ASCII.
- Added migration 004 + `passagePracticeRepository` for upsert/read of practice results in user.db only.
- Passage reader shows body + all comprehension questions with immediate correct/incorrect feedback and persisted state on revisit.
- Full CI green: lint, typecheck, 299 tests (51 suites).

### File List

**Created:**
- mobile/src/app/(tabs)/read/_layout.tsx
- mobile/src/app/(tabs)/read/index.tsx
- mobile/src/app/(tabs)/read/[id].tsx
- mobile/src/app/(tabs)/read/index.test.tsx
- mobile/src/app/(tabs)/read/[id].test.tsx
- mobile/src/components/read/PassageListRow.tsx
- mobile/src/components/read/PassageReader.tsx
- mobile/src/components/read/PassageQuestion.tsx
- mobile/src/core/answer/answer.types.ts
- mobile/src/core/answer/evaluatePassageAnswer.ts
- mobile/src/core/answer/evaluatePassageAnswer.test.ts
- mobile/src/data/curriculum/passageRepository.ts
- mobile/src/data/curriculum/passageRepository.test.ts
- mobile/src/data/hooks/usePassagesByLevel.ts
- mobile/src/data/hooks/usePassageDetail.ts
- mobile/src/data/migrations/004_passage_practice_results.ts
- mobile/src/data/user/passagePracticeRepository.ts
- mobile/src/data/user/passagePracticeRepository.test.ts

**Modified:**
- mobile/__mocks__/expo-sqlite.ts
- mobile/src/data/database.test.ts
- mobile/src/data/migrations/index.ts

**Deleted:**
- mobile/src/app/(tabs)/read.tsx

### Change Log

- 2026-06-25: Story 4.4 — Read tab passage list hub, passage reader with comprehension prompts, answer evaluation, and user.db practice persistence.
- 2026-06-25: Code review — applied patches (FlatList flex-1, a11y input label, empty-submit guard, all accepted answers in feedback); one-shot answer UX confirmed.

### Review Findings

- [x] [Review][Decision] No UI path to re-answer after first submit — resolved: one-shot answers (first attempt is final; upsert reserved for programmatic/future use)

- [x] [Review][Patch] Read hub FlatList missing `flex-1` [mobile/src/app/(tabs)/read/index.tsx:47]
- [x] [Review][Patch] Question prompt not linked for screen readers [mobile/src/components/read/PassageQuestion.tsx:73]
- [x] [Review][Patch] Empty answers can be submitted and persisted [mobile/src/components/read/PassageQuestion.tsx:41]
- [x] [Review][Patch] Incorrect feedback shows only first accepted form [mobile/src/components/read/PassageQuestion.tsx:109]

- [x] [Review][Defer] `useLocalSearchParams` id may be `string[]` [mobile/src/app/(tabs)/read/[id].tsx:12] — deferred, pre-existing (same pattern as Learn item route)
- [x] [Review][Defer] `JSON.parse` on `accepted_answers` has no try/catch [mobile/src/data/curriculum/passageRepository.ts:106] — deferred, pre-existing (compile-time validated seed; matches grammar rules pattern)
