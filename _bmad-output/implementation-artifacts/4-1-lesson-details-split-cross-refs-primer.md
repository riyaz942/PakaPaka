---
baseline_commit: 82dc757
---

# Story 4.1: Lesson / Details Split, Cross-Refs & Primer

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want lessons paced in three clear sections and details pages that show honest cross-links and study status,
so that studying an item feels guided while browsing an item never pretends to be a lesson.

## Acceptance Criteria

1. **Given** I start a lesson for an item  
   **When** the lesson UI loads  
   **Then** it uses a three-section paged flow: Introduction → Mnemonic → Examples & links, advanced by Continue (FR71, UX-DR16)  
   **And** section content is authored once into the correct surface (lesson vs details)

2. **Given** I open an item details page  
   **When** the page renders  
   **Then** it is a single vertical scroll with sections collapsible behind disclosures (FR71)  
   **And** the details page is never a lesson entry point (FR76)

3. **Given** any content type on details  
   **When** cross-references render  
   **Then** they come from dependency edges: radical→example kanji, kanji→vocabulary using it, vocabulary→component kanji (browsable), grammar→vocabulary using the pattern (FR72)

4. **Given** a section heading that needs an explainer (on'yomi/kun'yomi, radical, burned, transitive, etc.)  
   **When** I use the info affordance on `SectionHeading`  
   **Then** an explainer opens as a bottom sheet (FR73, UX-DR16)

5. **Given** I am an absolute beginner (onboarding path) and have not seen the kanji reading primer  
   **When** I reach the first kanji that has both reading types  
   **Then** an on'yomi/kun'yomi primer is shown unprompted as section-1 content (FR74, UX-DR17)  
   **And** `seenKanjiReadingPrimer` is set so it does not repeat; the primer remains reachable via heading info later

6. **Given** my study status for the viewed item  
   **When** the details page shows  
   **Then** a passive non-blocking study-status banner orients me (locked → what’s needed; prereqs-met-not-started → “you haven’t studied this yet”; in-progress/known → nothing) (FR76)  
   **And** content stays fully visible in every state

7. **Given** curriculum accepted answers vs my personal synonyms  
   **When** I view accepted answers  
   **Then** they are behind a disclosure that does not collide with the synonyms editor naming (FR77)

8. **Given** personal mnemonic for an item  
   **When** I view or edit it  
   **Then** empty shows a muted “add your own” line; saved shows text with edit + delete (delete confirms); editing disables Save when empty (FR75, FR26b, UX-DR16)

## Tasks / Subtasks

