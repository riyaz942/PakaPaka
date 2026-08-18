# Working history — plan status

Every plan and story doc in this repo, with one status each. Details stay in the linked
plan; **only leftovers are listed here**, one line per point.

Last verified against the codebase: **2026-08-11**

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
| [Kanji coverage & dependency order](./content/kanji-coverage-and-dependency-order-plan.md) | **v2 Phases A–D done 2026-08-17** (A: corpus 2,000 kanji, bands 150/300/700/1000/2000, 238 radicals. B: all four app rules — reading prompts gated on guru+ kanji, two-card vocabulary, master cap with the reason on the card, furigana at master + reading-live, annotated meaning prompts, Stats note. C: pull-forward dropped, `requires` band-gated. D: 8,500 derived N3/N2/N1 words, every band ranked on reuse, "No mnemonic" marker in Browse — 12,156 items, 25,124 edges, 6.5 MB); **Phase E track 1 done 2026-08-17, track 2 not started** — track 1 (kanji prose) authored all 238 radicals (14 N5 + 10 N4) and all 300 N5+N4 band kanji (55 N5 + 118 N4) via the subagent lane (`sonnet-5`, groups of ≤4): 197 net-new items this phase, 195/197 gate-passing on attempt 1, only `k-storey` (N5) and `k-have-the` (N4) needing one repair each — both the same failure shape, a `description` naming a Japanese character not on the item's reviewed look-alike list. The runbook's Step 1a auto-select was fixed to read "done" from the per-source sidecar (`bands.json`-mapped) instead of the drafts folder, which the reband had made stale — verified against the sidecar directly, giving the exact counts the plan predicted (10 N4 radicals, 55 N5 kanji, 118 N4 kanji), and the runbook doc is updated in place with the corrected snippet. `generate.py --bands`, `validate-schema`, `compile-curriculum` all clean after every layer; the sidecar-based auto-select confirms 0 remaining across all four layers. Track 2 (N5/N4 vocabulary top-up) started 2026-08-17 with its mandatory prerequisite — `reading_regularity()` now judges against KANJIDIC (checked-in `_build/kanjidic_readings.json`, built by `import/build_kanjidic_readings.py`) and gained a `kun_word` kind, which puts N5+N4's 1,247 words at 538 note / 459 story / 207 kana / 43 irregular and leaves a 220-word re-authoring queue, 188 of them **reviewed** in the sidecar (the shipped file says draft for all 718 because the least-reviewed-wins rollup folds in the draft examples sidecar — read the sidecar, not the shipped file). 12-word pilot done, both directions, 12/12 gate-passing, run as seed-and-repair so untouched meaning prose stays byte-identical. Also found: 209 shipped words (189 reviewed) fail the gate on their *meaning* mnemonic, a separate pre-existing Phase A reband regression. No top-up words written yet — the real sizes are +82 N5 and +171 N4. **Track 1 gated most of track 2**: 345 of the 1,247 N5+N4 words could not have a prompt built until the 173 band kanji had prose — now unblocked, track 1 being fully done. Track 2's word-writing has not started. See the Phase E section of the plan. v1 Phases 1–4 tranche 1 shipped 2026-08-16 but the design is superseded: pull-forward is reverted in favour of gating the *question* (reading prompts withheld until a kanji is guru) rather than the display. New ladder 150/300/700/1000/2000 kanji, ~10,000 vocabulary, ~240 radicals. Kept from v1: Phase 1 ordering moves, Phase 2 skeleton, Phase 4 tranche-1 prose (30 kanji + 30 radicals), the `getParentsByRelationshipType` chunking fix |

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
- **N4 is untouched for every content type**: 0/97 grammar lessons, 0/94 kanji mnemonics, 0/33 radicals, 0 vocab mnemonics, 0 examples.
- N5 vocabulary example sentences: 491/1,245 generated and all still `draft`, never reviewed.
- N5 radical/kanji mnemonics still fail the current Rev-3 gate by design — the wholesale regen (radicals → kanji → vocab) has not run; needs API credentials or a web-chat/subagent lane.
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
- Running `generate.py --level <n>` reverts Studio review-status flips in `radicals/*.json` and `kanji/n5.json`; those files must be `git checkout`-ed after a regeneration until the sidecars carry the status. Phase 4 fixed one instance at source (`kokoro`) by promoting the **sidecar**, which is the durable form of the fix.

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
  Phase E (author 173 kanji + 24 radicals, top up N5/N4 vocabulary) is untouched.

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

### Dead code to remove (not missing features)
- `claimStreakCelebration` + migration 014 (`src/data/user/streakRepository.ts`) — Plan 05 §5.2's data path. PRD decision R2 removed streaks from Home, so this has no UI and no callers by design. Do not build onto it.
