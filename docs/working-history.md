# Working history — plan status

Every plan and story doc in this repo, with one status each. Details stay in the linked
plan; **only leftovers are listed here**, one line per point.

Last verified against the codebase: **2026-09-02**

- **Done** — plan acceptance met, or the doc is a closed investigation / reference.
- **Partial** — meaningful work shipped, leftovers listed in [What's left](#whats-left).
- **Not started** — no product work yet, by intent or because it is queued.

## At a glance

| Area | Done | Partial | Not started |
| --- | ---: | ---: | ---: |
| Product plans (`docs/feedback/`) | 14 | 1 | 0 |
| Content plans (`docs/content/`) | 2 | 4 | 0 |
| Design & platform (`docs/design/`) | 4 | 0 | 2 |
| BMAD stories (`_bmad-output/`) | 52 | 1 | 3 |

---

## Product plans — `docs/feedback/`

| Plan | Status |
| --- | --- |
| [01 — SRS scheduling correctness](./feedback/01-srs-scheduling-correctness.md) | Done |
| [02 — Review session mechanics](./feedback/02-review-session-mechanics.md) | Done |
| [03 — Answer validation & feedback](./feedback/03-answer-validation-and-feedback.md) | Done |
| [04 — Lesson pacing & grammar coverage](./feedback/04-lesson-pacing-and-grammar-coverage.md) | Done |
| [05 — Session UX polish](./feedback/05-session-ux-polish.md) | Done — §5.2 cancelled by PRD decision R2 |
| [06 — UI navigation & polish](./feedback/06-ui-navigation-and-polish.md) | Done |
| [07 — Grammar review overview](./feedback/07-grammar-review-overview.md) | Index for 07–10 |
| [07 — Grammar cloze contract](./feedback/07-grammar-cloze-contract.md) | Done |
| [08 — Grammar stage ladder](./feedback/08-grammar-stage-ladder.md) | Done |
| [09 — Cloze variants & families](./feedback/09-grammar-cloze-curriculum.md) | **Partial** |
| [10 — Grammar hints & near-miss](./feedback/10-grammar-hints-and-nearmiss.md) | Done |
| [11 — Lesson content order & navigation](./feedback/11-lesson-content-order-navigation-and-grammar-furigana.md) | Done |
| [12 — Android playtest round 2](./feedback/12-android-playtest-round-2.md) | Done |
| [13 — Vacation mode](./feedback/13-vacation-mode.md) | Done |
| [14 — Conjugated-form linking & furigana gesture](./feedback/14-conjugated-form-linking-and-furigana-gesture.md) | Done |
| [15 — ChatBubble word linking & furigana toggle](./feedback/15-chatbubble-word-linking-and-furigana-toggle.md) | Done |

## Content plans — `docs/content/`

| Plan | Status |
| --- | --- |
| [Content quality pipeline](./content/content-pipeline-plan.md) | **Partial** — per-phase % in [content-pipeline-status.md](./content/content-pipeline-status.md) |
| [Content audit plan](./content/content-audit-plan.md) | **Partial** |
| [Furigana support plan](./content/furigana-support-plan.md) | **Partial** |
| [Radical mnemonic images](./content/radical-mnemonic-images.md) | **Partial** |
| [Phase 4 — reading passage tooling](./content/phase-4-reading-passage-tooling.md) | **Partial** |
| [Radical coverage audit](./content/radical-coverage-audit.md) | Done — N4 skeleton findings fixed 2026-08-10 |
| [Untaught kanji in vocabulary mnemonics](./content/untaught-kanji-in-vocabulary-mnemonics-plan.md) | **Partial** — step 1 (pipeline), step 2 (chip annotation) and step 3 (opt-in unlock) done 2026-09-05; the 803 words are not regenerated yet |
| [Kanji coverage & dependency order](./content/kanji-coverage-and-dependency-order-plan.md) | **v2 Phases A–D done 2026-08-17** (A: corpus 2,000 kanji, bands 150/300/700/1000/2000, 238 radicals. B: all four app rules — reading prompts gated on guru+ kanji, two-card vocabulary, master cap with the reason on the card, furigana at master + reading-live, annotated meaning prompts, Stats note. C: pull-forward dropped, `requires` band-gated. D: 8,500 derived N3/N2/N1 words, every band ranked on reuse, "No mnemonic" marker in Browse — 12,156 items, 25,124 edges, 6.5 MB); **Phase E track 1 done 2026-08-17, track 2 in progress (2026-08-18)** — track 1 (kanji prose) authored all 238 radicals (14 N5 + 10 N4) and all 300 N5+N4 band kanji (55 N5 + 118 N4) via the subagent lane (`sonnet-5`, groups of ≤4): 197 net-new items this phase, 195/197 gate-passing on attempt 1, only `k-storey` (N5) and `k-have-the` (N4) needing one repair each — both the same failure shape, a `description` naming a Japanese character not on the item's reviewed look-alike list. The runbook's Step 1a auto-select was fixed to read "done" from the per-source sidecar (`bands.json`-mapped) instead of the drafts folder, which the reband had made stale — verified against the sidecar directly, giving the exact counts the plan predicted (10 N4 radicals, 55 N5 kanji, 118 N4 kanji), and the runbook doc is updated in place with the corrected snippet. `generate.py --bands`, `validate-schema`, `compile-curriculum` all clean after every layer; the sidecar-based auto-select confirms 0 remaining across all four layers. Track 2 (N5/N4 vocabulary top-up) started 2026-08-17 with its mandatory prerequisite — `reading_regularity()` now judges against KANJIDIC (checked-in `_build/kanjidic_readings.json`, built by `import/build_kanjidic_readings.py`) and gained a `kun_word` kind, which puts N5+N4's 1,247 words at 538 note / 459 story / 207 kana / 43 irregular and leaves a 220-word re-authoring queue, 188 of them **reviewed** in the sidecar (the shipped file says draft for all 718 because the least-reviewed-wins rollup folds in the draft examples sidecar — read the sidecar, not the shipped file). 12-word pilot done, both directions, 12/12 gate-passing, run as seed-and-repair so untouched meaning prose stays byte-identical. Also found: 209 shipped words (189 reviewed) fail the gate on their *meaning* mnemonic, a separate pre-existing Phase A reband regression. **Track 1 gated most of track 2**: 345 of the 1,247 N5+N4 words could not have a prompt built until the 173 band kanji had prose — now unblocked, track 1 being fully done. First batch of word-writing, 50 N5 words, done 2026-08-18: same seed-and-repair method as the pilot but run at subagent scale (7 parallel repair subagents, groups of 8, mechanical seed step scripted rather than model-generated), 50/50 gate-passing, `generate.py --level n5` + `validate-schema` + `compile-curriculum` clean, shipped N5 vocab gate-error count 413 → 333 lines. Second batch, 36 N5 words, done 2026-08-18: same method (5 parallel repair subagents, groups of ≤8, `claude-sonnet-5-low`), 36/36 on the first repair attempt, 29 reading-only reshape + 7 meaning grafts, gate-error count 333 → 288 lines. Third batch, 36 N5 words, done 2026-08-18: same method (9 parallel repair subagents, groups of ≤4, `cursor-grok-4.6-high`), 36/36 on the first repair attempt, 24 reading-only reshape + 12 meaning grafts, gate-error count 288 → 243 lines. Fourth batch, 100 N5 words, done 2026-08-18: same method (25 parallel repair subagents, groups of ≤4, `cursor-grok-4.6-high`, three waves), 100/100 on the first repair attempt — finished the remaining 57 N5 regularity words (27 reading-only reshape + 30 meaning grafts) and started the meaning-mnemonic pass (43 wraps/grafts), gate-error count 243 → 89 lines. **N5 regularity is done**; **29 N4 regularity + 73 N5 / 1 N4 meaning-only** remained going into batch 5. Fifth batch, 100 words, done 2026-08-19: same seed-and-repair method (26 parallel general-purpose repair subagents, `sonnet-5`, groups of ≤4, three waves) — all 73 remaining N5 meaning-only words plus 27 of the 30 remaining N4 words (regularity reshapes and meaning grafts, mixed per item), 100/100 on the first repair attempt, `generate.py --level n5`/`--level n4` + `validate-schema` + `compile-curriculum` clean. Sixth batch, 3 N4 words, done 2026-08-20: same seed-and-repair method, closing out the queue — `setsumei` and `shuukan-custom` each needed one meaning-component wrap (an already-present synonym word left untagged: "explanation", "becomes") plus a reading_mnemonic reshape from story to one-sentence derivation note; `keizai` needed only the reshape. All 3 passed on the first repair attempt; `generate.py --level n4` + `validate-schema` + `compile-curriculum` clean. **The re-authoring queue is done (0 remaining).** Scoping batch 5 also surfaced that **N4's bulk vocabulary authoring has not actually started**: only 36 of N4's 529 shipped words have ever had a mnemonic generated through this pipeline (the other 493 ship with empty `meaning_mnemonic`/`reading_mnemonic`) — a much larger task than the tracked re-authoring queue, not yet scheduled. The +82 N5 / +171 N4 new-word top-up (no JLPT word-list source held yet) is still untouched. See the Phase E section of the plan. v1 Phases 1–4 tranche 1 shipped 2026-08-16 but the design is superseded: pull-forward is reverted in favour of gating the *question* (reading prompts withheld until a kanji is guru) rather than the display. New ladder 150/300/700/1000/2000 kanji, ~10,000 vocabulary, ~240 radicals. Kept from v1: Phase 1 ordering moves, Phase 2 skeleton, Phase 4 tranche-1 prose (30 kanji + 30 radicals), the `getParentsByRelationshipType` chunking fix |

## Design & platform — `docs/design/`

| Plan | Status |
| --- | --- |
| [Design System v2 restyle](./design/redesign-v2/README.md) | Done — Sessions 1–8 |
| [Curriculum Studio (web tool)](./design/curriculum-studio-web-plan.md) | Done — Chunks 1–9 live in [`web/`](../web/README.md) |
| [Backup/restore + web build](./design/backup-and-web-plan.md) | **In progress** — Part A complete: export is story 9-1 (`done`), restore + backup nudge is 9-2 (`done`). Part B (web learner app) not started |
| [Web SQLite ATTACH findings](./design/web-sqlite-attach-findings.md) | Done — spike closed, `ATTACH` verified working |
| [AI reading & community contribution](./design/ai-reading-and-community-contribution-design-note.md) | Done — design note only, no app work by intent |
| [Customizable Home screen](./design/customizable-home-screen-plan.md) | Done — all 7 steps shipped: settings route restructure, catalog + reconciler, `ActionCard` extraction, Home rewired to the stored layout, customizer screen with drag/eye/lock/reset, Settings entry row |

## BMAD stories — `_bmad-output/implementation-artifacts/`

Two generations of stories share this folder. The live tracker is
[`sprint-status.yaml`](../_bmad-output/implementation-artifacts/sprint-status.yaml); see
[`_bmad-output/README.md`](../_bmad-output/README.md) for which is which.

**Wave 2 — current epics** ([`epics.md`](../_bmad-output/planning-artifacts/epics.md)):

| Epic | Status |
| --- | --- |
| 1 Kanji Review Clarity · 2 Goal-Driven Home · 3 Browse & Passages · 4 Lessons & Details | Done (2 stories each) |
| 5 AI Conversation · 6 Onboarding Personalization · 7 Contextual Guidance | Done (2 stories each) |
| 8 Shadow Mode & post-MVP backlog | **Not started** (`backlog`) |
| 9 Backup & Restore | **In progress** — 9-1 `done`, 9-2 `done` |

**Wave 1 — MVP epics** (from a superseded epics doc): 40 story files, all `done`
except [3-3 Bunpro import](../_bmad-output/implementation-artifacts/3-3-bunpro-import-or-documented-fallback.md), still at `review`.

## Defect logs

| Log | Status |
| --- | --- |
| [known-issues.md](./known-issues.md) | 2 open |
| [codebase-issues.md](./codebase-issues.md) | 10 open (L1–L10); H1 and M1–M8 fixed |
| [deferred-work.md](../_bmad-output/implementation-artifacts/deferred-work.md) | Reference — consciously-not-fixed review findings |

## Reference / runbooks (no status)

| Doc | What it is |
| --- | --- |
| [README.md](./README.md) | Docs navigation hub |
| [app-overview.md](./app-overview.md) | What the app is, screen by screen |
| [workflows/](./workflows/) | Maintainer generation runbooks (web-chat + subagent lanes) |
| [content/content-pipeline-status.md](./content/content-pipeline-status.md) | Per-phase % snapshot of the content pipeline |
| [archive/](./archive/) | Closed investigations and superseded prompts |

---

## What's left

### 09 — Cloze variants & families
- N4 cloze variants (Wave C): zero authored, so every N4 nudge is the blanked structure frame. Blocked on N4 grammar lessons.
- N4 grammar families for distractor selection: not authored.
- `mada-teinai`: discontinuous `accepted_forms` (`まだ〜ていない`) can't equal a single blank — needs the forms split first.
- `ya-among`: `やなど` has no single-blank slot (real usage is 「AやBなど」) — same fix needed.
- `ta-koto-ga-aru` omits rendaku `だことがある`, so its sentences must dodge む/ぶ/ぬ/ぐ verbs.

### Content quality pipeline
- **N4 remaining**: grammar 0/97 reviewed, radicals 0/33, vocab mnemonics 0. Kanji mnemonics are in progress — shipped N4 is 90 reviewed / 85 draft of 175.
- N5 vocabulary example sentences: 491/1,245 generated and all still `draft`, never reviewed.
- ~~N5 radical/kanji mnemonics still fail the current Rev-3 gate by design~~ — **closed 2026-08-31**. All 469 stored kanji and 185 stored radicals now pass the full gate (2 length nits on one radical remain). Closed by the Rev 6/7 sweep, not by the wholesale regen, which still has not run.
- **Rev 6/7 kanji meaning-mnemonic sweep, done 2026-08-31.** Rev 6 (previous session) retargeted the house style to 120–220 characters of plain English in one cause-and-effect chain and added the `<kanji>` landing tag; Rev 7 added the *identity* class — a kanji that simply **is** a taught radical (山 the radical, 山 the kanji) now says so in one line instead of getting an invented scene, detected mechanically by `mnemonic_context.identical_radical` (116 kanji) with its own 40–200 gate band. Applied in place over stored prose rather than regenerated: 118 drafts (Rev 6), then 35 identity items and 231 over-length reviewed items (Rev 7), 266 in this session. Only `meaning_mnemonic` was touched — reading mnemonics and descriptions are byte-identical. `PROMPT_VERSION` deliberately stays at 4 throughout (bumping would make `cmd_run` regenerate every stored draft and throw the sweep away). Corpus after: 469 kanji, meaning length 77/188/260, 0 gate failures, 0 missing landing tags. **Cost: every rewritten item dropped to `draft`, so reviewed went 351 → 86** — a re-review queue of 383 is the outstanding work.
- **N5-band draft radical regen, done 2026-09-02.** The 39 N5-band radicals still at `review_status: draft` (all in `radicals/mnemonics/k.json`, previously `claude-opus-5`) were regenerated via the subagent lane (`sonnet-5`, 10 groups of ≤4, `PROMPT_VERSION` radical stays 1). 39/39 gate-passing — 38 on the group's first pass, `circumference` needed one inline trim (`image_prompt` 503 → under 500). `generate.py --bands` + `validate-schema` + `compile-curriculum` clean. All 39 were then flipped to `review_status: reviewed` on operator instruction (outside the subagent workflow's automation gate). Quality note carried forward: group 3 (`circumference`, `do-not`, `mingle`, `i`) plus `hill-left` and `left-hand-2` lean on a bolt-on animal/gag the style calibration discourages, and most `mnemonic_text` run ~190–225 chars vs the ~180 soft target.
- **N4 kanji mnemonic review, 32 items, done 2026-09-02.** Operator verified the first N4 subagent-lane batch (8 groups of ≤4). All 32 mnemonic sidecars flipped `draft` → `reviewed` (`kanji/mnemonics/n4.json` 30 slugs; `kanji/mnemonics/k.json` `k-world` + `k-idea`). Example sidecars for `n4-hosoi` and `n4-yowai` were still `draft` and were flipped too — `generate.py` takes the min status across both sidecars, so those two would otherwise have stayed draft in Studio; 29 others already had reviewed examples; `n4-atsumeru` has no examples sidecar. `generate.py --bands` + `validate-schema` clean. Shipped `kanji/n4.json` shows all 32 as `reviewed`. Slugs: k-world, n4-omou, n4-isogu, n4-iro, n4-dou, n4-ani, k-idea, n4-sha, n4-mono, n4-akarui, n4-chi, n4-tokoro, n4-mise, n4-ie-kanji, n4-shitsu, n4-zu, n4-shi-try, n4-ken-exam, n4-tsukau, n4-hajimeru, n4-owaru, n4-hosoi, n4-shinu, n4-atsumeru, n4-shu-main, n4-otouto, n4-ane, n4-suki, n4-warui, n4-futoi, n4-yowai, n4-tsuyoi.
- **N5 vocab mnemonic review, 32 items, done 2026-09-04.** Operator verified the first N5 subagent-lane vocab batch (8 groups of ≤4: pronouns/demonstratives/interrogatives). All 32 mnemonic sidecars flipped `draft` → `reviewed` in `vocabulary/mnemonics/n5.json`; example sidecars were already `reviewed`. Shipped `vocabulary/n5.json` updated to match. Slugs: watashi, watashitachi, boku, anata, kimi, kare, kore, sore, are, dore, kono, sono, ano, dono, koko, soko, asoko, doko, kochira, sochira, achira, dochira, konna, sonna, anna, donna, dare, donata, nani, nan, itsu, naze.
- **N5 flagged-kanji mnemonic regen, done 2026-09-02.** The 32 N5-band kanji an operator review pass had marked `review_status: flagged_for_rewrite` (11 in `kanji/mnemonics/n5.json`, 21 in `kanji/mnemonics/k.json`) were regenerated via the subagent lane (`sonnet-5`, high effort, 8 groups of ≤4, `PROMPT_VERSION` kanji stays 4). The runbook's Step 1a auto-select finds 0 because flagged drafts still match v4 — the flagged set was selected explicitly instead, reusing the runbook's grouping logic. 32/32 gate-passing on the group's first pass; zero repairs. `generate.py --bands` + `validate-schema` + `compile-curriculum` clean. After regen the 32 sat at `review_status: draft`; the operator then verified all 32 and, on instruction (outside the automation gate), both sidecars were flipped to `review_status: reviewed` — the mnemonic sidecars (`kanji/mnemonics/{n5,k}.json`) for the regenerated prose, and the example-sentence sidecars (`kanji/examples/{n5,k}.json`) for the pre-existing example sentences, which the same review pass had also flagged. `generate.py` sets the shipped `review_status` to the min across both sidecars, so both had to move before Studio (which reads the compiled DB) would clear. Shipped `kanji/n5.json` now shows all 32 as `reviewed`. Slugs: n5-nichiyou, n5-mai-every, n5-kou-school, n5-uru-baku, n5-takai, n5-atarashii, n5-ooi-ta, n5-hayai, n5-kuni, n5-michi, n5-shi-city, k-body, k-thing, k-meal, k-ill, k-inst, k-building, k-empty, k-brush-stroke, k-roof, k-paper, k-true, k-move, k-music, k-dwell, k-trip, k-attend, k-topic, k-sound, k-medicine, k-revolve, k-sentence.
- Review card mnemonic (`queueBuilder`) and `PassageWordDetailSheet` still read the old `mnemonic_text` field only.
- Phase 5 human review tool (`npm run review-content`) never built — review-status flips are ad hoc.
- Settings → About attribution UI missing (root `NOTICE` exists, no in-app surface).
- Default CI compile does not pass `--fail-on-draft`.
- Humor-tagged passages: planned, not built.
- Cast-coherence ship gate for draft → reviewed mnemonics/examples: not built.

