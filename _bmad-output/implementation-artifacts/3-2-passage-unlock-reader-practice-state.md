---
baseline_commit: 3b47d54
---

# Story 3.2: Passage Unlock, Reader & Practice State

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want passages to unlock when I’m mostly ready, show what’s missing when locked, and remember practice answers,
so that reading feels like a destination I can work toward — not a dead end.

## Acceptance Criteria

1. **Given** a passage with linked vocabulary and grammar  
   **When** unlock is evaluated  
   **Then** it unlocks when ≥90% of linked vocab+grammar are Guru or above (FR68)  
   **And** a single leech cannot keep the passage fully locked  

2. **Given** a locked passage  
   **When** I tap it  
   **Then** I see the specific vocab/grammar still needed as a to-do list (FR69, UX-DR14)  
   **And** I am not shown a dead-end empty state  

3. **Given** the curriculum compile pipeline  
   **When** passages are compiled  
   **Then** bilingual one-line summaries and authored word-boundary spans linking vocabulary `item_id`s are emitted into `curriculum.db`  

4. **Given** an unlocked passage reader  
   **When** I long-press a word with an authored boundary  
   **Then** meaning/reading/details open in place (FR70)  
   **And** a visible non-gesture alternative exists for the same action (NFR29, UX-DR15)  

5. **Given** I previously answered comprehension inputs correctly  
   **When** I reopen the passage  
   **Then** `passage_practice_results` are read back to show completed state and disable already-correct inputs (FR70)  
   **And** BUG5 is fixed (results are no longer write-only)

## Tasks / Subtasks

