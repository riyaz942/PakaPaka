---
baseline_commit: 004e211d350d309104657e4b316ebea250c80873
---

# Story 7.1: Card Registry & Day-1 Beginner Deck

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time learner on the beginner onboarding path,
I want a short day-1 deck covering the three scripts and word spacing — built from real curriculum items, not screenshots,
so that I'm not lost the moment my first lesson starts, without sitting through an explanation of everything the app does up front.

## Acceptance Criteria

1. **One registry, not three screens.** A single exported list of card definitions — `GUIDANCE_CARDS` in `components/onboarding/cardRegistry.ts` — holds every guidance card as `{ id, title, trigger, Render }`. Story 7.2's contextual triggers and Settings "How this works" library read the *same* array; nothing about this story's structure may force 7.2 to declare a second list.

2. **Closed trigger set.** `GuidanceCardTrigger = 'onboarding-deck' | 'contextual' | 'library-only'`. This story ships two cards, both `'onboarding-deck'`. The day-one screen renders `GUIDANCE_CARDS.filter((card) => card.trigger === 'onboarding-deck')` — it never hardcodes the two ids, so 7.2 adding `'contextual'` entries changes nothing here.

3. **Two cards, exactly.** `three-scripts` (hiragana / katakana / kanji, each with its job) and `word-spacing` (Japanese writes no spaces between words). No on'yomi/kun'yomi card — see AC #11.