### Content audit plan
- The single `audit_shipped.py` command exists; the ~8 new cheap checks it was specced with are only partly in (round-trip answer checks, graph completeness vs KRADFILE, look-alike symmetry).
- Tier 2 AI semantic pass (`audit_semantic.py`) built but not run over a full level.
- Tier 3 human pass on flagged items: not started.

### Furigana support plan
- Per-passage eye toggle (Phase 3) — per-*word* long-press toggle shipped via Plans 14/15, whole-passage switch did not.
- Open product questions unresolved (default by JLPT level, katakana policy). Not shipping blockers.

### Radical mnemonic images
- N5: 76/76 Tier 1 (KanjiVG render) images bundled under `mobile/assets/radicals/n5/`.
- N4: 0/33 — directory exists and is empty.
- Tier 2 (curated AI art) not started; production process is [radical-art-web-chat-workflow.md](./workflows/radical-art-web-chat-workflow.md).
- **`k`-corpus art made reband-safe (done 2026-08-22).** The art path's first segment is the
  *source dataset*, and `k` had no directory of its own, so `generate.py` fell back to keying
  `k` radicals' `visual_mnemonic_url` to their **band** — a silent-loss bug, because a slug
  does not follow its band: reband a `k` radical and its ref moves while the file stays put,
  and the art disappears behind the text fallback. Four files were exposed (`bou-stick`,
  `hakenobou`, `kawa-skin`, `nogihen`). `k` now has `mobile/assets/radicals/k/`, the schema
  pattern is `^radicals/(n[1-5]|k)/…`, `generate-radical-asset-map.js` accepts the directory,
  and the band-keyed fallback in `_write_banded` is deleted — every ref is now keyed to the
  dataset that wrote the radical, for all three sources. 126 files, 0 orphans, every ref's
  directory equals its source. Docs corrected in `radical-mnemonic-images.md`,
  `curriculum/README.md`, the art workflow and `web/src/lib/guide.ts`.

