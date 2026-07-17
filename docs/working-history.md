# Docs working history

Last checked against the codebase: **2026-07-16**

---

## At a glance

| Status | Count |
| --- | ---: |
| Done | 10 |
| Not done | 2 |
| Index only | 1 |

---

## Done

### [Radical mnemonic images](./content/radical-mnemonic-images.md)
Maintainer workflow + app support shipped (`MnemonicImage`, disk cache, curriculum URLs). CDN uploads may still 404 → text fallback is expected.

### [Bunpro import investigation](./archive/bunpro-import-investigation.md)
Investigation closed. Best-effort Bunpro import is in onboarding.

### [Furigana support plan](./content/furigana-support-plan.md)
Schema, `FuriganaText`, settings preference, build pipeline, and UI wiring (vocab / grammar / passages).

### [01 — SRS scheduling correctness](./feedback/01-srs-scheduling-correctness.md)
`learning_steps` persisted (migration 011). FSRS short-term step policy fixed.

### [02 — Review session mechanics](./feedback/02-review-session-mechanics.md)
In-session re-queue + stage-transition badge.

> Deferred: split `srs_states` by `(item_id, prompt_type)` (Q1 Option B).

### [03 — Answer validation & feedback](./feedback/03-answer-validation-and-feedback.md)
Kana-only meaning prompts, wrong-script hints, multi-meaning / synonyms, user-added answers, full incorrect reveal.

### [04 — Lesson pacing & grammar coverage](./feedback/04-lesson-pacing-and-grammar-coverage.md)
Grammar floor in lesson planner. Daily lesson allowance (migration 013).

### [05 — Session UX polish](./feedback/05-session-ux-polish.md)
Time-compression copy removed, streak celebration, lesson back/forward, collapsible mnemonics.

### [06 — UI navigation & polish](./feedback/06-ui-navigation-and-polish.md)
`ScreenHeader` + status bar, back icon, Learn detail scroll + keyboard avoidance, `on-primary` Save contrast.

> Deferred: auto-hide header/tab bar on scroll (§6.6, P3).

### [07–10 — Grammar review redesign](./feedback/07-grammar-review-overview.md)
Universal JP cloze contract (07), stage ladder — apprentice MC / Guru+ type-in / Enlightened no-English gate (08), curriculum `family` + `cloze_variants` schema, compile pipeline, and Wave A authoring — wa-topic/ga/wo/mo-also/desu × 5 variants (09), two-rung hints with no SRS penalty + near-miss "incomplete" teaching reveal (10). Curriculum version `1.4.0-grammar-cloze`; seed DB recompiled.

> Remaining content work: Wave B/C variant authoring (rest of N5, then N4) and families for N4 grammar — tracked in plan 09 §9.4.

---

## Not done

### [Content quality pipeline](./content/content-pipeline-plan.md)
Furigana schema/data landed via the furigana plan. Still open:
- MaruMori-depth grammar (`explanation_markdown`, etc.)
- Split kanji mnemonics
- Review tooling
- NOTICE / attribution

### [AI reading & community contribution](./design/ai-reading-and-community-contribution-design-note.md)
Post-MVP design note only (Epic 8 / FR38–45-PM). No app work by design.

---

## Index

- [Docs README](./README.md) — navigation hub
- [Feedback plans README](./feedback/README.md) — index for plans 01–10

---

## Session notes

Furigana implementation —
`claude --resume 81ab0be9-8f53-471c-9b81-a9fb8668ddae`