4. **Real curriculum data, not hardcoded glyphs.** Every Japanese character a card displays is read from `curriculum.db` at render time via the repository layer. Cards reference content by **slug**, never by integer row id: ids are assigned by the compile step and shift on recompile/OTA (same reasoning as Story 9.1's slug-keyed backup). Required slugs:
   - `three-scripts`: vocabulary `hiragana` (ひらがな), `basu` (バス "bus" — katakana doing its actual job, a loanword), `nihongo` (日本語, furigana `日本[にほん]語[ご]`)
   - `word-spacing`: grammar `wa-topic` (は), whose first example sentence is 私は学生です。/ `私[わたし]は学[がく]生[せい]です。` / "I am a student.", linked to vocabulary `私` and `学生`
   The one-line "what this script is for" copy beside each glyph is app-authored (like `explainerContent.ts`) — only the glyphs, readings and meanings come from the DB.

5. **The spacing card shows the same sentence twice.** Once verbatim (no spaces — that is the point), then again with the word boundaries pulled apart, then the English gloss. Boundaries come from `buildExampleSentenceSpans` + `buildPassageBodyParts` over the sentence's authored vocab links — **not** from a hand-written split string. On this sentence that yields 私 / は / 学生 / です。, which is exactly the teaching point (は is glue between words). Reuse both helpers as-is; do not write a new segmenter.

6. **New `card_seen` table via migration 019.** `card_seen(card_id TEXT PRIMARY KEY, seen_at TEXT NOT NULL)`, created in `data/migrations/019_card_seen.ts` and appended to the `migrations` array in `data/migrations/index.ts`. Not new `user_preferences` keys: the registry must grow without a migration per card. `data/user/cardSeenRepository.ts` exposes exactly two functions — `isCardSeen(userDb, cardId): boolean` and `markCardSeen(userDb, cardId): void` — synchronous SQLite, no `Result<T, AppError>` wrapper, matching `preferencesRepository.ts` (its sibling), not the async Result-wrapped modules elsewhere.

7. **Beginner path only.** `intensity.tsx`'s Continue routes: `manual` → `/onboarding/placement` (unchanged), `beginner` → `/onboarding/day-one` (new), everything else → `/onboarding/complete` (unchanged). Manual and import paths never see the deck. `/onboarding/day-one` continues to `/onboarding/complete`.

8. **A card is marked seen when it is shown, not when it is dismissed.** Written the moment the card becomes visible, matching `useKanjiReadingPrimer.ts:56`'s precedent — a learner who force-quits mid-deck has still seen card 1 and must not be shown it again unprompted.

9. **Skip marks both.** The first card carries a skip action labelled "Skip all, I know how apps work". Tapping it marks **both** deck cards seen and navigates to `/onboarding/complete`. Skipped cards stay in `GUIDANCE_CARDS` unabridged, so 7.2's Settings library will still list them.

10. **Already-seen cards are not re-fired.** The day-one screen renders only deck cards with no `card_seen` row. If none remain (Settings' "replay onboarding" clears `onboarding_completed` at `settings.tsx:215` but leaves `card_seen` intact), the screen navigates straight to `/onboarding/complete` instead of rendering an empty deck. Cards stay reachable from the Settings library in 7.2 — this AC is about *unprompted* firing only.

11. **The shipped on'yomi/kun'yomi primer is untouched.** `useKanjiReadingPrimer.ts`, `useKanjiReadingPrimer.test.tsx`, `KanjiReadingPrimer.tsx` and the `seenKanjiReadingPrimer` preference key must not appear in this story's diff. FR74 already explains readings live, in-lesson, at the first dual-reading kanji; the day-1 deck deliberately omits readings rather than explaining the same fact twice (decision resolved 2026-08-07, epics.md:1105).

12. **Step dots stay at 4.** The deck screen uses `OnboardingStep` with `stepIndex={3} stepCount={4}`. The beginner path currently shows dots 1, 2, 4 (it skips `placement`, which owns 3); the deck fills that gap. No other onboarding screen's `stepIndex`/`stepCount` changes.

13. **Verify green.** `npm run lint && npm run typecheck && npm test` in `mobile/`. No new color tokens, so repo-root `npm run check-contrast` is expected unaffected — run it only if you touch a token.

**Explicitly out of scope (do not implement):**

- **Everything in Story 7.2** — contextual triggers (first wrong answer, item repeat, locked passage, ring >100%, furigana auto-hide), "explain this" affordances on `GoalRing` / `SRSStageIndicator` / `FuriganaText` / `FuriganaOverrideControl` / review card header, and the Settings "How this works" library. Build the registry so 7.2 slots in; do not build 7.2.
- **WaniKani-diff deck for importers and a glossary card for manual-path learners** (brainstorm SYNTHESIS-6). Raised, not chosen, not in scope.
- **Trust cards** (who-made-this, no-account-means-no-cloud-backup). These track `docs/design/backup-and-web-plan.md` / Epic 9, not this epic.
- **Shareable-image export, "last card doubles as Start button", replay-count badge.**
- **Retiring or relocating `useKanjiReadingPrimer`** — see AC #11.

## Tasks / Subtasks

- [x] **Task 1 — `card_seen` storage (AC: #6)**
  - [x] `data/migrations/019_card_seen.ts`: `export const migration019CardSeen: Migration = { version: 19, name: '019_card_seen', up: (db) => db.execSync('CREATE TABLE IF NOT EXISTS card_seen (card_id TEXT PRIMARY KEY, seen_at TEXT NOT NULL);') }`. Header comment says *why* it is its own table rather than preference keys (open-ended card ids vs. a fixed key set).
  - [x] `data/migrations/index.ts`: import and append `migration019CardSeen` — last in the array, after `migration018AiSessionTopicIds`.
  - [x] `data/user/cardSeenRepository.ts`: `isCardSeen` (`SELECT card_id FROM card_seen WHERE card_id = ?`, `getFirstSync`, return `row !== null`) and `markCardSeen` (`INSERT INTO card_seen (card_id, seen_at) VALUES (?, ?) ON CONFLICT(card_id) DO NOTHING` — re-marking must not move `seen_at`). No other exports.
  - [x] **Extend `mobile/__mocks__/expo-sqlite.ts` (mandatory — see Dev Notes → Mock pitfall):** add an `INSERT INTO card_seen` branch to `applySql` and a `FROM card_seen` branch with `WHERE card_id = ?` to `queryRows`. Without both, the write is a silent no-op and the read returns `[]` — every seen-state test would pass while asserting nothing.
  - [x] `cardSeenRepository.test.ts`: unseen → false; after `markCardSeen` → true; second `markCardSeen` keeps the original `seen_at`; a different card id stays unseen.
  - [x] `019_card_seen.test.ts`: mirrors `018_ai_session_topic_ids.test.ts` — run the migration, assert the table exists and is idempotent on re-run.

- [x] **Task 2 — Slug lookup in the curriculum layer (AC: #4)**
  - [x] `data/curriculum/itemRepository.ts`: add `getItemBySlug(db, itemType: ItemType, slug: string): CurriculumItemDetail | null`. Same `SELECT` column list and `mapRowToDetail` call as `getItemById` (`itemRepository.ts:190`) — do not duplicate the mapper. Query `WHERE item_type = ? AND slug = ?` (the table's `UNIQUE (item_type, slug)`).
  - [x] **Extend the sqlite mock again:** the `FROM items` branch (`__mocks__/expo-sqlite.ts:1192`) has no `slug` handling, so a slug query silently returns the *whole* items table and `getFirstSync` hands back an arbitrary row. Add `if (/WHERE item_type = \? AND slug = \?/i.test(trimmed))` before the existing filters.
  - [x] `itemRepository.test.ts`: `getItemBySlug` returns the matching row; returns `null` for an unknown slug; does not cross item types (same slug on two types resolves to the requested one).

- [x] **Task 3 — The card registry (AC: #1, #2, #3)**
  - [x] `components/onboarding/cardRegistry.ts` (`.ts`, not `.tsx` — it holds no JSX, only component references, so `core/`'s JSX-free rule is irrelevant and the file stays a plain module):
    ```ts
    export type GuidanceCardId = 'three-scripts' | 'word-spacing';
    export type GuidanceCardTrigger = 'onboarding-deck' | 'contextual' | 'library-only';
    export type GuidanceCard = {
      id: GuidanceCardId;
      title: string;
      trigger: GuidanceCardTrigger;
      Render: React.ComponentType;
    };
    export const GUIDANCE_CARDS: readonly GuidanceCard[] = [ /* two entries */ ];
    ```
  - [x] Add a header comment stating the registry is the single list behind the day-1 deck, 7.2's contextual triggers, and 7.2's Settings library — so a future card is one array entry, not a new screen.
  - [x] `cardRegistry.test.ts`: every id is unique; every deck card has a non-empty title and a `Render`; the deck filter returns exactly `['three-scripts', 'word-spacing']` in that order.

- [x] **Task 4 — `ThreeScriptsCard` (AC: #4)**
  - [x] `components/onboarding/cards/ThreeScriptsCard.tsx`. Reads `curriculumDb` from `useDatabase()`, resolves the three vocabulary slugs with `getItemBySlug`, renders three rows: the real `primaryForm` (via `FuriganaText` with `mode="shown"` so 日本語's reading is visible), the real `meaning`, and an app-authored one-line job ("the glue…", "borrowed words…", "meaning at a glance…").
  - [x] Wrap the lookups in `useMemo` keyed on `curriculumDb` — the row set is fixed, so do not re-query per render.
  - [x] `ThreeScriptsCard.test.tsx`: seed the three items with `__mockSetItems`, assert the rendered glyphs are ひらがな / バス / 日本語 and that the katakana row's meaning reads "bus" — i.e. the copy came from the DB, not a literal.

- [x] **Task 5 — `WordSpacingCard` (AC: #4, #5)**
  - [x] `components/onboarding/cards/WordSpacingCard.tsx`. `getItemBySlug(curriculumDb, 'grammar', 'wa-topic')` → `getExampleSentences(curriculumDb, item.id)[0]`.
  - [x] Render (a) the sentence verbatim via `FuriganaText` (`mode="shown"`, `text={sentence.furigana ?? sentence.japanese}`), (b) the same sentence pulled apart, (c) `sentence.english`.
  - [x] Build (b) with `buildExampleSentenceSpans(sentence.japanese, sentence.vocabularyLinks)` → `buildPassageBodyParts(sentence.japanese, sentence.furigana, spans)`, then lay the returned parts out with a visible gap between them (each part in its own `View`, `flex-row flex-wrap gap-…`). `buildPassageBodyParts` already returns *alternating* span and interstitial runs, so the particle は and です。 come back as their own parts for free — that is the whole demonstration. Render each part's `text` through `FuriganaText`; do not make the parts pressable (that is `PassageBody`'s job, not a teaching card's).
  - [x] `WordSpacingCard.test.tsx`: seed the grammar item, its sentence and the two vocab links; assert the verbatim line contains 私は学生です。 and that the separated view renders 4 parts with 私 / は / 学生 / です。 as their surfaces.

- [x] **Task 6 — The day-one screen (AC: #2, #7, #8, #9, #10, #12)**
  - [x] `app/onboarding/day-one.tsx`: filter `GUIDANCE_CARDS` to `trigger === 'onboarding-deck'`, then to cards with no `card_seen` row. Hold a `cardIndex` state; render the active card's `Render` inside `OnboardingStep` (`title` = the card's title, `stepIndex={3}`, `stepCount={4}`, `testID="day-one-screen"`).
  - [x] `markCardSeen` on the card *becoming visible* (effect keyed on the active card id), not on Continue (AC #8).
  - [x] Primary action: "Next" while more cards remain, "Continue" on the last, which `router.push('/onboarding/complete')`. Skip action only on the first card, label "Skip all, I know how apps work" — marks **every** deck card seen (not just the unseen ones on screen) then pushes to complete.
  - [x] Empty-after-filter case: `router.replace('/onboarding/complete')` from an effect; render nothing. Guard the navigation with a ref so a re-render cannot fire it twice (`complete.tsx:49`'s `submittedRef` is the pattern).
  - [x] `app/onboarding/_layout.tsx`: add `<Stack.Screen name="day-one" />` between `intensity` and `placement`.
  - [x] `day-one.test.tsx`: two cards advance in order; card 1 is marked seen on mount; skip marks both and pushes to `/onboarding/complete`; a userDb with both `card_seen` rows already present navigates straight to complete without rendering a card.

- [x] **Task 7 — Route the beginner path (AC: #7)**
  - [x] `app/onboarding/intensity.tsx` `handleContinue`: replace the two-way `manualPath ? placement : complete` with the three-way branch on `getOnboardingPath(userDb)`. Keep `setSessionIntensity` first and the `!selectedIntensity` guard unchanged. Leave the `importPath` / `isImportOnboardingPath` usage in the preview copy exactly as it is — it answers a different question than the routing branch does (see Dev Notes).
  - [x] `intensity.test.tsx`: extend the existing routing assertions — beginner → `/onboarding/day-one`, manual → `/onboarding/placement` (must still pass), import → `/onboarding/complete` (must still pass).

- [x] **Task 8 — Regenerate typed routes, then verify (AC: #13)**
  - [x] **`router.push('/onboarding/day-one')` will not typecheck until `.expo/types/router.d.ts` is regenerated** — `app.json` sets `experiments.typedRoutes: true` and the checked-in `router.d.ts` predates this route. Run `npx expo start` briefly (or `npx expo customize tsconfig.json`) until the types file is rewritten, then kill it. Do not hand-edit `router.d.ts`, and do not work around it by casting the href.
  - [x] `npm run lint` (a11y rules block merge — the deck's actions go through `Button`/`OnboardingStep`, which are already labelled; anything new that is pressable needs `accessibilityRole` + label).
  - [x] `npm run typecheck` — clean.
  - [x] `npm test` — full suite. `useKanjiReadingPrimer.test.tsx` must pass untouched (AC #11).

### Review Findings

- [x] [Review][Defer] Back from complete resurfaces a stale deck card — `day-one.tsx` exits via `router.push('/onboarding/complete')`, so Back from complete reveals the last card in stale state (all cards marked seen; the empty-deck effect can't fire because `activeCard` is non-null) [mobile/src/app/onboarding/day-one.tsx:56] — deferred: push is spec-mandated by Task 6 and the state self-corrects on Continue.
- [x] [Review][Patch] Double-tap "Next" overshoots the deck and strands a card unmarked [mobile/src/app/onboarding/day-one.tsx:59]
- [x] [Review][Patch] Double-tap "Continue"/"Skip all" pushes `/onboarding/complete` twice [mobile/src/app/onboarding/day-one.tsx:56]
- [x] [Review][Patch] Mock `INSERT INTO card_seen` branch applies conflict-dedupe without requiring the `ON CONFLICT` text, unlike its neighbors — a dropped clause in the real SQL would stay green in tests [mobile/__mocks__/expo-sqlite.ts:335]
- [x] [Review][Patch] `019_card_seen.test.ts` reintroduces the fragile `migrations[migrations.length - 1]` "registered last" assertion one file after the diff fixed it in 018's test [mobile/src/data/migrations/019_card_seen.test.ts:16]
- [x] [Review][Patch] `React.ComponentType` used with no React import — compiles only via the UMD global; `import type { ComponentType } from 'react'` is robust to tsconfig changes [mobile/src/components/onboarding/cardRegistry.ts:26]
- [x] [Review][Defer] Mock masks the real "no such table: card_seen" crash path — `FROM card_seen` returns `[]` regardless of table existence, so a pre-migration read crashes on device but stays green in tests [mobile/__mocks__/expo-sqlite.ts:1065] — deferred, pre-existing (same trade-off as `preferencesRepository`; migrations always run before any screen reads `card_seen`)
- [x] [Review][Defer] No path guard on the `day-one` route — a deep link drops manual/import-path users into the beginner deck and marks cards seen on their behalf [mobile/src/app/onboarding/_layout.tsx:9] — deferred, pre-existing (no onboarding route guards deep links; out of scope for this story)

## Dev Notes

### The registry is the deliverable; the deck is one view of it

The value of this story is structural. Two cards on a screen is trivial; what 7.2 needs is a list it can filter three different ways. Concretely: 7.2 will add ~5 `'contextual'` entries and render `GUIDANCE_CARDS` unfiltered in Settings. If you find yourself writing `if (cardId === 'three-scripts')` anywhere outside the registry file, the abstraction has already failed.

Precedent for where this lives: `components/learn/explainerContent.ts` is the same shape of thing — app-authored content keyed by a string union, consumed by `SectionHeading.tsx` and `ExplainerSheet.tsx`. It lives under `components/`, not `core/`, and that is deliberate: `src/core/` contains **zero** `.tsx` files and **zero** imports from `@/components` (verified). The epic sketches the path as `core/onboarding/cardRegistry.ts`; putting a `React.ComponentType` there would be the first core→UI dependency in the codebase. Use `components/onboarding/cardRegistry.ts` instead and note the deviation in your completion notes.

Similarly, the epic names the migration `019_card_registry.ts`. Every existing migration is named for the table it creates (`015_goal_ring_state`, `016_furigana_overrides`), so use `019_card_seen.ts`. Same deviation-note treatment.

### 🚨 Mock pitfall — the single most likely way this story ships broken

`mobile/__mocks__/expo-sqlite.ts` is a hand-rolled SQL fake, not SQLite. It dispatches on regexes per table, and **both** ends fail silently for an unknown table:

- `applySql` ends at line ~606 with no fallback. A parameterized `INSERT INTO card_seen (…) VALUES (?, ?)` matches no branch and is a **no-op** — no error, no row.
- `queryRows` ends with `return []` (line 1243). `SELECT … FROM card_seen …` returns empty forever.

Net effect if you skip Task 1's mock work: `markCardSeen` writes nothing, `isCardSeen` always returns false, and a test asserting "card 1 is marked seen" passes because the *screen* called the function. The assertion has to be on `isCardSeen` reading back `true` — which requires the mock branches.

The `FROM items` branch has the same shape of trap for Task 2: it handles `WHERE id = ?`, `WHERE id IN`, `item_type = ?`, `jlpt_level = ?` — and nothing for `slug`. An unmatched slug query falls through the filters and returns **every seeded item**, so `getFirstSync` returns whichever item you seeded first and the test looks green. The mock's own comment at line 723 flags exactly this class of bug ("ignoring the WHERE silently reports inflated totals… the mock pitfall").

Add branches, then write a test that would fail without them.

### Reuse map — do not rebuild any of these

| Need | Use | Where |
| --- | --- | --- |
| Screen chrome, progress dots, primary/secondary/skip buttons | `OnboardingStep` | `components/common/OnboardingStep.tsx` — already wraps children in a `ScrollView` (added by 6.2's code review), so a tall card scrolls on an SE |
| Furigana rendering | `FuriganaText` with `mode="shown"` | `components/common/FuriganaText.tsx` — takes the mode as a prop, no provider needed; falls back to plain `<Text>` when the string has no brackets |
| Word-boundary segmentation | `buildExampleSentenceSpans` → `buildPassageBodyParts` | `core/content/exampleSentenceSpans.ts`, `core/content/passageBodyParts.ts` |
| Sentence + its vocab links in one call | `getExampleSentences` (returns `vocabularyLinks`) | `data/curriculum/itemRepository.ts:808` |
| Item lookup + row→type mapping | `mapRowToDetail` via a new `getItemBySlug` | `data/curriculum/itemRepository.ts:190` |
| Preference-style sync repository shape | `preferencesRepository.ts` | plain functions, `SQLiteDatabase` first arg, no `Result` |
| "Mark seen the moment it is visible" | `useKanjiReadingPrimer.ts:56` | read it for the reasoning, then leave the file alone |
| Card visual tone | `KanjiReadingPrimer.tsx` | `rounded-radius-lg border border-border bg-surface p-space-lg`, header + body paragraphs |
| Entering-screen animation | `FadeSlideIn` | used by every onboarding screen; `index` prop staggers children |

### Files being changed — current state and what must survive

**`app/onboarding/intensity.tsx` (UPDATE).** Today: `router.push(manualPath ? '/onboarding/placement' : '/onboarding/complete')` at line 29, where `manualPath = getOnboardingPath(userDb) === 'manual'`. Beginner and import both land on complete. Only the routing line changes.

Note the trap: line 18 also computes `importPath = isImportOnboardingPath(userDb)`, and that helper is **not** a synonym for `getOnboardingPath(userDb) === 'import'` — it falls back to counting `import_metadata` rows when the preference is unset (`onboardingPathUtils.ts:14`). It exists to decide whether the lesson-preview copy says "layered on top of your imported progress". Do not fold it into the routing branch, and do not delete it.

**`app/onboarding/_layout.tsx` (UPDATE).** Six `<Stack.Screen>` entries, `headerShown: false`. Add one.

**`data/migrations/index.ts` (UPDATE).** Import list + array must stay in version order; the runner applies them in array order.

**`app/onboarding/complete.tsx` (READ ONLY — do not edit).** Referenced for two patterns: the `submittedRef` double-fire guard (line 49) and `stepIndex={4} stepCount={4}`. The deck pushes to it; it needs no change.

**`app/onboarding/welcome.tsx` (READ ONLY).** Confirms `onboarding_path` is written at welcome for all three paths before `intensity` runs, so the deck's gate can read it without a null case in the real flow.

### Content — why these slugs

Verified present in the bundled `mobile/assets/curriculum-seed/curriculum.db`:

| Slug | Type | `primary_form` | `furigana` | `meaning` |
| --- | --- | --- | --- | --- |
| `hiragana` | vocabulary | ひらがな | ひらがな | hiragana |
| `basu` | vocabulary | バス | バス | bus |
| `nihongo` | vocabulary | 日本語 | `日本[にほん]語[ご]` | Japanese |
| `wa-topic` | grammar | は | — | (topic particle) |

`wa-topic`'s first example sentence (lowest `sort_order`) is `私は学生です。` / `私[わたし]は学[がく]生[せい]です。` / "I am a student.", with authored `example_sentence_vocab` links to `私` and `学生`. `buildExampleSentenceSpans` matches both forms and `buildPassageBodyParts` returns four parts — 私 (span) / は (interstitial) / 学生 (span) / です。 (interstitial). That is a genuinely segmented sentence out of authored data, which is what AC #5 is protecting.

`basu` rather than `katakana` for the katakana row: カタカナ is self-naming but is not a loanword, and the card's claim is that katakana's *job* is foreign words. Use the example that proves the claim.

### The no-hidden-fallback rule applies to missing content

If `getItemBySlug` returns `null` for one of these slugs, do **not** silently substitute another item, and do not render a half-empty card. The bundled curriculum is a build artifact shipped with the app, so a missing slug is a build error, not a runtime condition to degrade around. Let the card's test be the guard: it seeds exactly the rows the card names, and it fails if the card stops asking for them. In the component, a `null` lookup should render the card without that row rather than crash — but no substitution, and no "content unavailable" placeholder copy.

### Testing

- Screen tests follow `intensity.test.tsx`: `__mockResetSqlite()`, `openDatabaseAsync`, `runMigrations(db, [migration001Initial, …])`, then render inside `SafeAreaProvider` + `DatabaseContext.Provider`. `expo-router` is `jest.mock`ed with `push`/`replace` spies. `day-one.test.tsx` must run migration 019 as well as 001.
- Card content tests follow `radicalRepository.test.ts` / `SectionHeading.test.tsx`: seed with the mock's existing helpers — `__mockSetItems`, `__mockSetExampleSentences`, `__mockSetExampleSentenceVocab` (all already exported from `__mocks__/expo-sqlite.ts`) — then assert on rendered Japanese text. Do not hand-roll INSERT statements for these three tables.
- `SafeAreaProvider` needs `initialMetrics` in tests or `OnboardingStep`'s `useSafeAreaInsets()` throws; copy the block from `intensity.test.tsx:35`.

### Previous-story intelligence (6.2, done 2026-08-08)

- 6.2's code review patched `OnboardingStep` to wrap children in a `ScrollView` because five intensity tiers overflowed an iPhone SE. That fix is in the file you are building on — a tall day-one card is safe, but do not assume it: `OnboardingStep`'s header, action stack and safe-area padding sit *outside* the scroll view, so only the card body scrolls.
- 6.2 shipped in-place with no new files and no migration, so the last real migration precedent is 018 (an `ALTER TABLE` with a `PRAGMA table_info` guard) and 016 (a `CREATE TABLE IF NOT EXISTS`). Yours is 016's shape.
- 6.2's dev agent stopped rather than editing a file outside its declared file set, and that was the right call. This story's file set is declared below — if you find you need a file that is not on it, say so in the completion notes instead of widening the diff silently.

### Recent commit context

`004e211` (five-tier pace) is the baseline. The three commits before it are curriculum content additions (example sentences for N5 vocabulary) — they change `curriculum/**` JSON and the compiled `curriculum.db`, which is why the slugs in the content table above were verified against the bundled DB rather than taken from the epic. `curriculum.db` is Git LFS; if the file reads as a pointer stub, run `git lfs pull` before querying it.

### Project Structure Notes

Declared file set for this story:

**New**
- `mobile/src/data/migrations/019_card_seen.ts` + `.test.ts`
- `mobile/src/data/user/cardSeenRepository.ts` + `.test.ts`
- `mobile/src/components/onboarding/cardRegistry.ts` + `.test.ts`
- `mobile/src/components/onboarding/cards/ThreeScriptsCard.tsx` + `.test.tsx`
- `mobile/src/components/onboarding/cards/WordSpacingCard.tsx` + `.test.tsx`
- `mobile/src/app/onboarding/day-one.tsx` + `.test.tsx`

**Modified**
- `mobile/src/data/migrations/index.ts`
- `mobile/src/data/curriculum/itemRepository.ts` + `.test.ts`
- `mobile/src/app/onboarding/_layout.tsx`
- `mobile/src/app/onboarding/intensity.tsx` + `.test.tsx`
- `mobile/__mocks__/expo-sqlite.ts`
- `mobile/.expo/types/router.d.ts` (regenerated, not hand-edited)

**Must not appear in the diff:** `useKanjiReadingPrimer.ts`, `useKanjiReadingPrimer.test.tsx`, `KanjiReadingPrimer.tsx`, `preferencesRepository.ts`, `GoalRing.tsx`, `SRSStageIndicator.tsx`, `FuriganaText.tsx`, `FuriganaOverrideControl.tsx`, `ExplainerSheet.tsx`, `explainerContent.ts`, `settings.tsx`.

Naming conventions in play (architecture.md § Naming Patterns): components `PascalCase.tsx` with a named export matching the filename and no default export — **except** files under `src/app/`, which are expo-router screens and use `export default` (see every existing screen). Logic/registry files `camelCase.ts`. Tests co-located. Semantic NativeWind tokens only, no raw hex. Directories `kebab-case` (`cards/`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1: Card Registry & Day-1 Beginner Deck] — acceptance criteria, beginner-path-only gate, `card_seen` schema
- [Source: _bmad-output/planning-artifacts/epics.md#Dev Notes — Epic 7] — file inventory, the 2026-08-07 primer decision, out-of-scope list, sync-repository convention
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — table/column/file naming, `Record` and token rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — co-located tests, one component per file, no barrels in `core/`
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries] — repositories are the only SQLite accessors; UI reads through hooks
- [Source: _bmad-output/brainstorming/brainstorm-onboarding-experience-2026-07-27/brainstorm.html] — SYNTHESIS 3 (one registry, three surfaces), SYNTHESIS 4 (real curriculum items, never mockups), SYNTHESIS 7 (the keep-test), CHOSEN DIRECTIONS a–d; "show one real sentence with and without artificial spaces" is the spacing card's origin
- [Source: mobile/src/data/hooks/useKanjiReadingPrimer.ts:56] — mark-seen-on-visible precedent
- [Source: mobile/src/app/onboarding/intensity.tsx:29] — the routing line to change
- [Source: mobile/src/data/user/onboardingPathUtils.ts:14] — why `isImportOnboardingPath` ≠ `path === 'import'`
- [Source: mobile/__mocks__/expo-sqlite.ts:1192] — `FROM items` branch with no slug handling
- [Source: mobile/src/core/content/passageBodyParts.ts] — alternating span/interstitial parts, furigana kept intact
- [Source: CLAUDE.md#Hard conventions] — dual DB, never write to `curriculum.db`, numbered migrations, semantic tokens

## Dev Agent Record

### Agent Model Used

claude-opus-5 (bmad-dev-story workflow)

### Debug Log References

- `npm run lint` — 0 errors, 1 pre-existing warning (`browse/passage/[id].test.tsx` require-import), untouched by this story.
- `npm run typecheck` — clean.
- `npm test` — 217 suites / 1871 tests passing.
- Typed-routes check: `.expo/types/router.d.ts` regenerated itself during `npm run typecheck`, and `/onboarding/day-one` resolves. Verified the guard is real by temporarily pointing the push at a bogus route — `tsc` rejected it — then restoring. The file is gitignored (`mobile/.gitignore:7`), so it is not part of the diff.

### Completion Notes List

**Deviations from the epic's sketch (both flagged in Dev Notes, both taken):**

- Registry lives at `components/onboarding/cardRegistry.ts`, not `core/onboarding/`. `GuidanceCard.Render` is a `React.ComponentType`; putting it in `core/` would have been the first `core → components` dependency in the codebase.
- Migration named `019_card_seen.ts`, not `019_card_registry.ts`, matching the existing convention of naming a migration for the table it creates.

**Two files changed outside the story's declared file set**, both because appending migration 019 invalidated an assertion that hard-coded 018 as the last registered migration:

- `018_ai_session_topic_ids.test.ts` — "registered last" → "registered in version order" (`migrations[17]`).
- `migrationRunner.test.ts` — expected last-migration name updated to `019_card_seen`.

Both are regressions caused directly by this story's change rather than opportunistic edits; no production code outside the declared set was touched.

**Mock work (the flagged failure mode) done and proven:**

- `applySql` gained an `INSERT INTO card_seen` branch honouring `DO NOTHING` (first `seen_at` wins); `queryRows` gained a `FROM card_seen` branch with `WHERE card_id = ?`. Seen-state assertions read back through `isCardSeen`, so they would fail without both.
- The `FROM items` branch gained a `WHERE item_type = ? AND slug = ?` filter placed *before* the generic filters. The `getItemBySlug` test seeds the same slug on two item types and asserts no cross-type leak — without the branch the whole table returns and the first row wins.
- `cardSeenRepository.test.ts` uses fake timers for the re-mark case; on a real clock two calls land in the same millisecond and the assertion would be vacuous.

**Behaviour notes:**

- The day-one screen snapshots its unseen-card list at mount (`useState` initialiser). Re-filtering per render would pull the current card off screen the instant it is marked seen.
- Skip marks *every* deck card from `DECK_CARDS`, not only the ones still unseen on screen, and the cards stay in `GUIDANCE_CARDS` for 7.2's Settings library.
- Missing-slug handling follows the no-hidden-fallback rule: a card omits the row (or renders nothing) — no substitute item, no "content unavailable" copy. Covered by a test per card.
- AC #11 held: `useKanjiReadingPrimer.ts`, its test, `KanjiReadingPrimer.tsx` and `seenKanjiReadingPrimer` are absent from the diff.

### File List

**New**

- `mobile/src/data/migrations/019_card_seen.ts`
- `mobile/src/data/migrations/019_card_seen.test.ts`
- `mobile/src/data/user/cardSeenRepository.ts`
- `mobile/src/data/user/cardSeenRepository.test.ts`
- `mobile/src/components/onboarding/cardRegistry.ts`
- `mobile/src/components/onboarding/cardRegistry.test.ts`
- `mobile/src/components/onboarding/cards/ThreeScriptsCard.tsx`
- `mobile/src/components/onboarding/cards/ThreeScriptsCard.test.tsx`
- `mobile/src/components/onboarding/cards/WordSpacingCard.tsx`
- `mobile/src/components/onboarding/cards/WordSpacingCard.test.tsx`
- `mobile/src/app/onboarding/day-one.tsx`
- `mobile/src/app/onboarding/day-one.test.tsx`

**Modified**

- `mobile/src/data/migrations/index.ts`
- `mobile/src/data/curriculum/itemRepository.ts`
- `mobile/src/data/curriculum/itemRepository.test.ts`
- `mobile/src/app/onboarding/_layout.tsx`
- `mobile/src/app/onboarding/intensity.tsx`
- `mobile/src/app/onboarding/intensity.test.tsx`
- `mobile/__mocks__/expo-sqlite.ts`
- `mobile/src/data/migrations/018_ai_session_topic_ids.test.ts` (outside declared set — see notes)
- `mobile/src/data/migrations/migrationRunner.test.ts` (outside declared set — see notes)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-08-08 — Story created. Status → ready-for-dev.
- 2026-08-08 — Implemented card registry, `card_seen` storage, both day-1 cards, the day-one deck screen and the beginner routing branch. Lint/typecheck/full suite green. Status → review.
- 2026-08-08 — Code review (3 layers: blind, edge-case, acceptance). All 13 ACs pass. 5 patches applied (double-tap guards + clamp on the deck screen, mock `ON CONFLICT` strictness, 019 test assertion style, `ComponentType` type import); 3 findings deferred to `deferred-work.md`; 7 dismissed as spec-mandated. Full suite re-run green (217/217). Status → done.
