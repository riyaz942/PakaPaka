# Docs working history

Last checked against the codebase: **2026-07-25**

Status legend: **Done** = plan acceptance met (or investigation closed). **Partial** = meaningful work shipped, open leftovers listed. **Not done** = no product work yet (or design-only by intent).

---

## At a glance

| Status | Count |
| --- | ---: |
| Done | 6 |
| Partial | 5 |
| Not done | 1 |
| Index / runbooks | 2 |

---

## Done

### [Bunpro import investigation](./archive/bunpro-import-investigation.md)
Investigation closed. Best-effort Bunpro import is in onboarding (`bunproClient`, mapper, limitation copy).

> Caveat: seed `external_id_mappings` for Bunpro is still empty — most imports will report unmatched until content authors mappings (Story 3.3 deferred that).

### [01 — SRS scheduling correctness](./feedback/01-srs-scheduling-correctness.md)
`learning_steps` persisted (migration 011). FSRS short-term step policy fixed (`['10m']`).

### [02 — Review session mechanics](./feedback/02-review-session-mechanics.md)
In-session re-queue + stage-transition badge. Progress monotonic; summary first-try copy.

> Deferred: split `srs_states` by `(item_id, prompt_type)` (Q1 Option B). Two-card kanji (worst-of-both) later satisfied the meaning+reading UX without that DB split.

### [03 — Answer validation & feedback](./feedback/03-answer-validation-and-feedback.md)
Kana-only meaning prompts, wrong-script hints, multi-meaning / synonyms, user-added answers, incorrect reveal.

> Caveat: FR85 later trimmed on-card reveal depth (mnemonic/examples live on the item details route). Optional curriculum strip of tautological kana readings not pursued.

### [04 — Lesson pacing & grammar coverage](./feedback/04-lesson-pacing-and-grammar-coverage.md)
Grammar floor in lesson planner. Daily lesson allowance (migration 013) + “Learn anyway”.

### [06 — UI navigation & polish](./feedback/06-ui-navigation-and-polish.md)
`ScreenHeader` + status bar, back icon, Learn detail scroll + keyboard avoidance, `on-primary` Save contrast.

> Deferred: auto-hide header/tab bar on scroll (§6.6, P3). Related open defect: undefined `feedback-error` token — see [known-issues.md](./known-issues.md).

---

## Partial

### [Radical mnemonic images](./content/radical-mnemonic-images.md)
**Done:** `MnemonicImage` (disk cache + text fallback), HTTPS URL validation, curriculum placeholder URLs for all N5 + N4 radicals, maintainer upload/wiring runbook.

**Not done:** Image generation, R2/CDN upload, and live assets. CDN URLs do not currently serve usable images — the app shows text fallback. No local PNG assets in the repo.

### [Furigana support plan](./content/furigana-support-plan.md)
**Done:** Schema + compile/validate, generation pipeline, corpus coverage (vocab / examples / passages / questions), `FuriganaText`, Settings preference (`auto` / `shown` / `hidden`), mastery-aware auto + per-word overrides (Phase 4 shipped early). Review prompts correctly omit furigana.

**Not done:** Per-passage eye toggle (Phase 3). Open product questions in the plan (default by JLPT, katakana policy) still unresolved — not shipping blockers.

### [05 — Session UX polish](./feedback/05-session-ux-polish.md)
**Done:** Lesson back/forward across items + sectioned lesson flow (FR71); streak credited on lesson finish; mnemonic paced as its own section.

**Not done:**
- §5.1 — “separate apps” time-compression copy still shown in `SessionSummaryCard` / `PostSessionShareCard` when `estimatedMinutes` is set
- §5.2 — streak celebration data path exists (migration 014, `claimStreakCelebration`) but **no celebration UI**; not wired from review/lesson completion screens

### [07–10 — Grammar review redesign](./feedback/07-grammar-review-overview.md)
**Done (app):** Universal JP cloze contract (07); stage ladder — apprentice MC / Guru+ type-in / Enlightened no-English gate (08); schema `family` + `cloze_variants`, compile pipeline, Wave A authoring — wa-topic/ga/wo/mo-also/desu × 5 variants (09); two-rung hints + near-miss “incomplete” teaching reveal (10).

**Not done (content):** Wave B/C variant authoring (rest of N5, then N4) and families for N4 grammar — tracked in plan 09 §9.4. Remaining N5 points still use interim Plan 07 cloze derivation.

### [Content quality pipeline](./content/content-pipeline-plan.md)
**Done:** Phase 0 schema (explanation / caution / related / split mnemonics / passage enrichment); Phase 0.5 `LessonMarkdown` UI; Phase 1 fact skeleton + audit tooling; mechanical validators; **N5 grammar depth** (74/74 lessons reviewed with `explanation_markdown`); N5 mnemonic + example generators/sidecars (still mostly `draft`; mnemonic drafts superseded by Rev 1); root `NOTICE` file; cloze schema coordination with Wave A. Composition chips (`ItemCrossReferences`) already ship.

