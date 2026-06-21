---
baseline_commit: 253403c82ae9651a742d7b265b43e4df056323cb
---

# Story 4.3: Item detail screens — kanji, vocabulary, and grammar

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **rich detail screens for kanji (readings, meanings, synonyms, mnemonics), vocabulary (contextual usage, examples), and grammar (structured rules, accepted forms, example sentences)**,
so that **I can study all content types in depth outside reviews (FR5, FR6, FR6c, FR7, FR27)**.

## Acceptance Criteria

1. **Kanji detail screen (FR5, FR27, UX-DR34)**

   **Given** a kanji item in `curriculum.db`  
   **When** I view the detail screen at `/learn/item/[id]`  
   **Then** the screen shows:
   - **Kanji glyph** — `primary_form` at `text-display` size
   - **Meaning** — primary meaning as label text
   - **Synonym meanings** — additional `accepted_answers` where `answer_type = 'meaning'` and `is_primary = 0`
   - **Onyomi readings** — from `kanji_readings` where `reading_type = 'onyomi'`, clearly labeled "On'yomi"
   - **Kunyomi readings** — from `kanji_readings` where `reading_type = 'kunyomi'`, clearly labeled "Kun'yomi"
   - **Text mnemonic** — `mnemonic_text` when present
   **And** readings are labeled distinctly with section headings to prevent reading-vs-meaning confusion (UX-DR34)  
   **And** query completes within architecture <100ms budget (indexed PK + FK lookups)

2. **Vocabulary detail screen (FR7, FR27)**

   **Given** a vocabulary item with contextual gloss and linked example sentences  
   **When** I view the detail screen  
   **Then** the screen shows:
   - **Word form** — `primary_form` at `text-display` size (or `text-title-lg` for longer words)
   - **Meaning** — primary meaning text
   - **Synonym meanings** — additional `accepted_answers` where `answer_type = 'meaning'` and `is_primary = 0`
   - **Text mnemonic** — `mnemonic_text` when present
   - **Example sentences** — from `example_sentences` table, rendered as Japanese + English pairs
   - **Grammar cross-links** — when `grammar_vocabulary_links` rows exist, show linked grammar point names as tappable links to their detail  
   **And** contextual meaning and at least one example render when present in seed data  
   **And** grammar cross-links navigate to `/learn/item/[grammarItemId]`

3. **Grammar detail screen (FR6, FR6c, FR27)**

   **Given** a grammar point with `grammar_rules` row (structure, accepted_forms, conjugation_rules)  
   **When** I view the grammar detail screen  
   **Then** the screen shows:
   - **Grammar pattern** — `primary_form` (e.g. "です") at `text-title-lg` size with `font-mono`
   - **Meaning** — meaning text
   - **Structure** — `grammar_rules.structure` field (e.g. "Noun + です")
   - **Accepted forms** — parsed JSON array displayed as a list
   - **Conjugation rules** — parsed JSON object displayed in a readable format
   - **Example sentences** — ≥5 sentences from `example_sentences` when data provides them (FR6c), rendered as Japanese + English pairs
   - **Text mnemonic** — `mnemonic_text` when present  
   **And** conjugation rules are exposed through the same data path that Epic 5 imports for validation (shared query, no duplication)

4. **List row navigation for kanji, vocabulary, and grammar (FR1, FR2, FR3)**

   **Given** the Learn level list at `/learn/[level]`  
   **When** I tap a kanji, vocabulary, or grammar row  
   **Then** the app navigates to `/learn/item/[id]` for that item  
   **And** the detail screen renders the correct type-specific view  
   **And** the `LearnItemRow` `onPress` handler is wired for all item types (not just radicals)

5. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass in `mobile/`  
   **And** new repository functions have unit tests (`getKanjiReadings`, `getAcceptedAnswers`, `getGrammarRule`, `getExampleSentences`, `getGrammarVocabLinks`)  
   **And** screen tests cover: kanji detail with readings; vocabulary detail with examples; grammar detail with structure/forms/sentences  
   **And** level list navigation tests verify all item types navigate to detail  
   **And** existing Learn hub/level/item tests (Stories 4.1, 4.2) remain green

## Tasks / Subtasks

