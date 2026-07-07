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
   even for a free app.
3. **This is build-time generation** (maintainer laptop / CI → `curriculum/` → compile →
   OTA). It is unrelated to Epic 8's on-device BYO-key story generation
   (`docs/ai-reading-and-community-contribution-design-note.md`) — no app code, no keys
   on device, no new network access for learners.
4. **Everything flows through the existing pipeline:** `curriculum/_build/` datasets →
   `generate.py` → `curriculum/**/*.json` → `validate-schema` → `compile-curriculum` →
   `curriculum.db` (LFS) → OTA. New tooling feeds `_build`, never bypasses it.

## Phase 0 — Schema extensions (prerequisite, ~half a day)

Additive changes to `curriculum/schema/curriculum.schema.json`,
`scripts/curriculum-schema.ts` (DDL), `scripts/compile-curriculum.ts`, and
`scripts/validate-schema.ts`. `curriculum.db` is replaced wholesale via OTA, so no
migration concerns; the app's read repositories gain optional fields.

| Content | New fields | Rationale |
|---|---|---|
| grammar | `explanation_markdown` (long-form lesson body), `caution_notes`, `related_grammar_slugs` | the MaruMori-depth lesson has nowhere to live today (`grammar_rules` has only structure/conjugation/forms) |
| kanji | `meaning_mnemonic` + `reading_mnemonic` (split, WaniKani-style), `description`, reuse existing `items.visual_mnemonic_url` | reading mnemonics need the reading in the story; one blob can't serve both quiz directions |
| example sentences | `furigana` (JmdictFurigana notation: `私[わたし]は学生[がくせい]です。`) | furigana is half of MaruMori's readability |
| example sentences | keep `vocabulary_slugs`; validator gains a **level check** (see Phase 2) | prevents N3 vocab leaking into N5 examples |
| readings | `english_translation`, `grammar_slugs`, `vocabulary_slugs`, `word_count` | enables graded-reader validation + cross-domain reinforcement display |

Authoring format decision: long-form `explanation_markdown` should live as **one markdown
file per grammar point** (`curriculum/grammar/lessons/<level>/<slug>.md`) that
`generate.py` inlines at build time — reviewing a 2,000-word lesson as a Python string
literal or JSON-escaped blob is miserable; per-file markdown gives clean git diffs and
lets a human read the lesson the way a learner would.

Each generated artifact carries sidecar metadata (frontmatter in the .md, or a `_meta`
key in datasets): `generator_model`, `prompt_version`, `review_status: draft|reviewed`,
`reviewed_by`. `compile-curriculum` warns (CI: fails a flag-gated check) on `draft`
content so unreviewed prose can't silently ship.

## Phase 1 — Fact skeleton from open sources (1–2 days, deterministic)

New importers under `scripts/import/`, output merged into `_build` datasets. These are
re-runnable and give correct *facts* before any AI touches anything.

| Data | Source | License | Used for |
|---|---|---|---|
| kanji meanings, on/kun readings, JLPT level, stroke count, frequency | KANJIDIC2 | EDRDG (CC BY-SA) | verify/correct `kanji/*.json` readings + accepted answers |
| kanji → component decomposition | KRADFILE | EDRDG | grounds kanji mnemonics in *our* radical names; cross-checks `dependencies/graph.json` (1,368 edges today) |
| vocab glosses, readings, part-of-speech, common-word flags | JMdict | EDRDG (CC BY-SA) | verify vocab meanings/readings; pick example vocab |
| JP/EN sentence pairs searchable by word | Tatoeba | CC BY 2.0 FR | candidate pool for example sentences (real, native-written) |
| furigana segmentation for JMdict entries | JmdictFurigana | CC BY-SA | furigana for vocab; base dictionary for the tokenizer |
| stroke-order SVGs with per-stroke/-component grouping | KanjiVG | CC BY-SA 3.0 | Phase 3 image cards |
| JP tokenizer | kuromoji.js (or MeCab+unidic via a small script) | Apache-2.0 | level-checking examples and passages (Phases 2/4) |

Deliverable: a `scripts/import/audit` report diffing current `_build` facts against the
authoritative sources (wrong readings, missing kunyomi, meaning drift). Fix facts before
generating prose that would bake mistakes in.

## Phase 2 — AI generation for the creative layer