### Kanji coverage & dependency order
- Phase 1 done: `curriculum/_build/reports/dependency_order.py` reports coverage + ordering, and the 6 same-level ordering cases are fixed.
- Phase 2 done: 553 skeleton kanji at N3/N2/N1 (104/356/93) + 10 new radicals, generated from
  KANJIDIC2/KRADFILE by `curriculum/_build/import/build_skeleton.py` into the checked-in
  `curriculum/_build/skeleton.json`. Coverage is 100% — every kanji in every shipped word is
  now taught somewhere.
- `visual_mnemonic_url` is now optional in the schema — skeleton radicals ship without art.
- `listLevelsWithContent` now tests for **vocabulary**, not any item: with skeleton kanji in
  the DB, onboarding would otherwise have offered N3/N2/N1 as startable levels.
- Phase 3 done: `listLessonCandidatePool` (`itemRepository.ts`) makes the lesson pool the
  level's items **plus their transitive `requires` parents, wherever taught**, each parent
  taking the sort position of the earliest item that needs it. `planLesson` is unchanged — the
  chain falls out of the existing unlock gate. Skeleton `requires` edges are on: 711 → 1,607,
  0 kanji-bearing words left parentless (was 479), 765 words rely on pull-forward, 624 kanji
  pulled forward, N5 pool 988 → 1,355. Nothing is permanently locked (closure is depth 1).
  **Reverted by v2 Phase C** — the pool is one level again and `requires` is band-gated.
- Phase 3 needed no display change: `jlpt_level` comes straight off the item row, so Browse
  filters and item detail already showed 写 as N3. `builds_on` parents are deliberately not
  pulled forward — radicals never gate, and it would undo Phase 2's art deferral.
- `getParentsByRelationshipType` now chunks its `IN (…)` list; it sat one bound parameter under
  SQLite's 999 limit and the pull-forward pool would have blown past it.
- `dependency_order.py`'s severity model was rewritten for the new planner: cross-level
  `requires` is INFO (pull-forward, by design) with its own section, ERROR now means a
  `requires` chain that never bottoms out. Report is clean — 0 errors, 0 warnings. The 115 N5
  words Phase 1 left as ERRORs are resolved by the pull-forward, as Phase 1 predicted.
  **Superseded by v2 Phase C:** cross-level `requires` is an ERROR again, and the section is
  now a reading-gate table.
- ~~**Live cost until Phase 4:**~~ paid down by Phase 4 tranche 1 — see below.
- **Open, from Phase 1:** re-running `audit_shipped.py` after the 2026-08-16 group moves shows
  14 N5 example sentences referencing a word taught later — 13 for 彼女 (`kanojo`), 1 for 日本
  (`nihon`) — plus 2 `tabun` mnemonic errors. Moving 彼女 later fixed the ordering of the word
  itself and broke the examples that used it. Not Phase 2 fallout; not yet fixed.
- ~~Phase 2 leaves 3 known WARNINGs on 方~~ — resolved in Phase 4.
- ~~Running `generate.py --level <n>` reverts Studio review-status flips in `radicals/*.json` and `kanji/n5.json`; those files must be `git checkout`-ed after a regeneration until the sidecars carry the status.~~ **Fixed 2026-08-21** in `web/server/curriculum/sidecar.ts`: every Studio save now writes the sidecar generate.py reads back (source-keyed for radicals/kanji, level-keyed for vocabulary, lesson frontmatter for grammar), and an edit to a field with no sidecar behind it is refused instead of written to a file the next generate run overwrites. Verified: after a Studio save, `generate.py --bands` + `--level n5` reproduces the level files byte-for-byte.

### Phase 4 — authoring the skeleton (tranche 1 done 2026-08-16)
- **The plan's "order by reuse count" is obsolete.** It assumed authoring a kanji is what
  makes its words reachable; Phase 3 turned every edge on, so coverage is already 100% and
  what is missing is prose — met in *lesson* order. `reports/kanji_priority.py` is the queue
  (first encounter, reuse as tie-break) and writes `kanji-priority.md` / `.json`.