- [x] **AC1 — Kanji detail component and data layer**
  - [x] Add `KanjiReading` type and `getKanjiReadings(db, itemId): KanjiReading[]` to `itemRepository.ts`
  - [x] Add `AcceptedAnswer` type and `getAcceptedAnswers(db, itemId): AcceptedAnswer[]` to `itemRepository.ts`
  - [x] Create `mobile/src/components/learn/KanjiDetail.tsx` — glyph, meaning, synonyms, onyomi/kunyomi sections, mnemonic text
  - [x] Add `useKanjiDetail` hook (or extend `useItemDetail`) to fetch readings + answers alongside base item

- [x] **AC2 — Vocabulary detail component and data layer**
  - [x] Add `ExampleSentence` type and `getExampleSentences(db, itemId): ExampleSentence[]` to `itemRepository.ts`
  - [x] Add `GrammarVocabLink` type and `getGrammarLinksForVocab(db, vocabItemId): GrammarVocabLink[]` to `itemRepository.ts`
  - [x] Create `mobile/src/components/learn/VocabularyDetail.tsx` — word, meaning, synonyms, mnemonic, examples, grammar cross-links
  - [x] Wire grammar cross-links as tappable Pressables navigating to `/learn/item/[id]`

- [x] **AC3 — Grammar detail component and data layer**
  - [x] Add `GrammarRule` type and `getGrammarRule(db, itemId): GrammarRule | null` to `itemRepository.ts`
  - [x] Create `mobile/src/components/learn/GrammarDetail.tsx` — pattern, meaning, structure, accepted forms list, conjugation rules display, example sentences
  - [x] Render `conjugation_rules` JSON as structured key-value pairs
  - [x] Render `accepted_forms` JSON as a bulleted/chip list

- [x] **AC4 — Route integration — replace placeholder with type branching**
  - [x] Update `mobile/src/app/(tabs)/learn/item/[id].tsx` — branch on `item.itemType` to render `KanjiDetail`, `VocabularyDetail`, `GrammarDetail` (replace "coming soon" placeholder)
  - [x] Extend `useItemDetail` or create dedicated hooks per type as needed

- [x] **AC5 — List row navigation for all types**
  - [x] In `mobile/src/app/(tabs)/learn/[level].tsx`, wire `onPress` for kanji, vocabulary, and grammar rows (currently only radicals navigate)
  - [x] All item types navigate to `/learn/item/${item.id}`

- [x] **AC6 — Tests**
  - [x] `itemRepository.test.ts` — `getKanjiReadings`, `getAcceptedAnswers`, `getGrammarRule`, `getExampleSentences`, `getGrammarLinksForVocab`
  - [x] `KanjiDetail.test.tsx` — renders readings (onyomi/kunyomi labeled), synonyms, mnemonic
  - [x] `VocabularyDetail.test.tsx` — renders meaning, examples, grammar links
  - [x] `GrammarDetail.test.tsx` — renders structure, forms, sentences, conjugation rules
  - [x] `learn/item/[id].test.tsx` — extend with kanji/vocab/grammar type rendering
  - [x] `learn/[level].test.tsx` — verify kanji/vocab/grammar rows navigate to detail
  - [x] Run full CI pass: `npm run lint && npm run typecheck && npm test`

## Dev Notes

### Epic context (Epic 4)

Epic 4 delivers structured curriculum browsing outside the review loop. **Story 4.1** shipped the JLPT hub and per-type lists. **Story 4.2** added the radical detail screen and established the shared `/learn/item/[id]` route pattern. **This story (4.3)** fills in the remaining detail screens for kanji, vocabulary, and grammar — replacing the "coming soon" placeholder with rich type-specific views.

| Story | Scope | Relationship to 4.3 |
| --- | --- | --- |
| 4.1 | JLPT hub + per-type lists | Foundation — hub, level list, type picker |
| 4.2 | Radical detail + mnemonic image | Established `item/[id]` route, `getItemById`, `useItemDetail` |
| **4.3** | **Kanji, vocabulary, grammar details** | Extends `item/[id]` with type-specific views |
| 4.4 | Reading passages | Different route pattern — passages not items |
| 4.5 | Dependency graph visibility | Extends list rows + detail with lock/unlock |
| 4.6 | Personal mnemonics editor | Extends detail screens with edit |

