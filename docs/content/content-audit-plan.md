# Content audit plan — verifying a whole level programmatically

How to verify the generated N5 corpus (76 radicals, 106 kanji, 716 vocabulary,
74 grammar, 10 passages) without reading every item by hand. Written
2026-08-08, ahead of the N5 content freeze.

## Verdict

Most of the audit checklist is **deterministic and already built** — the
pipeline gates (`validate_drafts` / `validate_examples` / `validate_mnemonics`
/ `validate_readings` / `check_cloze`), `validate-schema`, `compile-curriculum`,
and `import/audit_facts.py` each cover a slice. What is missing is a **single
audit command that runs every check against the *shipped* JSON** (the draft
gates mostly ran pre-assembly) plus about eight new cheap checks.

AI verification is only needed for one layer — **translation fidelity and
naturalness** — and batched with a small model it costs on the order of
**$1–5 for all of N5**, not hundreds of dollars. Mnemonic↔image match and
passage tone stay human.

*Update 2026-08-09:* feedback 14.1 landed (conjugated-form linking) — shipped
examples and passages now carry derived `word_spans` including taught
inflections (`surface_form` + `inflection`, compile-verified). The audit gains
span coverage/staleness checks (rows and check 10 below); the rest of the
plan is unchanged.

## The four tiers

| Tier | What | Cost | Verdict |
| --- | --- | --- | --- |
| 0. Structural / cross-reference | JSON schema, furigana round-trip, slug existence, span integrity, tag checks, in-level vocab | free, seconds | objective pass/fail |
| 1. Dataset cross-check | meanings/readings vs KANJIDIC2 + JMdict, decomposition vs KRADFILE | free, seconds | ERROR/WARNING/INFO |
| 2. AI semantic pass | example/passage translation fidelity, naturalness, summary faithfulness | ~$1–5 per level, minutes | advisory flags for human |
| 3. Human | mnemonic↔image match, tone/humour, final judgment on flags | hours, but only on flagged items | final |

Tiers 0–1 are rerunnable CI-style gates. Tier 2 runs on demand, ideally only
on items whose `_meta.review_status` is still `draft` (today that is all 716
vocab items — the bulk of the surface). Tier 3 consumes the report.

## Checklist mapping

**Status key:** `exists` = implemented today · `new` = cheap deterministic
check to add · `AI` = tier 2 · `human` = tier 3.

### Radical

| Check | Status | Where / how |
| --- | --- | --- |
| Meaning correct | exists (kanji/vocab only) + new | `import/audit_facts.py` covers kanji/vocab; extend with a radical-name reference pass, INFO-graded (radical names are mnemonic conventions, not dictionary facts) |
| Mnemonic/form matches image | human | Moot for Tier 1 (KanjiVG render *is* the character); matters when Tier 2 AI art lands — see [radical-mnemonic-images.md](./radical-mnemonic-images.md) |
| Description correct | exists (draft gate) → run on shipped | `validate_mnemonics` already checks a description names every reviewed look-alike and invents none; factual prose beyond that is tier 2/3 |

### Kanji

| Check | Status | Where / how |
| --- | --- | --- |
| Meaning correct | exists | `audit_facts.py` vs KANJIDIC2 |
| On/kun readings correct, common readings listed | exists | `audit_facts.py` vs KANJIDIC2 readings |
| Taught readings accepted in review | **new** | round-trip: every `readings[]` entry has a `reading` accepted_answer and vice versa; exactly one `is_primary` meaning answer matching `meaning` |
| Lesson mnemonic teaches main on'yomi | exists (draft gate) → run on shipped | `validate_mnemonics`: `reading_mnemonic` contains the first on'yomi (kana-normalised) inside `<reading>…</reading>` |
| Built from the correct, **complete** radical set | **new** | graph completeness vs KRADFILE: every component of a taught kanji has a `builds_on` edge or a recorded exception. The fact-audit already lists 257 missing pairings as INFO "candidate additions" — promote to a decision list. Live example: 道 (`n5-michi`) lists only 辶; 首 is missing from the graph *and* from the curriculum entirely (neither radical nor kanji), so fixing it means authoring a new radical entry. 62/106 N5 kanji have exactly one radical parent — some legitimately (一, 人), some partial like 道 |
| Meaning mnemonic hooks component radicals, highlighted | exists (draft gate) → run on shipped | every taught component's meaning recognisable and wrapped in `<radical>…</radical>`; cross-check tags against `builds_on` edges in `dependencies/graph.json`. Note the gate checks against the *current* graph, so a partial decomposition passes silently (道's mnemonic mentions only 辶 because the graph has no 首 edge) — run the graph-completeness check first |
| Description when needed | exists (draft gate) | required iff reviewed look-alikes exist; names exactly them |
| Example sentences with furigana | exists | `validate-schema` strip/round-trip/coverage; `validate_examples` annotation success |
| Example EN translation correct | AI | tier 2 |
| Visually similar kanji listed | exists + new | presence + no self-reference exist; add symmetry check (A lists B ⇒ B lists A) against `visually_similar.py` candidates |