- Authored: **30 kanji** (queue #1 私 → #30 医) and **all 30 skeleton radicals**. First card
  with no mnemonic moved from **lesson 2 to lesson 96**; 0 empty cards in the first 200
  non-grammar cards, was 12. 523 kanji remain.
- Three prerequisites had to land first: 20 new radicals for decompositions that dropped a
  dominant component (私 was 厶 alone, ignoring 禾); maximal-component pruning in
  `build_decomposition`, since KRADFILE lists sub-strokes the gate then demands a story for
  (彼 = 彳 + 皮 now, mean 2.9 components); and `builds_on` pull-forward in
  `listLessonCandidatePool`, at the child's position minus half a step — a kanji mnemonic
  names its components, and `builds_on` does not gate, so position is the only ordering.
- 灬 (`rekka`) had looked untaught on all 318 kanji carrying it: KRADFILE writes it 杰 and the
  variant map had no entry. A mapping bug, not missing content.
- 方/遊/族 got their `katahen` edges and their mnemonics extended to name the component; all
  three are back to `review_status: draft`, since a sign-off does not carry to changed prose.
- **Open:** 30 skeleton radicals owe `.webp` art (text fallback renders today, and 禾 now
  appears in an N5 learner's lesson 1). `vocab_context`'s taught-kanji window still excludes
  pulled-forward kanji, so ~390 words keep a reading story for a now-regular reading —
  deliberately deferred until the kanji layer exists to chain from.

### v2 Phase A — reband (done 2026-08-17)
- **Corpus is 2,000 kanji.** The user held the ladder's N2/N1 figures at 1,000 / 2,000
  cumulative, and a band size is a count, so Phase D step 1 had to land inside Phase A:
  `import/build_skeleton.py` now derives the whole corpus (192 hand-authored +
  **1,808 derived**) instead of only the 553 kanji shipped words needed. Selection is every
  kanji a shipped word uses, then jōyō by KANJIDIC frequency rank until 2,000. 136 of the
  2,136 jōyō are left out.
- **Bands are exactly 150 / 300 / 700 / 1,000 / 2,000 cumulative.** New
  `reports/kanji_bands.py` ranks by corpus reuse (how many of a level's *own* words each
  kanji appears in), tie-breaks by KANJIDIC grade, and writes the checked-in
  `_build/bands.json` plus `reports/kanji-bands.md`. N3+ has no vocabulary to rank on and
  falls back to frequency.
- **Radicals: 152 → 238**, derived not curated. `build_skeleton.py` now mints a radical for
  every KRADFILE component of a derived kanji that nothing already teaches (86 new), rather
  than waiting for someone to hand-list it. Each files at the level of the first kanji that
  needs it: 122 / 40 / 42 / 15 / 19.
- **A slug no longer names a level.** It names the *source dataset* — `n5`/`n4` hand-authored,
  `k` derived — and is frozen, because the mnemonic sidecars, the bundled radical art and
  `user.db` are all keyed by it. `n5-en` ships in `kanji/n3.json`. The 553 old `n3-`/`n2-`/
  `n1-` kanji slugs were rewritten to `k-` with their suffixes intact, and their 30 mnemonic
  sidecar entries merged into `kanji/mnemonics/k.json` (radicals likewise into
  `radicals/mnemonics/k.json`).
- `generate.py` gained `--bands`: radicals and kanji can no longer be written per level,
  because a band mixes sources. `--level` now writes vocabulary, grammar and readings only.
  `generate_deps.py` resolves the curated decomposition maps by source, not level.
- `generate_mnemonics.py`'s sidecar now follows the slug's source and merges rather than
  rewrites for banded kinds — one level's drafts can no longer drop another level's entries.
- **113 hand-authored kanji changed level; 188 derived kanji moved up into N5/N4.** 53 kanji
  with written prose fell out of the 300-band and now wait, 百 千 万 円 東 西 南 北 道 高 足
  雨 among them. Their prose is not lost.
- Authoring debt is **173 kanji + 24 radicals** in the N5+N4 bands (plan estimated ~180
  kanji). `reports/kanji_priority.py` was rewritten against bands — its pull-forward
  reconstruction is gone, the queue is simply band order.
- **Plan claim corrected:** "every radical the 300-kanji N5+N4 band needs already exists" is
  false. 24 of the newly derived radicals land in N5/N4 with no mnemonic; they need prose
  (art is optional — text fallback renders).
- Verified: `validate-schema` clean, `compile-curriculum` clean (DB 3.6 MB, 3,656 items,
  8,059 edges), `dependency_order.py` 0 errors, mobile `npm test` 2,130 passing. 0 radicals
  file at a later *level* than a kanji that needs them; the 18 remaining within-level
  off-by-ones are a pre-existing artifact of radicals and kanji being separate streams, down
  from 48. The 8 kanji with no radical parent are unchanged from before.
- **Not done here:** Phase B (app rules), Phase C (drop pull-forward, band-gate `requires`),
  the rest of Phase D (N3+ vocabulary, Browse marker), Phase E (authoring). Pull-forward is
  still on, as Phase A intends.
- **Open risk, pre-existing and now acute:** `compile-curriculum` assigns `items.id` by
  (level, type, slug), and `user.db` stores progress against those integers. Rebanding
  renumbers essentially the whole corpus, so any installed profile would map onto the wrong
  items after an OTA swap. Nothing in this repo remaps them.

### v2 Phase C — drop pull-forward, band-gate edges (done 2026-08-17)
- **The non-gating edge is `builds_on`, not a new relationship type.** A kanji banded at or
  before the word's level emits `requires` (gates the lesson); a later-banded one emits
  `builds_on`, which already means *is a component of, never gates*. Schema enum, the DB
  CHECK constraint and both apps' types are untouched, and Phase B's `masteryRepository`
  already read both edge types, so rule 1's reading gate needed no change.
- `generate_deps.py`: 1,607 `requires` became **1,023 gating + 584 non-gating**. Edge total
  unchanged at 8,059; DB still 3.6 MB.
- `listLessonCandidatePool` is the level's own items and nothing else — the transitive
  `requires` walk and the `builds_on` component pass are both deleted. Radicals need no
  pull-forward because Phase A re-filed each to the level of its first kanji.
- **Two display surfaces had to widen**, or an out-of-band kanji would vanish from the UI:
  component chips on a word (`getComponentParentsForItem`) and "vocabulary using this kanji"
  (`useRelatedItems`) read either edge. Without it 写真 shows no components at all.
- `dependency_order.py`: a `requires` parent banded later than its child is now an **ERROR**
  — the pool never leaves the level, so it is a permanent lock. The pull-forward section is
  replaced by a reading-gate table.
- **Reading-gate coverage measured: 727 of 1,247 words (58%)** have a live reading card by
  their level's end — N5 407/718 (56%), N4 320/529 (60%), against the plan's estimate of 417
  at N5 and 65% overall. 520 words are meaning-only, held by 501 out-of-band kanji.
- Verified: `validate-schema` and `compile-curriculum` clean, `dependency_order.py` 0 errors,
  mobile `npm test` 2,145 passing, root 62, lint + typecheck clean. A fresh N5 profile meets
  its first prose-less card at position **205** (bar was 200); N4 hits one at position 1 —
  that is Phase E's authoring debt (173 kanji + 24 radicals), not a Phase C regression.
- **Open, not fixed:** the 11 same-level ordering WARNINGs from Phase A's reband stand.
  Fixing them means re-ordering inside a level, which the plan puts out of scope.
- **Stale decomposition exceptions cleared (done 2026-08-22).** Ten of
  `audit_shipped.DECOMPOSITION_EXCEPTIONS`'s group 1 suppressed a missing `builds_on` edge
  with the reason "the component radical is taught a level later". Banding files a radical at
  the level of the first kanji that needs it, so after Phase A all ten radicals band N5 and
  the reason was false — those kanji were shipping without a component chip for a radical the
  learner already knows, and the mnemonic generator was never told about the component. The
  ten edges are in `generate_deps.N5_DECOMPOSITION` now (斤→新, 冖→学/帰/売/読, 尸→駅,
  王→金/国, 广→座, 里→黒) and each child's `meaning_mnemonic` was rewritten to reference and
  tag the new component, back to `review_status: draft` for a human read. One group-1
  exception survives and is the only shape that still can: 隹→曜, where the radical's first
  kanji (集) bands N4 while 曜 bands N5. Adding the edges also pulls 冖 (86→37), 王 (75→17)
  and 里 (76→58) forward inside N5; no radical or kanji changed **level**.
- **Cost of that fix, accepted:** non-gating radical→kanji edges out of order went 18 → 21
  (INFO in `dependency_order.py` — presentation only, never a lesson gate). One is the new
  王→金 edge; two are collateral, radicals pushed a slot later by 王 jumping ahead. Radicals
  and kanji are separate dense ranks, so the k-th radical cannot always precede the k-th
  kanji; removing these would mean re-ordering inside a level, still out of scope.

### v2 Phase D — skeleton to full scale (done 2026-08-17)
- Step 1 (2,000-kanji corpus) landed back in Phase A. This is steps 2 and 3.
- **N3/N2/N1 vocabulary: 8,500 derived words**, 2,250 / 2,250 / 4,000.
  `import/build_vocab_skeleton.py` selects them from JMdict by `nfXX` frequency bucket
  (nf01–nf19) into the checked-in `_build/vocab_skeleton.json`; `generate.py --level n3|n2|n1`
  writes the vocabulary files. Slug is `v-<romaji reading>`, frozen once minted, as `k-` is
  for derived kanji.
- **Furigana is a selection filter, not an output step.** A candidate with no JmdictFurigana
  alignment for its exact (form, reading) is dropped — 49 of them — so every shipped entry has
  furigana without the tokenizer guessing at build time.
- **Bands now rank on reuse at every level.** `kanji_bands.py`'s N3+ frequency fallback only
  existed because those levels had no words. Ranking N3/N2/N1 on their own words moved 492
  kanji between those three bands (N5/N4 untouched — they are assigned first, from their own
  words) and took reading-gate coverage at the tail from 21/18/18% to **78% N3, 85% N2, 100%
  N1**. Overall 8,422 of 9,747 words (86%) get a live reading card by their level's end.
- **Word selection is constrained by the kanji corpus, not by band.** A word written with a
  kanji outside the 2,000 is dropped (556 candidates): its reading card would otherwise go
  live at the end of N1 having never taught the kanji. Coverage is 100% at every level, and
  `dependency_order.py`'s "authored nowhere" section is empty for the first time.
- **JMdict `ateji` is not a rejection reason** — 時計, 試合, 支払う, 拠出 are all tagged ateji
  and are the normal spellings; rejecting the tag taught them as bare kana. Rejected instead:
  search-only / rarely-used / out-dated / irregular spellings, digit headwords (４０ beside
  四十), and first senses that are only a particle, auxiliary, affix or numeral.
- **Browse marker, not a filter:** a `has_mnemonic` column on the item branch of the browse
  query drives a **"No mnemonic"** pill on the row. Grammar is exempt — its prose is
  `explanation_markdown`, not a mnemonic column.
- Verified: `validate-schema` clean (3 pre-existing warnings), `compile-curriculum` clean,
  `dependency_order.py` 0 errors / 11 pre-existing warnings, mobile `npm test` 2,148 passing,
  root 62, lint + typecheck clean. **12,156 items, 25,124 edges, curriculum.db 6.5 MB** —
  under the plan's 10–14 MB estimate. metadata 1.12.0.
- **Open, and now larger:** `items.id` is assigned by (level, type, slug), so 8,500 new words
  plus the N3+ reband renumber the corpus again. Nothing remaps an installed `user.db`.
- **Not done:** N3+ grammar, examples, mnemonics and passages — all out of scope by the plan.
  Phase E track 1 (author 173 kanji + 24 radicals) is done; track 2's re-authoring
  queue (N5 regularity + N4 regularity + meaning-mnemonic fixes, 103 words) is
  **done** (batch 6, 2026-08-20: the last 3 N4 words — `setsumei`, `keizai`,
  `shuukan-custom` — same seed-and-repair method, all 3 gate-clean on the first
  repair attempt); the +82/+171 new-word top-up is untouched. Also found while
  scoping batch 5: 493 of N4's 529 shipped vocabulary words have **no mnemonic
  prose at all** (only 36 ever went through this pipeline) — a much larger,
  separate authoring task the plan's progress notes had not surfaced.

### v2 Phase A revision — JLPT-first band ranking (done 2026-08-30)
- **Why:** N5/N4 items kept showing up at N3+ in Browse. The pronoun pins (私僕君彼誰) were a
  named workaround for a rule that was wrong in general: `kanji_bands.py` ranked the derived
  corpus by **KANJIDIC school grade**, the order Japanese *schooling* teaches in, while the app
  teaches to the JLPT.
- **Measured damage before the fix:** 58 kanji the JLPT tests at N4 (勉 医 病 薬 銀 館 英 飯 研
  究 転 進 都 開 院 題 …) sat at N3 or N2; 38 of the 64 derived N4 slots and 12 of the 44 N5
  slots went to early-school kanji no word at that level uses (麦 羽 矢 貝 黄 竹 森 草 …).
- **Fix:** `import/build_skeleton.py` now emits KANJIDIC2's `jlpt` tag into `skeleton.json`
  (additive, 1,808 lines, nothing else changed). `reports/kanji_bands.py` ranks the derived
  corpus by that tag first, then reuse, then grade, then frequency. `PINNED_DERIVED` stays —
  KANJIDIC tags the five pronouns 3/2/2/1/none, so JLPT-first alone does not place them at N5.
- **Budget: N4 150 → 175, N3 400 → 375**, cumulative still 2,000. Needed because 181 kanji
  carry the JLPT-N4 tag and 150 slots could not hold them all.
- **Result:** 0 JLPT-N5 and 0 JLPT-N4 kanji band above N4. (会 店 社 read as N5 on the exam and
  sit at N4 because `n4_kanji.py` hand-authors them — an authored-list call, not a ranking
  one.) Reading-gate coverage rose: N5 357 → 375 readable words, N4 206 → 245, N3 1,327 →
  1,645; N2 slipped 1,697 → 1,618, N1 unchanged. Total 7,187 → 7,883.
- **Cost, open:** the N5+N4 bands grew 300 → 325 kanji and 152 → 162 radicals, and **25 kanji
  plus 2 radicals (品, 井) inside them now have no mnemonic prose** — the authoring queue was
  empty before this change. See `_build/reports/kanji-priority.md`.
- **Amended the same day — two corrections inside the JLPT rank.** JLPT-first alone read wrong
  in the other direction, which playtest caught: 番 fell to N2 although six N5 words are
  written with it (一番, 番号, 交番, 電話番号, 部屋番号, 番), and 雲 皿 貝 虫 丸 黄 才 泳 — all
  grade 1-3, all written into just one N5/N4 word each — sat at N2 behind kanji twice their
  stroke count. Fixes, both acting *inside* a JLPT tier so no exam-N4 kanji is displaced:
  `RESERVED_BY_REUSE` ({n5: 10, n4: 6}) hands the front of each band to its own highest-reuse
  kanji, and `SIMPLE_GRADE` (3) sorts grade 1-3 ahead of the rest of its JLPT tier. Result:
  番 → N5, the other eight → N3. Cost: N3 reading cards 1,645 → 1,575 and N4 245 → 241; N5
  gained one (375 → 376). Budgets untouched. Rejected on the way: promoting *any* kanji this
  level's words use, which threw 58 exam-N4 kanji straight back to N3.
- Verified: `validate-schema` clean (6 pre-existing warnings, none new), `compile-curriculum`
  clean, root `npm test` 62 passing, `dependency_order.py` 0 errors / 27 warnings (24 before —
  all the same "kanji sorts one slot after its word inside a level" class, none new in kind).
  metadata 1.13.1.

### Phase 4 — reading passages
- N5: done. 10 generated passages reviewed and wired in; the hand-authored set was retired (`31d5cc7`).
- N4: 9 hand-authored passages remain, not regenerated (no `word_count`, no seeds authored).
- Phase 5 read of the generated set not done.

### Backup/restore + web build
- Part A export (backup format + Settings export) is story 9-1, `done`.
- Part A restore preview + backup nudge is story 9-2, `done`. Replace-all restore inside one
  transaction, preview-then-confirm in Settings and as a fourth onboarding source, "last backed up
  N days ago" in Settings, and a web-only stale-backup banner on Home.
- Restore keeps `passage_practice_results` on raw curriculum ids (v1); rows pointing at passages this
  device lacks are counted in the preview and skipped, not migrated to slugs.
- Part B (web build + PWA) not started. The `ATTACH` blocker is cleared; the real one is the `expo-sqlite` sync-bridge bug.

### BMAD open stories
- 3-3 Bunpro import: at `review`, and seed `external_id_mappings` for Bunpro is still empty, so most imports report unmatched.
- 5-1 BYOK chat: `done`, but the native dev-client rebuild smoke test was never run on a machine with Xcode / Android Studio.
- Epic 8 (shadow mode positioning, AI reading backlog): `backlog` by design — post-MVP.

### Open defects
- `feedback-error` token used in 3 places but never defined — the review exit sheet's "End session" button renders white-on-light. See [known-issues.md](./known-issues.md).
- Executorch main vs Expo resource-fetcher nightly skew: accepted risk, revisit on upstream release.
- `codebase-issues.md` L1–L10: naming/perf/fragility items, all low severity, none user-visible.

### Mnemonic highlights carry their character: the `form` attribute (2026-09-08)
- **What changed.** A highlight tag now names the character it stands for, in a `form`
  attribute: `Give it a <kanji form="少">few</kanji> <kanji form="年">year</kanji>s, and the
  child grows into a <vocabulary form="少年">boy</vocabulary>.` Both apps render that as
  "Give it a few (少) years (年), and the child grows into a boy (少年)." All three layers
  carry it — a radical's `mnemonic_text`, a kanji's borrowed `<radical>` and its own
  `<kanji>`, a word's borrowed `<kanji>` and its own `<vocabulary>`.
- **Why an attribute rather than prose.** The parenthesis, the Japanese face and the accent
  colour stay render decisions, the character never counts toward a length band, and
  `stripHighlightTags` drops it so a screen reader is not asked to read a kanji mid-English-
  sentence. `<reading>` carries no `form` (its own text is already the kana), and neither
  does a radical's `image_prompt` — a glyph in an art prompt is a thing the picture might
  try to draw.
- **Gate.** `validate_mnemonics` checks three things per tag: the character is one the tag
  may legally name here, it is the one the tagged *words* mean when they identify exactly
  one candidate (so `<kanji form="年">few</kanji>` fails), and on a fresh draft it is
  present at all. Fresh drafts only, the same `enforce_readability` lane every added
  contract rides. Re-validating the whole shipped corpus is **byte-identical** to before —
  no stored item is requeued.
- **`PROMPT_VERSION` deliberately unchanged** (`radical 1 / kanji 4 / vocab 6`): bumping
  would make `cmd_run` regenerate every stored draft. Reviewed prose keeps its bare tags and
  renders exactly as it did; only newly generated mnemonics carry characters.
- **Quoted prose stays bare, on purpose.** A kanji prompt injects each taught radical's stored
  `mnemonic_text`, and a vocab prompt each component kanji's stored `meaning_mnemonic`, so the
  new story hooks into imagery the learner already has. That stored prose predates the
  attribute, so its tags carry no character — 4 bare of 42 tagged specimens in the 海 prompt,
  7 of 28 in the 少年 one. Accepted: both prompts say the quoted tags are history and not the
  format, and a fresh draft that misses a character is a hard gate error, so a slip costs a
  repair round and cannot ship.
- **`restyle_drafts.py` and `restyle/` deleted (2026-09-08).** Both matched `"<kanji>"`
  literally and would have rejected every rewrite in the new format. Rather than teach the
  attribute to a spent lane, the whole restyle pass was removed — the remaining
  `flagged_for_rewrite` kanji get regenerated through `generate_mnemonics.py` instead. See
  "Kanji meaning mnemonics restyled to one logical sentence".

### Untaught kanji in vocabulary mnemonics — steps 1 and 2 (2026-09-05)
- Plan: [untaught-kanji-in-vocabulary-mnemonics-plan.md](./content/untaught-kanji-in-vocabulary-mnemonics-plan.md).
  **Step 1 (content pipeline) and step 2 (app annotation) are done; step 3 (opt-in unlock)
  is not started**, deliberately deferred — it reverses `StudyStatusBanner`'s stated no-CTA
  contract (BUG7), which is a product decision worth taking on its own.
- **The defect.** A word can be written with a kanji banded above its own level — 昨 (N3) in
  N5's 昨日 — and `mnemonic_context.vocab_context` fed the prompt only the `requires` kanji, so
  the mnemonic explained half the word while the app rendered a chip for the other half.
  `vocab_component_edges` now returns both edge kinds; `vocab_context` returns the `builds_on`
  ones as `untaught_components`, and `format_vocab_components` renders them **meaning-only**,
  interleaved with the taught ones in written-form order. Meaning-only is what keeps the block
  buildable — 17 N5 and 51 N4 of those kanji have no `meaning_mnemonic` at all, which would trip
  the "regenerate the kanji layer first" `ValueError`.
- **Two filters, both computed, never the model's call.** A kanji whose meaning restates the
  word's is dropped via the same `_shares_meaning` test `identical_kanji` uses (昨日 "yesterday"
  over 昨 "yesterday" reads as "the yesterday day is yesterday"), and a word with *no* taught
  kanji keeps its existing standalone-story contract.
- **803 words gain a kanji: 70 N5, 94 N4, 324 N3, 315 N2, 0 N1** (N1's taught window is every
  level, so nothing is untaught there). The plan's table predicted 1,016 from a slightly
  different partition — it also calls 写真 zero-taught when 真 is in fact an N5 `requires`
  parent. The mechanism is the same; the arithmetic in the plan doc is stale, not the code.
- **`PROMPT_VERSION["vocab"]` stays 6**, same reasoning as the Rev 7 kana amendment: a bump
  requeues all 861 stored drafts including reviewed prose the new rule cannot change. Of the 164
  affected N5+N4 words, **only 3 needed stamping** (N5, at v6) — the other 92 with drafts were
  already at v4 against the v6 contract, i.e. already in the Rev 5/Rev 6 re-authoring queue, and
  69 N4 words have never been generated at all. N3/N2 have no drafts. All 164 regenerate.
  Stamp only *downward*, and only from the current version: a draft already below it is already
  queued, and rewriting its `prompt_version` erases which contract actually wrote the prose on
  disk. (Done wrong first here — 92 drafts were pushed 4 → 5 — then restored from the shipped
  sidecar's `_meta.prompt_version`, which is the surviving record.)
- **The gate allows the untaught kanji and never requires it.** Nothing in `validate_vocab`
  forbade naming one to begin with — a mnemonic names kanji by English meaning, and the only
  character check is on `description`, whose allow-list already contains the word's own form.
  `_component_errors` still gets the taught list only, so a two-sentence story that could not fit
  a fourth kanji is not a gate failure. Re-validating all 861 stored drafts on the stored lane
  gives the **same 14 pre-existing failures before and after** — zero new.
- **Step 2: the chip says so.** `CurriculumParentItem` gains `inBand: boolean`, set at
  `getComponentParentsForItem` per edge kind (vocabulary `requires` in-band, `builds_on` not;
  radical → kanji always in-band, because Phase A re-filed every radical to the level of the first
  kanji needing it). `useComponentParents` combines that curriculum fact with the learner's
  `item_study_status` and returns `ComponentParent.notYetLearned`. Both halves are needed: band
  alone would keep 昨 marked long after an N3 learner had learned it, and status alone would mark
  日 on a freshly opened 昨日, where the study-status banner is already saying so. The plan's file
  table said edge type alone, which contradicts its own "an N3 learner sees neither dimmed"
  verification; the verification won.
- The marked chip drops from the layer-below `soft` tint to the quiet `surface` tile, gains
  ", not learned yet" on its accessibility label, and the section prints one caption underneath —
  "You haven't learned 昨 yet — it comes later in the course." It is never hidden or delinked
  (FR76: a detail screen informs, it never withholds).
- **Not done, and it is the reason step 1 is only half-shipped: the 803 words have not been
  regenerated.** The plan's own step-1 verification #5 asks for N5 + N4 (164 words here) to be
  regenerated and read before touching the 639 at N3/N2. That is a paid batch run and has not been
  started.

### Untaught kanji in vocabulary mnemonics — step 3, opt-in unlock (2026-09-05)
- The chip now offers to do something about itself: `NotYetLearnedNote` puts a "Learn 昨 now
  (+2 items)" button under the not-yet-learned caption, writing one row to a new
  `lesson_opt_ins` table (migration 020). `useLessonPlan.buildPlanForLevel` unions that
  learner's opt-ins into the candidate pool.
- **This is not the pull-forward Plan v2 Phase C removed.** That was curriculum-level and
  automatic — every N5 learner got 写 and 真 whether they asked or not. This is per-learner and
  opt-in; the level model, the graph and everyone else's queue are untouched.
- **"Transitive *required* parents", as the plan's file table put it, would have unioned
  nothing.** The curriculum authors no `requires` edge into a kanji — a kanji holds its radicals
  through `builds_on`. Opting into 昨 by `requires` alone queues a kanji with none of the
  radicals its own mnemonic is written from. `getOptInPoolForItems` is one recursive CTE over
  **both** component edge kinds, which is what the plan's cost table ("the kanji + its radicals",
  minimum 2) always described. 昨's real closure: 日 (N5 radical, already in band), 乍 (N4
  radical), 昨 itself — so an N5 learner pays 2.