### Current state — what exists vs what to build

**Already implemented (reuse, do not rebuild):**

| Asset | Location | Reuse for 4.3 |
| --- | --- | --- |
| `item/[id].tsx` route | `(tabs)/learn/item/[id].tsx` | Extend with type branching |
| `useItemDetail` hook | `data/hooks/useItemDetail.ts` | Base item load — extend or compose |
| `getItemById` | `itemRepository.ts` | Base item fetch — PK lookup |
| `RadicalDetail` | `components/learn/RadicalDetail.tsx` | Pattern reference (already in route) |
| `LearnItemRow` | `components/learn/LearnItemRow.tsx` | Already has `onPress` prop |
| `[level].tsx` | `(tabs)/learn/[level].tsx` | Wire `onPress` for all types |
| `KanjiDependencyHints` | `components/learn/KanjiDependencyHints.tsx` | Keep on kanji list rows |
| `MnemonicImage` | `components/common/MnemonicImage.tsx` | Not needed for 4.3 (no visual mnemonic URLs on kanji/vocab/grammar) |
| `cn` utility | `utils/cn.ts` | Conditional class merging |
| Theme constants | `constants/theme.ts` | `MaxContentWidth`, `BottomTabInset` |
| `CalibrationItemTypePicker` | `components/onboarding/CalibrationItemTypePicker.tsx` | Already used in level screen |

**Gaps this story must fill:**

1. No `getKanjiReadings` query — cannot show onyomi/kunyomi
2. No `getAcceptedAnswers` query — cannot show synonyms
3. No `getGrammarRule` query — cannot show structure/forms/conjugation
4. No `getExampleSentences` query — cannot show examples
5. No `getGrammarLinksForVocab` query — cannot show grammar cross-links
6. No `KanjiDetail`, `VocabularyDetail`, `GrammarDetail` components
7. Kanji/vocabulary/grammar rows in `[level].tsx` are **not tappable** — only radicals navigate
8. `item/[id].tsx` shows "coming soon" for non-radical types

### Database schema reference (curriculum.db)

```sql
-- items (base row — already fetched by getItemById)
id, item_type, jlpt_level, slug, primary_form, meaning, mnemonic_text, visual_mnemonic_url, sort_order

-- kanji_readings (kanji only)
id, item_id, reading_type ('onyomi' | 'kunyomi'), reading, sort_order

-- accepted_answers (all item types)
id, item_id, answer_type ('meaning' | 'reading' | 'production'), answer_text, is_primary

-- grammar_rules (grammar only, 1:1 with item)
id, item_id (UNIQUE), structure, conjugation_rules (JSON TEXT), accepted_forms (JSON TEXT)

-- example_sentences (any item type)
id, item_id, japanese, english, sort_order, reinforcement_tags (JSON TEXT nullable)

-- grammar_vocabulary_links (grammar↔vocab associations)
id, grammar_item_id, vocabulary_item_id
```

**Key observations from seed data:**
- `kanji_readings`: Each kanji has onyomi + kunyomi entries sorted by `sort_order`
- `accepted_answers`: Both primary (`is_primary = 1`) and synonym meanings; reading answers also stored here
- `grammar_rules.conjugation_rules`: Stored as JSON string (e.g. `{"polite": true}`)
- `grammar_rules.accepted_forms`: Stored as JSON string (e.g. `["です", "だ"]`)
- `example_sentences`: At least 1 per grammar item in seed; `vocabulary_slugs` in JSON only exists in source — only `japanese`, `english`, `sort_order`, `reinforcement_tags` in DB
- `grammar_vocabulary_links`: Maps grammar items to associated vocabulary items

### Recommended repository additions