### Vocabulary

| Check | Status | Where / how |
| --- | --- | --- |
| Meaning + taught reading correct | exists | `audit_facts.py` vs JMdict |
| Alternates in `accepted_answers`, primary marked | **new** | exactly one `is_primary`; primary matches `meaning`; every `reading` answer consistent with `furigana` (bracket concatenation == taught reading) |
| `primary_form` / `furigana` match | exists | `validate-schema` strip-match + kana-only readings |
| Meaning mnemonic hooks taught kanji in `<kanji>`; no fake hooks for kana-only | exists (draft gate) → run on shipped | `validate_mnemonics` vocab checks |
| Reading mnemonic covers taught reading in `<reading>` | exists (draft gate) → run on shipped | includes the regularity-shape rule (regular = short derivation note, irregular = full story) |
| Description only when nuance needed | exists (draft gate) + AI for "needed but missing" | presence rule is mechanical; judging a *missing* description (false friend, register trap) is tier 2 |
| Examples with furigana | exists | as kanji |
| Example EN translation correct | AI | tier 2 |
| Each example actually uses the target word | exists (draft gate) → run on shipped | `validate_examples` target-presence is lemma-aware, so 来ます counts for 来る |
| `vocabulary_slugs` in-level only | exists | compile-time slug resolution + `level_check` tokenizer gate |
| Conjugated forms of linked words spanned → base word (feedback 14.1) | exists (integrity) + **new** (coverage/staleness) | compile enforces the full span contract on every example (surface match, non-overlap, taught-inflection stem invariant); coverage and freshness need the shipped re-derivation diff (check 10) |

### Grammar

| Check | Status | Where / how |
| --- | --- | --- |
| `primary_form` / `meaning` / `structure` correct | AI + human | well-formedness lint is mechanical; correctness is judgment |
| `conjugation_rules` correct | AI + human | JSON shape lint mechanical; mapping correctness needs judgment |
| `accepted_forms` complete (て/で variants…) | AI | completeness needs a model conjugating the pattern; cloze-answer ∈ accepted_forms already exists (`validate-schema`, `check_cloze`) |
| `family` set correctly | exists (enum) + AI for sensibility | schema enforces the enum; "sensible distractor family" is judgment |
| `explanation_markdown` teaches the point | AI + human | markdown-subset lint exists (`validate_drafts`); pedagogy is judgment |
| `caution_notes` present | exists | schema `minItems: 1` |
| `related_grammar_slugs` real siblings | exists (existence) + AI (contrast relevance) | compile resolves slugs; "real contrast" is judgment |
| Cloze variants well-formed | exists | `check_cloze.py` already runs on **shipped** grammar: blank, answer ∈ accepted_forms, filled sentence in-level + furigana, nudge quality |
| Examples with furigana | exists | as kanji |
| Example EN translation correct | AI | tier 2 |
| Examples demonstrate the pattern | exists (draft gate) → run on shipped | every example contains one of the item's `accepted_forms` |
| `vocabulary_slugs` in-level | exists | as vocabulary |

### Passage

| Check | Status | Where / how |
| --- | --- | --- |
| Title/body natural, plain prose, word-count band | exists (plain prose) + new (band) + AI (naturalness) | body is plain prose by construction; check `word_count` against the seed's band in `reading_seeds.py` |
| In-level vocabulary only | exists (draft gate) → run on shipped | `level_check` over the shipped body |
| `grammar_slugs` real **and actually used** | exists (real) + **new** (used) | compile resolves slugs; new: for each declared slug, at least one of its `accepted_forms` (or a conjugation-rule surface) appears in the body |
| `english_translation` faithful | AI | tier 2 |
| `summary_ja` / `summary_en` accurate | AI | presence/length mechanical; faithfulness tier 2 |
| Question count matches seed | exists (draft gate) → run on shipped | `validate_readings` |
| ≥1 accepted answer appears in body | exists (draft gate) → run on shipped | `validate_readings` check 2 |
| Prompts in-level, `prompt_furigana` correct | exists | `validate-schema` + `level_check` |
| `body_furigana` matches body | exists | `validate-schema` strip-match + coverage |
| `word_spans` / `vocabulary_slugs` correct, incl. inflected spans (feedback 14.1) | exists (integrity) + **new** (coverage/staleness) | compile enforces the full span contract (slice match, order, non-overlap, `surface_form`↔`inflection` co-required, taught-inflection stem invariant); `validate_readings` checks inflection coverage per draft; add the shipped re-derivation diff (check 10). Invariant to preserve: an inflected span never introduces a slug absent from `vocabulary_slugs`, so spans can't move a passage's unlock bar |
| Tone matches seed (humour) | human | planned humour vs random is a read |