New `scripts/generate-content/` (Node/TS, Anthropic SDK, **Message Batches API** — 50%
cost, generation is offline so latency is irrelevant). One generator per content type,
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
  instruction to write original scenario-framed examples, not copy them
- output contract: markdown with fixed section headings + a JSON block of new example
  sentences (`japanese`, `english`, `furigana`, `vocabulary_slugs`)

**Pilot: 10 N5 grammar points.** Iterate the prompt until output honestly compares to
the かどうか lesson. Only then batch the rest. Prompt lives in the repo
(`scripts/generate-content/prompts/grammar-lesson.md`) and is versioned
(`prompt_version` in sidecar metadata) so regeneration is reproducible.

### 2b. Kanji + radical mnemonics

- Kanji meaning mnemonic **must reference the KRADFILE components by our radical names**
  ("*tree* + *sun* peeking through = east") — systematic, WaniKani-style, reinforces the
  radical layer the app already teaches.
- Kanji reading mnemonic must *contain* the target reading in the story.
- Radical mnemonics: one vivid concrete image per radical (feeds Phase 3 image
  generation directly).
- Enforce a consistent mnemonic *cast* (recurring characters/settings) via a shared
  style sheet in the prompt — coherence across hundreds of items is what makes
  WaniKani's system feel designed rather than generated.

### 2c. Example sentences (kanji + vocab)

Prefer adapting Tatoeba candidates (filtered by the tokenizer to in-level vocab);
generate only when no suitable real sentence exists. Every sentence gets furigana via
the tokenizer, not the LLM (LLM furigana is unreliable for rare readings).

### Mechanical validation gate (before any human review)

`scripts/generate-content/validate-drafts.ts`, run on every batch output:

1. every referenced `vocabulary_slugs` / `related_grammar_slugs` exists
2. tokenizer level-check: no out-of-level content words in examples
3. grammar examples actually contain one of the item's `accepted_forms`
4. furigana round-trips (stripping readings reproduces the surface string)
5. output parses and passes `validate-schema` after assembly

Failures are auto-requeued with the validator error appended to the prompt (one retry),
then flagged for manual handling.

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
3. **Closed loop:** tokenize the output; every content word must resolve to an allowed
   vocab slug and every grammar point to an allowed slug. Reject and regenerate with
   the specific violations listed. Iterate until clean or flagged.
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
- Grammar lessons: full read of every item (~150 lessons; at 5 min each this is
  ~2 focused days — the single biggest human cost in the plan, and worth it).
- Mnemonics/examples: bulk skim, 10–20 per screen.
- `review_status: reviewed` required before `generate.py` will emit the item without a
  warning; CI check keeps drafts out of release compiles.

## Execution order

| Step | What | Effort | Gate |
|---|---|---|---|
| 1 | Phase 0 schema + validator + compile changes | ~0.5 day | `validate-schema` + `compile-curriculum` + app typecheck green |
| 2 | Phase 1 importers + fact audit, fix `_build` facts | 1–2 days | audit report clean |
| 3 | **Grammar pilot: 10 N5 points** (Phase 2a) | 1 day + iteration | side-by-side read against the かどうか lesson — go/no-go on the whole approach |
| 4 | Batch remaining N5+N4 grammar; review | 2–3 days (mostly review) | all lessons `reviewed` |
| 5 | Kanji/radical mnemonics (2b) + Tier 1 image cards (Phase 3) | 1–2 days | validator green, spot review |
| 6 | Example sentence upgrade w/ furigana (2c) | 1 day | level-check green |
| 7 | Reading passages (Phase 4) | 1 day | tokenizer loop green, full read |
| 8 | Tier 2 radical art, R2 upload per existing doc | best effort | per-image visual review |

The step-3 pilot is the decision point: if generated lessons can't be prompted to the
quality bar, the fallback is hand-writing grammar lessons (using the same schema and
review tooling) starting with N5 — everything else in the plan still stands.

## Open questions

- **Attribution UI:** where the EDRDG/Tatoeba/KanjiVG credits live in-app (Settings →
  About is the obvious spot). Required before shipping Phase 1 data.
- **N3+ expansion:** same pipeline, but grammar point *inventory* for N3+ needs
  curating first (open lists vary in quality); out of scope here.
- **Voice:** pick and document the app's teaching voice (MaruMori is playful-casual;
  WaniKani is absurdist) in the prompt style sheet before the pilot, so all content
  sounds like one author.