```ts
export type KanjiReading = {
  id: string;
  readingType: 'onyomi' | 'kunyomi';
  reading: string;
  sortOrder: number;
};

export type AcceptedAnswer = {
  id: string;
  answerType: 'meaning' | 'reading' | 'production';
  answerText: string;
  isPrimary: boolean;
};

export type GrammarRule = {
  structure: string;
  conjugationRules: Record<string, unknown>;
  acceptedForms: string[];
};

export type ExampleSentence = {
  id: string;
  japanese: string;
  english: string;
  sortOrder: number;
};

export type GrammarVocabLink = {
  grammarItemId: string;
  vocabularyItemId: string;
  vocabularyPrimaryForm: string;
  vocabularyMeaning: string;
};

export function getKanjiReadings(db: SQLiteDatabase, itemId: string): KanjiReading[] {
  const rows = db.getAllSync<KanjiReadingRow>(
    `SELECT id, reading_type, reading, sort_order FROM kanji_readings WHERE item_id = ? ORDER BY sort_order ASC`,
    Number(itemId),
  );
  return rows.map(mapKanjiReadingRow);
}

export function getAcceptedAnswers(db: SQLiteDatabase, itemId: string): AcceptedAnswer[] {
  const rows = db.getAllSync<AcceptedAnswerRow>(
    `SELECT id, answer_type, answer_text, is_primary FROM accepted_answers WHERE item_id = ? ORDER BY is_primary DESC, id ASC`,
    Number(itemId),
  );
  return rows.map(mapAcceptedAnswerRow);
}

export function getGrammarRule(db: SQLiteDatabase, itemId: string): GrammarRule | null {
  const row = db.getFirstSync<GrammarRuleRow>(
    `SELECT structure, conjugation_rules, accepted_forms FROM grammar_rules WHERE item_id = ?`,
    Number(itemId),
  );
  if (!row) return null;
  return {
    structure: row.structure,
    conjugationRules: JSON.parse(row.conjugation_rules),
    acceptedForms: JSON.parse(row.accepted_forms),
  };
}

export function getExampleSentences(db: SQLiteDatabase, itemId: string): ExampleSentence[] {
  const rows = db.getAllSync<ExampleSentenceRow>(
    `SELECT id, japanese, english, sort_order FROM example_sentences WHERE item_id = ? ORDER BY sort_order ASC`,
    Number(itemId),
  );
  return rows.map(mapExampleSentenceRow);
}

export function getGrammarLinksForVocab(
  db: SQLiteDatabase,
  vocabItemId: string,
): GrammarVocabLink[] {
  const rows = db.getAllSync<GrammarVocabLinkRow>(
    `SELECT gvl.grammar_item_id, gvl.vocabulary_item_id, i.primary_form, i.meaning
     FROM grammar_vocabulary_links gvl
     JOIN items i ON i.id = gvl.grammar_item_id
     WHERE gvl.vocabulary_item_id = ?
     ORDER BY i.sort_order ASC`,
    Number(vocabItemId),
  );
  return rows.map(mapGrammarVocabLinkRow);
}
```

### Technical requirements (must follow)

- **Monorepo path:** All code under `mobile/`.
- **Data layer:** Repository functions in `data/curriculum/itemRepository.ts`; sync `db.getFirstSync` / `db.getAllSync`; snake_case → camelCase mapping; **no React in repositories**.
- **Hooks:** Thin wrappers in `data/hooks/` using `useDatabase()` → `curriculumDb`. May extend `useItemDetail` or create `useKanjiDetail`, `useVocabularyDetail`, `useGrammarDetail` — choose based on simplicity.
- **JSON parsing:** `grammar_rules.conjugation_rules` and `accepted_forms` are JSON TEXT columns — parse with `JSON.parse()` in the repository mapper, **not** in components.
- **Named exports** for components/hooks; **default export** for route file (`item/[id].tsx`).
- **Token-only styling:** NativeWind classes; no new raw hex. Use `text-primary`, `text-secondary`, `text-display`, `text-title-lg`, `text-body`, etc.
- **Component file pattern:** Props type defined → named export → hooks at top → render.
- **Touch targets:** 44×44px minimum on tappable grammar cross-links and any navigation elements.
- **Performance:** All queries are single-item lookups by indexed FK (`item_id`) — will easily meet <100ms on N5 seed data.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| `learn/item/[id].tsx` branching | Extend with `KanjiDetail`, `VocabularyDetail`, `GrammarDetail` |
| `itemRepository.ts` | New query functions for readings, answers, rules, sentences, links |
| Dual-DB separation | All detail reads from `curriculumDb` only — no user.db access |
| Drill-down depth ≤ 2 | Hub → list → detail (unchanged from 4.2) |
| FR5 multiple answers | `accepted_answers` table queried; synonyms displayed |
| FR6 structured grammar | `grammar_rules` table: structure, forms, conjugation |
| FR6c example sentences | `example_sentences` table: ≥5 shown when data provides |
| FR7 contextual vocab | Examples + grammar cross-links shown on vocabulary detail |
| FR27 view mnemonics | `mnemonic_text` shown on all detail types |
| NFR2 <100ms | FK-indexed single-item queries |
| Shared grammar parser path | `conjugationRules` exposed as typed data from repository — Epic 5 can import the same `getGrammarRule` for validation |