- **Only the anchor is stored, never the closure.** Which components a kanji needs is a fact
  about `curriculum.db`, and that file is replaced wholesale by OTA update; writing the closure
  into `user.db` would freeze one version of the graph.
- **Opted-in items sort to the front of their type bucket** (`LessonCandidate.optedIn`). Not a
  nicety: `sort_order` restarts at 1 per level *and* per type, so an opted-in N3 kanji merged
  into an N5 pool would land wherever N3's own numbering happened to put it — 昨 is N3 #67 and
  would have interleaved with N5 kanji #67. `ROUND_QUOTAS` still leads each round with radicals,
  so 乍 is never taught after 昨.
- **The count is always on the button**, and the offer is hidden when it would add nothing (every
  component already in band or already studied). "Already started" uses the planner's own
  two-part definition — a study status, or an SRS state from a progress import — so the number
  on the button is the number of lessons that actually appear.
- **The opt-in toggles off.** Not in the plan's file table; added because a mistap would
  otherwise permanently add items to the queue. Removing takes the item back out of the *pool*
  only — an item already taught keeps its SRS state.
- **The BUG7 friction, settled.** `StudyStatusBanner`'s "no CTA, no lesson entry point" is now
  scoped to the banner rather than the whole details screen, and both its docstring and
  `ItemDetailBody`'s record why: the button is a **queue** entry point, not a lesson one. It
  writes a row and stays on the screen, so details still enters no session and still withholds
  nothing. The stale `useLessonPlan.ts` comment the plan flagged (still claiming 写/真 are pulled
  forward) is rewritten.
