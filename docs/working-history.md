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
| Content plans (`docs/content/`) | 2 | 3 | 0 |
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

## Design & platform — `docs/design/`

| Plan | Status |
| --- | --- |
| [Design System v2 restyle](./design/redesign-v2/README.md) | Done — Sessions 1–8 |
| [Curriculum Studio (web tool)](./design/curriculum-studio-web-plan.md) | Done — Chunks 1–9 live in [`web/`](../web/README.md) |
| [Backup/restore + web build](./design/backup-and-web-plan.md) | **In progress** — Part A complete: export is story 9-1 (`done`), restore + backup nudge is 9-2 (`done`). Part B (web learner app) not started |
| [Web SQLite ATTACH findings](./design/web-sqlite-attach-findings.md) | Done — spike closed, `ATTACH` verified working |
| [AI reading & community contribution](./design/ai-reading-and-community-contribution-design-note.md) | Done — design note only, no app work by intent |
| [Customizable Home screen](./design/customizable-home-screen-plan.md) | **In progress** — step 1 (settings route restructure) done; steps 2–7 remaining |

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