### File structure guidance

**Create:**

| Path | Purpose |
| --- | --- |
| `mobile/src/components/learn/KanjiDetail.tsx` | Kanji detail: glyph, readings, meanings, mnemonic |
| `mobile/src/components/learn/VocabularyDetail.tsx` | Vocabulary detail: word, meaning, examples, grammar links |
| `mobile/src/components/learn/GrammarDetail.tsx` | Grammar detail: pattern, structure, forms, rules, sentences |

**Modify:**

| Path | Change |
| --- | --- |
| `mobile/src/data/curriculum/itemRepository.ts` | Add types + queries: `getKanjiReadings`, `getAcceptedAnswers`, `getGrammarRule`, `getExampleSentences`, `getGrammarLinksForVocab` |
| `mobile/src/data/curriculum/itemRepository.test.ts` | Tests for all new queries |
| `mobile/src/data/hooks/useItemDetail.ts` | Extend to also fetch type-specific data (readings for kanji, rule for grammar, etc.) OR create dedicated hooks |
| `mobile/src/app/(tabs)/learn/item/[id].tsx` | Replace "coming soon" placeholder with `KanjiDetail`, `VocabularyDetail`, `GrammarDetail` branching |
| `mobile/src/app/(tabs)/learn/item/[id].test.tsx` | Add tests for kanji, vocabulary, grammar detail rendering |
| `mobile/src/app/(tabs)/learn/[level].tsx` | Wire `onPress` for kanji, vocabulary, and grammar rows (line 94-98 — remove conditional) |
| `mobile/src/app/(tabs)/learn/[level].test.tsx` | Verify all item types navigate to detail on press |
| `mobile/__mocks__/expo-sqlite.ts` | Extend mock to support `kanji_readings`, `accepted_answers`, `grammar_rules`, `example_sentences`, `grammar_vocabulary_links` queries |

**Do NOT create/modify in 4.3:**

| Path | Deferred to |
| --- | --- |
| `core/content/dependencyGraph.ts` | Story 4.5 |
| Lock/unlock badges | Story 4.5 |
| Personal mnemonics editor | Story 4.6 |
| SRS stage badges on detail | Epic 5/6 |
| Reading passages route | Story 4.4 |
| Visual mnemonic images for non-radicals | Not in schema (only radicals have `visual_mnemonic_url`) |
| `MnemonicImage` modifications | Not needed — kanji/vocab/grammar have text mnemonics only |

### UX references (must follow)

- **UX-DR34:** Reading vs meaning clarity — instant type indicator on labels. On detail, clearly label "On'yomi" and "Kun'yomi" as section headings so there is never ambiguity about whether content is a reading or a meaning.
- **Drill-down:** Stack list → detail, max depth 2; Back returns to list.
- **Typography:** Kanji glyph `text-display text-primary`; grammar pattern `text-title-lg font-mono text-primary`; vocab word `text-display text-primary` (or `text-title-lg` for multi-character); section headings `text-body-sm text-secondary uppercase`; body text `text-body text-primary`.
- **Touch targets:** 44px minimum on grammar cross-link pressables and Back button.
- **Content organization:** Detail screens show rich study content — mnemonics, readings, examples. This content does NOT belong in the review loop (UX principle from spec line 288).

### Previous story intelligence (4.2)

**Critical learnings from Story 4.2 implementation:**