- **Not wired: backup/restore.** `lesson_opt_ins` is not in `exportBackup`/`restoreBackup`, so a
  restore onto a new device drops pending opt-ins. Out of the plan's step-3 scope and low harm
  (the learner re-taps a chip), but it is a real gap.

### Vocabulary mnemonics Rev 6: reading composition becomes a field, reading reuse (2026-09-03)
- Rev 6 landed the same day as Rev 5 and **before a single word had been generated under Rev 5**,
  which is what made a second bump free rather than wasteful. It answers one question: where does
  "this is a jukugo word, so both kanji use their on'yomi" belong?
- **Not in the mnemonic, and not in the description — in a computed field.** `reading_regularity`
  already knows the pattern and every sound change *exactly*, so a model paraphrasing it can only
  lose precision, and the paraphrase was eating the reading mnemonic's whole one-or-two-sentence
  budget. The description was the wrong home for the opposite reason: it is authored prose for
  nuance the mnemonics cannot carry (register, false friends), and mixing derived data into it
  means no one can tell later which sentences a reviewer wrote.
  `mnemonic_context.reading_composition(form, reading)` now emits one line per word —
  "Jukugo — 年（ねん）＋中（じゅう）, each kanji read with its on'yomi. Rendaku: 中 ちゅう → じゅう.",
  "Kun'yomi — 入（い）＋り＋口（ぐち）. Rendaku: 口 くち → ぐち.", "Mixed — 太（ふと）kun'yomi ＋
  字（じ）on'yomi.", "Irregular — あした cannot be assembled from the dictionary readings of 明日."
  Carried through `generate.py` → `reading_composition` on `vocabItem` → an
  `items.reading_composition` column → `CurriculumItemDetail.readingComposition` → a "Reading
  composition" row on `VocabularyDetail`, under Word type. All 9,747 vocabulary rows carry one.
