# Furigana support — plan

Goal: display furigana (ruby readings) above kanji everywhere Japanese text appears —
example sentences, reading passages, and vocabulary forms — with a user preference to
show/hide it, and eventually knowledge-aware hiding (no furigana on kanji you've burned).

## Current state (why this is a gap)

- **No furigana data exists.** `example_sentences.japanese`, `reading_passages.body`,
  `passage_questions.prompt`, and `items.primary_form` are plain UTF-8 strings with no
  reading annotations. Vocabulary readings exist only as whole-word kana in
  `accepted_answers` (`answer_type: 'reading'`) — not aligned to individual kanji.
- **No rendering primitive exists.** React Native `<Text>` has no `<ruby>` equivalent;
  every surface renders Japanese as a single `<Text>` node
  (`VocabularyDetail.tsx:88`, `GrammarDetail.tsx:100`, `PassageReader.tsx:28`,
  `LessonItemView`, `ReviewCard`).
- `docs/content/content-pipeline-plan.md` (Phase 0) already reserves a `furigana` field on
  example sentences using JmdictFurigana bracket notation. This plan is the app-side
  and pipeline-side realization of that decision, extended to passages and vocab.

## Ground rules

1. **One notation everywhere: JmdictFurigana bracket format** —
   `私[わたし]は学生[がくせい]です。` Reading applies to the maximal kanji run
   immediately before the bracket. It's human-diffable in git, trivially parseable,
   and matches the content-pipeline plan. No JSON segment arrays in curriculum sources.
2. **Furigana is always derivable, never authoritative.** Stripping `[...]` from an
   annotated string must reproduce the plain string byte-for-byte. The plain columns
   (`japanese`, `body`, `primary_form`) stay the source of truth for answer
   evaluation, search, and import mapping — nothing downstream parses brackets except
   the display layer.
3. **Generation is build-time** (in `curriculum/_build/`), consistent with the content
   pipeline: dataset → `generate.py` → JSON → `validate-schema` → `compile-curriculum`
   → `curriculum.db` → OTA. No tokenizer or dictionary ships in the app.
4. **All new columns are nullable.** The app renders plain text when furigana is
   absent, so content can be annotated incrementally and old OTA DBs keep working.
5. JmdictFurigana is CC BY-SA (EDRDG-adjacent) — covered by the same attribution
   screen the content pipeline already requires.

## Phase 1 — Data model + pipeline (~1 day)

Additive schema changes (no user.db migration; curriculum.db is replaced wholesale):

| Table | New column | Notes |
|---|---|---|
| `example_sentences` | `furigana TEXT` (nullable) | annotated form of `japanese` |
| `reading_passages` | `body_furigana TEXT` (nullable) | annotated form of `body` |
| `passage_questions` | `prompt_furigana TEXT` (nullable) | annotated form of `prompt` |
| `items` | `furigana TEXT` (nullable) | vocabulary only; annotated `primary_form` (e.g. `食[た]べる`); NULL for radicals/kanji/grammar |

Touch points:

- `curriculum/schema/curriculum.schema.json` — optional `furigana` properties.
- `scripts/curriculum-schema.ts` — DDL columns above.
- `scripts/compile-curriculum.ts` — pass columns through.
- `scripts/validate-schema.ts` — new checks when `furigana` is present:
  - strip-brackets(furigana) === plain text (ground rule 2)
  - bracket contents are kana-only (hiragana + katakana + ー)
  - every kanji character in the plain text is covered by a bracket annotation
    (warn-level initially, error once corpus is fully annotated)

Generation in `curriculum/_build/`:

- Vocabulary: look up (`primary_form`, reading from `accepted_answers`) in the
  JmdictFurigana dataset — exact, hand-curated alignments for ~250k dictionary forms.
  This covers essentially all N5/N4 vocab deterministically.
- Sentences/passages: tokenize with a MeCab wrapper (`fugashi` + unidic-lite, pure
  pip install, fits the existing Python `_build` tooling), then map each token to
  JmdictFurigana alignment; fall back to the tokenizer's own reading for tokens not
  in the dataset. Kana/punctuation tokens pass through unannotated.
- Output is written into the existing per-level JSON files, so annotations get
  reviewed in git diffs like any other content change.

**Choosing the reading is the whole problem** (revised 2026-08-03, after ~230
wrong annotations shipped). Hand-editing the JSON was the original answer and it
is the wrong one: a regeneration silently overwrites the edit, so every rule
below lives in `furigana.py`. A wrong reading renders exactly like a right one —
nothing surfaces it — which is why these are rules and not spot fixes.

- **Never resolve by surface alone.** JmdictFurigana lists every reading a word
  has, so a surface-keyed lookup returns whichever line sorts first: 来 came back
  らい in all 68 places it appeared, including 来ました. The reading is settled
  from context first, then looked up.
- **The curriculum's `known_readings` override is for free-standing words only.**
  It exists so 私 is わたし rather than unidic's isolated-form わたくし, but keyed
  by surface it also hijacked the 人 of 日本人 (じん, not the taught ひと) and the
  三 of 三日 (みっ, not さん).
- **A host fused to a suffix is looked up whole.** unidic reads the two lemmas
  separately and models no sound change between them — 一 + 本 is イチ + ポン
  where 一本 is いっぽん. When the composed reading is not a reading the
  dictionary lists for the compound, the compound's own entry wins.
- **The suffix analysis needs dictionary evidence.** unidic tags suffixes from
  the lemma, not from context, so an ordinary noun following a counter gets
  mislabelled: 三回犬と歩きます had 犬 as a suffix read けん. Requiring the pair to
  be a real compound drops the accidents.

## Phase 2 — Parser + `<FuriganaText>` component (~1–2 days)

**Parser** — `mobile/src/core/furigana/parseFurigana.ts` (pure, heavily unit-tested):

```ts
type FuriganaSegment = { text: string; reading?: string };
function parseFurigana(annotated: string): FuriganaSegment[]
```

Malformed input (unbalanced brackets, non-kana reading) degrades to a single
unannotated segment — never throw; this is display-layer code fed by validated data,
but OTA content is still external input.

**Component** — `mobile/src/components/common/FuriganaText.tsx`:

- Layout: outer `<View className="flex-row flex-wrap items-end">`; each segment is a
  column (`<View className="items-center">`) with the reading `<Text>` above the base
  `<Text>`. Unannotated segments are split on characters (or small chunks) so line
  wrapping stays natural — RN wraps flex children, not text inside them.
- Trailing punctuation (。、！？」etc.) merges into the preceding segment's chunk so
  lines never start with punctuation (simple kinsoku handling).
- Props: `text` (annotated string), `showFurigana: boolean`, plus `className` passthrough
  for the base text so existing typography tokens (`text-body-lg text-primary`) keep
  working. When `showFurigana` is false, reading rows still occupy zero height —
  render plain `<Text>` in that case to preserve selection/accessibility.
- Sizing: furigana at ~50% of base size with tight line-height. Add a `text-furigana`
  token to `tailwind.config.js` rather than hardcoding.
- Accessibility: set `accessibilityLabel` on the container to the plain (stripped)
  string so screen readers don't read interleaved kana; per-segment Texts are
  `accessible={false}`. (a11y lint gate applies — see CI policy in CLAUDE.md.)

Trade-offs accepted (same ones Jisho-style RN apps accept): text is not
long-press-selectable in furigana mode, and justification is flexbox-based rather
than true text layout. A WebView with real `<ruby>` was considered and rejected —
styling/theming duplication, worse perf in FlatLists, heavier offline footprint.
Existing npm furigana components are unmaintained; the component above is ~100 lines.

## Phase 3 — Preference + surface adoption (~1–2 days)

**Preference:** `furiganaDisplay: 'shown' | 'hidden'` in the existing key-value
`user_preferences` table via `preferencesRepository` (`PREFERENCE_KEYS`) — no
migration needed. Default `'shown'` (beginner-first). Toggle in
`(tabs)/settings.tsx`, plus a small context or hook (`useFuriganaPreference`) so
surfaces don't each hit the DB.

**Repository/type plumbing:** `ExampleSentence` gains `furigana: string | null`
(`itemRepository`), `PassageDetail` gains `bodyFurigana`, `PassageQuestion` gains
`promptFurigana` (`passageRepository`), vocabulary detail row gains `furigana`.

**Adoption order:**

1. Example sentences — `VocabularyDetail`, `GrammarDetail`, `KanjiDetail`,
   `LessonItemView`. Highest value, lowest risk.
2. Reading passages — `PassageReader` body and question prompts, with a per-passage
   quick toggle (eye icon) in addition to the global preference, since hiding
   furigana is itself reading practice.
3. Vocabulary `primary_form` on detail screens (currently the whole-word reading is
   shown separately; per-kanji furigana replaces/augments it).

**Explicitly out of scope for review sessions (Epic 5):** furigana on a reading or
production prompt gives away the answer. `ReviewCard` must suppress furigana for
those prompt types; showing it on meaning prompts is a product decision to record in
the Epic 5 story, not here.

## Phase 4 (later) — Knowledge-aware furigana

Once Epic 5 SRS states are live: `'auto'` mode hides furigana only on kanji at
guru+ (or burned) stage, per WaniKani convention. Requires per-segment kanji → item
lookup (via `ATTACH DATABASE`, same mechanism as the Epic 5 reinforcement display)
and makes furigana itself a weakness signal (tapped-to-reveal = weak). Design only;
don't build until the SRS tables exist.

## Testing

- `parseFurigana` unit tests: round-trip strip, multi-bracket sentences, kana-only
  text, malformed input, katakana readings, punctuation merging.
- `FuriganaText` component tests (jest + RN testing library): shown/hidden modes,
  plain-text fallback when `furigana` is null, accessibility label.
- Validator tests in `scripts/` for the three new checks.
- Snapshot the adopted surfaces (existing `.test.tsx` files already cover these
  components — extend, don't duplicate).
- Manual: long passage line-wrapping on a narrow device, dark/light themes, font
  scaling (furigana must scale with the OS font size setting).

## Execution order & estimate

1. Phase 1 pipeline + schema (~1 day) — unblocks everything, independently shippable.
2. Phase 2 parser + component (~1–2 days) — can start in parallel using fixture strings.
3. Phase 3 preference + adoption (~1–2 days).
4. Recompile `curriculum.db` (Git LFS), bump curriculum version for OTA.

Total: roughly 3–5 days. Phases 1–2 have no user-visible effect and can merge
independently; Phase 3 is the visible switch-on.

## Open questions

1. Should the global default be `'shown'` for everyone, or keyed off the onboarding
   JLPT level (shown for N5/N4, hidden for N3+)?
2. Per-passage toggle UX: eye icon in the header vs. tap-anywhere-on-passage?
3. Do we annotate passage question prompts at all, or is that hand-holding that
   undermines the comprehension exercise? (Column is cheap; decision is product.)
4. Katakana loanwords: annotate with readings (some apps do for consistency) or leave
   bare? Proposal: leave bare — the dataset treats them as kana.