1. **`item/[id].tsx` already branches on `item.itemType`** — the radical case renders `RadicalDetail`, other cases show placeholder. Replace the `else` clause with kanji/vocab/grammar branching.
2. **`useItemDetail` returns `CurriculumItemDetail`** — base fields only (id, slug, itemType, jlptLevel, primaryForm, meaning, mnemonicText, visualMnemonicUrl). Type-specific data needs additional queries.
3. **Pattern established:** Each detail component receives the base `item: CurriculumItemDetail` prop and does its own fetching if needed (or receives pre-fetched data via a richer hook).
4. **Back button** pattern from 4.2: `learn-item-back` testID, Pressable with 44px min-height, `router.back()`.
5. **Layout pattern:** `SafeAreaView` + `MaxContentWidth` + `BottomTabInset` already applied in `item/[id].tsx` — detail components just render content inside.
6. **`LearnItemRow` already accepts `onPress`** — just needs to be wired for non-radical types in `[level].tsx`.
7. **expo-sqlite mock** was extended in 4.2 for `WHERE id = ?` and parent relationship JOINs — extend further for new tables.

### Design decisions for developer

**Hook strategy:** Recommended approach — extend `useItemDetail` to return enriched data per type:

```ts
type ItemDetailResult = {
  item: CurriculumItemDetail | null;
  kanjiReadings: KanjiReading[] | null;   // only for kanji
  acceptedAnswers: AcceptedAnswer[];       // for all types
  grammarRule: GrammarRule | null;         // only for grammar
  exampleSentences: ExampleSentence[];    // for all types
  grammarVocabLinks: GrammarVocabLink[];  // only for vocab
  loading: boolean;
  notFound: boolean;
};
```

This keeps one hook + one render in the route file. Each detail component receives the relevant data as props.

**Grammar cross-links on vocabulary:** Query `grammar_vocabulary_links` where `vocabulary_item_id = ?`, JOIN `items` to get grammar name/form. Render as tappable chips/links. Navigate to `/learn/item/[grammarItemId]`.

**Accepted answers display:** Filter `accepted_answers` to show only `answer_type = 'meaning'` synonyms (non-primary) on detail screens. Reading answers are covered by the `kanji_readings` section. Production answers are for Epic 5 review validation.

### Git intelligence summary

Latest commits:
- `f49198d` — Story 4.2: radical detail screen, `getItemById`, `getRequiredParentsForItems`, `item/[id]` route
- `3ec6801` — Story 4.1: JLPT Learn hub, per-type lists, type picker, level screen

Build directly on the patterns in these commits. The item detail route and repository patterns are the immediate foundation.

### Scope boundaries

**In scope:**
- Kanji detail: readings (onyomi/kunyomi), meanings (primary + synonyms), mnemonic text
- Vocabulary detail: meaning, synonyms, example sentences, grammar cross-links, mnemonic text
- Grammar detail: structure, accepted forms, conjugation rules, example sentences, mnemonic text
- All item types navigable from level list (wire `onPress` for kanji, vocabulary, grammar rows)
- Repository queries for all new tables
- Tests for queries and components

**Out of scope (defer):**
- Reading passages — Story 4.4 (different route, not item detail)
- Dependency graph unlock visibility — Story 4.5
- Personal mnemonics editor (edit/save) — Story 4.6
- Visual mnemonic images on kanji/vocab/grammar — not in schema
- SRS stage indicators on detail — Epic 5/6
- "Known vocabulary" highlighting in grammar examples — Epic 5 (FR8 selection logic)
- Making examples tappable to navigate to vocab items — future polish
- Reverse lookup "vocabulary using this grammar" on grammar detail — optional polish

### Latest tech information

- **Expo SDK 55** + **expo-router** — no changes from 4.2; `item/[id]` route already registered.
- **expo-sqlite** sync API — `getFirstSync` for single-row lookups, `getAllSync` for multi-row (readings, answers, sentences).
- **JSON.parse** — safe for `grammar_rules.conjugation_rules` and `accepted_forms` since compile-curriculum validates JSON integrity.
- **@testing-library/react-native** — mock `expo-router` `router.push` and `useLocalSearchParams` like existing tests.