- **So 745 of N5+N4's 1,247 words now ship no `reading_mnemonic` at all** (538 `regular` +
  207 `kana_only`). That is the point rather than a gap: the field states the derivation better
  than prose could, and `reading_mnemonic` is left with the one job a field cannot do — a hook for
  a sound nothing derives. The gate enforces it in both directions: a fresh draft that writes one
  for a derivable word is rejected, and one missing for a `kun_word`/`irregular` word is too. The
  studio's reading-mnemonic panel now renders even when empty, saying the absence is correct, so a
  reviewer can tell it apart from prose that is merely missing.
- **A reading an earlier word already taught gets a pointer, not a rival story.** WaniKani's 教え
  says "you already learned this reading from 教える"; ours invented a second hook for the same
  sound, which competes with the first rather than reinforcing it.
  `mnemonic_context._reading_teachers()` walks all five levels in teaching order and records the
  first `kun_word` to teach each (kanji, reading-chunk) pair — **90 words at N5+N4, 351 across the
  whole curriculum** — covering exactly the transitive/intransitive pairs (上がる → 上げる,
  壊す → 壊れる), the derived nouns (答える → 答え, 続き → 続く), the potentials (書く → 書ける)
  and the passives/causatives (食べる → 食べさせる). Only a `kun_word` counts as a teacher: a
  `regular` word merely *contains* the reading and now ships a composition line rather than a
  mnemonic, so being shown 月（つき）inside 毎月 does not count and 月 the word keeps its own story.
  Those 90 get one sentence at 50–200 characters, and the gate requires the source word's written
  form to actually appear in it.
- **No kun'yomi/on'yomi terminology in the prose at all**, per the maintainer's call. The prompt
  says so twice and the composition field carries the vocabulary instead.
- `PROMPT_VERSION["vocab"]` 5 → 6; the vocab tool schema drops `reading_mnemonic` from `required`.
  Re-validating the 858 stored drafts on the stored lane gives **10 failures, all of them the
  pre-existing untagged-component ones on `meaning_mnemonic`** — zero new. That took two
  fresh-lane-only bands to achieve: the reuse rule would otherwise have requeued 43 kept Rev 4
  stories, and `VOCAB_READING_REUSE_STORED_BOUNDS` spans both a Rev 4 story and a Rev 6 pointer so
  neither shape fails re-validation.
- **Leftover:** the whole vocabulary layer is now at v4 against a v6 contract — 1,247 N5+N4 words
  queued, of which 529 N4 (493 of them never written at all) are the first batch. Under Rev 6 only
  ~412 of the 1,247 need an invented reading story at all (502 `kun_word`/`irregular`, less the 90
  back-references), down from 1,247.
