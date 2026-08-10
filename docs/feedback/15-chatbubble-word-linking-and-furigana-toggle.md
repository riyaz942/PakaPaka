# Plan 15 — ChatBubble word linking & furigana toggle

Deferred out of [Plan 14](14-conjugated-form-linking-and-furigana-gesture.md)
on 2026-08-10 and implemented the same day.

| # | Item | Status |
|---|------|--------|
| 15.1 | Per-word vocabulary linking on AI chat replies (Talk tab) | Done |
| 15.2 | Long-press furigana toggle on individual chat words | Done |

## Why this split from Plan 14

Plan 14 gave passages and example sentences two things: conjugated-form word
linking (14.1) and a tap = details / long-press = hide-show-furigana gesture
split (14.2). Both rely on the same precondition — every word in the text has
a pre-known span pointing at a specific vocabulary item, derived at curriculum
**compile time** from authored, reviewed content.

`ChatBubble.tsx` (Talk tab) has no such precondition. AI replies are generated
live and were not tokenized or linked to vocabulary items at render time —
`FuriganaText` rendered them with `interactive={false}` on the whole message.
14.2 shipped `PassageBody` and `ExampleSentencesSection` only and left
`ChatBubble` untouched rather than force a fit.

## What it took (design as built)

The open question was where word boundaries come from without a build step.
**They come from the reply itself.** The AI is already prompted to emit the
curriculum's furigana bracket notation, so every kanji run in a reply arrives
explicitly delimited (`私[わたし]は学生[がくせい]です`). Those runs are the
**anchors**: a match may only start at one, and grows rightwards over the kana
(or a following annotated run) that belong to it. No tokenizer, no extra model
call, no runtime conjugation. This is the same premise `extractWordCandidates`
already used for the lookup sheet, generalised into spans.

Three pieces:

- `core/ai/chatWordSpans.ts` — the matcher. Anchored, longest-match,
  left-to-right, non-overlapping, capped at 12 characters per candidate. Emits
  the same `PassageWordSpan[]` contract the pipeline emits, so
  `buildPassageBodyParts` renders chat exactly as it renders a passage.
- `data/curriculum/chatWordIndex.ts` — the surface index a candidate is checked
  against: every item's `primary_form`, plus the taught-inflection surfaces
  14.1a already derived at build time, read back out of
  `example_sentence_spans` / `passage_word_spans` and keyed the other way
  round. So 食[た]べました links to 食べる and is labelled its ます-form without
  the app conjugating anything. Built once per curriculum handle and cached; an
  OTA swap hands over a new handle and drops the old entry.
- `ChatBubble.tsx` — the 14.2 gesture split per word: tap opens the word's
  details (carrying `surface`/`inflection` so the hero can say
  "来ます is the polite / ます-form of 来る"), long-press writes the same
  persistent per-item furigana override the passage and example paths write.

`isWordFuriganaVisible` moved onto `FuriganaText` (next to
`defaultFuriganaVisible`, which it wraps) rather than being copied a third
time.

### Verified against the shipped curriculum

Spot-checked over realistic replies with the real `curriculum.db` index (1,983
surfaces). Correct links on 今日 / 天気 / 毎日 / 日本語 / 朝ご飯 / 一緒に /
私たち / 大丈夫です / 一つ, and on the conjugations 勉強して(te) /
食べました(masu) / 歩いて(te) / 行きました(masu) / 面白かった(ta) /
来ます(masu) / 見ません(masu) / 分かりました(masu) / 座って(te). No
false positives of the kind token-alignment exists to prevent (十分 does not
yield 分, 日曜日 does not yield 日) — anchoring plus longest-match covers what
the build-time tokenizer covers for these cases.

## Decisions

**Q1 — is per-word chat linking worth the runtime-tokenizer cost?** Yes,
because there is no tokenizer cost: the model's own bracket notation supplies
the boundaries, and the taught-inflection surfaces were already derived and
shipped by 14.1a. The "Look up words" sheet stays exactly as it was — see
below.

**Q2 — taught inflections or a looser match for chat?** Taught only, the same
scope as 14.1, and by the same data: chat matches literally the surfaces the
curriculum shows. Coverage is therefore "words you are taught, in forms you
have been shown" — the same set `getTaughtConjugatedForms` lists on the word's
own detail page.

**Off-curriculum words and untaught forms stay inert.** They are not
underlined, and the existing whole-message flow is what covers them: a
long-press anywhere but a linked word, plus the always-visible "Look up words"
button, opens `WordLookupSheet` — which lists every word in the message and
owns the BYOK translation path for words with no curriculum item. So the two
paths are complementary and the underline carries a precise meaning: *this is
a word you are being taught*. A word in an untaught form (a potential 食べたい,
a volitional 行きましょう) falls back to its kanji if that kanji is a
curriculum item, and is otherwise inert.

**The streaming preview gets no links.** Half a reply can hold half a bracket,
so a partial surface would link to the wrong word and flicker as the rest
arrives. Links appear when the turn settles.

**a11y (NFR29) — the one place 14.2 is deliberately not copied.** The bubble
stays a *single* readable element labelled with the whole reply, so a screen
reader hears a conversational turn as a sentence rather than word by word; the
linked words are touch targets only (`accessible={false}`). Per-word
`accessibilityActions` would have required making the bubble non-accessible
(on iOS an accessible parent hides its descendants), trading sentence-level
reading for word-level actions. The non-gesture path to both operations
survives regardless: the visible "Look up words" button → the sheet lists every
word → "Open details" → the details page owns `FuriganaOverrideControl`. In a
passage the text *is* the content and is already read span by span, so exposing
each word costs nothing there and everything here.

## Files touched

- `mobile/src/core/ai/chatWordSpans.ts` (new) + test
- `mobile/src/data/curriculum/chatWordIndex.ts` (new) + test
- `mobile/src/components/converse/ChatBubble.tsx` + test
- `mobile/src/app/(tabs)/converse/session/[id].tsx` — resolves spans once per
  settled reply, off one cached index
- `mobile/src/components/common/FuriganaText.tsx` — `isWordFuriganaVisible`
  moved here; `PassageBody.tsx` / `ExampleSentencesSection.tsx` import it
- `mobile/__mocks__/expo-sqlite.ts` — the two index queries

No schema change, no migration, no curriculum recompile: the index is built
from data 14.1a already ships.