**Rev 1 (July 2026) — R1.1–R1.3 built:** schema/DDL/compiler carry radical + vocab `description`,
vocab split mnemonics and `visually_similar_links`, and grammar no longer emits `mnemonic_text` (R1.1);
the app reads and renders all of it — split meaning/reading mnemonic blocks, description panels,
kanji composition line, radical description-as-image-caption, look-alike chips into Compare (R1.2).
Look-alike pairs are derived and reviewed (R1.3): `curriculum/_build/visually_similar.py` holds the
curated seed + graph/KanjiVG candidates, 52 reviewed pairs → 104 `visually_similar_links` rows, with
the candidate report kept at `curriculum/_build/reports/visually-similar-candidates.md`.
Same pass fixed a generator trap: passage enrichment (translations, summaries, grammar/vocab links,
word spans) was hand-added to `curriculum/readings/*.json` only, so regenerating stripped it while
`validate-schema` and `compile-curriculum` stayed green (the fields are schema-optional) — it now lives
in the `_build` datasets, and a `generator-drift` CI job fails when regeneration diffs the committed JSON.
Still planned, not built: humor-tagged passages, cloze nudge rewrite.

**R1.4 (tooling) built:** `prompt_version: 2` across the mnemonic lane. Radicals emit a
`description` and no mnemonic (`prompts/radical-description.md`, `submit_radical_description`);
kanji prompts ask for story paragraphs that continue each component radical's *established
description* and a description block contrasting the reviewed look-alikes; the new 2d vocab
generator (`--type vocab`, `prompts/vocab-mnemonic.md`) chains from the component kanji's meaning
mnemonics and classifies the word's reading (regular / kana-only / irregular / untaught kanji) by
matching it against the taught kanji readings, which is what makes "regular reading gets a one-line
derivation note, not a story" a gate check rather than a request. `validate_mnemonics.py` gained
per-type story-paragraph length bounds and two-way look-alike checks (every reviewed confusable
named; no other Japanese in a description, which carries no furigana). `persona.md` is v2 with a
comedy-register section, shared with the Phase 4 passage seeds. `generate.py` inlines radical
`description` and the new `curriculum/vocabulary/mnemonics/<level>.json` sidecar; `run` re-queues
drafts recorded under an older prompt version so a regen is wholesale, not a patch.

**Not done / thin:**
- **R1.4 (generation)** the wholesale N5 regen radicals → kanji → vocab (2d) has not run — needs
  API credentials, the web-chat lane, or the no-browser subagent lane
  (`docs/workflows/kanji-radical-mnemonic-subagent-workflow-automation-prompt.md`);
  N4 same order after. Shipped N5 radical/kanji mnemonics are
  still the v1 drafts, which now fail the Rev-2 gate by design (too short, no radical `description`,
  look-alikes unaddressed)
- **R1.5** cloze nudge rewrite (shipped N5 nudges are definitional giveaways)
- Review card mnemonic (`queueBuilder`) and `PassageWordDetailSheet` still read `mnemonic_text` only — outside R1.2's scope
- N4 grammar lessons (0) and N4 mnemonic/example authoring
- Cast-coherence / ship gate for draft → reviewed mnemonics & examples
- Phase 3 radical/kanji images (KanjiVG card render + Tier 2 art from radical `description`) — overlaps radical-mnemonic-images CDN gap
- Phase 4 closed-loop reading generation + 50–60% humorous tone mix (`word_count` never set — 0/10 N5 and 0/9 N4 passages)
- Phase 5 review tooling (`npm run review-content` / local HTML review UI)
- Settings → About attribution UI (NOTICE exists; in-app surface does not)
- Default CI compile does not `--fail-on-draft`

---

## Not done

### [AI reading & community contribution](./design/ai-reading-and-community-contribution-design-note.md)
Post-MVP design note only (Epic 8 / FR38–45-PM). No app work by design. (Talk BYOK conversation is a different feature.)

---

## Index / runbooks

- [Docs README](./README.md) — navigation hub
- [Feedback plans README](./feedback/README.md) — index for plans 01–10
- [known-issues.md](./known-issues.md) — open defects outside discovering stories
- [workflows/](./workflows/) — maintainer web-chat generation runbooks; backed by real `curriculum/_build/generate_content/` `webprompts` / `ingest` CLIs (not in-app features)

---

## Session notes

Furigana implementation —
`claude --resume 81ab0be9-8f53-471c-9b81-a9fb8668ddae`