- [x] **Task 0 — Split compositions first (D-DET-1)** (AC: #1, #2)
  - [x] **Do this before** adding cross-ref sections or both surfaces will be edited twice.
  - [x] Introduce distinct lesson vs details section assemblies under `components/lesson/` and `components/learn/` (or shared section atoms + two composers). Stop having `LessonItemView` render the same `*Detail` scroll as Browse.
  - [x] Keep shared atoms: `ItemDetailHeader`, `MnemonicSection`, `MnemonicImage`, chip presses, example sentence rows, `FuriganaText` usage.
  - [x] Remove reliance on `mnemonicCollapsible` for lessons — paging replaces it (prop may remain briefly for review if needed; do not invent a third collapse mode).
  - [x] Preserve review nested details at `/review/item/[id]` on the **details** composition (session must survive — do not push Browse from an active review).

- [x] **Task 1 — `SectionHeading` + info bottom sheet** (AC: #4)
  - [x] New `SectionHeading` with optional `infoTopic` (or equivalent) — replaces duplicated `text-body-sm uppercase text-secondary` headings.
  - [x] Info affordance opens a bottom sheet with shared explainer content. Prefer the existing RN `Modal` sheet pattern (`PassageWordDetailSheet`, `SessionExitSheet`, `FilterDrawer`) — do **not** add `@gorhom/bottom-sheet` / `@expo/ui` BottomSheet unless product requires detents this story cannot get from Modal.
  - [x] Ship at least the on'yomi/kun'yomi explainer as real content (markdown or static TSX). Stub/registry pattern OK for radical / burned / transitive topics so later content plugs in without API churn.
  - [x] A11y: 44px hit target on info control; sheet dismissible; labelled heading + button.

- [x] **Task 2 — Lesson three-section pager** (AC: #1, #5)
  - [x] Per item inside `/lesson`: sections **1 Introduction → 2 Mnemonic → 3 Examples & links**, advanced by Continue (not the outer “Got it — next” until section 3 completes).
  - [x] Outer session loop in `lesson/index.tsx` stays item-by-item (progress bar = items). Inner section index is local state per item (reset when `itemId` changes).
  - [x] Section mapping (author once into lesson surface):
    | Section | Contents |
    | --- | --- |
    | 1 Intro | Glyph/header, meaning, readings (kanji), radical image (radicals), grammar structure/forms overview — not examples/links |
    | 2 Mnemonic | Curriculum mnemonic (+ radical visual) + personal mnemonic content states |
    | 3 Examples & links | Example sentences + type-appropriate cross-refs |
  - [x] Primer (AC #5): when `getOnboardingPath() === 'beginner'` AND `seenKanjiReadingPrimer` unset AND current item is kanji with **both** on'yomi and kun'yomi readings → show primer as **section-1 content** (not a wall before the lesson). On show/dismiss-continue, set preference so it never auto-repeats.
  - [x] Manual/import paths: never unprompted; primer still reachable via `SectionHeading` info on readings thereafter.
  - [x] Prefer Continue copy that distinguishes inner sections from outer item advance (e.g. section Continue vs existing “Got it — next” / “Finish lesson”).
  - [x] Watch item (not AC): radicals with thin content may feel like wasted taps — ship three sections for all types unless UX clearly breaks; do not invent a two-section radical special-case without product sign-off.

- [x] **Task 3 — Details single-scroll + disclosures** (AC: #2, #6, #7, #8)
  - [x] `ItemDetailScreen` / type detail composers: one `ScrollView`; dense sections may sit behind disclosures (accepted answers, optional secondary blocks). Never add “Start lesson” CTA.
  - [x] `StudyStatusBanner` (new): passive, non-blocking; content always fully visible.
    | State | Banner |
    | --- | --- |
    | Locked (unmet prereqs) | What’s needed (chip/list of unmet parents) |
    | Prereqs met + `not_started` | “You haven't studied this yet” |
    | `in_progress` / `known` | _(nothing)_ |
  - [x] Wire study status via `getStudyStatusOrDefault` (existing) + existing lock/parents from `useItemDependencyStatus`. Thin hook OK (e.g. `useItemStudyStatus`).
  - [x] Replace always-open “Synonyms” curriculum list with **Accepted answers** disclosure; keep `UserSynonymEditor` label as “Your accepted answers” (or tighten naming so the two never collide — FR77).
  - [x] Reshape `PersonalMnemonicEditor` → content states (FR75): empty muted “add your own”; saved text + edit + delete (confirm); editing disables Save when empty. Reuse `getPersonalMnemonic` / `setPersonalMnemonic` / `clearPersonalMnemonic`. Mount on kanji/vocab/grammar (status quo); radicals remain without personal mnemonic unless already planned elsewhere.

- [x] **Task 4 — Type-appropriate cross-references** (AC: #3)
  - [x] **Reuse graph APIs** — do not invent a parallel relationship table:
    | Type | Edge / API | UI |
    | --- | --- | --- |
    | Radical → example kanji | `getRelatedItemsForItems` (`builds_on` children) | Browsable chips |
    | Kanji → vocab using it | `getRelatedItemsForItems` (`requires` children where child is vocabulary) | Browsable chips |
    | Vocab → component kanji | `getRequiredParentsForItems` / existing parents | Always-browsable chips — **never** collapse to only “Prerequisites met” |
    | Grammar → vocab using pattern | `getRelatedItemsForItems` (`reinforces` children) **or** new `getVocabLinksForGrammar` on `grammar_vocabulary_links` WHERE `grammar_item_id = ?` if related-items filter is awkward | Browsable chips |
  - [x] Keep vocab → grammar chips (`getGrammarLinksForVocab`) — already ships; place in Examples & links / details cross-ref area consistently.
  - [x] New chips navigate to `/browse/item/[id]` (not `/learn/item/…`). Inside review session details, keep `/review/item/[id]` so the review stack survives.
  - [x] Empty related sets: omit the section (no empty “Related” shells).
  - [x] Optional rename `KanjiDependencyHints` → neutral name (deferred-work note) when touching it — not required if timeboxed.

- [x] **Task 5 — Preferences: `seenKanjiReadingPrimer`** (AC: #5)
  - [x] Add key to `PREFERENCE_KEYS` + get/set helpers in `preferencesRepository.ts` (boolean string `'true'` pattern like other flags). **No user.db migration** — key/value prefs table already exists.
  - [x] Unit tests for get/set default.

- [x] **Task 6 — Verification**
  - [x] Unit: primer gating matrix (beginner+unseen+dual readings → show; manual/import/seen/single-reading → no unprompted); study-status banner states; related-item queries per type.
  - [x] Component/RNTL: lesson section Continue advances 1→2→3 then outer next; details has no Start lesson; accepted-answers disclosure; mnemonic empty/saved/edit/delete; SectionHeading opens sheet; cross-ref chips navigate.
  - [x] Gates from `mobile/`: `npm run typecheck`, `npm run lint`, `npm test` (targeted suites OK while iterating; full test before review).

### Review Findings

_(filled by code-review)_

## Dev Notes

### Scope boundary (critical)

| In 4.1 | Out → Story 4.2 / later |
| --- | --- |
| Split lesson vs details compositions (D-DET-1) | Furigana vocab-keyed auto-hide / **BUG6** |
| 3-section lesson paging + Continue | Tap-furigana peek model changes |
| Cross-refs from existing edges | Settings furigana overrides + reset |
| `SectionHeading` + info sheets + primer | Migration formerly labeled `015_furigana_overrides` — **note: `015_goal_ring_state` already exists; 4.2 must use next free migration id** |
| StudyStatusBanner + accepted-answers disclosure | CompareView + fulfilling Story 1.2 compare stub (FR80) |
| Personal mnemonic content states (FR75) | Curated lookalike content / schema (rejected — D-DET-2) |
| Prefer `/browse/item` links | Epic 5 Conversation / AI |

### Current state (must read before coding)

| Area | Today | This story changes |
| --- | --- | --- |
| Lesson UI | `LessonItemView` renders same `*Detail` as Browse with `size="lg"` + `mnemonicCollapsible` | Inner 3-section pager; distinct lesson composition |
| Details | Single scroll shared components; lock line or “Prerequisites met” only | Disclosures + banner + full cross-refs; no lesson CTA (already none — keep it) |
| Cross-refs | Thin: unmet parents / grammar chips on vocab / related grammar | All four FR72 directions |
| Primer / SectionHeading | **None** | New components + preference flag |
| Personal mnemonic | Always-open `TextInput` + Save | Content states |
| Accepted answers | Inline “Synonyms” + `UserSynonymEditor` “Your accepted answers” | Curriculum list behind disclosure; naming fixed |
| Study status on details | Not shown | Passive banner only |
| Graph reads | `getRelatedItemsForItems` used by review reinforcement, not details | Wire into details/lesson section 3 |

### Architecture compliance

- **D-DET-1:** Split lesson composition from details composition **before** adding cross-reference sections. [Source: `_bmad-output/planning-artifacts/.decision-log.md`]
- **Placement:** `app/lesson`, `browse/item`, `components/learn|lesson`, shared `SectionHeading` (learn/ or common/). [Source: `architecture.md` tree]
- **Dual DB:** curriculum read-only for edges/content; user writes only prefs + personal mnemonics (existing tables). No new curriculum schema for primers — app-authored explainer content.
- **Result type:** fallible async → `Result`; sync SQLite helpers may match existing void/plain returns (`mnemonicRepository`, `preferencesRepository`).
- **NativeWind** semantic tokens only — no deprecated `Colors` / raw hex.
- **View permission ≠ lesson eligibility:** details never gates or withholds content (FR76); banner orients only. Do not reintroduce BUG7 browse dimming.

### Anti-patterns (do NOT)

- Do not add cross-ref sections into shared `*Detail` **before** splitting lesson vs details (D-DET-1).
- Do not add “Start lesson” (or equivalent) on details.
- Do not hide/disable detail content based on lock or study status.
- Do not implement Compare, BUG6, furigana overrides, or migration `015_furigana_overrides` here.
- Do not add a primer row to curriculum JSON / schema — app content + preference flag only.
- Do not use `getKnownKanjiCharacters()` for anything new (BUG6 territory).
- Do not navigate from review details to `/browse/item` in a way that unmounts the review session — stay on `/review/item/[id]`.
- Do not confuse this story with historical `4-1-jlpt-learn-hub-and-per-type-item-lists.md` (old epic numbering).
- Do not pull in a new bottom-sheet library when `Modal` sheets already ship in-app.
- Do not leave `mnemonicCollapsible` as the primary lesson mnemonic UX after paging ships.

### Settled product meanings

| Term | Meaning for 4.1 |
| --- | --- |
| Lesson sections | Intro → Mnemonic → Examples & links; Continue advances sections; outer control advances items |
| Details | Single vertical scroll; disclosures OK; never a lesson entry |
| Absolute beginner | `getOnboardingPath() === 'beginner'` |
| Dual-reading kanji | At least one on'yomi **and** one kun'yomi row |
| Primer once | `seenKanjiReadingPrimer` preference `'true'` after first unprompted show |
| Cross-ref | From `item_relationships` / `grammar_vocabulary_links` — not curated lookalikes |
| Passive banner | Informational only; no CTA that starts a lesson |
| FR77 collision | Curriculum accepted answers vs user synonym editor must not share the same visible title |

### Reuse map

| Need | Reuse |
| --- | --- |
| Item payload | `useItemDetail`, `CurriculumItemDetail`, readings, examples |
| Lock / parents | `useItemDependencyStatus`, `getRequiredParentsForItems` |
| Related children | `getRelatedItemsForItems` (already tested in `itemRepository.test.ts`) |
| Vocab→grammar | `getGrammarLinksForVocab` |
| Study status | `getStudyStatusOrDefault`, `StudyStatus` |
| Onboarding path | `getOnboardingPath` |
| Prefs pattern | `PREFERENCE_KEYS` + get/set in `preferencesRepository` |
| Mnemonics I/O | `mnemonicRepository` (`clearPersonalMnemonic` already exists) |
| Sheet UX | `PassageWordDetailSheet` / `SessionExitSheet` Modal pattern |
| Header / mnemonic display | `ItemDetailHeader`, `MnemonicSection`, `MnemonicImage` |
| Lesson shell | `lesson/index.tsx` item loop, `startLessonItems`, progress bar — preserve commit-on-finish semantics |
| Detail routes | `/browse/item/[id]` (`ItemDetailScreen`); `/review/item/[id]` details composition |
| Content accents | `CONTENT_TYPE_ACCENT` / semantic tokens |

### Files being modified — current behavior (UPDATE)

**`LessonItemView.tsx` + `lesson/index.tsx`**  
Today: full detail scroll per item; outer Back / Got it — next / Finish; nothing committed until last item.  
Change: inner section pager per item; Continue for sections; keep outer item progression + finish commit/streak/load behavior.  
Preserve: empty/cap-reached states, close, progress accessibility, `startLessonItems` only on finish.

**`ItemDetailScreen.tsx` + `KanjiDetail` / `VocabularyDetail` / `RadicalDetail` / `GrammarDetail`**  
Today: one shared teach-card composition; thin dependency UX; always-open mnemonic + synonyms.  
Change: details-only composition with banner, disclosures, cross-refs, SectionHeading; lesson stops importing these as full cards (may share section atoms).  
Preserve: loading/not-found, KeyboardAvoidingView, ScreenHeader, furigana on examples (BUG6 unchanged).

**`PersonalMnemonicEditor.tsx`**  
Today: always-open input + Save (empty save clears via repo).  
Change: empty / saved / editing states per FR75; delete confirm; Save disabled when empty while editing.  
Preserve: one mnemonic per item; local-only storage.

**`KanjiDependencyHints.tsx`**  
Today: unmet “Learn first” / “Requires” chips → `/learn/item/…`.  
Change: always-browsable component chips for vocab/kanji parents; prefer `/browse/item/…`; do not replace StudyStatusBanner.

**`preferencesRepository.ts`**  
Today: no primer flag.  
Change: `seenKanjiReadingPrimer` key + helpers + tests.

**`itemRepository.ts` (maybe)**  
Today: `getRelatedItemsForItems` parent→child; `getGrammarLinksForVocab` vocab→grammar only.  
Change: only if grammar→vocab needs a dedicated query or typed helpers for details hooks; prefer wrapping existing related-items API.

### Previous story intelligence (3.2)

- Prefer **reuse over reimplementation** (unlock math pattern → here: graph queries).
- Document settled empty-state policies in the story and code comments.
- Modal sheet + visible a11y controls are the house pattern for overlays.
- Keep review/browse route boundaries strict.
- Code review will nail edge cases (nested Pressables, focus refresh) — write tests for primer gating and banner states up front.
- Historical deferred items (`4-6` mnemonic tests, `KanjiDependencyHints` rename) are optional polish while touching those files — not blockers.

### Git intelligence

Recent work (`82dc757` and Epic 3): Browse as canonical discovery, passage sheets, Result-friendly user writes, NativeWind tokens, dual-DB discipline. Lesson/details still pre-split — this story is the first Epic 4 change; mark `epic-4` in-progress when creating the story file.

### Latest tech notes

- Expo SDK 55 supports native `formSheet` / `@expo/ui` BottomSheet, but **this codebase already standardizes on RN `Modal` bottom sheets**. Match that unless you hit a hard limitation.
- No new npm dependency expected for 4.1.

### Project Structure Notes

- Path alias `@/*` → `mobile/src/*`.
- New UI: prefer `components/learn/` for details atoms and `components/lesson/` for lesson pager/composers; shared heading may live in `components/common/` if used outside learn.
- Tests colocated `*.test.ts(x)`.
- Do not treat `_bmad-output/` as backlog beyond this story file + `sprint-status.yaml`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4 / Story 4.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR71–FR77, FR26b, FR27]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Subsystem 5, file tree]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR16–17, SectionHeading / StudyStatusBanner]
- [Source: `_bmad-output/planning-artifacts/.decision-log.md` — D-DET-1, D-DET-2]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322.md`]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322-learn-page.md`]
- [Source: `mobile/src/components/lesson/LessonItemView.tsx`]
- [Source: `mobile/src/components/learn/ItemDetailScreen.tsx`]
- [Source: `mobile/src/data/curriculum/itemRepository.ts` — `getRelatedItemsForItems`]
- [Source: `mobile/src/data/user/preferencesRepository.ts` — `getOnboardingPath`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

Gates run from `mobile/`: `npx tsc --noEmit` (clean), `npm run lint` (0 errors; 1 pre-existing
`no-require-imports` warning in `browse/passage/[id].test.tsx`, untouched by this story),
`npm test` — **150 suites / 1192 tests passing**.

### Completion Notes List

**Task 0 — split compositions (D-DET-1).** `LessonItemView` no longer renders the Browse
`*Detail` scroll. Lesson content now lives in `components/lesson/LessonItemSections.tsx`
(intro / mnemonic / examples composers) and details in `components/learn/ItemDetailBody.tsx`.
Both surfaces share section atoms: `ItemDetailHeader`, `MnemonicSection`, `MnemonicImage`,
`ExampleSentencesSection`, `KanjiReadingsSection`, `ItemCrossReferences`, `PersonalMnemonicEditor`.
`mnemonicCollapsible` was removed from all four `*Detail` components — paging replaced it, and no
third collapse mode was invented. Browse and the review nested detail now share one
`ItemDetailBody`, so the two surfaces cannot drift; the review route wraps it in
`ItemLinkProvider base="/review/item"` so the session survives every cross-ref tap.

**Task 1 — `SectionHeading` + info sheet.** New `components/common/SectionHeading.tsx` replaces the
duplicated `text-body-sm uppercase text-secondary` headings. `ExplainerSheet` uses the in-app RN
`Modal` bottom-sheet pattern — no new dependency. All four explainer topics
(`onyomi-kunyomi`, `radical`, `burned`, `transitive`) ship authored copy in `explainerContent.ts`
rather than placeholders, so there is no "topic exists but has no content" state. Info control is
44×44 with a labelled button and dismissible sheet.

**Task 2 — three-section pager.** `lesson/index.tsx` owns `sectionIndex` (reset on item change);
`LessonItemView` renders the section for that index. Continue walks 1→2→3, then the outer control
("Got it — next" / "Finish lesson") advances the item. Back rewinds sections before items, and
re-entering an earlier item restarts it at its introduction. The progress bar stays item-based and
`startLessonItems` still commits only on finish. Judgement call worth review: the story's section
table lists the radical visual under *both* section 1 and section 2 — it is rendered once, in
section 2 beside the mnemonic, since `visual_mnemonic_url` *is* the visual mnemonic. Three sections
ship for all four content types, as instructed, with no radical special-case.

**Task 3 — details single scroll.** One `ScrollView`; new passive `StudyStatusBanner` (locked →
unmet parents; prereqs-met + `not_started` → "You haven't studied this yet"; in-progress/known →
nothing). Content is never hidden or dimmed by lock or study status, and no "Start lesson" CTA
exists on details. Curriculum synonyms moved from an always-open "Synonyms" block into an
**Accepted answers** disclosure, distinct from the user's "Your accepted answers" editor (FR77).
`PersonalMnemonicEditor` was reshaped into empty / saved / editing states with an inline delete
confirm and Save disabled while the draft is blank.

**Task 4 — cross-references.** All four FR72 directions come from existing graph APIs; **no new
repository query was needed**. Verified against `curriculum/dependencies/graph.json`: the graph
carries exactly `radical→kanji builds_on` (153), `kanji→vocabulary requires` (745) and
`grammar→vocabulary reinforces` (458), so `getRelatedItemsForItems` covers three directions and
`getRequiredParentsForItems` (via `useItemDependencyStatus`) covers vocabulary→component kanji.
`getVocabLinksForGrammar` was therefore **not** added. Component chips are always browsable — the
old "Prerequisites met" line is gone. Empty sets omit the section entirely. Chips route to
`/browse/item/[id]`, or `/review/item/[id]` inside a review. `KanjiDependencyHints` survives only
for list rows (`LearnItemRow`) and now links to `/browse/item`; the optional rename was skipped as
timeboxed.

**Task 5 — `seenKanjiReadingPrimer`.** Key + `getSeenKanjiReadingPrimer` / `setSeenKanjiReadingPrimer`
in `preferencesRepository.ts`, boolean-string pattern, no migration.

**Task 6 — verification.** New suites: primer gating matrix (7 cases), related-item queries per type
(5), study-status banner states (5), personal-mnemonic content states (5), `SectionHeading` sheet (4),
lesson section mapping incl. inline primer (5), review cross-ref stack boundary (1). Four existing
suites were updated to the story's intended behavior (lesson section paging, accepted-answers
disclosure, mnemonic content states, `/browse/item` chip routing).

### File List

**New**
- `mobile/src/components/common/Disclosure.tsx`
- `mobile/src/components/common/ExplainerSheet.tsx`
- `mobile/src/components/common/SectionHeading.tsx`
- `mobile/src/components/common/SectionHeading.test.tsx`
- `mobile/src/components/learn/AcceptedAnswersDisclosure.tsx`
- `mobile/src/components/learn/CrossReferenceSection.tsx`
- `mobile/src/components/learn/ExampleSentencesSection.tsx`
- `mobile/src/components/learn/ItemCrossReferences.tsx`
- `mobile/src/components/learn/ItemDetailBody.tsx`
- `mobile/src/components/learn/ItemLinkContext.tsx`
- `mobile/src/components/learn/KanjiReadingsSection.tsx`
- `mobile/src/components/learn/StudyStatusBanner.tsx`
- `mobile/src/components/learn/StudyStatusBanner.test.tsx`
- `mobile/src/components/learn/PersonalMnemonicEditor.test.tsx`
- `mobile/src/components/learn/explainerContent.ts`
- `mobile/src/components/lesson/KanjiReadingPrimer.tsx`
- `mobile/src/components/lesson/LessonItemSections.tsx`
- `mobile/src/components/lesson/LessonItemView.test.tsx`
- `mobile/src/data/hooks/useItemStudyStatus.ts`
- `mobile/src/data/hooks/useKanjiReadingPrimer.ts`
- `mobile/src/data/hooks/useKanjiReadingPrimer.test.tsx`
- `mobile/src/data/hooks/useRelatedItems.ts`
- `mobile/src/data/hooks/useRelatedItems.test.tsx`

**Modified**
- `mobile/src/app/lesson/index.tsx`
- `mobile/src/app/lesson/index.test.tsx`
- `mobile/src/app/review/item/[id].tsx`
- `mobile/src/app/review/item/[id].test.tsx`
- `mobile/src/app/(tabs)/browse/item/[id].test.tsx`
- `mobile/src/components/learn/GrammarDetail.tsx`
- `mobile/src/components/learn/ItemDetailScreen.tsx`
- `mobile/src/components/learn/KanjiDependencyHints.tsx`
- `mobile/src/components/learn/KanjiDetail.tsx`
- `mobile/src/components/learn/KanjiDetail.test.tsx`
- `mobile/src/components/learn/PersonalMnemonicEditor.tsx`
- `mobile/src/components/learn/RadicalDetail.tsx`
- `mobile/src/components/learn/VocabularyDetail.tsx`
- `mobile/src/components/learn/VocabularyDetail.test.tsx`
- `mobile/src/components/lesson/LessonItemView.tsx`
- `mobile/src/data/user/preferencesRepository.ts`
- `mobile/src/data/user/preferencesRepository.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Change |
| --- | --- |
| 2026-07-20 | Implemented Story 4.1: split lesson vs details compositions (D-DET-1), three-section lesson pager with Continue, `SectionHeading` + explainer bottom sheets, unprompted on'yomi/kun'yomi primer with `seenKanjiReadingPrimer`, passive `StudyStatusBanner`, accepted-answers disclosure (FR77), personal-mnemonic content states (FR75), and all four FR72 cross-reference directions from existing graph edges. Status → review. |

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