- [x] **Task 1 — Curriculum pipeline: summaries + links + word spans** (AC: #3, #1)
  - [x] Extend `curriculum.schema.json` `readingPassage`: required/optional `summary_ja`, `summary_en` (one-line each); `word_spans` array of `{ vocabulary_slug, start, end }` (UTF-16/JS string indices into `body`, inclusive-start exclusive-end) OR equivalent authored markers — pick one format and document it in compile comments.
  - [x] Extend `scripts/curriculum-schema.ts` DDL:
    - `reading_passages.summary_ja TEXT`, `summary_en TEXT`
    - New `passage_word_spans (id, passage_id, vocabulary_item_id, start_offset, end_offset, sort_order)` + index on `passage_id`
  - [x] Update `scripts/compile-curriculum.ts` to insert summaries and resolve `vocabulary_slug` → `items.id` for spans; reject unknown slugs at compile (same pattern as existing link slug resolution).
  - [x] Update validate-schema / compile tests + fixtures under `scripts/__fixtures__/`.
  - [x] **Author content** in `curriculum/readings/n5.json` and `n4.json`:
    - `vocabulary_slugs` / `grammar_slugs` on every shipped passage (unlock is meaningless without links)
    - `summary_ja` / `summary_en` one-liners (searchable + Browse row)
    - `english_translation` where still null (helps interim EN fallback and comprehension)
    - `word_spans` for a representative subset of vocab in each body (enough to demo long-press — not every particle)
  - [x] Recompile and refresh Git LFS `mobile/assets/curriculum-seed/curriculum.db` (`npm run validate-schema` + `npm run compile-curriculum` from repo root).
  - [x] Devices already installed pick up content via the existing curriculum OTA/swap path — do **not** add a user.db migration for summaries/spans (curriculum-only).

- [x] **Task 2 — Unify unlock evaluation + batch reads** (AC: #1)
  - [x] **Reuse** `computePassageUnlock` + `PASSAGE_UNLOCK_COVERAGE` — do not reimplement 90% math.
  - [x] Settle empty-link policy (document in code + here):  
    | Caller | Today | After 3.2 |
    | --- | --- | --- |
    | `computePassageUnlock` | locked, remaining 0 | unchanged (pure math) |
    | Browse `listPassageUnlockStates` | unlinked → unlocked | keep unlocked (avoid dead-end when links missing) |
    | Home `useReadingReadiness` | skips unlinked | unchanged |
    | Passage route gating | none | if linkedCount=0 → treat as unlocked reader (same as Browse) |
  - [x] Add pure helper e.g. `listNeededItemsForPassage(linkedIds, stageByItemId) → itemId[]` (items not Guru+) for FR69 — lives in `core/content/` next to unlock.
  - [x] Batch unlock I/O (deferred-work): replace per-passage N+1 in `useReadingReadiness` and tighten `listPassageUnlockStates` with batched link + SRS fetches where cheap (single pass over link tables, one `getSrsStatesForItems` for the union of ids).

- [x] **Task 3 — Locked passage → needed-items to-do (FR69)** (AC: #2)
  - [x] Tap locked Browse row → `/browse/passage/[id]` still, but screen branches:
    - **Locked:** title + bilingual summary (when present) + “N to go” framing + **to-do list** of needed vocab/grammar (primary_form + meaning + type accent). Each row navigates to `/browse/item/[id]`. No comprehension practice section.
    - **Unlocked:** existing reader + practice (Task 4–5).
  - [x] Tone: destination / invitation (UX-DR14, UX-DR30) — never “blocked” dead end or empty padlock-only.
  - [x] Wire unlock status into `usePassageDetail` (or sibling hook): linked ids + SRS stages + `computePassageUnlock` + needed-item details via existing item reads.
  - [x] Update `PassageBrowseRow` / Browse tests: locked tap still opens route; assert to-do content on locked screen.

- [x] **Task 4 — Browse + repository plug-in for summaries** (AC: #3)
  - [x] `browseRepository`: SELECT `summary_ja` / `summary_en`; map `summaryJa` / `summaryEn` from real columns (keep `english_translation` fallback only if summary_en null).
  - [x] Extend search OR branches to include `summary_ja` / `summary_en`.
  - [x] `passageRepository` `PassageDetail`: expose summaries (+ spans via new `getPassageWordSpans` / `passageSpans` module per architecture tree).
  - [x] Passage reader header: show JA/EN one-line summary above body when present.

- [x] **Task 5 — Word spans + long-press + a11y alt (FR70 / NFR29)** (AC: #4)
  - [x] New data module: `mobile/src/data/curriculum/passageSpans.ts` (architecture name) — `getPassageWordSpans(db, passageId)`.
  - [x] Reader body: render spannable regions (do **not** break existing `FuriganaText` furigana toggle for non-span text). Preferred approach: compose body from spans + interstitial plain/`FuriganaText` segments; spannable tokens are `Pressable`/`Text` with `onLongPress` **and** `onPress` (or adjacent “Look up” control) opening the same detail sheet.
  - [x] In-place detail: bottom sheet / modal with meaning, reading, link to full `/browse/item/[id]` — reuse item fields from `getItemById` / detail snippets; do not invent a second detail screen.
  - [x] NFR29 / UX-DR15 / OA7: every long-press target must have a **visible** non-gesture alternative (short tap on the word, or a per-word “ⓘ” / “Look up” control). Screen-reader: `accessibilityRole="button"`, label includes the surface form + “show word details”, and/or `accessibilityActions` with activate → same sheet. Do not ship gesture-only.
  - [x] Words without authored spans remain non-interactive (no auto-segmentation).

- [x] **Task 6 — Practice read-back polish (BUG5 / FR70)** (AC: #5)
  - [x] Confirm `usePassageDetail` already calls `getPassagePracticeResults` — keep that path; add regression tests if thin.
  - [x] Fix disable semantics in `PassageQuestion`: disable input **only when `isCorrect`** (`editable={savedResult?.isCorrect !== true}` / local `result !== 'correct'`). Incorrect answers stay editable so the learner can retry; upsert still overwrites PK `(passage_id, question_id)`.
  - [x] On reopen: correct answers show completed feedback + disabled input; incorrect show prior answer editable with prior feedback until resubmit.

- [x] **Task 7 — Verification**
  - [x] Unit: unlock still passes leech case (19/20); needed-items lists only non-Guru+; empty links → unlocked gate; span compile rejects bad slug / out-of-range offsets.
  - [x] Repo: summaries round-trip; spans join vocabulary ids; Browse search hits summary columns.
  - [x] UI/RNTL: locked → to-do (not practice); unlocked → reader; long-press + tap alt open same sheet; correct inputs disabled on reload; incorrect still editable.
  - [x] Gates: `npm run validate-schema`, `npm run compile-curriculum` (root); from `mobile/`: `npm run typecheck`, `npm run lint`, `npm test`.

### Review Findings

- [x] [Review][Patch] Hide accepted-answer feedback until the answer is correct (incorrect stays retryable without reveal) [`PassageQuestion.tsx:72`]
- [x] [Review][Patch] Nested FuriganaText Pressables steal span taps (NFR29 broken for annotated spans) [`PassageBody.tsx:61`]
- [x] [Review][Patch] Locked passage unlock state never refreshes on focus after studying needed items [`usePassageDetail.ts:69`]
- [x] [Review][Patch] Compile does not assert span surface matches vocabulary `primary_form` [`compile-curriculum.ts:707`]
- [x] [Review][Patch] JSON schema allows invalid span ranges (`end ≤ start`) [`curriculum.schema.json:284`]
- [x] [Review][Patch] Duplicate `testID`s when the same vocab is spanned twice [`PassageBody.tsx:69`]
- [x] [Review][Defer] Malformed `bodyFurigana` can desync span offsets from rendered text [`passageBodyParts.ts:45`] — deferred, pre-existing

## Dev Notes

### Scope boundary (critical)

| In 3.2 | Out → later |
| --- | --- |
| Pipeline `summary_ja/en` + `passage_word_spans` + authored links on seed passages | AI-generated stories (post-MVP) |
| FR68 unlock wired end-to-end on Browse tap + reader gate | FlashList / New Arch (Epic 5) |
| FR69 needed-items to-do surface | Visible “← you learned this” reinforcement highlights (FR12 narrative — not this AC set) |
| FR70 long-press + visible a11y alt | OA7 *exact* pattern polish beyond a working visible alt |
| BUG5: correct-only disable + read-back regressions | Epic 4 lesson/details split |
| Batch unlock N+1 (deferred from 2.2) | Formal NFR22 Browse harness / FTS5 |
| Plug Browse summaries into existing row props | Removing legacy `learn/*` / `read/*` redirects |

### Current state (must read before coding)

| Area | Today | This story changes |
| --- | --- | --- |
| Unlock math | `core/content/passageUnlock.ts` (2.2) — correct | Reuse; add needed-items helper; batch I/O |
| Seed links | **0** vocab/grammar links in bundled DB | Author slugs + recompile |
| Summaries | No columns; Browse `summaryEn` ← `english_translation` | Real columns + search |
| Word spans | Missing | Schema + compile + reader |
| Locked tap | Opens full reader (practice visible) | Locked branch = to-do only |
| Long-press | None in `mobile/src` | Spans + sheet + a11y alt |
| Practice | `getPassagePracticeResults` already used | Fix `editable={result === null}` → correct-only |
| Routes | `/browse/passage/[id]` + `/read/[id]` redirect | Keep; deepen `PassageDetailScreen` |
| Empty links | Browse unlocks; helper locks; readiness skips | Document + gate like Browse |

### Architecture compliance

- **Derived unlock only** — never a `passage_unlock` user table; SRS coverage via ATTACH / existing SRS reads.
- **Three-layer purity:** unlock / needed-items in `core/`; SQL in `data/curriculum/`; hooks wire; UI presentational.
- **Dual DB:** curriculum compile only for summaries/spans/links; practice stays in `user.db` migration 004 (no new user migration unless unavoidable).
- **Result type** for fallible async; sync SQLite may return plain values (match repos).
- **NativeWind** semantic tokens; passage accent `content-reading` / `PASSAGE_CONTENT_*`.
- **View permission ≠ lesson eligibility:** do not reintroduce BUG7 dependency dimming on Browse items.

### Anti-patterns (do NOT)

- Do not reimplement 90% Guru+ math — call `computePassageUnlock`.
- Do not add a persisted unlock table.
- Do not show comprehension practice on a locked passage.
- Do not auto-tokenize the whole body without authored spans.
- Do not ship `onLongPress` without a visible non-gesture path (NFR29).
- Do not disable inputs after an incorrect answer (retry required).
- Do not write to `curriculum.db` at runtime.
- Do not invent FlashList / New Arch here.
- Do not confuse historical `_bmad-output/implementation-artifacts/3-2-wanikani-*.md` (old epic numbering) with this story.
- Do not break furigana toggle on non-span text while adding span presses.

### Settled product meanings

| Term | Meaning for 3.2 |
| --- | --- |
| Guru+ | `guru` \| `master` \| `enlightened` \| `burned` |
| Unlock threshold | `coverage >= PASSAGE_UNLOCK_COVERAGE` (0.9); remaining = `ceil(n*0.9) - guruOrAbove` |
| Needed item | Linked vocab/grammar whose stage is missing or below Guru |
| Unlinked passage | Treat as unlocked for Browse/reader gate; hide from Home readiness |
| In place | Sheet/modal over reader — not a forced navigate away (full item route is optional secondary) |
| BUG5 fixed | Results read on open; UI reflects completed correct state |

### Reuse map

| Need | Reuse |
| --- | --- |
| Unlock math | `computePassageUnlock`, `PASSAGE_UNLOCK_COVERAGE` |
| Links | `getPassageLinkedItemIds`, link tables |
| Browse lock facet / chips | `listPassageUnlockStates`, `BrowsePassageRow` |
| Passage UI shell | `PassageDetailScreen`, `PassageReader`, `PassageQuestion` |
| Practice I/O | `upsertPassagePracticeResult`, `getPassagePracticeResults` |
| Answer eval | `evaluatePassageAnswer` |
| Item detail target | `/browse/item/[id]`, `getItemById` / `ItemDetailScreen` fields |
| Furigana | `FuriganaText`, `parseFurigana` |
| Accent | `PASSAGE_CONTENT_ACCENT` / `PASSAGE_CONTENT_LABEL` |
| Compile slug resolve | Existing vocab/grammar slug → id in `compile-curriculum.ts` |
| Home readiness | `useReadingReadiness` — batch only; do not redesign FR60 UI |

### Files being modified — current behavior (UPDATE)

**`PassageDetailScreen` / `PassageReader`**  
Today: always loads body + questions + practice; no lock branch; body is one `FuriganaText`.  
Change: branch on unlock; locked → to-do list; unlocked → summary header + spannable body + practice.  
Preserve: loading / not-found, practice local-state mirror, ScreenHeader back.

**`PassageQuestion`**  
Today: `editable={result === null}` locks after any answer; `usePassageDetail` already read-backs.  
Change: editable unless correct; keep upsert + feedback.  
Preserve: furigana prompts, a11y labels, accepted-answer feedback copy.

**`browseRepository` / `PassageBrowseRow`**  
Today: interim summaries; lock chip; tap → passage route; unlinked treated unlocked.  
Change: real summary columns + search; tap still navigates (locked content is on the destination).  
Preserve: UNION pagination, fail-closed missing unlock map, BUG7 (no item locks).

**`passageUnlock.ts`**  
Today: pure FR68 math; empty links → locked.  
Change: optional sibling needed-items helper; do not alter empty-link math without updating all callers.

**`useReadingReadiness`**  
Today: correct pick logic; N+1 per passage.  
Change: batch fetches; same selection semantics.

**Compile / schema / readings JSON**  
Today: supports slug links + english_translation; seed has neither links nor summaries/spans.  
Change: schema + compile + authored content + LFS db.

### File structure (expected)

**New:**
- `mobile/src/data/curriculum/passageSpans.ts` (+ test)
- `mobile/src/core/content/passageNeededItems.ts` (or export from `passageUnlock.ts`) (+ test)
- `mobile/src/components/read/PassageLockedTodo.tsx` (or equivalent)
- `mobile/src/components/read/PassageWordDetailSheet.tsx` (or equivalent)
- `mobile/src/components/read/PassageBody.tsx` (spannable body composer) if `PassageReader` gets too heavy

**Update:**
- `curriculum/schema/curriculum.schema.json`
- `curriculum/readings/n5.json`, `n4.json`
- `scripts/curriculum-schema.ts`, `compile-curriculum.ts` (+ tests/fixtures)
- `mobile/assets/curriculum-seed/curriculum.db` (LFS)
- `mobile/src/data/curriculum/passageRepository.ts` (+ test)
- `mobile/src/data/curriculum/browseRepository.ts` (+ test)
- `mobile/src/data/hooks/usePassageDetail.ts` / `useReadingReadiness.ts` (+ tests)
- `mobile/src/components/read/PassageDetailScreen.tsx`, `PassageReader.tsx`, `PassageQuestion.tsx` (+ tests)
- `mobile/src/components/browse/PassageBrowseRow.tsx` only if summary/a11y copy needs tweaks
- `mobile/src/app/(tabs)/browse/passage/[id].test.tsx`

### Testing requirements

- Pure: unlock leech; needed-items filter; span offset validation helpers if any.
- Compile: fixture with summaries + spans + slugs; unknown slug fails validate/compile.
- Repo: `getPassageWordSpans`; Browse maps summaries; search hits `summary_*`.
- UI: locked to-do navigation to item; unlocked long-press + tap alt; practice correct disabled / incorrect retry on reload.
- Gates as in Task 7. Watch expo-sqlite mock WHERE/COUNT pitfalls (`deferred-work.md`).

### Previous story intelligence (3.1)

- Browse UNION, lock facet, interim summary props, `/browse/passage/[id]` wrappers, Talk placeholder — **extend**, don’t rebuild.
- Passage unlock is resolved **before** Browse SQL and bound as ids — keep that pattern when summaries change SELECT list.
- Unlock map fail-closed (missing status → locked row) — preserve.
- FR69 / summaries / spans / long-press / BUG5 disable semantics were **explicitly deferred** to this story.
- Do not reintroduce Learn/Read tabs or item dependency locking.
- Co-located Jest; avoid `_layout.test.tsx` beside Expo Router layouts (use `__tests__/`).
- Stable `useDatabase` mock objects in hook tests (avoid infinite re-render).

### Git intelligence

Recent: `3b47d54` finalize Browse 3.1; Home triage / goal ring / review pacing before that. Patterns: pure `core/` helpers, ATTACH Browse, NativeWind tokens, Result-friendly hooks, RNTL + fake timers for debounce. Mirror those — no new UI kit.

### Latest tech notes

- **NFR29:** Prefer spannable `Text`/`Pressable` with both `onPress` (visible alt) and `onLongPress` calling the same handler; set `accessibilityRole="button"` and a clear label. RN may auto-assign `link` role when press handlers exist — override to `button` for “show details”. Optional `accessibilityActions` for screen readers.
- **Offsets:** Author spans against `body` (not furigana markup). Validate `0 <= start < end <= body.length` at compile.
- **LFS:** After recompile, ensure `curriculum.db` is committed via Git LFS pointers.
- **Content volume:** Prefer complete link+summary coverage on all N5/N4 passages; word_spans can be partial per passage if long-press is demonstrably covered on each.

### Project Structure Notes

Aligns with architecture: `browse/passage/[id]`, `data/curriculum/passageSpans`, pipeline emits summaries + spans, unlock derived from graph links + Guru+ coverage. Max Browse drill-down remains ~2 (list → passage / item).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3 Story 3.2 ACs]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR66–FR70, FR8b/c amended, BUG5, NFR29, OA7]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — passage summaries/spans; derived unlock; `passageSpans`; Browse]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR14–15, UX-DR30, UX-DR32]
- [Source: `_bmad-output/planning-artifacts/.decision-log.md` — R3]
- [Source: `_bmad-output/implementation-artifacts/3-1-unified-browse-list-search-filters.md` — handoffs / interim summaries]
- [Source: `_bmad-output/implementation-artifacts/2-2-home-triage-post-session-proof-days-studied.md` — unlock helper]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — `useReadingReadiness` N+1]
- [Source: `mobile/src/core/content/passageUnlock.ts`]
- [Source: `mobile/src/components/read/PassageQuestion.tsx` — `editable={result === null}`]
- [Source: `scripts/curriculum-schema.ts` — `reading_passages` DDL]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- **Template-literal break in DDL** — the `passage_word_spans` SQL comment originally used backticks around `body`, which terminated the `curriculum-schema.ts` template literal (TS1005). Rewrote the comment without backticks.
- **Span extraction false positives** — first pass of authored `word_spans` matched short all-kana forms across particle boundaries (`はい` spanning `は` + `いい` in 天気/週末) and sliced kanji compounds (`大学` inside 大学生). Added two authoring guards: skip all-hiragana forms shorter than 4 chars, and reject a match whose adjacent outside character is kanji when the match's boundary char is kanji. All 142 resulting spans were then verified to be genuine words.
- **expo-sqlite mock gaps** — `passage_word_spans` had no handler (returned `[]` silently) and `FROM items` ignored `WHERE id IN (...)` (would have returned the whole table). Added both, honouring WHERE/ORDER BY rather than dropping them — the pitfall called out in `deferred-work.md`.
- **Furigana/span offset mismatch** — spans index the plain `body` while readings live in bracket-annotated `bodyFurigana`. Resolved by walking `parseFurigana` segments and assigning each to the overlapping span; annotated runs stay atomic, unannotated segments split exactly on the boundary so `parseFurigana`'s merged trailing punctuation (`昨日、`) stays out of the pressable word.

### Completion Notes List

**Task 1 — pipeline.** Schema gains `summary_ja` / `summary_en` / `word_spans` (`{vocabulary_slug, start, end}`, UTF-16 indices into `body`, inclusive-start/exclusive-end — documented in the DDL and compile types). New `passage_word_spans` table + index. Compile resolves slugs to item ids and rejects unknown slugs, out-of-range offsets, non-increasing ranges, and overlapping spans. All 19 shipped passages authored with summaries, `english_translation`, vocab+grammar links and spans: **132 vocab links, 92 grammar links, 142 spans, min 3 spans/passage**. `curriculum.db` recompiled (Git LFS tracked; confirmed via `git check-attr filter`). No user.db migration — curriculum-only, so installed devices pick this up via the existing OTA swap.

**Task 2 — unlock unification + batching.** `computePassageUnlock` reused untouched; new pure sibling `listNeededItemsForPassage` (order-preserving, de-duplicating) shares the now-exported `GURU_PLUS` set rather than redefining Guru+. `getAllPassageLinkedItemIds` replaces the per-passage N+1 in both `listPassageUnlockStates` and `useReadingReadiness` — one pass per link table plus a single SRS read for the union. Selection semantics unchanged. Empty-link policy implemented and documented in code exactly as the story table specifies.

**Task 3 — locked to-do (FR69).** `usePassageDetail` now derives unlock and, while locked, skips reader-only reads entirely and resolves needed items via new batched `listItemSummariesByIds`. `PassageLockedTodo` shows title + bilingual summary + "N to go" + the needed vocab/grammar as tappable rows into `/browse/item/[id]`, with type accents. Comprehension practice is absent while locked. Tone is destination-framed ("Get these to Guru and this passage opens up"), never a bare padlock.

**Task 4 — summaries.** `browseRepository` selects and maps the real columns; `english_translation` demoted to a fallback used only when `summary_en` is null. Search now ORs across `summary_ja` / `summary_en` too (per-branch LIKE count raised 2 → 4). `PassageDetail` exposes summaries and the reader shows the JA/EN one-liner above the body. Stale "Story 3.2 hasn't shipped yet" comments removed from `browseRepository` and `PassageBrowseRow`.

**Task 5 — spans + a11y (FR70 / NFR29).** New `passageSpans.ts` data module, pure `buildPassageBodyParts` composer, `PassageBody` renderer and `PassageWordDetailSheet`. Furigana behaviour is preserved by handing each run's annotated substring back to `FuriganaText` rather than reimplementing rendering. **NFR29 is satisfied by construction:** every span responds to a plain `onPress` as well as `onLongPress`, is `accessibilityRole="button"` labelled `"<word>, show word details"`, exposes an `activate` accessibility action, and is visibly underlined — the gesture is never the only route. Words without an authored span stay inert; no auto-segmentation.

**Task 6 — BUG5.** `editable={!isCorrect}`: correct answers disable the input and remove the submit control; incorrect answers stay editable and the button becomes "Try again", with prior feedback held until resubmit. Read-back through `getPassagePracticeResults` was already wired and is now covered by regression tests on reopen for both outcomes. Accepted-answer feedback copy preserved as instructed.

**Task 7 — verification.** Root: `validate-schema` (12 files; 2 pre-existing furigana warnings on `shi-num`/`ku-num`, unrelated), `compile-curriculum`, `check-contrast` (72 pairs pass), `npx jest scripts/` (44 tests). Mobile: `typecheck` clean, `lint` clean, `npm test` — **1151 tests / 144 suites, all passing**.

Also closed the `useReadingReadiness` N+1 entry in `deferred-work.md`.

### File List

**New**
- `mobile/src/core/content/passageNeededItems.ts` (+ `.test.ts`)
- `mobile/src/core/content/passageBodyParts.ts` (+ `.test.ts`)
- `mobile/src/data/curriculum/passageSpans.ts` (+ `.test.ts`)
- `mobile/src/components/read/PassageLockedTodo.tsx`
- `mobile/src/components/read/PassageBody.tsx`
- `mobile/src/components/read/PassageWordDetailSheet.tsx`

**Modified**
- `curriculum/schema/curriculum.schema.json`
- `curriculum/readings/n5.json`, `curriculum/readings/n4.json`
- `scripts/curriculum-schema.ts`, `scripts/compile-curriculum.ts` (+ `compile-curriculum.test.ts`, `validate-schema.test.ts`)
- `scripts/__fixtures__/valid/readings/n5.json`
- `mobile/assets/curriculum-seed/curriculum.db` (Git LFS)
- `mobile/__mocks__/expo-sqlite.ts`
- `mobile/src/core/content/passageUnlock.ts`
- `mobile/src/data/curriculum/passageRepository.ts` (+ `.test.ts`)
- `mobile/src/data/curriculum/browseRepository.ts`
- `mobile/src/data/curriculum/itemRepository.ts`
- `mobile/src/data/hooks/usePassageDetail.ts`
- `mobile/src/data/hooks/useReadingReadiness.ts`
- `mobile/src/components/read/PassageDetailScreen.tsx`
- `mobile/src/components/read/PassageReader.tsx`
- `mobile/src/components/read/PassageQuestion.tsx`
- `mobile/src/components/browse/PassageBrowseRow.tsx`
- `mobile/src/app/(tabs)/browse/passage/[id].test.tsx`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-20 — Story context created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-07-20 — Implemented all 7 tasks. Pipeline emits summaries + `passage_word_spans`; all 19 passages authored with links/summaries/spans; unlock unified with a needed-items helper and batched I/O (closes the 2.2 N+1); locked passages show a needed-items to-do instead of the reader; word spans support long-press *and* tap with a labelled button role (NFR29); BUG5 fixed so only correct answers lock the input. Gates: typecheck, lint, 1151 mobile tests, 44 script tests, validate-schema, compile-curriculum, check-contrast — all green. Status → review.
- 2026-07-20 — Code review patches applied: hide accepted answers until correct; `FuriganaText interactive={false}` for spans; focus-refetch unlock; compile surface==primary_form; schema `$data` end>start; unique span testIDs. Status → done.
