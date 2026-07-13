# Content quality pipeline — plan

Goal: bring curriculum content up to the quality bar of the best commercial tools —
MaruMori-depth grammar lessons, WaniKani-depth radical/kanji mnemonics with images,
and genuinely graded reading passages — without copying any copyrighted prose.

Quality reference: the saved MaruMori lesson (かどうか・Question-word + か). What makes
it good, concretely:

- ~2,000-word **conversational explanation**, not a definition
- examples framed as **scenarios** ("you're setting up a surprise party for your dad…")
- **furigana** on every kanji in examples
- explicit **rules and exceptions** section ("かどうか can't be used with question words")
- **casual-speech notes** (わからない → わかんない)
- **contrast with sibling grammar** (かどうか vs bare か) and forward links ("this will
  become important when we talk about…")

Our current grammar items have a one-line `mnemonic_text` and a `structure` string.
This is a schema + content + tooling gap, not just missing data.

## Ground rules

1. **No scraped prose ships.** MaruMori/WaniKani/Bunpro pages are copyrighted; this repo
   is public. They are quality rubrics only. Facts come from open-licensed databases;
   prose is AI-generated in our own voice and human-reviewed.
2. **Licensing:** EDRDG files (KANJIDIC2, JMdict, KRADFILE) and KanjiVG are CC BY-SA;
   Tatoeba sentences are CC BY 2.0 FR. All are compatible with a free open-source app,
   but require an attribution screen in Settings and a NOTICE file in the repo.
   Avoid NC-licensed sources (e.g. Tae Kim is CC BY-NC-SA) — NC is a legal gray zone
   even for a free app. Note: KanjiVG's share-alike means the Tier 1 card PNGs we
   render from its SVGs are themselves CC BY-SA 3.0 — the R2 assets inherit the
   license; record this in the NOTICE file.
   **Tatoeba lane decision:** Tatoeba sentences are *style anchors only* — we generate
   original examples and never ship Tatoeba text verbatim or "adapted" (a paraphrase of
   a CC BY sentence is still a derivative work requiring per-sentence attribution;
   adapting is both an attribution obligation and a rule-1 violation, so we don't).
3. **This is build-time generation** (maintainer laptop / CI → `curriculum/` → compile →
   OTA). It is unrelated to Epic 8's on-device BYO-key story generation
   (`docs/ai-reading-and-community-contribution-design-note.md`) — no app code, no keys
   on device, no new network access for learners.
4. **Everything flows through the existing pipeline:** `curriculum/_build/` datasets →
   `generate.py` → `curriculum/**/*.json` → `validate-schema` → `compile-curriculum` →
   `curriculum.db` (LFS) → OTA. New tooling feeds `_build`, never bypasses it.

## Phase 0 — Schema extensions (prerequisite, ~1 day)

Additive changes to `curriculum/schema/curriculum.schema.json`,
`scripts/curriculum-schema.ts` (DDL), `scripts/compile-curriculum.ts`, and
`scripts/validate-schema.ts`. `curriculum.db` is replaced wholesale via OTA, so no
migration concerns; the app's read repositories gain optional fields.

| Content | New fields | Rationale |
|---|---|---|
| grammar | `explanation_markdown` (long-form lesson body), `caution_notes`, `related_grammar_slugs` | the MaruMori-depth lesson has nowhere to live today (`grammar_rules` has only structure/conjugation/forms) |
| kanji | `meaning_mnemonic` + `reading_mnemonic` (split, WaniKani-style), `description`, reuse existing `items.visual_mnemonic_url` | reading mnemonics need the reading in the story; one blob can't serve both quiz directions |
| example sentences | keep `vocabulary_slugs`; validator gains a **level check** (see Phase 2) | prevents N3 vocab leaking into N5 examples |

Note: example-sentence `furigana` is **not** a new field — `generate.py` already emits it
(bracket notation) via `furigana.py` (fugashi/unidic, round-trip invariant) on vocab,
grammar examples, reading bodies, and question prompts. The *actual* gap is furigana on
Japanese embedded in `explanation_markdown` lesson bodies: `generate.py` gains a
build-time pass that runs `furigana.py::annotate_sentence` over Japanese runs inside
the markdown (fenced/inline JP spans use a lightweight convention the pass can detect),
emitting the same bracket notation the app already renders. Authors/generators write
plain Japanese; the tokenizer — never the LLM — supplies readings.
| readings | `english_translation`, `grammar_slugs`, `vocabulary_slugs`, `word_count` | enables graded-reader validation + cross-domain reinforcement display |

Authoring format decision: long-form `explanation_markdown` should live as **one markdown
file per grammar point** (`curriculum/grammar/lessons/<level>/<slug>.md`) that
`generate.py` inlines at build time — reviewing a 2,000-word lesson as a Python string
literal or JSON-escaped blob is miserable; per-file markdown gives clean git diffs and
lets a human read the lesson the way a learner would.

### Phase 0.5 — Minimal lesson UI (critical path, alongside the pilot)

Schema fields alone produce a corpus nobody sees: the app currently renders grammar as
structure + one-line mnemonic and has **no markdown renderer**. Before (or with) the
pilot, add a thin Learn/lesson surface that renders `explanation_markdown` (headings,
JP-with-furigana spans, caution/related sections) in the lesson session flow. It doesn't
need polish — the pilot's go/no-go read should happen in something close to the real
rendering, and reviewers (Phase 5) reuse the same renderer.

Each generated artifact carries sidecar metadata (frontmatter in the .md, or a `_meta`
key in datasets): `generator_model`, `prompt_version`, `review_status: draft|reviewed`,
`reviewed_by`. `compile-curriculum` warns (CI: fails a flag-gated check) on `draft`
content so unreviewed prose can't silently ship.

## Phase 1 — Fact skeleton from open sources (1–2 days, deterministic)

New importers under `curriculum/_build/import/` (Python — see the tokenizer/toolchain
note below), output merged into `_build` datasets. These are re-runnable and give
correct *facts* before any AI touches anything.

| Data | Source | License | Used for |
|---|---|---|---|
| kanji meanings, on/kun readings, JLPT level, stroke count, frequency | KANJIDIC2 | EDRDG (CC BY-SA) | verify/correct `kanji/*.json` readings + accepted answers |
| kanji → component decomposition | KRADFILE | EDRDG | grounds kanji mnemonics in *our* radical names; cross-checks `dependencies/graph.json` (1,368 edges today) |
| vocab glosses, readings, part-of-speech, common-word flags | JMdict | EDRDG (CC BY-SA) | verify vocab meanings/readings; pick example vocab |
| JP/EN sentence pairs searchable by word | Tatoeba | CC BY 2.0 FR | candidate pool for example sentences (real, native-written) |
| furigana segmentation for JMdict entries | JmdictFurigana | CC BY-SA | furigana for vocab; base dictionary for the tokenizer |
| stroke-order SVGs with per-stroke/-component grouping | KanjiVG | CC BY-SA 3.0 | Phase 3 image cards |
| JP tokenizer | **reuse `furigana.py`'s fugashi/unidic tagger** (already in `_build/requirements.txt`) | BSD | level-checking examples and passages (Phases 2/4) |

**One tokenizer, not two.** The level-checker must use the same fugashi/unidic tagger
that produces the shipped furigana. A second tokenizer (kuromoji.js was considered)
can segment differently, letting an example pass the level gate while its furigana has
holes — or vice versa. Consequence: **new tooling lives in Python** next to `_build`
(Anthropic has a first-class Python SDK), so importers go under `curriculum/_build/import/`
rather than a parallel Node toolchain; the repo's Node scripts stay confined to the
existing validate/compile step.

**Merge-back is real work, not a diff.** `_build` datasets are hand-authored positional
tuples (`(suffix, char, meaning, onyomi, kunyomi, mnemonic)`); merging KANJIDIC2/JMdict
corrections into them — and adding split mnemonics, `description`, and markdown
references — requires restructuring the tuples into dicts (or dataclasses) first. Do
that restructuring as the first Phase 1 task, mechanically (script converts tuples →
dicts, `generate.py` output byte-identical before/after), so importers and generators
have named fields to write into.

Deliverable: a fact-audit report diffing current `_build` facts against the
authoritative sources (wrong readings, missing kunyomi, meaning drift). Fix facts before
generating prose that would bake mistakes in. Also **spot-check the allowed-vocab
derivation** (`sort_order` + dependency graph) for a handful of grammar points before
the pilot — if unlock order is messy or graph edges are incomplete, in-level example
constraints will be quietly wrong.

## Phase 2 — AI generation for the creative layer

New `curriculum/_build/generate_content/` (Python, Anthropic SDK, **Message Batches
API** — 50% cost, generation is offline so latency is irrelevant; Python so it shares
`furigana.py`'s tokenizer and the `_build` datasets directly). One generator per content type,
run **one level × one content type at a time**, writing drafts into `_build` /
`lessons/`, never straight to shipped JSON.

Volume for N5+N4 (current counts): ~150 radicals, ~200 kanji, ~1,450 vocab,
~150 grammar points, readings. At ~3–4k output tokens per grammar lesson and far less
per mnemonic, the whole N5+N4 corpus is a few million tokens — **tens of dollars** even
on the top model via batches. Use the best available model; content is the product.

### 2a. Grammar lessons (highest leverage — pilot first)

Rubric prompt encoding the MaruMori qualities listed at the top, with strict inputs:

- the grammar point: `structure`, `conjugation_rules`, `accepted_forms`, JLPT level
- **allowed vocabulary**: the slugs unlocked at this point in the curriculum order
  (derivable from `sort_order` + the dependency graph) — examples must stay in-level
- **sibling grammar** already taught (for contrast sections) and upcoming related points
  (for forward teasers) via `related_grammar_slugs`
- 3–5 Tatoeba sentences containing the pattern, as *style anchors* (real usage), with
  instruction to write original scenario-framed examples, not copy or paraphrase them
  (see the Tatoeba lane decision in ground rule 2)
- output contract: **structured output via tool calling** — one tool schema with
  `lesson_markdown` (string) and `example_sentences` (array of `japanese`, `english`,
  `vocabulary_slugs`); LLMs mangle mixed markdown+JSON free-form output, tool use
  guarantees parseable JSON. Furigana is *not* an LLM output — the tokenizer adds it
  during assembly (rare-reading LLM furigana is unreliable).

**Pilot: 10 N5 grammar points.** Iterate the prompt until output honestly compares to
the かどうか lesson. Only then batch the rest. Prompt lives in the repo
(`curriculum/_build/generate_content/prompts/grammar-lesson.md`) and is versioned
(`prompt_version` in sidecar metadata) so regeneration is reproducible.

**Prerequisites for the pilot, not open questions:** the voice doc and mnemonic cast
bible (see 2b) must be locked *before* the 10-point pilot — regenerating items later
without the same voice/cast sheet is how mnemonic systems fall apart — and the pilot
must be read in the Phase 0.5 lesson renderer, not as raw markdown.

### 2b. Kanji + radical mnemonics

- Kanji meaning mnemonic **must reference the taught decomposition in
  `dependencies/graph.json`** ("*tree* + *sun* peeking through = east") — that graph
  (1,368 curated edges) is the app's actual truth for kanji→radical, in our radical
  names. KRADFILE is an *auditor* of the graph (Phase 1), not the mnemonic input: its
  decomposition doesn't map 1:1 to the taught radical set, and mnemonics must never
  reference components the learner was never taught.
- Kanji reading mnemonic must *contain* the target reading in the story.
- Radical mnemonics: one vivid concrete image per radical (feeds Phase 3 image
  generation directly).
- Enforce a consistent mnemonic *cast* (recurring characters/settings): the cast bible
  maps readings → characters (e.g. こう → a fixed character), and the generator script
  **injects the relevant character lore into each item's prompt** based on the reading —
  batch items are independent calls, so a static style sheet alone won't keep the cast
  coherent. Budget a cross-batch coherence pass at review time; drift across batches is
  expected even with injection.

### 2c. Example sentences (kanji + vocab)

Generate original sentences, using in-level Tatoeba candidates (filtered by the
tokenizer) as style anchors in the prompt only — per the lane decision in ground
rule 2, no Tatoeba text is shipped verbatim or adapted. Every sentence gets furigana
via the tokenizer, not the LLM (LLM furigana is unreliable for rare readings).

### Mechanical validation gate (before any human review)

`curriculum/_build/generate_content/validate_drafts.py`, run on every batch output:

1. every referenced `vocabulary_slugs` / `related_grammar_slugs` exists
2. tokenizer level-check: no out-of-level content words in examples
3. grammar examples actually contain one of the item's `accepted_forms`
4. **furigana annotation succeeds** — note `annotate_sentence` returns `None` on
   round-trip failure rather than raising, so today's behavior is "silently no
   furigana". For *generated* content that's a **rejection**, not a pass: a sentence
   the tokenizer can't fully annotate fails the gate.
5. output parses and passes `validate-schema` after assembly

**Exception policy (decide up front, not per-failure):** the level-check needs a
function-word/particle allowlist, a proper-noun escape hatch, and a colloquialism
safelist mapping casual forms to their base slugs (わかんない → 分かる) — unidic won't
lemmatize contractions cleanly, and without the safelist the gate infinitely rejects
natural casual examples the plan explicitly wants.

Failures are auto-requeued with the validator error appended to the prompt, **capped at
3 attempts**, then written with `review_status: flagged_for_rewrite` for manual
handling so batches never hang on an unsatisfiable constraint.

## Phase 3 — Images

Extends `docs/radical-mnemonic-images.md` (spec: PNG, square/4:3, ≤512 KB, R2 at
`https://assets.japanese-learning.app/radicals/{level}/{slug}.png`; app already has
disk caching + text fallback).

- **Tier 1 — deterministic, ship first:** script renders KanjiVG SVGs into card PNGs —
  the character with its mnemonic-relevant component highlighted in the
  `content-radical` accent color, on theme-consistent backgrounds. Covers *all* kanji
  and radicals immediately; zero marginal cost; visually consistent by construction.
  Add a `kanji/{level}/{slug}.png` prefix alongside the existing radicals convention.
- **Tier 2 — curated AI art for radicals only (~150 items):** image-generation model
  prompted from each radical's `mnemonic_text`, one shared style directive (flat color,
  bold line weight, readable at 140 px per the existing checklist). Small enough to
  human-review every image. Kanji stay on Tier 1 cards — pictorial mnemonics matter
  most at the radical layer.

## Phase 4 — Reading passages

The strongest-constrained generation, and the one where verification makes the
difference between filler and a real graded reader:

1. Input: exact vocab + grammar slug lists available at the passage's curriculum
   position, target length, topic seed.
2. Generate passage + `english_translation` + comprehension questions with
   `accepted_answers` in one call.
3. **Closed loop:** tokenize the output (same fugashi tagger, same exception policy as
   the Phase 2 gate); every content word must resolve to an allowed vocab slug and
   every grammar point to an allowed slug. Reject and regenerate with the specific
   violations listed — capped at 3 attempts, then `flagged_for_rewrite` (an LLM can get
   stuck needing an out-of-level word to express an idea; move on rather than loop).
4. Store `grammar_slugs` / `vocabulary_slugs` on the passage — this is what powers the
   cross-domain reinforcement display ("食べる ← you learned this yesterday") planned
   for Epic 5.

Target: 8–10 passages per level with increasing length/complexity, replacing the
current 2 per level.

## Phase 5 — Human review loop

Review is what actually reaches the MaruMori bar; make it cheap:

- `npm run review-content -- --type grammar --level n5` renders each draft item as a
  local HTML page (lesson prose + examples with furigana, styled roughly like the app)
  with approve / edit / regenerate actions that update `review_status` in the sidecar.
- Grammar lessons: full read of every item (~150 lessons; 5 min each is the
  *optimistic floor* — edit/regenerate cycles realistically push first-pass grammar
  review toward **a week**, not 2 days; it's the single biggest human cost in the plan,
  and worth it — but don't treat the execution table as a schedule).
- Mnemonics/examples: bulk skim, 10–20 per screen.
- `review_status: reviewed` required before `generate.py` will emit the item without a
  warning; CI check keeps drafts out of release compiles.

## Execution order

| Step | What | Effort | Gate |
|---|---|---|---|
| 1 | Phase 0 schema + validator + compile changes; Phase 0.5 minimal lesson UI | ~1 day + UI | `validate-schema` + `compile-curriculum` + app typecheck green; markdown lesson renders on device |
| 2 | Phase 1 tuple→dict restructure, importers + fact audit, fix `_build` facts; spot-check allowed-vocab derivation | 2–3 days | `generate.py` output unchanged by restructure; audit report clean |
| 3 | Voice doc + cast bible → **grammar pilot: 10 N5 points** (Phase 2a) | 1 day + iteration | side-by-side read against the かどうか lesson, in the Phase 0.5 renderer — go/no-go on the whole approach |
| 4 | Batch remaining N5+N4 grammar; review | ~1 week (mostly review) | all lessons `reviewed` |
| 5 | Kanji/radical mnemonics (2b) + Tier 1 image cards (Phase 3) | 1–2 days | validator green, spot review + cast-coherence pass |
| 6 | Example sentence upgrade (2c) | 1 day | level-check green |
| 7 | Reading passages (Phase 4) | 1 day | tokenizer loop green, full read |
| 8 | Tier 2 radical art, R2 upload per existing doc | best effort | per-image visual review |

**Coordination with review-quality work (docs 07–09):** deep lessons improve *Learn*;
`cloze_variants` authoring (already in schema/compiler) improves *Review*. Grammar
lessons take priority for maintainer hours per this plan, but the 2a generator's tool
schema should also emit candidate `cloze_variants` for each grammar point in the same
call — same inputs, marginal token cost — so we don't end up running two separate
content factories over the same 150 items.

The step-3 pilot is the decision point: if generated lessons can't be prompted to the
quality bar, the fallback is hand-writing grammar lessons (using the same schema and
review tooling) starting with N5 — everything else in the plan still stands.

## Open questions

- **Attribution UI:** Settings → About, grouped by source type (dictionary data:
  JMdict/KANJIDIC2/KRADFILE — EDRDG; furigana: JmdictFurigana; stroke orders: KanjiVG,
  incl. the share-alike note on our derived PNGs). Tatoeba appears only if we ever ship
  its text (we don't, per the lane decision). Required before shipping Phase 1 data.
- **N3+ expansion:** same pipeline, but grammar point *inventory* for N3+ needs
  curating first (open lists vary in quality); out of scope here.

(Voice/tone is no longer an open question — it's a step-3 prerequisite: a
`persona.md` in the prompts directory defining the teaching voice, with concrete rules
like "never use a linguistics term without immediately glossing it casually", plus the
mnemonic cast bible from 2b.)
