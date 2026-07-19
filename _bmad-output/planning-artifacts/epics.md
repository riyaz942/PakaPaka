---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
completedAt: '2026-07-20'
storiesCompletedEpics: [1, 2, 3, 4, 5]
storySizingPreference: '2-3 larger stories per epic (vertical slices)'
validationNotes:
  - 'Brownfield: starter-template story correctly omitted (Architecture retain Expo 55)'
  - 'Migrations created only when first needed (015 in 4.2, 016+ in 5.1, goal-ring in 2.1)'
  - 'FR89 past-threads AC added during validation'
  - 'OA4/OA5 remain non-blocking placeholders inside Epic 5'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/ux-design-directions.html'
  - '_bmad-output/planning-artifacts/.decision-log.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-18-2244.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-18-2354.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322-learn-page.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1628.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1651-ai-conversation.md'
excludedDocuments:
  - '_bmad-output/planning-artifacts/product-brief-japanese-learning-2026-04-12.md'
  - '_bmad-output/planning-artifacts/prd-validation-report.md'
  - '_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-03.md'
project_name: japanese-learning
date: '2026-07-20'
---

# japanese-learning - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for japanese-learning, decomposing the requirements from the PRD, UX Design, Architecture, decision log, and July 2026 brainstorming sessions into implementable stories.

**Context:** Brownfield — existing Expo SDK 55 app. PRD Revision v2 (UX upgrade + AI Conversation) is the primary delta; v1 FRs remain in force as amended. Do **not** re-run `create-expo-app`.

## Requirements Inventory

### Functional Requirements

**Learning Content & Progression (v1, retained / amended)**

- FR1: Learners can study kanji organized by JLPT level (N5→N1) with parallel progression within each level.
- FR2: Learners can study vocabulary organized by JLPT level (N5→N1) with parallel progression within each level.
- FR3: Learners can study grammar points organized by JLPT level (N5→N1) with input-based testing, including verb conjugation practice integrated into grammar reviews.
- FR4: Learners can study radicals as building blocks for kanji, with a strict dependency graph: radicals → kanji → vocabulary, precomputed and stored in SQLite.
- FR4b: Each radical displays an AI-generated visual mnemonic image (pre-generated, Cloudflare R2).
- FR5: [Amended v2] Each kanji/vocab item supports multiple accepted answers; on'yomi and kun'yomi tracked separately. On a kanji **reading** prompt the system asks a specific reading type and validates against only that type (see FR81–FR83).
- FR5b: Items progress through SRS stages including burn/mastered.
- FR6: Grammar points use structured schema: structure pattern, accepted forms, conjugation rules.
- FR6b: Grammar validation uses parser-based, conjugation-aware checking (not Levenshtein-only).
- FR6c: Each grammar point includes 5–10 example sentences preferring known vocabulary.
- FR7: Vocabulary items include contextual meanings and example sentences tied to grammar points.
- FR8: Grammar examples prioritize vocabulary the learner has already studied (reinforcement-ranked query).
- FR8b: [Amended v2] Learners can read pre-seeded passages with comprehension questions — reached via unified Browse (not a dedicated Read tab); see FR62–FR70.
- FR8c: [Amended v2] Passages use vocabulary/grammar from the learner's current/completed level, with progress-driven access states in Browse.

**SRS Engine & Review (v1 amended + v2)**

- FR9: [Amended v2] Input-based testing; keyboard-first show → type → result → next; gains two-card model and Return-to-advance (FR81–FR86).
- FR10: Reviews scheduled using FSRS.
- FR11: [Amended v2] Unified review session interleaving kanji, vocabulary, and grammar; starts immediately on "Review"; two-card pacing applied.
- FR12: Visible cross-domain reinforcement — recently studied kanji/vocab highlighted explicitly in grammar examples and passages.
- FR12b: Micro-adjustments to related items when one is reviewed.
- FR13: Embedded romaji-to-hiragana conversion (WanaKana).
- FR14: Typo detection (Levenshtein) for meaning answers; parser-based validation for grammar; non-terminal states for near-misses.

**Cognitive Load → Goal Ring & Engagement (v1 amended → v2)**

- FR15–FR17: [Amended v2 → FR55–FR58] Cognitive-load capacity ceiling reframed as adaptive goal ring.
- FR18–FR19: [Amended v2 → FR59 / Stats] Daily streak removed from Home; streak-at-risk notifications dropped; days-studied-this-month in Stats.
- FR20: Learners can configure notification timing and opt out entirely (review nudges retained if product-desired; streak-at-risk removed).
- FR55: Daily ring is an adaptive **goal** (not capacity ceiling): fills from lessons and reviews, may overshoot 100%, no maximum.
- FR56: Goal recalculates weekly as average daily achievement over prior week (active days only), with minimum sample; otherwise carries forward.
- FR57: Goal rises only (congratulatory prompt + change offer); never auto-drops; after 2–3 miss weeks offers opt-in reduction; user-configurable unbounded in Settings.
- FR58: Home = permanent sections with designed empty states (greeting, goal ring, Learn CTA, Review CTA, one-week forecast with wall annotation, reading readiness) + conditional content (at-risk, welcome-back, curriculum banner, shadow-mode prompt, import nudge). Home offers; never auto-starts.
- FR59: At-risk/refresher section when items genuinely at risk: count + top 5–10 items, inline revision CTA, full-list on tap; invitation framing.
- FR60: Reading-readiness meter frames locked passages as destination ("N items from unlocking").
- FR61: Welcome-back triage after absence ("20 of your 340 due") instead of full backlog dump.

**Unified Browse & Search (v2)**

- FR62: Single unified discovery surface replaces per-level Learn screens and Read tab; flat virtualized paginated list; JLPT level is a filter.
- FR63: Passages are first-class rows (UNION items + reading_passages); Read tab removed.
- FR64: Faceted multi-select filters (level, type, performance, SRS stage, lock) via drawers; live result count on Apply (disabled at zero); self-summarizing pills.
- FR65: Fan-out search (EN/romaji/kana/kanji) with ~200ms debounce; romaji→kana in parallel without replacing raw query.
- FR66: Each passage has bilingual (JA/EN) one-line summary (searchable + list display).
- FR67: Kanji/vocab/grammar always viewable in Browse; "locked" applies to passages only (view permission ≠ lesson eligibility).
- FR68: Passage unlocks when ≥90% of linked vocab+grammar reach Guru+.
- FR69: Tapping locked passage shows needed vocab/grammar to-do list.
- FR70: Passage reader long-press on word opens details in place (authored word-boundary item_ids); passage_practice_results drive completed state / disable correct inputs.