No new npm dependencies expected.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.3 AC]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR5, FR6, FR6c, FR7, FR27]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — itemRepository pattern, dual-DB, data access layer]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR34, drill-down depth, detail vs review content]
- [Source: `scripts/curriculum-schema.ts` — DDL for kanji_readings, accepted_answers, grammar_rules, example_sentences, grammar_vocabulary_links]
- [Source: `curriculum/kanji/n5.json` — Kanji JSON shape with readings and answers]
- [Source: `curriculum/grammar/n5.json` — Grammar JSON shape with structure, forms, rules, sentences]
- [Source: `mobile/src/app/(tabs)/learn/item/[id].tsx` — Current route with radical branching + placeholder]
- [Source: `mobile/src/data/curriculum/itemRepository.ts` — Existing getItemById, types, patterns]
- [Source: `mobile/src/data/hooks/useItemDetail.ts` — Current hook to extend]
- [Source: `_bmad-output/implementation-artifacts/4-2-radical-detail-with-mnemonic-image.md` — Previous story patterns]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Extended `useItemDetail` to return enriched `ItemDetailResult` with type-specific data (readings, answers, grammar rule, sentences, vocab links).
- JSON parsing for grammar rules done in repository layer per architecture spec.

### Completion Notes List

- Added five repository query functions (`getKanjiReadings`, `getAcceptedAnswers`, `getGrammarRule`, `getExampleSentences`, `getGrammarLinksForVocab`) with typed mappers and snake_case → camelCase mapping.
- Created `KanjiDetail`, `VocabularyDetail`, and `GrammarDetail` components following RadicalDetail patterns and UX-DR34 reading/meaning label clarity.
- Replaced "coming soon" placeholder in `item/[id].tsx` with type-specific detail branching.
- Wired all item types in level list to navigate to `/learn/item/[id]`.
- Extended expo-sqlite mock with new table support and setter helpers.
- All 275 tests pass; lint and typecheck clean.

### File List

- mobile/src/data/curriculum/itemRepository.ts (modified)
- mobile/src/data/curriculum/itemRepository.test.ts (modified)
- mobile/src/data/hooks/useItemDetail.ts (modified)
- mobile/src/components/learn/KanjiDetail.tsx (new)
- mobile/src/components/learn/KanjiDetail.test.tsx (new)
- mobile/src/components/learn/VocabularyDetail.tsx (new)
- mobile/src/components/learn/VocabularyDetail.test.tsx (new)
- mobile/src/components/learn/GrammarDetail.tsx (new)
- mobile/src/components/learn/GrammarDetail.test.tsx (new)
- mobile/src/app/(tabs)/learn/item/[id].tsx (modified)
- mobile/src/app/(tabs)/learn/item/[id].test.tsx (modified)
- mobile/src/app/(tabs)/learn/[level].tsx (modified)
- mobile/src/app/(tabs)/learn/[level].test.tsx (modified)
- mobile/__mocks__/expo-sqlite.ts (modified)

### Change Log

- 2026-06-21: Implemented kanji, vocabulary, and grammar detail screens with repository queries, enriched hook, route branching, list navigation, and comprehensive tests.

### Review Findings

- [x] [Review][Patch] Stale detail flash on item-to-item navigation [`mobile/src/data/hooks/useItemDetail.ts`]
- [x] [Review][Patch] Grammar cross-link Pressables missing 44px minimum width [`mobile/src/components/learn/VocabularyDetail.tsx:83`]
- [x] [Review][Patch] Screen-level grammar test omits example sentence assertions [`mobile/src/app/(tabs)/learn/item/[id].test.tsx:240`]
- [x] [Review][Patch] Kanji screen integration test omits kunyomi assertion [`mobile/src/app/(tabs)/learn/item/[id].test.tsx:212`]
- [x] [Review][Defer] Vocabulary examples absent from bundled N5 curriculum (compile-curriculum only inserts grammar sentences) — deferred, data pipeline scope
- [x] [Review][Defer] Uncaught JSON.parse in getGrammarRule — deferred, compile-curriculum validates JSON integrity per spec
- [x] [Review][Defer] Number(itemId) coercion for non-numeric params — deferred, pre-existing repository pattern from Story 4.2
