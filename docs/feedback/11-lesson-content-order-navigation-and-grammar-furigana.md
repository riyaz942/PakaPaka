# Plan 11 — Lesson content order, navigation stacking & grammar review furigana

Playtesting feedback on the lesson ("learn") flow plus one review-page item.
Seven lesson changes (content ordering, duplicate mnemonic, swipe, word lookup,
back-stack) and grammar furigana on review cards. Grounded in current code with
file:line references; each item lists the change, acceptance criteria, and files
touched.

## Feedback items

| # | Item | Priority |
|---|------|----------|
| [11.1](#111--remove-onyomikunyomi-from-the-lesson-kanji-intro-card) | Remove on'yomi/kun'yomi rows from the kanji intro card | P1 |
| [11.2](#112--radical-mnemonic-rendered-twice-white-box-fallback) | Radical mnemonic shows twice (second copy in a white box) | P1 |
| [11.3](#113--content-order-description--meaning--reading) | Reorder: description → meaning → reading; radical order | P1 |
| [11.4](#114--kanji-readings-move-to-the-mnemonic-section) | Kanji on'yomi + kun'yomi shown in the Mnemonic section | P1 |
| [11.5](#115--swipe-between-lesson-cards) | Swipe back/forth between lesson cards (keep buttons) | P2 |
| [11.6](#116--tap--long-press-a-word-in-examples--vocab-detail) | Tap/long-press a word in lesson examples → vocab detail | P2 |
| [11.7](#117--detail-pages-opened-from-a-lesson-must-stack) | Native back from a detail page exits the lesson (no stack) | **P0** |
| [11.8](#118--grammar-review-cards-have-no-furigana) | Grammar review prompts/reveals ignore the furigana system | P1 |

## Current state (shared context)

- A lesson pages each item through three sections — Introduction, Mnemonic,
  Examples & links (`LESSON_SECTION_LABELS`,
  `mobile/src/components/lesson/LessonItemSections.tsx:38`). Section/item
  advance is button-only (`handleBack`/`handleNext`,
  `mobile/src/app/lesson/index.tsx:44-111`).
- Kanji intro renders `KanjiReadingsSection` (on'yomi/kun'yomi rows) plus the
  reading primer (`LessonItemSections.tsx:112-117`).
- The Mnemonic section renders `ItemMnemonicSections` (meaning → reading
  mnemonic) then `ItemDescriptionSection`
  (`LessonItemSections.tsx:219-235`). For radicals it renders the story text,
  then `MnemonicImage`, then the description (`LessonItemSections.tsx:186-215`).
- `MnemonicImage` with a missing/broken image falls back to a `bg-surface` box
  containing the accessibility label — which embeds the mnemonic text
  (`mobile/src/components/common/MnemonicImage.tsx:43-55`). That box is the
  "second copy in white" seen on radicals.
- Word lookup by tap/long-press exists only on reading passages
  (`mobile/src/components/read/PassageBody.tsx:61-79`) and chat bubbles.
  Lesson example sentences are plain `FuriganaText`
  (`mobile/src/components/learn/ExampleSentencesSection.tsx:34-39`). There is
  **no** long-press lookup on the lesson surface today.
- The lesson stack has only `index` and `complete`
  (`mobile/src/app/lesson/_layout.tsx`). Any detail link from a lesson goes
  through `useItemHref`, whose default base is `/browse/item`
  (`mobile/src/components/learn/ItemLinkContext.tsx:11-13`) — navigating there
  leaves the full-screen lesson stack, which is why native back then exits the
  lesson. Review already solved this with a nested `/review/item/[id]` screen +
  `ItemLinkProvider base="/review/item"`
  (`mobile/src/app/review/item/[id].tsx:21-48`).
- Grammar review prompts render the cloze as a plain `<Text>`
  (`mobile/src/components/review/ReviewCard.tsx:216-219`), as does the
  completed sentence on the incorrect reveal
  (`mobile/src/components/review/IncorrectReveal.tsx:82-92`). No furigana.
- Furigana data: example sentences carry authored `furigana` (bracket
  notation) end-to-end. Authored grammar cloze variants do **not** — the
  `grammar_cloze_variants` table has only `jp_cloze/english/answer/nudge`
  (`scripts/compile-curriculum.ts:67-73`), and the derived-cloze fallback blanks
  `sentence.japanese`, discarding `sentence.furigana`
  (`mobile/src/core/grammar/clozeBuilder.ts:56-66`).
- Example sentences in curriculum JSON already carry per-sentence
  `vocabulary_slugs` (kanji, vocabulary, grammar files), but the compiler drops
  them — `example_sentences` is inserted without them
  (`scripts/compile-curriculum.ts:410`).

---

## 11.1 — Remove on'yomi/kun'yomi from the lesson kanji intro card

**Problem.** The kanji Introduction section shows the on'yomi/kun'yomi rows.
A separate design for this card is coming (owner: Riyaz); readings move to the
Mnemonic section for now (§11.4).

**Change.** In `LessonIntroSection`, stop rendering `KanjiReadingsSection` (and
move the `KanjiReadingPrimer` trigger with the readings to the Mnemonic
section, since the primer explains the reading rows it sits next to).
`KanjiReadingsSection` itself is untouched — Browse detail
(`KanjiDetail`) keeps using it.

**Acceptance criteria**
- Kanji lesson Introduction = hero (glyph + meaning) + description (§11.3) only.
- Browse item detail still shows the readings rows unchanged.

**Files.** `mobile/src/components/lesson/LessonItemSections.tsx` (+ its tests,
`LessonItemView.test.tsx`).

---

## 11.2 — Radical mnemonic rendered twice (white-box fallback)

**Problem.** The radical Mnemonic section renders the story once as text, then
`MnemonicImage` again with `mnemonicText={story}`. When the image URL is
missing or fails to load, `MnemonicImage` renders its accessibility label —
which contains the same story — inside the `bg-surface` box: the duplicate.

**Change.** Per the requested order ("mnemonic image **if available and
working**"), the lesson radical section renders the image slot only when it
will actually show an image: gate on `isValidMnemonicImageUrl(url)` and hide
the slot on `onLoadError` (local state). No text-fallback box on this surface.
Keep the current fallback behavior in `MnemonicImage` for other surfaces
untouched — the gate lives in `LessonMnemonicSectionView`.

**Acceptance criteria**
- Radical with no/broken image: story appears exactly once, no white box.
- Radical with a working image: story once + image once.

**Files.** `mobile/src/components/lesson/LessonItemSections.tsx` (+ tests).

---

## 11.3 — Content order: description → meaning → reading

**Problem.** The description currently trails the mnemonics at the end of the
Mnemonic section. Wanted order:

- **Kanji / vocabulary:** description sits with the hero — glyph + meaning,
  description directly below — then (in the Mnemonic section) meaning
  mnemonic, then reading (mnemonic + readings, §11.4).
- **Radical:** radical glyph → meaning → mnemonic image (if working) →
  description.

**Change.**
1. Move `ItemDescriptionSection` out of `LessonMnemonicSectionView` (kanji /
   vocab branch) into `LessonIntroSection`, rendered right under the hero for
   every non-grammar type.
2. Radical branch keeps its own order: story text → image (gated per §11.2) →
   description (stays in the Mnemonic section, after the image).
3. Mnemonic section order for kanji/vocab stays meaning mnemonic → reading
   mnemonic (already the case in `ItemMnemonicSections.tsx:46-69`).

*Assumption:* the radical story text still renders once, above the image — the
requested order lists glyph/meaning/image/description and the story is the
mnemonic itself; removing it entirely would orphan §11.2. Flag if wrong.

**Acceptance criteria**
- Kanji/vocab Introduction: hero, then description (when present).
- Kanji/vocab Mnemonic section: meaning mnemonic → reading block, no
  description.
- Radical Mnemonic section: story → image (only when working) → description.
- The empty-state copy ("No mnemonic for this one yet…") still shows when an
  item has neither mnemonic prose nor description.

**Files.** `mobile/src/components/lesson/LessonItemSections.tsx` (+ tests).

---

## 11.4 — Kanji readings move to the Mnemonic section

**Problem.** With §11.1 removing readings from the intro, the reading mnemonic
would reference sounds the learner hasn't been shown in this lesson.

**Change.** In `LessonMnemonicSectionView`, for kanji render a readings block —
both on'yomi and kun'yomi (reuse `KanjiReadingsSection`) — directly above the
reading mnemonic, with the reading primer trigger (`showReadingPrimer`)
relocated here from the intro. `LessonItemView` already fetches
`kanjiReadings` and passes them in `sectionProps`
(`LessonItemView.tsx:64-73`), so this is render-order only — no data changes.

**Acceptance criteria**
- Kanji Mnemonic section shows: meaning mnemonic → on'yomi + kun'yomi rows →
  reading mnemonic (readings render even when a mnemonic is missing).
- Reading primer appears (first dual-reading kanji) in the Mnemonic section.

**Files.** `mobile/src/components/lesson/LessonItemSections.tsx`,
`mobile/src/components/lesson/LessonItemView.tsx` (prop threading if any),
tests.

---

## 11.5 — Swipe between lesson cards

**Problem.** Section/item advance is button-only. Wanted: swipe back and forth
like a card deck, with the buttons kept.

**Change.** Wrap the lesson card area (`lesson/index.tsx:189-197`) in
`react-native-gesture-handler` fling gestures (already a dependency,
`~2.30.0`): fling **left** → `handleNext`, fling **right** → `handleBack`.
Reuse the exact existing handlers so swipe and buttons share one advance path
(sections first, then items — identical semantics). Fling, not pan: it can't
fight the vertical `ScrollView`, needs no gesture-position bookkeeping, and
the existing `FadeSlideIn` transition stays as the animation. Disabled states
mirror the buttons (no back-fling on the very first card; the final "Finish
lesson" commit stays on fling-left, same as the button).

**Acceptance criteria**
- Swiping left/right anywhere on the card advances/goes back exactly like the
  buttons, including the section → item progression and lesson completion.
- Vertical scrolling of long lesson content is unaffected.
- Buttons keep working (a11y path — gestures are never the only way).

**Files.** `mobile/src/app/lesson/index.tsx` (+ `index.test.tsx`).

---

## 11.6 — Tap / long-press a word in examples → vocab detail

**Problem.** "Don't we already have this?" — No: word lookup exists only on
passages (authored spans) and chat. Lesson example sentences are inert.

**Decision (from feedback):** ambiguous surfaces like 学生 navigate to the
**vocabulary** detail; the kanji pages are one hop away via its
cross-references, so no disambiguation UI.

**Change.**
1. **Pipeline:** compile the already-authored per-sentence `vocabulary_slugs`
   into a new `example_sentence_vocab` table (`sentence_id`, `item_id`,
   `sort_order`), with schema + validator coverage
   (`scripts/compile-curriculum.ts`, `scripts/curriculum-schema.ts`,
   `scripts/validate-schema.ts`). Curriculum-db only — no user.db migration;
   bump the curriculum manifest version for OTA.
2. **Repo:** extend the example-sentences query
   (`mobile/src/data/curriculum/itemRepository.ts:769`) to return each
   sentence's linked vocab (id + primary form).
3. **UI:** in `ExampleSentencesSection`, render linked words as pressable
   spans following the `PassageBody` pattern (tap **and** long-press,
   `accessibilityRole="button"`, underline — NFR29: long-press is never the
   only way in). Span location = first `primary_form` match in the sentence;
   no match → sentence stays inert (never auto-segment). Navigation uses
   `useItemHref` so it lands on `/lesson/item/[id]` (§11.7) inside a lesson
   and `/browse/item/[id]` on Browse detail.

**Acceptance criteria**
- Tapping/long-pressing a linked word in a lesson example opens that vocab's
  detail without leaving the lesson (see §11.7).
- Sentences without links, and words whose surface can't be located, render
  exactly as today.
- `npm run validate-schema && npm run compile-curriculum` pass; Browse detail
  examples gain the same affordance for free.

**Files.** `scripts/*` (3), `mobile/src/data/curriculum/itemRepository.ts`,
`mobile/src/components/learn/ExampleSentencesSection.tsx`, tests.

---

## 11.7 — Detail pages opened from a lesson must stack

**Problem.** Any detail link from a lesson pushes `/browse/item/[id]`, leaving
the full-screen lesson stack — native back then exits the lesson instead of
returning to it. Wanted: lesson → vocab → kanji → back → vocab → back →
lesson, with the session intact. (Review already behaves this way via its
nested `/review/item` screen.)

**Change.** Mirror the review solution exactly:
1. Add `mobile/src/app/lesson/item/[id].tsx` — copy of
   `review/item/[id].tsx` (`ScreenHeader` + `ItemDetailBody`), registered in
   `lesson/_layout.tsx`.
2. Extend `ItemLinkBase` with `'/lesson/item'`
   (`mobile/src/components/learn/ItemLinkContext.tsx:11`) and wrap the nested
   screen's body in `ItemLinkProvider base="/lesson/item"` so every
   cross-reference chip (vocab → kanji → radical…) keeps pushing inside the
   lesson stack.
3. Lesson session state (item/section index) lives in `LessonScreen` local
   state; the screen stays mounted beneath the pushed detail, so nothing else
   is needed — no provider, no persistence.
4. Verify the review flow still matches this contract (it already uses
   `/review/item`; no change expected).

**Acceptance criteria**
- From a lesson: open vocab detail → open kanji from its cross-refs → native
  back lands on the vocab detail → native back lands on the same lesson card
  and section, progress intact.
- Review: same chain via `/review/item` still returns to the live session.
- Closing the lesson (✕) from the lesson card behaves as today.

**Files.** `mobile/src/app/lesson/item/[id].tsx` (new),
`mobile/src/app/lesson/_layout.tsx`,
`mobile/src/components/learn/ItemLinkContext.tsx`, tests.

---

## 11.8 — Grammar review cards have no furigana

**Problem.** Grammar cloze prompts (and the completed sentence on reveals)
render kanji with no furigana, ignoring the app-wide furigana system
(shown / hidden / auto-with-mastery). Constraint: kanji and vocabulary cards
that *ask for a reading* must stay bare — no change there (they already render
plain `primaryForm`; keep it that way).

**Change.**
1. **Data — authored variants:** add optional `jp_cloze_furigana` (bracket
   notation, blank preserved as `＿＿＿`) to `cloze_variants` in the curriculum
   schema, compiler (`grammar_cloze_variants` column), and repo
   (`itemRepository.ts:693-706`). Author it for existing N5/N4 variants (the
   matching example sentence's furigana with the chunk blanked — scriptable
   for the majority that mirror an authored sentence).
2. **Data — derived fallback:** `buildGrammarCloze` gains furigana output —
   blank the accepted form in `sentence.furigana` (match outside `[...]`
   reading brackets) so the derived path carries furigana too
   (`clozeBuilder.ts`, `useReviewQueue.ts:293-302` threads it as
   `clozePromptFurigana` on `ReviewItem`).
3. **UI:** in `ReviewCard` (prompting + wrong-script states) and
   `IncorrectReveal` (completed sentence), render grammar prompts through
   `FuriganaText` with the standard preference plumbing
   (`useFuriganaPreference` → `mode` + `knownKanji`, embedded-text tier — the
   same call sites `ExampleSentencesSection` uses), falling back to plain text
   when no furigana string exists. Non-grammar prompts are untouched.

**Acceptance criteria**
- Grammar cloze prompt shows furigana per the global setting: `shown` always,
  `hidden` never, `auto` hidden only for kanji covered by mastered vocab;
  per-run tap-to-peek works (free from `FuriganaText`).
- Kanji reading cards and vocabulary cards render exactly as today.
- Completed sentence on the grammar incorrect reveal follows the same rules.
- Pipeline (`validate-schema`, `compile-curriculum`) passes with and without
  the new optional field.

**Files.** `scripts/*` (3), `curriculum/grammar/*.json`,
`mobile/src/data/curriculum/itemRepository.ts`,
`mobile/src/core/grammar/clozeBuilder.ts`,
`mobile/src/data/hooks/useReviewQueue.ts`,
`mobile/src/core/srs/srs.types.ts` / `queueBuilder.ts`,
`mobile/src/components/review/ReviewCard.tsx`,
`mobile/src/components/review/IncorrectReveal.tsx`, tests.

---

## Suggested sequencing

1. **11.7** (P0 back-stack) — small, unblocks 11.6's navigation target.
2. **11.1 → 11.4 → 11.3 → 11.2** — one PR: all four are edits to
   `LessonItemSections.tsx` render order.
3. **11.5** swipe — isolated to `lesson/index.tsx`.
4. **11.6** word lookup — pipeline + UI.
5. **11.8** grammar furigana — pipeline + review UI.

## Open questions

- **11.3:** confirm the radical story text stays (once) above the image — the
  requested order didn't name it explicitly.
- **11.1:** the removed intro readings await your redesign of the kanji card;
  this plan only relocates them (§11.4) so nothing is lost meanwhile.