**Item Details & Lesson (v2)**

- FR71: Lesson = three-section paged flow (Intro → Mnemonic → Examples & links); details = single vertical scroll with disclosures; compositions split.
- FR72: Type-appropriate cross-references from dependency edges (radical→kanji, kanji→vocab, vocab→component kanji, grammar→vocab).
- FR73: Shared SectionHeading with optional info affordance → bottom sheet explainer.
- FR74: On'yomi/kun'yomi primer shown unprompted to absolute beginners (onboarding path + seenKanjiReadingPrimer flag) on first dual-reading kanji; later via heading info.
- FR75: Personal mnemonic one-per-item as content (empty / saved / editing states; delete confirms; Save disabled when empty).
- FR76: Passive non-blocking study-status banner; details never a lesson entry point; content always visible.
- FR77: Curriculum accepted answers behind disclosure (vs user synonyms editor naming collision).
- FR78: Furigana auto-hiding keys on vocabulary item mastery (Guru+ or known), never component kanji.
- FR79: Tap-to-toggle furigana is stateless peek; persistent overrides in Settings with reset; resolution: Settings override → SRS default → global pref; overrides independent of study status.
- FR80: Comparison view (sticky glyphs, columns, stacked prose, component chips) via Compare picker / route params with two preselected items.

**Review Flow (v2)**