- **First two N5 Rev 6 batches, 64 words, done 2026-09-04 (uncommitted).** Subagent lane
  (`sonnet-5`, groups of ≤4, `PROMPT_VERSION["vocab"]` stays 6). Batch 1 (uncommitted from an
  earlier session, 32 words): pronouns/demonstratives/question words — watashi, watashitachi,
  boku, anata, kimi, kare, kore/sore/are/dore, kono/sono/ano/dono, koko/soko/asoko/doko,
  kochira/sochira/achira/dochira, konna/sonna/anna/donna, dare, donata, nani, nan, itsu, naze.
  Batch 2 (this session, 32 words, 8 groups of 4): the number words — doushite, dou, ikaga,
  ikutsu, ikura, zero, rei, ichi through juu (both native and Sino-Japanese counting series),
  hyaku, sen, man, and the ひとつ–やっつ/ここのつ native counter series. 32/32 gate-passing on
  the group's first pass — zero repairs needed. `generate.py --level n5` + `validate-schema` +
  `compile-curriculum` clean. **64/718 N5 words now done at v6; 654 remain**, all still `draft`
  (per the workflow's discipline — review is a separate manual step). Both batches are
  uncommitted in the working tree as of this entry.

### Vocabulary mnemonics Rev 5: word type, WaniKani-length prose, `<vocabulary>` tag (2026-09-03)
- Three changes to the word layer, all aimed at what WaniKani actually does and what our N4 output
  visibly was not doing.
- **Word type is now shipped data, not prose.** `import/build_vocab_word_types.py` distills JMdict's
  first-sense part of speech into the checked-in `_build/vocab_word_types.json` — 9,710 of 9,747
  words (99.6%), 277 KB — in WaniKani's own vocabulary: `い adjective`, `な adjective`,
  `の adjective`, `godan/ichidan/する verb`, `transitive`/`intransitive`, noun, adverb, pronoun.
  Three match paths: JMdict `seq` (the 8,500 derived words), (form, reading) (the hand-authored
  N5/N4 ones), and `X + する` looked up as the base noun (50 words). The 37 residue — て-form
  auxiliaries (教えてもらう), potential/passive/causative (書ける), set phrases (どうしましたか) —
  gets **no** entry rather than a guess. Transitivity is dropped where no conjugation class sits
  beside it, so 勉強 the noun is not labelled a transitive verb.
  Carried through `generate.py` → `word_type` on `vocabItem` → an `items.word_type` column →
  `CurriculumItemDetail.wordType` → a "Word type" row on `VocabularyDetail`, under the reading.
- **The prose is cut to WaniKani length.** The meaning mnemonic goes from ~180–330 characters and
  two-to-four sentences to **one or two sentences, ~70–200** — the same cut Rev 8 made to kanji, one
  layer up. Enforced on the fresh-draft lane by `VOCAB_MEANING_MAX_SENTENCES = 2` and
  `VOCAB_MEANING_FRESH_BOUNDS`, with the `LEN_BOUNDS` floor dropped 140 → 60 and the 450 ceiling
  kept so no stored Rev 4 draft is requeued for length. A word that simply **is** its kanji (年 the
  kanji / 年 the word, 白 / 白い) is detected mechanically by `mnemonic_context.identical_kanji` and
  gets the one-line form at 40–200, exactly as `identical_radical` does a layer down.
- **Both mnemonics now tag the word's own meaning.** The old output never marked it: `keizai` left
  "the economy" as plain text and `iken` left "opinion" plain, so the learner saw component kanji
  highlighted and the thing being taught not. A fourth highlight tag, `<vocabulary>`, is required
  once in each mnemonic on fresh drafts — the word-layer twin of the `<kanji>` self-tag — and
  renders in the vocabulary accent in `AnnotatedText`.
- **The reading note says what a course would say** — *superseded by Rev 6, below, on the same day
  and before any word was generated under Rev 5.* `reading_regularity` gained `pattern`
  (jukugo / on / kun / mixed) and `sound_changes` (rendaku, handakuon, gemination, each with the
  kana it came from), and the Rev 5 prompt asked the model to spell them out in the reading
  mnemonic. Rev 6 keeps the computation and drops the prose. A modern ぢ→じ / づ→ず spelling
  variant was added here so 年中 ねんじゅう derives instead of falling to "irregular"; the N5/N4
  branch counts are unchanged by it (538 / 459 / 207 / 43), so no existing word changed lane.
- `PROMPT_VERSION["vocab"]` 4 → 5. Here the staleness is the point: all 718 N5 words are correctly
  re-selected, because Rev 5 is a rewrite rather than a retag. Nothing is deleted — stale prose
  keeps shipping until a run replaces it — so N4's 493 unwritten words go first and N5 follows.
  Re-validating the 858 stored drafts on the stored lane produces **zero** new length or tag
  failures (the 11 that remain are the pre-existing untagged-component ones).
- **Leftover:** re-run `import/build_vocab_word_types.py` after `build_vocab_skeleton.py` or any
  hand edit to the N5/N4 word lists; a word added since the last run ships with no word type.

### Kanji decomposition switched from KRADFILE to KanjiVG (2026-09-01)
- `curriculum/_build/import/build_decomposition.py` → `_build/decomposition.json` is now the
  **single source** for every radical → kanji `builds_on` edge. `generate.py`,
  `generate_deps.py` and `reports/kanji_bands.py` all read it. KRADFILE survives only as the
  fallback for the 13 kanji KanjiVG has no entry for.
- Why: KRADFILE is a flat search index, so it listed every search radical at any depth and
  double-counted regions — 便 shipped as 人一ノ｜日田 and 休 as 人亻木. KanjiVG's stroke groups
  nest by component, so the top level is the split a human would draw: 便 = 亻+更, 映 = 日+央,
  輸 = 車+兪. 1,649 of 2,000 kanji now land on exactly two components; 33 on four or more,
  down from 609.
- Radicals grew **238 → 798** (N5 115→134, N4 46→99). 22 old radicals are no longer a
  component anywhere and were dropped, 8 of them carrying reviewed prose (面 買 初 世 無 麦 and
  the stroke-level ノ ｜, which were the point of the change). Their sidecar entries are left
  in place, unused.
- **Leftover:** 513 radicals at N3+ have no `mnemonic_text`. Harmless today — those levels ship
  no kanji prose either — but they are the queue if N3 content starts.
- **Leftover:** `N5_DECOMPOSITION` / `N4_DECOMPOSITION` in `generate_deps.py` (~200 lines of
  curated data) are now dead and were deliberately left in place, not deleted.

### Kanji meaning mnemonics restyled to one logical sentence (2026-09-01)
- The Rev 6 "two or three sentences, one causal chain" form produced a scene the components took
  turns acting in, with the meaning bolted on at the end. Rev 8 is **one sentence that reads as a
  reason**: 員 went from 216 characters of gatekeeper-and-badge to "An employee is just one more
  mouth the company has to feed with its own money."
- Enforced by `MEANING_MAX_SENTENCES = 1` in `validate_mnemonics.py` (fresh-draft lane only) and a
  `LEN_BOUNDS` floor drop 100 → 60. The meaning may now sit **anywhere** in the sentence, not only
  at the end.
- 266 kanji rewritten and ingested; 108 new N5/N4 radicals authored. Prompts updated:
  `prompts/kanji-mnemonic.md`, `prompts/vocab-mnemonic.md` (logic rule only — vocab keeps its own
  length).
- **The one-off tooling is gone.** `restyle_drafts.py` and `curriculum/_build/restyle/` (batch
  briefs, `BRIEF.md`, `check.py`, `patch.py`, `ingest_radicals.py`, the `out/` rewrites) were
  deleted on 2026-09-08. Recover them from git history if a pass like this is ever wanted again.
- **Leftover:** **50 stored kanji mnemonics are `flagged_for_rewrite`** (count as of 2026-09-08;
  112 when this entry was written) — they name components their kanji no longer has after the
  KanjiVG switch. They must be rewritten before those kanji ship. Regenerate them with
  `generate_content/generate_mnemonics.py --type kanji --level <lvl> --slugs …`. Note the flag
  lives only in `kanji/mnemonics/*.json`; no item in the shipped `kanji/<level>.json` carries it,
  so `compile-curriculum` does not warn on them.

### Decomposition holes closed: every split now accounts for every stroke (2026-09-01)
- KanjiVG labels the stroke groups it has names for and leaves the rest as bare strokes, and the
  walk in `build_decomposition.py` could only hoist *labelled* children out of an unnamed region.
  A region with no labelled child had its strokes dropped: **229 kanji shipped a component list
  with a hole in it** — 前 as 八+月+刂 with no ground, 右 as a mouth with no hand, 白 as 日 alone,
  先 as 儿 alone, 鳥 as 灬 alone, and 54 kanji (大 日 月 金 口 …) with no components at all.
- Every split is now checked against the glyph's own stroke count and a short one is not used:
  - `KANJI_OVERRIDES` (121 entries) states the components by hand where the missing region has a
    name — 前 = 丷+一+月+刂, 右 = 𠂇+口, 左 = 𠂇+工, 電 = 雨+电, 直 = 十+目+乚.
  - Where it has none, the kanji is taught as **its own single radical** (140 kanji: 七 大 北 白
    立 鳥 馬 …), which is the pairing 長/長 has always shipped and what KRADFILE says about most
    of them.
  - `HAND_STROKES` + the stroke-sum audit at the end of the run keep the hand table honest; it
    prints any entry whose components do not add up.
- "horns" moved from 䒑 to **丷**, with 一 as its own chip (`FORM_EXPANSIONS`, `SLUG_MOVES`), so
  the slug and its prose carry over. Its sidecar text was reworded — the bar it described is gone.
- Radicals 798 → 817. **N5 134 → 148, N4 99 → 107**, because a radical files at the level of the
  first kanji that needs it and identity edges pull 北 右 左 七 今 … forward to N5. 面 世 無 西 came
  back from the dropped set and recovered their prose. 10 new N5/N4 radicals were authored
  (五 万 西 北 今 电 飛 乚 以 民); no N5/N4 radical is prose-less.
- Kanji bands did not move (`bands.json` kanji section is byte-identical), so only the radical
  level files were rewritten.
- **Leftover:** **169 stored kanji mnemonics fail the gate and are all now
  `flagged_for_rewrite`** (N5 67, N4 65, N3 28, N2 5, N1 4). 69 were newly marked in this pass:
  64 were `draft`, 5 were `reviewed` (行 生 自 夫 夜 — flipped deliberately, on request, because
  their decomposition moved under them). 168 of the 169 name components their kanji no longer has,
  or are now identity items still carrying an invented scene where the contract wants one sentence
  ("the <radical>big</radical> radical and the <kanji>big</kanji> kanji are the same"); the odd one
  out is 重, whose description names 日 as a look-alike it does not have. No prose was edited.
- 12 items that were already flagged now *pass* the gate (口 立 羊 糸 竹 矢 角 肉 戸 羽 鳥 谷 — all
  became identity items and their stored prose happens to fit). They were left flagged, so the
  regeneration list is 181 unless they are dropped by hand.
- The flags were propagated into the shipped `curriculum/kanji/<level>.json` by hand (68 items:
  N5 36, N4 21, N3 8, N1 3). `generate.py` normally does that — it takes the *least* reviewed
  status of the mnemonic and example sidecars — but it cannot run here without `fugashi`, and the
  level files were otherwise already in sync with the sidecar prose. `compile-curriculum` only
  warns on a non-reviewed status, so nothing is withheld from the app by this.
- Regenerate with `generate_content/generate_mnemonics.py --type kanji --level <lvl> --slugs …`.
- **Gate gap:** 79 kanji are identity items with stored prose, and the 30 that pass the gate are
  all still multi-sentence scenes rather than the Rev 7 one-sentence "the radical and the kanji
  are the same". The gate cannot see it: when the radical meaning *is* the kanji meaning, any
  story that names it satisfies the component check, and `MEANING_MAX_SENTENCES` only runs on the
  fresh-draft lane. 12 of the 30 are flagged for other reasons; the other 18 (雨 力 入 川 子 耳 木
  二 女 水 手 夕 米 石 王 刀 弓 毛, 6 of them `reviewed`) are not flagged. Applying the
  one-sentence rule to identity items on the stored lane would catch the class mechanically.
- **Leftover:** `generate.py --bands` was not run end to end (no `fugashi` on this machine, and
  PyPI is unreachable from here). The radical level files were written through `generate.py`'s own
  `_write_banded`; the kanji files need no rewrite. `npm run compile-curriculum` still pending.

### Dead code to remove (not missing features)
- `claimStreakCelebration` + migration 014 (`src/data/user/streakRepository.ts`) — Plan 05 §5.2's data path. PRD decision R2 removed streaks from Home, so this has no UI and no callers by design. Do not build onto it.
