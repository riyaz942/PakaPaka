# Content quality pipeline — plan

Goal: bring curriculum content up to the quality bar of the best commercial tools —
MaruMori-depth grammar lessons, WaniKani-depth radical/kanji mnemonics (with
**radical-only** mnemonic images), and genuinely graded reading passages — without
copying any copyrighted prose.

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
   even for a free app. Note: KanjiVG's share-alike means radical Tier 1 card images we
   render from its SVGs are themselves CC BY-SA 3.0 — the **bundled** assets in
   `mobile/assets/radicals/` inherit the license; record this in the NOTICE file.
   **Tatoeba lane decision:** Tatoeba sentences are *style anchors only* — we generate
   original examples and never ship Tatoeba text verbatim or "adapted" (a paraphrase of
   a CC BY sentence is still a derivative work requiring per-sentence attribution;
   adapting is both an attribution obligation and a rule-1 violation, so we don't).
3. **This is build-time generation** (maintainer laptop / CI → `curriculum/` → compile →
   OTA). It is unrelated to Epic 8's on-device BYO-key story generation
   (`docs/design/ai-reading-and-community-contribution-design-note.md`) — no app code, no keys
   on device, no new network access for learners.
4. **Everything flows through the existing pipeline:** `curriculum/_build/` datasets →
   `generate.py` → `curriculum/**/*.json` → `validate-schema` → `compile-curriculum` →
   `curriculum.db` (LFS) → OTA. New tooling feeds `_build`, never bypasses it.

## Revision 1 — content depth, tone, and per-type model (July 2026)

Direction change after reading the first N5 drafts against the WaniKani bar.
The **per-item content model** changes; grammar lessons, example sentences, and
the pipeline machinery are untouched. Decided against the code as it exists
today — what is already built vs. missing is called out per point.

**Target content model per item type:**

| Type | Mnemonics | Description |
|---|---|---|
| radical | **none** | story-like, funny explanation of the glyph that doubles as the Tier 2 image prompt — it must match the generated image closely; plus look-alike warnings |
| kanji | `meaning_mnemonic` (story built from the taught radicals' *established images*) + `reading_mnemonic` (cast character, contains the kana) — both substantially longer, funnier, WaniKani-depth | meaning nuance + glyph description + look-alike kanji/radicals with the subtle visual differences spelled out |
| vocabulary | `meaning_mnemonic` (story connecting the component kanji → the word) + `reading_mnemonic` (full story; or a one-line "reading comes straight from 食 you already know" derivation note when the reading is regular) | meaning nuance, usage register, which kanji the word contains |
| grammar | **none** — drop `mnemonic_text`; the `explanation_markdown` lesson is the teaching artifact | n/a |

Mnemonics chain **radical → kanji → vocabulary**: a kanji story reuses each
component radical's established image (the kanji prompt already receives the
radical text via `mnemonic_context.format_components`; keep that mechanism, feed
it the new descriptions), and a vocab story reuses its kanji's established
meaning hooks. Regeneration order is therefore radicals → kanji → vocab.

**Findings that shape the work (verified in code):**

1. **Depth:** the v1 prompts capped kanji mnemonics at 2–4 sentences and radical
   text at 1–2 (`prompts/kanji-mnemonic.md`, `prompts/radical-description.md`;
   `validate_mnemonics.LEN_BOUNDS`). Rev-2 prompts raise the target to short
   WaniKani-style story paragraphs — funny, strange, concrete — and raise the
   length bounds to match. The N5 drafts (106 kanji, 76 radicals) are
   `review_status: draft`, never shipped: regenerate wholesale under
   `prompt_version: 2`, don't patch.
2. **App surfacing gap (critical path):** `meaning_mnemonic`,
   `reading_mnemonic`, and `description` are compiled into `curriculum.db` but
   the app never reads them — `itemRepository` selects only `mnemonic_text`,
   and `KanjiDetail`/lesson sections render only `mnemonicText`. Without the
   surfacing work (Phase 0.6 below) the whole revision is invisible.
3. **Grammar mnemonics:** `generate.py` still emits hand-authored one-liners
   and `GrammarDetail` renders them via `MnemonicSection`. Drop both (the
   learner-owned `PersonalMnemonicEditor` stays).
4. **Radical model:** rename/reframe radical `mnemonic_text` → `description`.
   Same text still drives Tier 2 image generation (text is written first, image
   is prompted from it — that coupling is what keeps description and image
   matching).
5. **Composition display:** already shipped — kanji details/lessons show
   "Built from" radical chips and vocab shows "Kanji in this word"
   (`ItemCrossReferences` + `useComponentParents`). Remaining nicety: a
   WaniKani-style composition line (木 + 日 = 東) at the top of the kanji
   meaning-mnemonic section.
6. **Look-alike ("visually similar") content** needs a *data-derived* pair
   list — the LLM must never invent confusables. New Phase 1 task below;
   structured `visually_similar_slugs` on radical/kanji plus prose in the
   description explaining the subtle differences. The app's existing
   `CompareView` is the natural render target for the chips.
7. **Passage tone:** Phase 4 generation has not run (current 10 N5 / 9 N4
   passages are hand-authored in `_build/*_readings.py`). When it runs, target
   **50–60% humorous** via tone-tagged topic seeds — not every passage, but
   most memorable ones.
8. **Cloze nudges reveal the answer:** the shipped nudges are hand-authored in
   `_build/n5_grammar.py` and are definitional giveaways ("Marks the topic —
   what the sentence is about" for は *is* the answer). Rewrite spec below.

## Phase 0 — Schema extensions (prerequisite, ~1 day)

Additive changes to `curriculum/schema/curriculum.schema.json`,
`scripts/curriculum-schema.ts` (DDL), `scripts/compile-curriculum.ts`, and
`scripts/validate-schema.ts`. `curriculum.db` is replaced wholesale via OTA, so no
migration concerns; the app's read repositories gain optional fields.

| Content | New fields | Rationale |
|---|---|---|
| grammar | `explanation_markdown` (long-form lesson body), `caution_notes`, `related_grammar_slugs` | the MaruMori-depth lesson has nowhere to live today (`grammar_rules` has only structure/conjugation/forms) |
| kanji | `meaning_mnemonic` + `reading_mnemonic` (split, WaniKani-style), `description`, reuse existing `items.visual_mnemonic_url` | reading mnemonics need the reading in the story; one blob can't serve both quiz directions |
| kanji (Rev 1) | `visually_similar_slugs`; `description` spec upgraded from "one plain sentence" to a descriptive block (meaning nuance + glyph + look-alike contrasts) | look-alikes are a top review-failure cause; structured slugs enable Compare links, prose carries the "how to tell them apart" |
| radicals (Rev 1) | `description` (replaces the mnemonic role of `mnemonic_text`), `visually_similar_slugs` | radicals get no mnemonic; the description explains the glyph/image story-style and is the Tier 2 image prompt |
| vocabulary (Rev 1) | `meaning_mnemonic`, `reading_mnemonic`, `description` | vocab mnemonics must chain from the component kanji; split serves the meaning/reading quiz directions same as kanji |
| grammar (Rev 1) | **stop emitting `mnemonic_text`** (`generate.py:385`) | grammar has full lessons now; a one-line mnemonic is noise |
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

*Status: built (`LessonMarkdown` + `parseLessonMarkdown` in the app). The JP-span
convention the renderer (and therefore the `generate.py` furigana pass) uses:
standalone example sentences go in ` ```jp ` fenced blocks; Japanese embedded in prose
just carries the usual bracket notation (`私[わたし]`) inline — no extra delimiter.
Supported markdown: `#`–`###` headings, paragraphs, `-`/`1.` lists, `>` callouts,
fenced blocks; inline `**bold**`, `*italic*`, `` `code` ``.*

### Phase 0.6 — Item-detail surfacing (Rev 1, critical path)

The Rev 1 twin of Phase 0.5: the DB already carries `meaning_mnemonic` /
`reading_mnemonic` / `description`, but `itemRepository` selects only
`mnemonic_text` and the detail/lesson views render only that. Work:

- `itemRepository` (+ `curriculum.types.ts`) selects the new columns, including
  the Rev 1 additions (radical/vocab `description`, vocab split mnemonics,
  `visually_similar_slugs`).
- `KanjiDetail` + lesson mnemonic section: split "Meaning mnemonic" /
  "Reading mnemonic" blocks, `description` panel, composition line
  (木 + 日 = 東) above the meaning mnemonic (data already available via
  `useComponentParents`).
- `RadicalDetail`: render `description` with the image (it *is* the image's
  caption/story); drop the mnemonic framing.
- `VocabularyDetail` + lesson: split mnemonics + description ("Kanji in this
  word" chips already exist).
- `GrammarDetail` + grammar lesson section: remove the curriculum
  `MnemonicSection`; keep `PersonalMnemonicEditor`.
- Look-alike chips on kanji/radical details, linking into `CompareView`.

Fallback rule: while old sidecar data lingers, render `mnemonic_text` only when
the split fields are absent — one path, visible in the UI, no silent merging.

*Status: built.* `itemRepository` selects the split mnemonics + `description` and
resolves look-alikes (`getVisuallySimilarItems`, [] on DBs compiled before the
`visually_similar_links` table); `useItemDetail` carries both to the surfaces.
Shared renderers: `ItemMnemonicSections` (composition line + split blocks +
legacy-blob fallback), `ItemDescriptionSection`, `LookAlikeSection` (chips open
Compare on whichever surface the detail is mounted on, per `ItemLinkContext`).
Kanji/vocabulary details and the lesson mnemonic section use them; `RadicalDetail`
and the lesson radical section caption the image with `description`; grammar's
curriculum `MnemonicSection` is gone (`PersonalMnemonicEditor` stays). `CompareView`
gained a "Descriptions" section above "Mnemonics" — that prose is what a look-alike
chip is sent there to read. Not covered: the review card mnemonic
(`queueBuilder`) and `PassageWordDetailSheet`, which still read `mnemonic_text`.

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
| stroke-order SVGs with per-stroke/-component grouping | KanjiVG | CC BY-SA 3.0 | Phase 3 radical Tier 1 cards |
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

**Rev 1 addition — look-alike pair derivation.** The confusable pairs that feed
kanji/radical descriptions come from data, never from the LLM: (a) a curated
seed list of the classic traps within our taught set (人/入, 大/犬/太, 土/士,
未/末, 白/百, 千/干, 石/右, ソ/ン-style radical pairs, …), plus (b) automated
candidates — items in the taught N5+N4 set sharing most taught components
(from `dependencies/graph.json`) or near-identical KanjiVG stroke skeletons.
Output: a reviewed `_build` dataset of symmetric pairs → `visually_similar_slugs`.
Hard rule mirroring the mnemonic component rule: a description may only name a
look-alike that is **in the taught set**; the validator enforces slug existence.

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
- **allowed vocabulary** — examples must stay in-level. *Derivation override
  (decided after the Phase 1 spot-check):* the original derivation here was the
  item's simulated planner unlock position (`sort_order` + dependency graph, as
  the app sequences content). The spot-check
  (`curriculum/_build/reports/allowed-vocab-spotcheck.md`) showed that is
  unusable — the planner's quotas leave the first grammar point with **1**
  unlocked word, ~100/171 points are taught before their own linked vocab, and
  ~138 N5 words defer into N4 behind cross-level kanji edges. Adopted instead:
  **option (a) — same-level vocab by proportional `sort_order` cutoff** (grammar
  point g of G gets the first ⌈g/G·V⌉ of the level's V vocab items), plus all
  lower-level vocab, plus the point's own `vocabulary_slugs`, plus the
  function-word/colloquialism allowlists from the exception policy below.
  Implementation + full rationale: `curriculum/_build/generate_content/context.py`.
  Known trade-off: the vocab list is ordered thematically, not by frequency, so
  very common words can sit late in the cutoff (食べる enters around grammar
  point ~38) — the generator sees the exact allowed list, so lessons stay
  self-consistent, but early-lesson scenarios are correspondingly constrained.
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

*Status: tooling built.* `curriculum/_build/generate_content/` holds the prompts
(persona, cast bible, lesson rubric), the option-(a) allowed-vocab derivation
(`context.py`), the tokenizer level-check + exception policy (`level_check.py`),
Tatoeba style anchors (`tatoeba.py`, needs `import/fetch_sources.sh --tatoeba`),
the mechanical gate (`validate_drafts.py`), and the batch driver
(`generate_grammar_lessons.py`, `claude-opus-4-8` via Message Batches, one forced
`submit_grammar_lesson` tool call per point, 3-attempt requeue then
`flagged_for_rewrite`). Pilot slugs: は・が・ませんか・て形・てもいい・
てはいけない・から・ので・たことがある・ほうがいい (contrast pairs built in).
Run from `curriculum/_build` with API credentials:
`.venv/bin/python -m generate_content.generate_grammar_lessons run` — gate-passing
drafts land as `curriculum/grammar/lessons/n5/<slug>.md` (`review_status: draft`
frontmatter carrying sidecar metadata + `caution_notes`/`related_grammar_slugs`);
`generate.py` inlines them into the grammar JSON and runs the build-time furigana
pass over ```jp fences and prose Japanese. Candidate `cloze_variants` are emitted
in the same call (per the docs 07–09 coordination note) but stay in
`generate_content/drafts/` as authoring input — they do not ship.

*No-API alternative for step 4 (batching the remaining ~161 points):*
`docs/workflows/grammar-web-chat-workflow.md` documents a paste-into-Claude/Gemini-web
flow using the same `context.py`, prompts, and `validate_drafts.py` gate — the
`webprompts` and `ingest` subcommands of `generate_grammar_lessons.py`. Only the
model call moves to the browser; the vocab constraints and mechanical gate are
identical, so it's a cost swap (flat subscription vs. per-token), not a quality
compromise. Use it to avoid the API cost of the long tail.

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

*Status (v1, superseded by the Rev 1 changes below — read those for what the
tooling does today): tooling built + N5 generated (draft).*
`curriculum/_build/generate_content/`
holds the mnemonic prompts (`prompts/kanji-mnemonic.md`, `prompts/radical-description.md`),
the cast-bible loader (`cast.py`, parses `prompts/cast-bible.md` and injects the
reading's fixed character per item), the context builder (`mnemonic_context.py` — kanji
readings + the **taught decomposition read straight from `dependencies/graph.json`** in
our radical names, never an untaught component), the mechanical gate
(`validate_mnemonics.py`: reading mnemonic contains the target reading, meaning mnemonic
references every taught component, plain-prose/length checks) and the batch driver
(`generate_mnemonics.py`, `claude-opus-4-8` via Message Batches, one forced
`submit_kanji_mnemonic` / `submit_radical_mnemonic` tool call per item, 3-attempt
requeue then `flagged_for_rewrite`). Run from `curriculum/_build` with API credentials:
`.venv/bin/python -m generate_content.generate_mnemonics run --type radical` and
`… run --type kanji`. Gate-passing drafts are assembled into per-level sidecars
(`curriculum/kanji/mnemonics/n5.json`, `curriculum/radicals/mnemonics/n5.json`) carrying
`_meta` (`generator_model`, `prompt_version`, `review_status: draft`); `generate.py`
inlines them into the kanji/radical JSON (`meaning_mnemonic`/`reading_mnemonic`/
`description` on kanji, the vivid image into radical `mnemonic_text`). The no-API
web-chat lane (`webprompts`/`ingest`) mirrors 2a for the cost swap and is documented
in `docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow.md` (with an automation prompt for
driving Gemini web in `docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow-automation-prompt.md`).
A no-API, no-browser variant that produces each reply with in-session subagents (same
`webprompts`/`ingest` commands and gate, auto-selecting the next batch of slugs stale
under the current `PROMPT_VERSION`) is in
`docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md`.
Still owed before ship: the Phase 5 human review + cross-batch cast-coherence pass
(drafts do not ship past `compile-curriculum`'s draft gate until
`review_status: reviewed`).

**Rev 1 changes to 2b (prompt_version 2, regenerate N5 drafts wholesale):**

- **Radicals: no mnemonic.** The `submit_radical_mnemonic` output becomes a
  `description`: a story-like, funny, drawable explanation of the glyph — what
  the strokes look like becoming the meaning, told as a memorable scene. It is
  simultaneously (a) what the learner reads next to the image and (b) the Tier 2
  image prompt, so it must describe one concrete picture the image will show.
  Where the radical has look-alikes, the description closes with the contrast
  ("don't confuse it with 入 — the short stroke leans the *other* way").
- **Kanji mnemonics get WaniKani depth.** Meaning mnemonic: a short story
  paragraph (not 2–4 sentences) that *continues each component radical's
  established image* — `mnemonic_context` already injects the radical text; it
  now injects the new descriptions, so the chain radical → kanji is literal, not
  just name-dropping. Funny, strange, concrete; ends on the meaning. Reading
  mnemonic: same depth, cast-driven, kana verbatim (unchanged rule).
- **Kanji `description` upgraded** from one factual sentence to a descriptive
  block: meaning nuance and usage, a plain description of the glyph, and — when
  `visually_similar_slugs` is non-empty — the look-alikes with the subtle
  visual differences spelled out. The pair list is prompt *input* (from
  Phase 1); the LLM writes only the contrast prose.
- **Gate updates** (`validate_mnemonics.py`): raise `LEN_BOUNDS` to story-
  paragraph range; radical checks move from `mnemonic_text` to `description`;
  new check — every character named as a look-alike resolves to a slug in
  `visually_similar_slugs`, and every listed look-alike is mentioned.
- **Generation order**: radicals first (their descriptions feed kanji prompts),
  then kanji, then 2d vocab.

*Status (Rev 2, partly superseded by Rev 3 below — read that for what the tooling
does today): Rev-2 tooling built (R1.4).* `PROMPT_VERSION = 2`
in `generate_mnemonics.py`, and `run` re-queues any draft recorded under an older
prompt version, so a regen is wholesale rather than a patch. The radical prompt is
now `prompts/radical-description.md` and its tool is `submit_radical_description`
(one `description`, no mnemonic); `prompts/kanji-mnemonic.md` asks for story
paragraphs that continue each component radical's *established description*
(`mnemonic_context.format_components` injects it) plus a description block that
contrasts the reviewed look-alikes; `prompts/vocab-mnemonic.md` + `--type vocab`
are the new 2d generator. `persona.md` is v2 — the added comedy-register section
is what "funny" means here, and it is shared with the Phase 4 passage seeds.
The gate (`validate_mnemonics.py`) has story-paragraph `LEN_BOUNDS` per type,
checks radicals on `description`, and enforces look-alikes in both directions:
every reviewed confusable is named, and no other Japanese character appears in a
description (descriptions carry no furigana). `generate.py` inlines radical
`description` and the new `curriculum/vocabulary/mnemonics/<level>.json` sidecar.

*Status: Rev 3 (July 2026) — calibrated against reviewed output.* Rev 1's bet that
radicals wanted a long `description` instead of a mnemonic did not survive contact
with the generated prose: the maintainer read the N5 set and kept the original
short mnemonics. So Rev 3 reverts that swap and recalibrates length from data
rather than intent.

- **Radicals go back to `mnemonic_text`**, ~150–300 characters, in a prompt that
  asks for a funnier image (`prompts/radical-mnemonic.md`,
  `submit_radical_mnemonic`). `PROMPT_VERSION["radical"]` is therefore **1**, not a
  new high number — a draft written under the original prompt is exactly what the
  current one asks for, and marking 76 kept items stale would regenerate them for
  nothing. `mnemonic_context.format_components` now injects the radical's
  `mnemonic_text` as the established image the kanji story must continue.
- **`description` is optional on all three types.** It is required only when the
  item has reviewed look-alikes (the visual contrast is the one thing a story
  cannot carry) and otherwise written only for a real nuance. The gate enforces
  both halves: it validates a description when present, and demands one when the
  item has confusables.
- **Length bounds come from the reviewed N5 set**, not from a target picked in the
  abstract: radical mnemonics 144–299 chars, kanji meaning 144–366, kanji reading
  133–272, kanji description 59–165. `LEN_BOUNDS` sits just outside those ranges;
  the prompts aim at the middle (radical 150–300, meaning 180–330, reading
  150–280). Rev 2's floors (300/250) were derived from the discarded long radical
  descriptions and would have rejected most of the kept prose. `PROMPT_VERSION` is
  `{"radical": 1, "kanji": 4, "vocab": 4}`.
- **Highlight tags carry over from Rev 2 and now reach radicals too**
  (`<radical>`/`<kanji>` around borrowed component meanings, `<reading>` around the
  kana and its phonetic hook), rendered by `AnnotatedText` in the content accent
  colours. A radical borrows nothing, so the piece it highlights is **its own
  meaning** — the word the picture resolves to, which is the same word a kanji
  story later pulls upward, so both ends of the chain highlight the same thing.
  `ALLOWED_TAG` gains `("radical", "mnemonic_text") → "radical"` and
  `validate_radical` requires the meaning to be tagged, not merely reached.

  The N5 prose that predates the tags was **retagged mechanically, not
  regenerated**: the words needing a wrapper were already in the text because the
  gate had required them there. 76/76 radicals, 75/75 kanji with a taught
  decomposition (the other 31 are pictographs and correctly carry none) and
  104/104 readings tagged, under the invariant that stripping the tags back out
  reproduces the original prose byte-for-byte. Nothing was rewritten for
  highlighting.
- **`PROMPT_VERSION` means "conforms to contract N", not "was produced by prompt
  N".** The N5 kanji were generated under 1 and 2 and brought up to 4 in place, so
  they are stamped 4. Leaving them behind the current number would mark 106
  reviewed items stale and let the next `run` overwrite them.
- **The description backlog is closed.** All 23 N5 radicals with reviewed
  look-alikes now carry contrast prose, as do the 31 kanji whose descriptions
  named the wrong characters or missed a confusable. 18 kanji with no look-alikes
  had descriptions that were generic filler name-dropping unmet compounds
  ("shows up in 土曜日") — those were dropped rather than rewritten, since the
  mnemonic already carries the meaning. 一 and 二 were generated under Rev 2's
  long-form contract at roughly 2× every Rev 3 ceiling and were cut to size with
  their cast intact. The full N5 set now passes the mechanical gate: 76/76
  radicals, 106/106 kanji.

### 2c. Example sentences (kanji + vocab)

Generate original sentences, using in-level Tatoeba candidates (filtered by the
tokenizer) as style anchors in the prompt only — per the lane decision in ground
rule 2, no Tatoeba text is shipped verbatim or adapted. Every sentence gets furigana
via the tokenizer, not the LLM (LLM furigana is unreliable for rare readings).

*Status: tooling built.* Schema/compiler/app now carry `example_sentences` on
kanji and vocab items (the DB table was already item-generic; `KanjiDetail`
gained the Examples section `VocabularyDetail` already had).
`curriculum/_build/generate_content/` holds the prompts
(`prompts/vocab-examples.md`, `prompts/kanji-examples.md`), the context builder
(`example_context.py` — allowed vocab mirrors 2a's option (a): a vocab item gets
its own sort-order prefix, a kanji a proportional cutoff, plus lower levels,
`CORE_SEED_SLUGS`, and — for kanji — every in-scope word containing the
character, which are the prompt's *target words*), the mechanical gate
(`validate_examples.py`: target actually used — lemma-aware, so 食べました
exemplifies 食べる; slug references in the allowed set; tokenizer level-check;
furigana round-trip as a rejection; plain-prose/length checks) and the batch
driver (`generate_examples.py`, `claude-opus-4-8` via Message Batches, one
forced `submit_example_sentences` tool call per item, 3-attempt requeue then
`flagged_for_rewrite`). Run from `curriculum/_build` with API credentials:
`.venv/bin/python -m generate_content.generate_examples run --type vocab` and
`… run --type kanji`. Gate-passing drafts are assembled into per-level sidecars
(`curriculum/vocabulary/examples/<level>.json`,
`curriculum/kanji/examples/<level>.json`) carrying `_meta`
(`review_status: draft`); `generate.py` inlines them into the item JSON, adds
tokenizer furigana, and — when an item already carries 2b `_meta` — keeps the
least-reviewed status so drafts stay behind the compile gate. The no-API
web-chat lane (`webprompts`/`ingest`) mirrors 2a/2b for the cost swap and is
documented in `docs/workflows/example-sentences-web-chat-workflow.md` (with an
automation prompt for driving Gemini web in
`docs/workflows/example-sentences-web-chat-workflow-automation-prompt.md`). A
no-API, no-browser variant that produces each reply with in-session Claude Opus
subagents (same `webprompts`/`ingest` commands and gate) is in
`docs/workflows/example-sentences-subagent-workflow-automation-prompt.md`.
Generation itself (N5/N4 batches) has not run yet.

### 2d. Vocabulary mnemonics + descriptions (Rev 1, new)

Completes the radical → kanji → vocabulary chain. Today vocab has hand-authored
one-liners ("watashi plus tachi: I and my group, we"). New generator
(`generate_mnemonics.py --type vocab`, same driver/gate pattern as 2b):

- Inputs per word: component kanji (from the graph — the same edges the app's
  "Kanji in this word" chips use) **with their reviewed meaning mnemonics'
  hooks**, the word's reading, meaning + accepted answers, and the cast lore
  for its readings.
- `meaning_mnemonic`: story connecting the kanji meanings to the word's meaning,
  reusing the kanji stories' imagery. Kana-only words get a standalone story.
- `reading_mnemonic`: full story when the reading is irregular or introduces an
  unlearned reading; when the reading is exactly the taught readings of its
  kanji, a one-line derivation note ("you already know both readings — 食(た)べる
  from 食") is correct and *preferred* — don't pad regular readings into
  stories.
- `description`: meaning nuance, register (casual/formal, spoken/written), and
  anything the glosses can't carry.
- Gate: reading-regularity is computed mechanically (word reading vs. taught
  kanji readings) so the "story vs. derivation note" choice is checkable; slug
  references validated; same plain-prose/length rules.

Volume: ~1,450 N5+N4 words — the largest batch, still tens of dollars via
Message Batches; the web-chat lane applies as usual.

*Status: tooling built (R1.4); generation has not run.*
`generate_mnemonics.py --type vocab` shares the 2b driver, gate and web-chat
lane. `mnemonic_context.vocab_context` supplies the component kanji from the
`requires` edges (the same ones the app's "Kanji in this word" chips use) with
their established meaning mnemonics, and classifies the reading as
`regular` / `kana_only` / `irregular` / `untaught` by matching it against the
kanji's taught readings (allowing rendaku, handakuon and gemination). That class
picks the reading-mnemonic length bound, so "regular reading gets a one-line
derivation note" is enforced, not requested. N5 splits 155 regular / 127 kana-only
/ 34 irregular / 400 containing a kanji not yet taught — the last two get full
stories. Note the level asymmetry the `untaught` bucket is mostly made of: a word
can sit a level below one of its own kanji (N5's 明日 uses 明, taught at N4), and
that kanji is deliberately withheld from the prompt — a story may only build on
kanji the learner has already met.

### 2e. Cloze nudge rewrite (Rev 1, new — fixes the giveaway hints)

The hint ladder (docs/feedback 09–10, `buildGrammarHintLevels`) intends rung 1
to be a *pedagogical poke*; the shipped nudges in `_build/n5_grammar.py` are
definitions that name the answer's function outright — for a two-choice particle
blank that's the answer. New spec:

- A nudge asks a question or points at the *sentence*, never defines the
  particle/pattern: for 私＿学生です not "Marks the topic — what the sentence is
  about" but "Is 私 *doing* something here, or being talked about?".
- Never contains: the answer string, any `accepted_forms` entry, the item's
  `meaning` gloss, or the pattern's textbook name.
- Mechanical checks in the gate (answer/forms containment is exact-checkable;
  the meaning-gloss overlap is a heuristic + human skim).
- Path: rewrite the ~74 N5 items' hand-authored nudges (and N4's) via a small
  batch pass reusing the 2a prompt context; the 2a generator's candidate
  `cloze_variants` guidance ("describing the pattern's function without naming
  it") is tightened to this spec too, so future drafts inherit it.

*Status: built (R1.5), hand-rewritten rather than batched.* The shipped corpus
was 25 nudges across 5 points (docs-09 Wave A — the "~74" above is the grammar
point count, not the nudge count), so a batch pass would have cost more than
writing them. All 25 are now per-sentence pokes in `_build/n5_grammar.py`; N4
ships no cloze variants yet, so it had none to rewrite. Per-sentence wording is
also load-bearing, not stylistic: 私＿学生です, 水＿飲みます and 猫＿います each
appear under two points, so a single per-point nudge could not distinguish
は/が/を from も at rung 1. The gate is `validate_drafts.nudge_errors` (answer,
accepted forms, meaning gloss, and duplicate nudges within a point), wired into
the 2a draft gate and runnable standalone over the shipped JSON:
`.venv/bin/python -m generate_content.check_nudges`. `prompts/grammar-lesson.md`
carries the spec for future drafts. Known follow-on: the 64/74 N5 lesson drafts
whose candidate `cloze_variants` now fail the check are authoring input for the
docs-09 cloze effort and need the rewrite when promoted, not before.

App-side twin (same bug, outside the dataset): with no authored variants —
69/74 N5 points and all of N4 — `ReviewCard`'s rung 1 fell back to the raw
structure frame, and "Noun + を + Verb" *is* the answer to a one-particle blank.
`blankFormsInStructure` (extracted from `buildGrammarCloze`, which already
blanked the frame when using it as the cloze *prompt*) now blanks it for the
nudge as well, so the frame still teaches the slot shape without naming the
filler.

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

## Phase 3 — Images (radicals only)

Extends `docs/content/radical-mnemonic-images.md`. **Kanji get no mnemonic images** —
pictorial mnemonics stop at the radical layer; kanji use text mnemonics only.

**Hosting decision (July 2026): local only** — commit images under
`mobile/assets/radicals/{level}/{slug}.webp` (Git LFS), bundle them into the app
binary, and resolve them as bundled assets in `MnemonicImage`. No CDN / R2 /
remote URLs. Hard size budget **≤80 KB per image** (pack target ~5–12 MB for
~150 radicals) so the IPA/APK stays sane; text fallback when a file is missing.

Schema/app today may still expect HTTPS placeholders in `visual_mnemonic_url`;
Phase 3 includes dropping that rule in favor of bundled asset refs.

- **Tier 1 — deterministic, ship first:** script renders KanjiVG radical SVGs into
  card images on theme-consistent backgrounds. Covers taught radicals immediately;
  zero hosting cost; visually consistent by construction.
  Path: `mobile/assets/radicals/{level}/{slug}.…`.
- **Tier 2 — curated AI art (~150 items):** image-generation model prompted from
  each radical's mnemonic/description (text is written first and the image is
  generated from it, which is what keeps the learner-facing prose matching the
  image), one shared style directive (flat color, bold line weight, readable at
  140 px per the existing checklist). Same in-repo paths and size budget. Small
  enough to human-review every image.

## Phase 4 — Reading passages

The strongest-constrained generation, and the one where verification makes the
difference between filler and a real graded reader:

1. Input: exact vocab + grammar slug lists available at the passage's curriculum
   position, target length, topic seed — and (Rev 1) a **tone tag** on the seed:
   `humorous` for 50–60% of each level's seeds, `neutral` for the rest. Humor is
   assigned at the seed level (planned mix), not left to per-call chance; the
   persona doc gains a short comedy-register section (absurd situations and
   deadpan, not wordplay that breaks the level constraint) shared with the
   Rev 1 mnemonic prompts.
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
| 5 | Kanji/radical mnemonics (2b) + radical Tier 1 image cards (Phase 3) | 1–2 days | validator green, spot review + cast-coherence pass |
| 6 | Example sentence upgrade (2c) | 1 day | level-check green |
| 7 | Reading passages (Phase 4) | 1 day | tokenizer loop green, full read |
| 8 | Tier 2 radical art → commit under `mobile/assets/radicals/` (LFS), wire bundled refs | best effort | per-image visual review + size budget |

### Rev 1 execution order (supersedes steps 5–6 above where they overlap)

| Step | What | Gate |
|---|---|---|
| R1.1 | Rev 1 schema/DDL/compiler: radical + vocab `description`, vocab split mnemonics, `visually_similar_slugs`; stop emitting grammar `mnemonic_text` | `validate-schema` + `compile-curriculum` green |
| R1.2 | Phase 0.6 app surfacing (repository + detail/lesson UI, grammar mnemonic removal, composition line, look-alike chips) | typecheck/tests green; new fields visible on device |
| R1.3 | Look-alike pair derivation (Phase 1 addition): curated seed list + graph/KanjiVG candidates, human-reviewed | pair dataset reviewed |
| R1.4 | Rev-2 prompts + gate (depth, humor, chain, descriptions, confusable prose); regenerate N5 **radicals → kanji**, then 2d **vocab**; N4 follows the same order | `validate_mnemonics` green; spot review in the app UI (R1.2 is the renderer, same go/no-go logic as the grammar pilot) |
| R1.5 | 2e nudge rewrite (N5 + N4) | no nudge contains its answer/forms/gloss; skim read |
| R1.6 | Phase 4 passage generation with the 50–60% humor mix | tokenizer loop green; tone mix honored; full read |

**Built as of 2026-07-28: R1.1, R1.2, R1.3, R1.5, and R1.4's tooling** (Rev-2 prompts,
gate and the 2d vocab generator — the regeneration run itself is still owed and
needs API credentials or the web-chat lane). R1.3's reviewed pair dataset is
`curriculum/_build/visually_similar.py` (52 pairs → 104 `visually_similar_links` rows);
candidates are logged in `curriculum/_build/reports/visually-similar-candidates.md`.
Per-step status lives in [working-history.md](../working-history.md).

R1.2 before R1.4 matters for the same reason Phase 0.5 preceded the grammar
pilot: the depth go/no-go read must happen in the real rendering. A pilot slice
applies here too — regenerate ~10 radicals + ~10 kanji (one dependency
neighborhood, e.g. 日/木/東) and read them in the app before batching the rest.

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
  incl. the share-alike note on our derived radical card images). Tatoeba appears only if we ever ship
  its text (we don't, per the lane decision). Required before shipping Phase 1 data.
- **N3+ expansion:** same pipeline, but grammar point *inventory* for N3+ needs
  curating first (open lists vary in quality); out of scope here.

(Voice/tone is no longer an open question — it's a step-3 prerequisite: a
`persona.md` in the prompts directory defining the teaching voice, with concrete rules
like "never use a linguistics term without immediately glossing it casually", plus the
mnemonic cast bible from 2b.)
