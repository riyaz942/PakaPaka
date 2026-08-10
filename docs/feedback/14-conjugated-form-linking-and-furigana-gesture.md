# 14 — Conjugated-form linking & furigana gesture split

Source: content examination while auditing N5 (2026-08-08). Two related asks
about how vocabulary surfaces in running text (example sentences, reading
passages, AI chat bubbles).

## 14.1 Conjugated forms should link to their base word

**Problem.** Word highlighting only recognises dictionary forms. In
`猫がここへ来ます。` the word 来ます is plain text even though `kuru-v` is in
the sentence's `vocabulary_slugs` — the learner gets no hint that this is a
word they know, and no path to its details.

This is by construction in two places:

- Example sentences: `buildExampleSentenceSpans` locates links by the first
  literal `primary_form` match — "never auto-segmented"
  (`mobile/src/core/content/exampleSentenceSpans.ts`,
  `ExampleSentencesSection.tsx`).
- Passages: `word_spans` are derived as literal dictionary-form occurrences —
  "conjugated usage is not marked" (`validate_readings.py`), and
  `compile-curriculum` enforces `body.slice(start, end) === primary_form`.

**Ask.**

1. Conjugated surface forms of taught vocabulary (来ます, 来て, 来ない, 来た …)
   get the same underline treatment as dictionary-form links.
2. Tapping one opens the **base form's** details page (来る), and when the
   learner arrives from a conjugated form the hero section notes it:
   "来ます is a conjugated form of 来る".
3. The vocabulary details page gains a conjugated-forms section listing the
   taught forms of the word.

**Implementation notes.**

- The pipeline already lemmatizes with unidic (`level_check.py` uses
  `orthBase`/`lemma`), so inflected spans can be derived **at build time** and
  shipped — the runtime stays literal, no tokenizer in the app. Either extend
  `word_spans` with the matched surface (relaxing the compile invariant to
  `body.slice(start, end) === span.surface_form`), or add a parallel
  `inflected_spans` layer; examples need the same derivation since they
  currently have no stored spans at all.
- Scope recognition to **taught inflections** (N5/N4 grammar's
  `conjugation_rules` already enumerate ます/て/ない/た + polite maps) rather
  than any lemma match — fewer false positives, and it matches what the
  learner can be expected to recognise.
- The details-page conjugated-forms section can be derived from the same
  conjugation tables at runtime, or precomputed at compile time.
- Hero note needs the surface form carried through the route/sheet — the
  passage path opens `PassageWordDetailSheet` (not a route), so the note
  lands there and in the item detail screen for the example-sentence path.

**Existing content (backfill — no regeneration).** The authored data is
already right: examples and passages list the *base-form* slug in
`vocabulary_slugs` even when the sentence uses an inflection (the 来ます
sentences already link `kuru-v`). What is missing is purely **derived data** —
which character offsets are an inflected form of a linked word — and derived
data is re-runnable, never regenerated with a model:

- *Passages:* `word_spans` are already a derived, checked-in artifact
  (`generate.py` derives them, compile validates
  `body.slice(start, end) === primary_form`). Add the inflected-span
  derivation to that same step and re-run it over the shipped passages — a
  mechanical, reviewable JSON diff.
- *Examples:* nothing positional is stored today
  (`example_sentence_vocab` is just sentence↔item; the app literal-matches
  `primary_form` at runtime). Derive spans at compile time into a new
  `example_sentence_spans` table — existing example JSON untouched.
- Ships through the normal curriculum recompile / OTA swap; `curriculum.db`
  is rebuilt wholesale, so there is no `user.db` migration.

**Future content (pipeline).** The same derivation lives in the generation
gate (`validate_readings.enrich()` / `generate.py`), so N4+ levels and any
regenerated N5 set get inflected spans automatically. The draft gates gain
one check — every inflected occurrence of a linked word is spanned, and no
span lemmatizes to a word that is *not* linked — so the closed loop flags
missing/extra links per batch instead of after shipping.

## 14.2 Tap = details, long-press = hide/show furigana

**Today.** Both gestures do the same thing: `onPress` and `onLongPress` both
open word details (`PassageBody.tsx`, `ExampleSentencesSection.tsx`;
`ChatBubble.tsx` in Talk follows the same pattern). Long-press is redundant
and free to take over. Furigana hide/show currently lives behind
`FuriganaOverrideControl` (per-item override via `useFuriganaPreference`),
reachable from the details UI.

**Ask.** Tap a word → open its details page. Long-press a word → hide/show
its furigana in place (same per-item override store the control writes, so
the choice persists).

**Notes.**

- a11y (NFR29 non-gesture path): add a "Toggle furigana"
  `accessibilityAction` next to the existing "Show word details" action on
  each word span, so screen-reader users keep both operations.
- Scope: `PassageBody`, `ExampleSentencesSection`, and decide whether
  `ChatBubble` (Talk) follows — it has the same dual-gesture duplication.

## Open questions

1. Recognise only taught inflections, or any unidic lemma match to a taught
   word? (Recommendation: taught only, per above.)
2. Long-press toggles furigana for the **item everywhere** (current
   per-item preference store) or just this instance (new ephemeral state)?
3. Hero copy for the conjugated-form note, and whether it also shows the
   conjugation category ("polite form of", "te-form of").
4. Does the conjugated-forms section list only taught forms or the full
   godan/ichidan/irregular paradigm?

## Suggested sequencing

1. **14.2** — small gesture rewire + a11y action; ships alone.
2. **14.1a** — build-time inflected-span derivation + schema/compile changes.
3. **14.1b** — rendering, hero note, details-page conjugated-forms section.

## Resolution (2026-08-10)

14.1a, 14.1b, and 14.2 shipped (commit `8cbe944`). Two decisions surfaced
during 14.1a were escalated to the product owner and resolved:

1. **Passage `vocabulary_slugs` should expand** to include words that appear
   only in a taught-conjugated form (not just already dictionary-linked
   words), accepting that this raises the ≥90% Guru+ unlock bar on some
   existing passages. 14.1a's original backfill deliberately did not do this
   (only 1 new span landed as a result); the expansion is being implemented
   as a follow-up in the same pipeline (`generate.py::_passage_word_spans`,
   `validate_readings.py::build_passage_spans`).
2. **ChatBubble (Talk tab) does not get per-word linking or the gesture
   split** as part of this plan — it has no per-word span data at render
   time, and the existing whole-message "look up a word" flow already covers
   the a11y requirement. Split into
   [Plan 15](15-chatbubble-word-linking-and-furigana-toggle.md) as its own,
   not-yet-started plan.