## New deterministic checks to build (the gaps)

1. **Accepted-answer invariants** (kanji + vocab): readings[] ↔ reading answers
   round-trip; exactly one `is_primary` meaning answer; primary matches
   `meaning`; vocab reading answer == furigana-derived kana reading.
2. **Shipped-content re-run of the draft gates**: mnemonic tag checks
   (`<radical>` / `<kanji>` / `<reading>`), target presence in examples,
   example-contains-accepted-form for grammar, passage question rules — the
   checkers exist; wrap them so they read `curriculum/<level>.json` like
   `check_cloze.py` already does for cloze variants.
3. **Graph decomposition completeness vs KRADFILE**: every component of a
   taught kanji has a `builds_on` edge or a recorded exception (the
   fact-audit's 257 INFO pairings become a decision list: author the missing
   radical — e.g. 首 for 道 — or accept with a recorded reason). Run this
   *before* check 4: adding edges can flip previously-passing mnemonics to
   failing, which is the desired cascade.
4. **Mnemonic tags ↔ taught decomposition (both directions)**: `<radical>`
   tags in kanji mnemonics resolve to `builds_on` parents in
   `dependencies/graph.json` *and every* `builds_on` parent is referenced in
   the mnemonic; `<kanji>` tags in vocab mnemonics resolve to the word's
   taught component kanji.
5. **Passage grammar actually used**: each declared `grammar_slugs` entry
   contributes ≥1 surface form found in the body.
6. **Passage word-count band**: `word_count` within the seed's band.
7. **Look-alike symmetry**: `visually_similar_slugs` mutual.
8. **Corpus hygiene**: duplicate slug / `primary_form` detection across files;
   `metadata.json` `content_counts` matches actual; `sort_order` sane.
9. **Review-status rollup**: counts by `_meta.review_status` per content type,
   so the report doubles as the human-review tracker (and flags drift, e.g.
   tracking docs claiming "reviewed" where JSON says `draft`).
10. **Span re-derivation diff** (feedback 14.1): re-derive spans from the
    shipped text + `vocabulary_slugs` with `generate_content/spans.py` and diff
    against the shipped `word_spans` on every example sentence and passage —
    reporting missing, extra, or misclassified (`inflection`) spans. Compile
    verifies spans are *well-formed* but not *complete or current*: a
    hand-edited sentence or a changed link list leaves stale spans that still
    compile. Also assert the unlock-bar invariant: every inflected span's slug
    already appears in the item's `vocabulary_slugs`.

## Tier 2 — the AI pass, scoped and priced

Semantic surface for N5: **2,734 example sentences** (318 kanji + 2,152 vocab
+ 264 grammar), **10 passage translations**, **27 comprehension questions**,
optionally 74 `explanation_markdown` lessons.

- Batch ~40 sentence pairs per call, JSON in / JSON out ("for each: does the
  English faithfully translate the Japanese? flag only mismatches") → ~70
  calls, roughly 300K tokens total.
- Small model (Haiku / Flash / mini class): **order of $1–2 for the level**.
  Frontier model: single-digit dollars. Compare human spot-checking at
  ~5 s/sentence ≈ 4 hours.
- Run it only over `review_status: draft` items; flip items to `reviewed`
  when tiers 0–2 come back clean.
- Output lands in the same report as advisory findings — the human decides;
  the model never edits content directly.

## Proposed shape

- `curriculum/_build/generate_content/audit_shipped.py` — tiers 0–1 over the
  shipped JSON for a level (`--level n5`), reusing `level_check`,
  `validate_*`, and `import/sources.py`; writes
  `curriculum/_build/reports/content-audit-n5.md` graded ERROR/WARNING/INFO
  like `fact-audit.md`, with the review-status rollup at the top.
- `audit_semantic.py` (or `--semantic` flag) — the tier-2 batch pass, opt-in.
- Thin repo-root wrapper: `npm run audit-content` = `validate-schema` +
  compile + shipped audit, so one command answers "is N5 shippable?"

Suggested build order: (1) shipped re-run harness + accepted-answer
invariants, (2) graph/tag and passage-usage checks, (3) report + rollup,
(4) semantic pass last — it is only worth paying for once the free tiers are
green.