- FR81: Kanji = two cards (meaning + on'yomi), both required; prompt labels reading type; kun'yomi via vocabulary pairing.
- FR82: Valid-but-wrong reading type = non-terminal `wrong_reading_type` (no grade, no weakness, nudge + re-prompt).
- FR83: Two cards → single SRS state via worst-of-both, once per item per session (no double FSRS update).
- FR84: Return advances on correct (submit then continue); 800ms auto-advance opt-in off by default; MC gets Continue; deferred-grade flush preserved for indefinite wait.
- FR85: Inline AnswerReveal (reading + meaning) on correct and incorrect paths; deeper detail via details route under `review/` (session survives).
- FR86: Progress counter counts **cards** not items; answer-collision reveal links to Compare (FR80) with both items preselected.

**Onboarding & Customization (v1 retained)**

- FR21: Select starting JLPT level on first launch.
- FR22: Import via WaniKani API, Bunpro, or Anki during onboarding.
- FR23: Mark items known / in-progress / not started.
- FR24: Bulk-mark items when importing knowledge.
- FR25: Session intensity preference (relaxed ~15 / intense ~30).
- FR26: Use app without account or personal information.

**Personal Content & Weakness (v1 retained)**

- FR26b: Personal mnemonics for any item, local.
- FR27: View pre-generated visual radical mnemonics and text mnemonics.
- FR28: View weakness detection statistics.
- FR29: Per-user per-item error stats (correct/incorrect, error type history).
- FR30: Pattern tags for confusion clusters.
- FR31: Review queue biased `fsrs × 0.7 + weakness × 0.3`.
- FR32: Weakness stats visible with improvement over time.
- FR33: Confusion clusters surfaced to learner.

**Time Compression (v1 retained)**

- FR33b: Post-session summary: domain breakdown, total time, equivalent multi-app stack time.
- FR33c: Conservative estimate based on documented separate-tool patterns.

**Progress Import (v1 retained)**

- FR33d: WaniKani API import → map items, convert SRS → FSRS; burned stay burned.
- FR33e: Bunpro grammar import → map + FSRS conversion (API/export dependent).
- FR33f: Anki deck import → map cards where possible + FSRS conversion.
- FR33g: Unmatched imported items clearly flagged.
- FR33h: Import summary before finalizing (mapped / unmatched).

**Shadow Mode (Post-MVP)**

- FR33i-PM / FR33j-PM / FR33k-PM: Shadow mode parallel tool framing, comparative stats, periodic switch prompts.

**Administration & Pipeline (v1 retained)**

- FR34: Creator manages radical mnemonic images on R2.
- FR35: CI validates curriculum JSON schema.
- FR36: CI compiles JSON → SQLite on merge.
- FR37: Compiled DB versioned via Git LFS.
- FR37b: Mnemonic image URLs in curriculum data.

**AI Reading Stories / Community (Post-MVP)**

- FR38-PM–FR40-PM: BYO-key AI reading stories.
- FR41-PM–FR45-PM: In-app contribution / GitHub PR pipeline.

**Data & Offline (v1 retained)**

- FR46: All curriculum, progress, weakness stats local in SQLite.
- FR47: Fully offline after initial download (except AI Conversation per NFR24).
- FR48: Curriculum DB update check/download on launch.
- FR49: Mnemonic images cached locally after first load.
- FR50: Import requires one-time network; then local.
- FR51: OTA JS bundle updates via Expo Updates.

**Accessibility (v1 retained)**

- FR52: Screen reader support (TalkBack / VoiceOver).
- FR53: Sufficient contrast including goal ring.
- FR54: Scalable text for learning content.

**AI Conversation (v2 — MVP scope)**

- FR87: AI Conversation tab (replaces Read; 5-tab shell); always visible; unconfigured → key-setup.
- FR88: BYOK; OpenAI-compatible (editable base URL) + Anthropic adapters; Result type; keys in secure store (tab + Settings).
- FR89: Empty state = start picker (practise recent / choose grammar / role-play / random); past conversations secondary.
- FR90: Chat default; mic promotes to conversation mode mid-session.
- FR91: AI replies in curriculum furigana bracket format; parse fail → plain text, no error.
- FR92: Unknown words flagged (local lookup); curriculum-unstudied deep-links to details; off-curriculum display-only; flagging = long-press discoverability.
- FR93: AI words never enter SRS directly (no item_id → no SRS row).
- FR94: Turn budget steers role-plays / cost ceiling (formula OA4 TBD); steer not hard cutoff.
- FR95: Never correct mid-conversation; end-of-session summary (≤5 mistakes, words met by membership, grammar practice).
- FR96: Summary on-demand and cached (never regenerate); end via AI wrap-up, user End, or abandon (silent, resumable).
- FR97: Hidden in-band structured markers (no tool-calling layer).
- FR98: Conversation mode full-screen PTT: AI latest line (text + TTS) + user transcription; history hidden.
- FR99: STT lands in composer for confirm/edit before send; on-device STT default; cloud STT explicit opt-in only.
- FR100: On-device TTS/STT via executorch (Supertonic + Whisper); no interim system-TTS.

### NonFunctional Requirements

**Performance**

- NFR1: SRS review interactions <100ms on mid-range devices.
- NFR2: SQLite standard ops (queue, details, SRS update, weakness) <100ms.
- NFR3: Cold start to interactive <3s; Review → first item with no intermediate screens.
- NFR4: Curriculum incremental update download <30s on standard mobile connection.
- NFR5: WanaKana conversion real-time with no visible delay.
- NFR5b: No UI animations in review loop between items.

**Security & Privacy**

- NFR6: Import API keys in platform secure storage; discardable after import.
- NFR7: Import transmits only API key over HTTPS; no learning data sent.
- NFR8: No learning data/progress/weakness/PII transmitted off-device.
- NFR9: Anki import processes entirely on-device.

**Data Integrity**

- NFR10: User progress survives app/OS/curriculum updates.
- NFR11: JSON→SQLite validates schema; failure blocks publish.
- NFR12: Interrupted curriculum download discarded; continue with existing DB.
- NFR13: Streak/activity tracking accurate across timezone/restart/offline (activity days replace Home streak).

**Accessibility**

- NFR14: WCAG 2.1 AA contrast (4.5:1 normal / 3:1 large).
- NFR15: All interactive elements operable via screen reader with meaningful labels.
- NFR16: Text scales to 200% without loss.
- NFR17: Input testing operable via a11y keyboards/IMEs.

**Integration**

- NFR18: WaniKani/Bunpro handle rate limits, invalid keys, API changes; fallback to manual marking.
- NFR19: Anki import handles malformed/unsupported/partial matches gracefully.
- NFR20: R2 image load failure → cache or text mnemonic fallback.

**Scalability**

- NFR21: Schema supports N5→N1 growth without schema break.
- NFR22: Query performance <100ms at ~10k+ items.

**v2 Platform / AI**

- NFR23: Platform floor iOS 17 / Android 13 (API 33) + New Architecture (executorch); v1 mins retired.
- NFR24: AI Conversation network-exempt from offline-first; BYOK key only to user-configured HTTPS endpoints; no learning data to unconfigured endpoints.
- NFR25: On-device model downloads explicit, user-initiated, size-disclosed; app usable (chat without voice) before complete.
- NFR26: BYOK cost bounded/legible via turn budget + on-demand summaries; adapter usage accounting.
- NFR27: Streaming via expo/fetch SSE; partial/failed streams degrade without corrupting transcript.
- NFR28: New user.db tables via numbered migrations (`015_furigana_overrides`, `016+` AI) preserving NFR10.
- NFR29: First onLongPress surfaces require non-gesture a11y alternative (CI-enforced).
- NFR30: Pinned executorch nightly — manual upgrade + re-verify accepted cost.

### Additional Requirements

**Brownfield / foundation (Architecture — do not re-init Expo app)**

- Retain Expo SDK 55 + Expo Router + NativeWind v4 + dual SQLite + custom dev client; evolve in place.
- Enable New Architecture (`newArchEnabled: true`) and min OS iOS 17.0 / Android API 33 via `expo-build-properties`.
- Tab shell: Home · Browse · AI Conversation · Stats · Settings (Read removed; temporary redirects from learn/read OK during rollout).
- Dual-DB contract retained: curriculum.db read-only/replaceable; user.db numbered migrations; ATTACH for joins.
- All fallible async returns `Result<T, AppError>`; never throw across async in core/data.
- Semantic NativeWind tokens only — no deprecated Colors / raw hex in new code.

**Curriculum pipeline deltas**

- Compile contract must emit bilingual passage one-line summaries and authored word-boundary spans linking vocabulary `item_id`s.
- Curriculum OTA: download → SHA-256 verify → atomic rename (unchanged).

**Review / grading engine deltas**

- Two-card kanji → worst-of-both single FSRS update; never double-update.
- Answer feedback kinds include `wrong_reading_type` alongside `wrong_script` / `confused_with`.
- Progress UI counts cards; SessionHeader / counter must not stall under two-card model.
- Deferred-grade flush must work when advance wait is indefinite (Return-to-advance).
- Details routes mounted under `review/` so session survives.

**Goal ring / Home**

- Goal-ring fields in user.db (target, weekly ratchet, achievement); never clamp as capacity ceiling.
- Daily load accounting must include lesson contributions (`addDailyLoad` from lesson flow — fixes BUG2).
- Remove Home streak UI and streak-at-risk notifications.
- Stats shows days-studied-this-month.

**Browse / search**

- Virtualized UNION query over items + reading_passages; filter indexes for NFR22.
- Separate view permission (passages) from lesson eligibility.
- Passage unlock = ≥90% linked vocab+grammar at Guru+ (derived query, no unlock table).

**Furigana / AI persistence**

- Migration `015_furigana_overrides`; resolution helper: Settings override → SRS default → global pref.
- Migrations `016+` for ai_sessions / ai_messages / cached summaries.
- BYOK adapters in `core/ai/adapters/`; markers in `core/ai/markers.ts`; voice in `data/ai/voice/`.
- Never create SRS rows from AI/off-curriculum words.
- Cloud STT only if `cloudSttOptIn === true`.

**Known bugs to fix in stories (PRD v2 Bug Batch)**

- BUG1: Home metrics don't refresh after lesson/review until tab switch.
- BUG2: Goal ring shows 0% for lesson-only users (no addDailyLoad in lesson flow).
- BUG3: Any kanji reading accepted on reading prompt (on/kun flattened).
- BUG4: Progress counter stalls once two-card model lands.
- BUG5: passage_practice_results written but never read back.
- BUG6: Furigana auto-hide keyed on kanji characters instead of vocabulary mastery.
- BUG7: Dependency-graph locking wrongly applied to kanji/vocab rows in browse list.

**Open items (non-blocking placeholders)**

- OA4: Turn-budget formula — implement behind named pure function with placeholder constants.
- OA5: Role-play scenario library — ship picker shells + stub scenarios.
- OA6: Furigana parse-failure → plain text (already FR91).
- OA7: Long-press a11y pattern before shipping those gestures.

**Architecture implementation sequence (v2 delta-first)**

1. Platform floor + New Architecture verify (dev client rebuild)
2. User migrations: furigana overrides, goal-ring fields, AI tables
3. Review two-card / worst-of-both / Return-to-advance / card progress
4. Home goal-ring + streak removal + triage
5. Unified Browse + pipeline passage summaries/spans
6. Lesson/details split + comparison + furigana fixes
7. BYOK adapters + chat UI + summary cache
8. executorch TTS/STT + model downloads + conversation mode
9. A11y long-press alternatives; polish

### UX Design Requirements

- UX-DR1: Implement NativeWind semantic token system per UX color/typography/spacing spec (dark-first; SRS/feedback/content/goal-ring/reinforcement tokens); CI contrast check remains authoritative.
- UX-DR2: Rename CognitiveLoadRing → GoalRing; support 0% / filling / goal-met / overshoot (>100% cyan extended arc + `+N%` badge); large Home (~160px) and small session header (~32px); a11y progressbar announces percent including overshoot.
- UX-DR3: TabBar: Home · Browse · Conversation (short label **Talk** OK) · Stats · Settings; hide during review/lesson/PTT; reviews-ready count on Review CTA only (no tab badge).
- UX-DR4: Home composition per FR58–61 — greeting with day-1 fallback, goal ring hero, illustrated Review (primary) + Learn (secondary) CTAs, thin JLPT progress bar under CTAs, forecast+wall, reading readiness, designed empty states; soft hero graphics behind ring; no streak.
- UX-DR5: Conditional Home sections: at-risk refresher, welcome-back triage, curriculum-update banner, import nudge — invitation framing, never shame/auto-start.
- UX-DR6: Direction A compact review layout default (dense header, large focal, full-width input); zero animations in review loop; Direction B reference-only for later a11y preference.
- UX-DR7: ReviewCard states: prompting / correct / incorrect / typo / wrong_reading_type / wrong_script; variants for kanji meaning, kanji on'yomi (labeled), vocab, grammar (+ Hint).
- UX-DR8: Shared AnswerReveal (reading + meaning) on correct and incorrect paths; collision line + Compare deep-link.
- UX-DR9: SessionHeader: small GoalRing + card progress `N of M` + type badge.
- UX-DR10: Return-to-advance on correct; Continue on MC/incorrect; 800ms auto-advance Settings opt-in off by default.
- UX-DR11: ProgressiveHint for grammar (Direction E ladder: scope → lesson → full reinforcement); no automatic reinforcement on initial prompt; full notes on result.
- UX-DR12: Post-session TimeCompressionSummary / PostSessionShareCard — time compression centerpiece; goal-met/overshoot; domain breakdown; optional weakness delta; **no streak row**.
- UX-DR13: BrowseList / BrowseRow / FilterDrawer / FilterPill / SearchField — virtualized UNION list; passage rows show bilingual summary + lock/readiness; Apply shows live count (disabled at zero); self-summarizing pills.
- UX-DR14: Locked passage UX = needed-items to-do list (never dead end); reading-readiness meter destination framing.
- UX-DR15: Passage reader long-press word details + visible non-gesture a11y alternative (NFR29 / OA7).
- UX-DR16: Lesson 3-section paged flow vs details single-scroll split; SectionHeading + info bottom sheets; StudyStatusBanner passive; PersonalMnemonic content states; accepted-answers disclosure.
- UX-DR17: On'yomi/kun'yomi primer for absolute beginners (FR74) as first-kanji section content + later via info affordance.
- UX-DR18: CompareView sticky side-by-side comparison reachable from details and answer-collision.
- UX-DR19: FuriganaText shared renderer; vocab-mastery auto-hide; tap = peek; Settings overrides + reset UI.
- UX-DR20: DaysStudiedStat on Stats (calm monthly activity — no flame); SRS stage buckets + weakness trends retained on Stats.
- UX-DR21: ConversationStartPicker as empty state; KeySetup for unconfigured BYOK; ChatBubble / Composer / PTTSession / ConversationSummary components.
- UX-DR22: Conversation offline empty/error: clear "requires internet"; study features remain available messaging.
- UX-DR23: Voice model missing: chat OK; mic prompts explicit download with size disclosure.
- UX-DR24: Flagged unknown words tappable (curriculum) with non-gesture alternative; never mid-convo correction UI.
- UX-DR25: ImportSummaryCard transparent mapped/unmatched summary (Direction F trust pattern).
- UX-DR26: Onboarding intensity = two options only (Relaxed ~15 / Intense ~30); no account.
- UX-DR27: Remove streak-at-risk warning banners and streak-recovery sheets from product surfaces.
- UX-DR28: Goal-rise congratulatory overlay/prompt with change offer (FR57); non-review only.
- UX-DR29: Feedback patterns: correct=green+reveal+Return; incorrect=red+reveal+manual; typo/wrong_reading_type=amber nudge+re-prompt; collision=Compare link.
- UX-DR30: Empty/loading states for no reviews, Browse no-matches, Conversation unconfigured/offline, Stats first-run, locked passage, voice models missing — per UX Consistency Patterns table.
- UX-DR31: Visual reference implementation must match refreshed `ux-design-directions.html` v2 shell (Directions A, C-v2 Home, D post-session, E hints, F onboarding, G Browse, H Conversation); PRD wins on IA/behavior conflicts.
- UX-DR32: Conversation accent reuses `feedback-info` blue; content-reading accent for passages.
- UX-DR33: Settings surfaces: unbounded goal config, furigana overrides+reset, review auto-advance, notifications (no streak-at-risk), AI key, cloud STT opt-in, haptics, intensity.
- UX-DR34: Session exit confirm ("Progress is saved"); tab bar hidden in focused session contexts; max Browse drill-down ~2.

### FR Coverage Map

**Epic 1 — Kanji Review Clarity**
- FR5: Specific reading-type validation on kanji reading prompts (amended)
- FR9: Input-based review loop with two-card / Return-advance (amended)
- FR11: Unified review session with two-card pacing (amended)
- FR14: Non-terminal wrong_reading_type alongside typo / wrong_script paths
- FR81: Two-card kanji (meaning + labeled on'yomi); kun'yomi via vocabulary
- FR82: wrong_reading_type non-terminal state
- FR83: Worst-of-both single SRS update per item/session
- FR84: Return-to-advance; auto-advance opt-in off by default
- FR85: Shared AnswerReveal; details under review/
- FR86: Card-based progress counter; answer-collision → Compare

**Epic 2 — Goal-Driven Daily Home**
- FR18→Stats: Days studied this month (streak removed from Home)
- FR20: Notification config (streak-at-risk removed)
- FR33b: Post-session domain + time summary (no streak row)
- FR33c: Conservative time-compression estimate
- FR55: Adaptive goal ring (lessons + reviews, overshoot, no max)
- FR56: Weekly goal recalculation (active days, min sample)
- FR57: Goal rises only; opt-in reduction offer; Settings unbounded
- FR58: Home permanent sections + empty states + conditional triage
- FR59: At-risk / refresher section
- FR60: Reading-readiness meter
- FR61: Welcome-back triage

**Epic 3 — Unified Browse & Passages**
- FR8b: Pre-seeded passages with comprehension (via Browse, not Read tab)
- FR8c: Passages use current/completed level content + access states
- FR62: Unified virtualized discovery list; level as filter
- FR63: Passages as first-class rows; Read tab removed
- FR64: Faceted filters with live Apply count + pills
- FR65: Fan-out search (~200ms debounce)
- FR66: Bilingual passage one-line summaries
- FR67: Kanji/vocab/grammar always viewable; lock = passages only
- FR68: ≥90% Guru+ unlock gating
- FR69: Locked passage needed-items to-do
- FR70: Long-press word details; passage_practice_results read-back

**Epic 4 — Clear Lessons & Honest Details**
- FR26b: Personal mnemonics as content states
- FR27: View mnemonics on details surfaces
- FR71: Lesson 3-section paged vs details scroll split
- FR72: Type-appropriate cross-references
- FR73: SectionHeading + info bottom sheet
- FR74: On'yomi/kun'yomi primer for beginners
- FR75: Personal mnemonic empty/saved/editing UX
- FR76: Passive study-status banner; details ≠ lesson entry
- FR77: Accepted answers behind disclosure
- FR78: Furigana auto-hide on vocabulary mastery
- FR79: Stateless tap peek; Settings overrides + reset
- FR80: Comparison view via picker / route params

**Epic 5 — AI Conversation Practice**
- FR87: Conversation tab (replaces Read); key-setup when unconfigured
- FR88: BYOK OpenAI-compatible + Anthropic adapters; secure store
- FR89: Start picker empty state; past threads secondary
- FR90: Chat default; mic → conversation mode
- FR91: Furigana bracket replies; plain-text fallback
- FR92: Unknown-word flagging + curriculum deep-links
- FR93: Never inject AI words into SRS
- FR94: Turn budget steer (OA4 placeholder OK)
- FR95: Deferred correction → end summary
- FR96: On-demand cached summary; end / abandon rules
- FR97: In-band control markers
- FR98: Full-screen PTT conversation mode
- FR99: STT → composer confirm; cloud STT opt-in only
- FR100: On-device TTS/STT via executorch

**Deferred (Post-MVP)**
- FR33i-PM, FR33j-PM, FR33k-PM: Shadow mode
- FR38-PM–FR45-PM: AI reading stories; community contribution

**Shipped baseline (v1 — no new stories unless gap/regression)**
- FR1–FR4b, FR5b–FR8, FR10, FR12–FR13, FR21–FR33h, FR34–FR54, FR46–FR51

## Epic List

**Story sizing (approved):** Prefer **2–3 larger stories per epic**, each a vertical slice covering a coherent user outcome (not micro-tickets).

### Epic 1: Kanji Review Clarity
Learners prove meaning and on'yomi as separate cards, advance on Return, and see inline reveals — without double-grading or a stalled progress counter.
**FRs covered:** FR5 (amended), FR9 (amended), FR11 (amended), FR14 (wrong_reading_type), FR81–FR86
**Also:** BUG3, BUG4 · UX-DR6–11, UX-DR29 · NFR1, NFR5b

### Epic 2: Goal-Driven Daily Home
Learners work toward an adaptive daily goal (lessons + reviews, overshoot OK) with Home triage — no streak guilt, no auto-start.
**FRs covered:** FR55–FR61, FR20 (amended), FR33b–FR33c, days-studied (ex-FR18/FR19)
**Also:** BUG1, BUG2 · UX-DR2–5, UX-DR12, UX-DR20, UX-DR27–28, UX-DR30

### Epic 3: Unified Browse & Passages
Learners find radicals, kanji, vocab, grammar, and passages in one searchable, filterable list — locked passages become to-dos, not dead ends.
**FRs covered:** FR8b–FR8c (amended), FR62–FR70
**Also:** BUG5, BUG7 · UX-DR3, UX-DR13–15, UX-DR31–32 · pipeline summaries + word spans

### Epic 4: Clear Lessons & Honest Details
Learners get a three-section lesson flow and a details page that explains, cross-links, and peeks furigana correctly — never conflating details with “start lesson.”
**FRs covered:** FR71–FR80, FR26b, FR27 (details surfaces)
**Also:** BUG6 · UX-DR16–19 · migration `015_furigana_overrides`

### Epic 5: AI Conversation Practice
Learners practise Japanese in a BYOK Conversation tab (chat default, optional on-device voice), grounded in curriculum — corrections only at the end.
**FRs covered:** FR87–FR100
**Also:** NFR23–NFR30 · UX-DR21–24, UX-DR33 · platform floor + New Architecture + executorch · migrations `016+`

**Natural implementation order:** Epic 1 → 2 → 3 → 4 → 5 (matches Architecture). Platform floor / New Arch opens Epic 5 (no separate Epic 0). Epic 3 may leave a Conversation placeholder tab until Epic 5.

## Epic 1: Kanji Review Clarity

Learners prove meaning and on'yomi as separate cards, advance on Return, and see inline reveals — without double-grading or a stalled progress counter.

### Story 1.1: Two-Card Kanji Grading

As a learner,
I want each kanji reviewed as separate meaning and on'yomi cards with correct reading-type validation,
So that I practise the right skill and my SRS grade isn’t polluted by accepting the wrong reading type.

**Acceptance Criteria:**

**Given** a kanji due for review
**When** the queue builds cards for that item
**Then** I receive two cards — meaning and on'yomi reading — both required before the item can advance
**And** the reading prompt is labeled (e.g. “Reading — on'yomi”) and validates only on'yomi (FR81, FR5)
**And** kun'yomi is not accepted as the kanji reading answer (kun'yomi delivered via vocabulary pairing)

**Given** I submit a reading that is valid for the other reading type but not the prompted type
**When** the answer is evaluated
**Then** the result is non-terminal `wrong_reading_type` (nudge + re-prompt)
**And** no FSRS grade and no weakness signal are recorded (FR82, FR14)

**Given** I have answered both cards for a kanji in one session
**When** the item’s grade is applied
**Then** a single FSRS update uses worst-of-both
**And** there is no double FSRS write and no SRS schema change (FR83)
**And** BUG3 is fixed (flattened any-reading acceptance is gone)

**Given** vocabulary or grammar cards in the same session
**When** they are presented
**Then** existing single-card behavior remains unchanged

### Story 1.2: Review Pacing, Reveal & Card Progress

As a learner,
I want Return-to-advance pacing, a clear inline reveal, and a progress counter that tracks cards,
So that a longer two-card session still feels fast, honest, and controllable.

**Acceptance Criteria:**

**Given** I answered a card correctly
**When** I press Return
**Then** the answer is submitted on first Return and the session advances on the next Return
**And** 800ms auto-advance is off by default and only runs if enabled in Settings (FR84)
**And** multiple-choice / incorrect paths show a visible Continue control

**Given** any graded answer (correct or incorrect)
**When** the result is shown
**Then** a shared `AnswerReveal` shows reading + meaning (trimmed) on both paths (FR85, UX-DR8)
**And** no review-loop animations delay the next card (NFR5b)
**And** deeper detail opens a details route mounted under `review/` so the session survives (FR85)

**Given** a session that includes two-card kanji
**When** I view the session header progress
**Then** progress counts **cards** (`N of M`), not items (FR86, UX-DR9)
**And** BUG4 is fixed (counter does not stall)

**Given** my answer collides with another item’s accepted answer
**When** the reveal is shown
**Then** one extra line explains the collision and links to Compare with both items preselected (FR86)
**And** if Compare UI is not yet built, the route/params contract is stubbed so Epic 4 can fill it without rework

**Given** deferred grades waiting on an indefinite Return advance
**When** I eventually continue or leave the session
**Then** the deferred-grade flush contract still applies correctly (FR84)

## Epic 2: Goal-Driven Daily Home

Learners work toward an adaptive daily goal (lessons + reviews, overshoot OK) with Home triage — no streak guilt, no auto-start.

### Story 2.1: Adaptive Goal Ring from Lessons & Reviews

As a learner,
I want a daily goal ring that fills from both lessons and reviews and can overshoot 100%,
So that progress feels like an aspiration I can beat — not a capacity ceiling.

**Acceptance Criteria:**

**Given** I complete review cards and/or lesson items in a day
**When** daily load is recorded
**Then** both lessons and reviews contribute to the goal ring (FR55)
**And** BUG2 is fixed (`addDailyLoad` is called from the lesson flow, not only reviews)

**Given** my achievement exceeds the daily target
**When** the ring renders
**Then** it may show >100% with cyan overshoot arc and a `+N%` badge (UX-DR2)
**And** there is no maximum clamp; the ring never blocks continuing to study (FR55)

**Given** a week of activity with enough active days
**When** the weekly recalculation runs
**Then** the new goal is the average daily achievement over active days only (FR56)
**And** if the minimum active-day sample is not met, the current goal carries forward

**Given** the recalculated average is higher than my current goal
**When** the rise is surfaced
**Then** I see a congratulatory prompt that also offers to change the goal (FR57, UX-DR28)
**And** the goal never auto-drops; after 2–3 consecutive miss weeks the system may *offer* an opt-in reduction
**And** Settings lets me set an unbounded goal manually (FR57, UX-DR33)

**Given** I finish a lesson or review and return to Home
**When** Home is focused/visible
**Then** goal and related metrics refresh without requiring a tab switch (BUG1)

**Given** assistive technology reads the ring
**When** progress is announced
**Then** it exposes a progressbar including overshoot percent (e.g. “Goal 120 percent”) (UX-DR2)

### Story 2.2: Home Triage, Post-Session Proof & Days Studied

As a learner,
I want Home to offer today’s work with clear empty states and triage, and Stats to show calm monthly activity,
So that I always know what to do next without streak anxiety or an overdue mountain.

**Acceptance Criteria:**

**Given** I open Home
**When** the screen renders
**Then** permanent sections are present: greeting (comprehensible sentence + day-1 fallback), goal ring, Learn CTA, Review CTA, one-week forecast with wall annotation on heavy days, reading readiness (FR58, UX-DR4)
**And** Home never auto-starts a session — I choose the mode
**And** Review is primary and Learn is secondary; reviews-ready count lives on the Review CTA only (UX-DR3)
**And** a thin JLPT progress bar may sit under the CTAs
**And** no streak flame or streak-at-risk UI appears (R2, UX-DR27)

**Given** items are genuinely at risk
**When** the at-risk section is shown
**Then** I see a count plus top 5–10 items and an inline “do a small revision” CTA (FR59)
**And** tapping opens a full list; framing is invitation, never failure

**Given** passages remain locked
**When** reading readiness is shown
**Then** it frames a destination (“N items from unlocking…”) not a dead end (FR60)

**Given** I return after an absence with a large backlog
**When** welcome-back triage appears
**Then** it offers a slice (e.g. “20 of your 340 due”) instead of dumping the full backlog (FR61)

**Given** conditional banners apply (curriculum update, import nudge, etc.)
**When** they are eligible
**Then** they appear as designed empty-state-aware conditionals without blocking the permanent sections (FR58, UX-DR5)

**Given** I complete a review session
**When** the post-session summary shows
**Then** time compression is the centerpiece with domain breakdown and goal-met/overshoot state (FR33b–c, UX-DR12)
**And** there is no streak row on the share card

**Given** I visit Stats
**When** activity is displayed
**Then** I see “days studied this month” (calm, no flame) (UX-DR20)
**And** streak-at-risk notifications are not sent (FR20 amended)

## Epic 3: Unified Browse & Passages

Learners find radicals, kanji, vocab, grammar, and passages in one searchable, filterable list — locked passages become to-dos, not dead ends.

### Story 3.1: Unified Browse List, Search & Filters

As a learner,
I want one Browse surface for radicals, kanji, vocab, grammar, and passages with search and filters,
So that I can find anything without navigating per-level Learn screens or a separate Read tab.

**Acceptance Criteria:**

**Given** the app tab shell
**When** I open the discovery tab
**Then** it is labeled Browse (replacing Learn-as-tab discovery) and the dedicated Read tab is removed (FR62–FR63, UX-DR3)
**And** a Conversation/Talk placeholder tab may occupy the freed slot until Epic 5
**And** temporary redirects from `learn/*` / `read/*` are allowed during rollout

**Given** Browse is open
**When** the list loads
**Then** it is a flat, virtualized, paginated UNION of items and reading passages (FR62–FR63, UX-DR13)
**And** JLPT level is a filter attribute, not a navigational container

**Given** I apply faceted multi-select filters (level, type, performance, SRS stage, lock)
**When** I view the Apply control
**Then** it shows a live result count and is disabled at zero (FR64)
**And** active selections appear as self-summarizing pills

**Given** I type in the search field (English, romaji, kana, or kanji)
**When** ~200ms debounce elapses
**Then** a fan-out query runs with parallel OR branches (FR65)
**And** romaji converts to kana in parallel without replacing the raw query

**Given** kanji, vocabulary, or grammar rows
**When** they appear in Browse
**Then** they are always viewable regardless of lesson eligibility (FR67)
**And** BUG7 is fixed — dependency-graph locking is not applied to these rows

**Given** a passage row
**When** it is rendered
**Then** it shows its bilingual (JA/EN) one-line summary when available (FR66)
**And** lock/readiness affordance is passage-specific (UX-DR13–14)

**Given** Browse has no matches for current filters/search
**When** the empty state shows
**Then** I see “No matches” with a clear-filters action (UX-DR30)

### Story 3.2: Passage Unlock, Reader & Practice State

As a learner,
I want passages to unlock when I’m mostly ready, show what’s missing when locked, and remember practice answers,
So that reading feels like a destination I can work toward — not a dead end.

**Acceptance Criteria:**

**Given** a passage with linked vocabulary and grammar
**When** unlock is evaluated
**Then** it unlocks when ≥90% of linked vocab+grammar are Guru or above (FR68)
**And** a single leech cannot keep the passage fully locked

**Given** a locked passage
**When** I tap it
**Then** I see the specific vocab/grammar still needed as a to-do list (FR69, UX-DR14)
**And** I am not shown a dead-end empty state

**Given** the curriculum compile pipeline
**When** passages are compiled
**Then** bilingual one-line summaries and authored word-boundary spans linking vocabulary `item_id`s are emitted into `curriculum.db`

**Given** an unlocked passage reader
**When** I long-press a word with an authored boundary
**Then** meaning/reading/details open in place (FR70)
**And** a visible non-gesture alternative exists for the same action (NFR29, UX-DR15)

**Given** I previously answered comprehension inputs correctly
**When** I reopen the passage
**Then** `passage_practice_results` are read back to show completed state and disable already-correct inputs (FR70)
**And** BUG5 is fixed (results are no longer write-only)

## Epic 4: Clear Lessons & Honest Details

Learners get a three-section lesson flow and a details page that explains, cross-links, and peeks furigana correctly — never conflating details with “start lesson.”

### Story 4.1: Lesson / Details Split, Cross-Refs & Primer

As a learner,
I want lessons paced in three clear sections and details pages that show honest cross-links and study status,
So that studying an item feels guided while browsing an item never pretends to be a lesson.

**Acceptance Criteria:**

**Given** I start a lesson for an item
**When** the lesson UI loads
**Then** it uses a three-section paged flow: Introduction → Mnemonic → Examples & links, advanced by Continue (FR71, UX-DR16)
**And** section content is authored once into the correct surface (lesson vs details)

**Given** I open an item details page
**When** the page renders
**Then** it is a single vertical scroll with sections collapsible behind disclosures (FR71)
**And** the details page is never a lesson entry point (FR76)

**Given** any content type on details
**When** cross-references render
**Then** they come from dependency edges: radical→example kanji, kanji→vocabulary using it, vocabulary→component kanji (browsable), grammar→vocabulary using the pattern (FR72)

**Given** a section heading that needs an explainer (on'yomi/kun'yomi, radical, burned, transitive, etc.)
**When** I use the info affordance on `SectionHeading`
**Then** an explainer opens as a bottom sheet (FR73, UX-DR16)

**Given** I am an absolute beginner (onboarding path) and have not seen the kanji reading primer
**When** I reach the first kanji that has both reading types
**Then** an on'yomi/kun'yomi primer is shown unprompted as section-1 content (FR74, UX-DR17)
**And** `seenKanjiReadingPrimer` is set so it does not repeat; the primer remains reachable via heading info later

**Given** my study status for the viewed item
**When** the details page shows
**Then** a passive non-blocking study-status banner orients me (locked → what’s needed; prereqs-met-not-started → “you haven’t studied this yet”; in-progress/known → nothing) (FR76)
**And** content stays fully visible in every state

**Given** curriculum accepted answers vs my personal synonyms
**When** I view accepted answers
**Then** they are behind a disclosure that does not collide with the synonyms editor naming (FR77)

**Given** personal mnemonic for an item
**When** I view or edit it
**Then** empty shows a muted “add your own” line; saved shows text with edit + delete (delete confirms); editing disables Save when empty (FR75, FR26b, UX-DR16)

### Story 4.2: Furigana Model, Settings Overrides & Compare View

As a learner,
I want furigana that follows vocabulary mastery (with Settings overrides) and a side-by-side Compare view,
So that reading practice matches what I actually know and lookalike mistakes become teachable.

**Acceptance Criteria:**

**Given** furigana `auto` mode on vocabulary
**When** visibility is resolved
**Then** auto-hide keys on the vocabulary item’s mastery (Guru+ or known), never on component kanji characters (FR78)
**And** BUG6 is fixed (`getKnownKanjiCharacters()` is not the mastery unit)

**Given** I tap furigana on a word
**When** visibility toggles
**Then** the tap is a stateless peek/self-test only (FR79)

**Given** I set persistent per-word show/hide in Settings
**When** furigana resolves
**Then** order is Settings override → SRS default → global preference mode (FR79, UX-DR19, UX-DR33)
**And** overrides live in `user.db` via migration `015_furigana_overrides`, independent of `item_study_status`
**And** Settings provides a reset for overrides

**Given** I open Compare from details or from a review answer-collision link
**When** two items are provided (picker or route params)
**Then** Compare shows sticky side-by-side glyphs, columnized short attributes, stacked prose, and component chips with shared parts dimmed (FR80, UX-DR18)
**And** the route/params contract from Story 1.2 is fulfilled (no stub left)

**Given** shared furigana rendering
**When** curriculum bracket text is displayed (details, passages, later AI replies)
**Then** the shared `FuriganaText` component is used (UX-DR19)

## Epic 5: AI Conversation Practice

Learners practise Japanese in a BYOK Conversation tab (chat default, optional on-device voice), grounded in curriculum — corrections only at the end.

### Story 5.1: Platform Floor, BYOK Chat & Session Summary

As a learner,
I want a Conversation tab with bring-your-own-key chat grounded in what I’ve learned, and coaching only after I end,
So that I can practise real Japanese without mid-chat corrections or handing data to a vendor I didn’t choose.

**Acceptance Criteria:**

**Given** the app build configuration
**When** native builds are produced
**Then** minimum OS is iOS 17.0 / Android API 33 and New Architecture is enabled via `expo-build-properties` (NFR23)
**And** a custom dev client is required (Expo Go is insufficient for later voice work)

**Given** the tab shell after Epic 3
**When** I open the Conversation/Talk tab
**Then** it replaces the Read slot and is always visible (FR87, UX-DR3, UX-DR21)
**And** if no key is configured, I see KeySetup; otherwise the start picker is the empty state (FR88–FR89)

**Given** I configure BYOK
**When** I enter credentials in the tab or Settings
**Then** two adapters are supported: OpenAI-compatible (editable base URL) and Anthropic (FR88)
**And** keys are stored in platform secure storage and only sent to the user-configured HTTPS endpoint (NFR24)
**And** all adapter calls return `Result<T, AppError>`

**Given** I start a session from the picker (practise recent grammar / choose grammar / role-play / random)
**When** chat runs
**Then** chat is the default mode (FR90)
**And** AI replies use curriculum furigana bracket format rendered by `FuriganaText`; parse failure renders plain text with no error toast (FR91, OA6)
**And** control signals use hidden in-band markers stripped before render — no tool-calling layer (FR97)
**And** streaming uses `expo/fetch` SSE; partial/failed streams do not corrupt the persisted transcript (NFR27)

**Given** the AI uses a word I don’t know
**When** local lookup flags it
**Then** curriculum-but-unstudied words deep-link to details; off-curriculum words are display-and-translate only (FR92, UX-DR24)
**And** flagged words never create SRS rows (FR93)
**And** a non-gesture alternative exists for flag/long-press actions (NFR29)

**Given** I end a session (End button or AI wrap-up signal) or abandon it
**When** summary is requested
**Then** end-of-session summary is generated on demand once and cached (never regenerated) (FR95–FR96)
**And** summary includes ≤5 mistakes worth fixing, words met by curriculum membership, and grammar practice notes
**And** abandon closes silently, un-summarised but resumable
**And** a turn budget steers endings (placeholder constants OK for OA4) without a hard cutoff (FR94, NFR26)

**Given** I have past conversation sessions
**When** I use the top-corner entry on the Conversation tab
**Then** I can open prior threads as a secondary surface (FR89)
**And** the start picker remains the primary empty state for new sessions

**Given** I am offline
**When** I open Conversation
**Then** I see a clear “requires internet” state; other tabs remain fully usable (NFR24, UX-DR22)

**Given** persistence needs
**When** migrations run
**Then** `016+` AI sessions/messages/cached summaries are created without breaking existing user data (NFR28)

### Story 5.2: Push-to-Talk Voice with On-Device TTS/STT

As a learner,
I want optional on-device voice conversation I explicitly download and control,
So that I can speak Japanese in full-screen PTT mode without silent cloud fallbacks or blocking the rest of the app.

**Acceptance Criteria:**

**Given** chat is in progress
**When** I tap the mic in the composer
**Then** I am promoted to conversation mode mid-session with no up-front mode choice (FR90, FR98)

**Given** conversation mode is active
**When** the PTT UI shows
**Then** it is full-screen with chat history hidden: AI latest line (readable text + on-device TTS) and my latest transcription, with push-to-talk below (FR98, UX-DR21)

**Given** on-device STT produces a transcript
**When** I finish a utterance
**Then** text lands in the composer for confirm/edit/retry before send — never straight onto the wire (FR99)
**And** exiting conversation mode needs no chat-log reconciliation

**Given** TTS/STT runtime
**When** models are used
**Then** they ship via pinned `react-native-executorch` nightly with Supertonic Japanese TTS + Whisper Japanese STT (FR100, NFR30)
**And** no interim system-TTS engine is adopted

**Given** models are not yet downloaded
**When** I try to use voice
**Then** chat remains usable; mic prompts an explicit user-initiated download with clear size disclosure (NFR25, UX-DR23)
**And** downloads do not block cold start or other tabs (NFR3, NFR25)

**Given** cloud STT
**When** transcription is configured
**Then** cloud STT is an explicit Settings opt-in only — never an automatic fallback (FR99, UX-DR33)
