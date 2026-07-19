---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
documentsIncluded:
  - prd.md
  - architecture.md
  - epics.md
  - ux-design-specification.md
  - ux-design-directions.html
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-20
**Project:** japanese-learning

## Document Inventory

### PRD
- **Selected:** `prd.md` (88K, 2026-07-20)
- Companion (not used as PRD source): `prd-validation-report.md`

### Architecture
- **Selected:** `architecture.md` (43K, 2026-07-20)

### Epics & Stories
- **Selected:** `epics.md` (50K, 2026-07-20)

### UX Design
- **Selected:** `ux-design-specification.md` (44K, 2026-07-20)
- Companion: `ux-design-directions.html` (73K, 2026-07-20)

### Issues Resolved
- No whole + sharded duplicates
- All four required document types present
- Assessment set confirmed by user 2026-07-20

## PRD Analysis

### Functional Requirements

#### Learning Content & Progression
- FR1: Learners can study kanji organized by JLPT level (N5→N1) with parallel progression within each level.
- FR2: Learners can study vocabulary organized by JLPT level (N5→N1) with parallel progression within each level.
- FR3: Learners can study grammar points organized by JLPT level (N5→N1) with input-based testing, including verb conjugation practice integrated into grammar reviews.
- FR4: Learners can study radicals as building blocks for kanji, with a strict dependency graph: radicals must be learned before their associated kanji, kanji before associated vocabulary. The dependency graph (`radical_id → kanji_id → vocab_id`) is precomputed and stored in SQLite.
- FR4b: Each radical displays an AI-generated visual mnemonic image that creates a memorable association with the radical's meaning. Images are pre-generated and served from Cloudflare R2.
- FR5: Each kanji and vocabulary item supports multiple accepted answers — a primary meaning plus accepted synonyms stored in a dedicated table. Onyomi and kunyomi readings are tracked separately for kanji. **[Amended in v2]** — On a kanji reading prompt the system asks a specific reading type and validates against only that type (see FR81–FR83).
- FR5b: Items progress through SRS stages including a burn/mastered stage where review intervals become very long, equivalent to WaniKani's burn system.
- FR6: Grammar points use a structured schema: structure pattern, accepted forms, and conjugation rules — not free-text explanations only.
- FR6b: Grammar answer validation uses parser-based, conjugation-aware checking that understands verb forms (e.g., distinguishes て-form from た-form errors) rather than relying solely on Levenshtein string distance.
- FR6c: Each grammar point includes a minimum of 5–10 example sentences that use vocabulary the learner has already studied where possible.
- FR7: Vocabulary items include contextual meanings (usage in context, not just dictionary definitions) and example sentences tied to grammar points.
- FR8: The system presents grammar examples that prioritize vocabulary the learner has already studied, queried as `SELECT sentence WHERE vocab IN user_known_vocab ORDER BY reinforcement_score DESC`.
- FR8b: Learners can read pre-seeded passages (creator-authored) tagged by JLPT level, with comprehension questions that validate understanding. **[Amended in v2]** — Passages reached via unified Browse/Search, not dedicated Read tab (see FR62–FR70; R3).
- FR8c: Reading passages use vocabulary and grammar from the learner's current/completed JLPT level. **[Amended in v2]** — Same as FR8b amendment.
- FR9: Learners can prove knowledge through input-based testing — typing answers rather than self-grading. The review loop is keyboard-first: show → type → result → next, with no menus or animations between items. **[Amended in v2]** — Two-card model for kanji and Return-to-advance pacing (see FR81–FR86; R4).
- FR10: The system schedules reviews using FSRS (Free Spaced Repetition Scheduler) for research-backed optimal intervals.
- FR11: The system provides a unified review session that interleaves kanji, vocabulary, and grammar items intelligently. Sessions start immediately upon tapping "Review" — no intermediate screens. **[Amended in v2]** — See FR81–FR86; R4.
- FR12: The system maintains a static relationship layer that maps connections between content types (kanji↔vocabulary, kanji↔radicals, grammar↔vocabulary). When a grammar example uses kanji or vocabulary the learner studied recently, it is highlighted explicitly in the UI (e.g., "食べる ← you learned this yesterday"). Reinforcement is visible, not invisible.
- FR12b: The system applies micro-adjustments to related items when one is reviewed (e.g., reviewing a kanji boosts scheduling priority of its associated vocabulary and grammar).
- FR13: Learners can input Japanese text via embedded romaji-to-hiragana conversion (WanaKana) without relying on the OS keyboard.
- FR14: The system detects typos using Levenshtein distance for meaning answers (accepting with warning for minor typos, rejecting with "close!" hint for near-misses) and parser-based conjugation-aware validation for grammar answers.

#### Cognitive Load & Engagement
- FR15: The system tracks daily cognitive load through a visual ring that fills as the learner studies, with heavier items (new kanji) costing more energy than light reviews (mature vocabulary). **[Amended in v2]** — Reframed as adaptive goal (see FR55–FR58; R1).
- FR16: The system communicates to the learner when they have done enough for the day based on their cognitive load threshold. **[Amended in v2]** — Goal framing; see FR55–FR58; R1.
- FR17: The cognitive load threshold adapts over time as the learner grows stronger. **[Amended in v2]** — See FR55–FR58; R1.
- FR18: Learners can maintain a daily streak, with the streak count visible in the app. **[Amended in v2]** — Streak removed from Home; days-studied-this-month in Stats (see FR59; R2).
- FR19: The system sends opt-in push notifications for daily review reminders and streak-at-risk alerts. **[Amended in v2]** — Streak-at-risk notifications dropped (see FR59; R2).
- FR20: Learners can configure notification timing and opt out of notifications entirely.

#### Onboarding & Customization
- FR21: Learners can select their starting JLPT level (N5 for beginners, or higher for existing learners) on first launch.
- FR22: Learners can import existing progress via WaniKani API, Bunpro import, or Anki deck upload during onboarding.
- FR23: Learners can mark individual kanji, vocabulary, or grammar items as "already known" (skip), "in progress" (add to SRS at appropriate interval), or "not started."
- FR24: Learners can bulk-mark items when importing existing knowledge (e.g., mark all N5 kanji as known).
- FR25: Learners can select session intensity preference (relaxed ~15 min or intense ~30 min daily sessions).
- FR26: Learners can begin using the app without creating an account or providing personal information.

#### Personal Content
- FR26b: Learners can write personal mnemonics for any kanji, vocabulary, or grammar item, stored locally on-device.
- FR27: Learners can view the pre-generated visual mnemonic images for radicals and text mnemonics for kanji, vocabulary, and grammar items.
- FR28: Learners can view their weakness detection statistics — per-item error history, confusion clusters, and pattern accuracy trends over time.

#### Weakness Detection Engine
- FR29: The system tracks per-user, per-item error statistics: correct count, incorrect count, and error type history (e.g., reading mistake vs meaning mistake for kanji, conjugation error type for grammar).
- FR30: Items are tagged with pattern labels (e.g., `grammar_tag: "te-form"`, `kanji_tag: "reading_confusion"`) to enable confusion cluster detection — identifying groups of items the learner consistently confuses.
- FR31: The review queue is biased by weakness: `priority = fsrs_score × 0.7 + weakness_score × 0.3`. Items the learner struggles with appear more frequently than pure FSRS scheduling would dictate.
- FR32: Weakness statistics are visible to the learner — they can see which patterns are weakest and track improvement over time (e.g., "te-form accuracy: 45% → 72% over 2 weeks").
- FR33: Confusion clusters are surfaced to the learner (e.g., "You often confuse て-form and た-form") to build awareness of specific weak areas.

#### Time Compression Display
- FR33b: After each review session, the system displays a summary showing items reviewed broken down by domain (kanji, grammar, vocabulary), total time spent, and an estimated equivalent time in a multi-app stack (e.g., "18 min → ~35–40 min across separate apps").
- FR33c: The time compression estimate is based on documented session patterns in separate tools (separate logins, separate review queues, no cross-domain mixing) and is conservative to maintain credibility.

#### Progress Import
- FR33d: Learners can import their WaniKani progress via the WaniKani API — items are mapped to internal curriculum items, and WaniKani SRS intervals are converted to FSRS state. Burned items remain burned, apprentice items enter at short intervals.
- FR33e: Learners can import their Bunpro grammar progress — grammar points are mapped to internal grammar items, and Bunpro SRS intervals are converted to FSRS state. Import method depends on Bunpro's available API/export functionality.
- FR33f: Learners can import Anki decks — the system parses standard Anki export formats and maps cards to internal curriculum items where a match exists, converting intervals to FSRS state.
- FR33g: Unmatched imported items (e.g., custom Anki cards not in the structured curriculum) are clearly flagged for the learner to handle manually.
- FR33h: The import process provides a clear summary of what was imported, what was mapped, and what remains unmatched before finalizing.

#### Shadow Mode (Post-MVP)
- FR33i-PM: Learners who import progress can enable shadow mode — reviews are scheduled normally, but the app explicitly positions itself as a parallel tool ("try before you commit") rather than a replacement.
- FR33j-PM: Post-session stats in shadow mode show retention rate, items covered across domains, and total time — providing data the user can compare with their existing tool experience.
- FR33k-PM: Shadow mode displays periodic prompts after 1–2 weeks of usage: "You've been comparing for X days — ready to switch fully?" without forcing a decision.

#### Administration & Content Pipeline
- FR34: The project creator generates and manages visual mnemonic images for radicals, uploading them to Cloudflare R2.
- FR35: The system automatically validates curriculum content against JSON schema rules via CI (GitHub Actions).
- FR36: The system automatically compiles JSON source data into an optimized SQLite database when changes are merged (GitHub Actions).
- FR37: The compiled SQLite database is versioned and stored in the repository via Git LFS.
- FR37b: Visual mnemonic image URLs are stored in the curriculum data and referenced by the app to load images from Cloudflare R2.

#### AI-Generated Reading Stories (Post-MVP)
- FR38-PM: Learners with an AI API key (BYO or obtained via OpenRouter) can generate reading stories that use their active kanji, vocabulary, and grammar — creating narrative reinforcement of current learning material.
- FR39-PM: The system supports multiple AI providers (OpenAI, Anthropic, OpenRouter) via stored API key, with appropriate error handling.
- FR40-PM: Learners can obtain an AI API key through two paths: (1) entering their own BYO key, or (2) being redirected to OpenRouter to purchase API credits.

#### Community Contribution (Post-MVP)
- FR41-PM: Contributors can propose edits to curriculum content (kanji descriptions, readings, grammar details, synonyms, example sentences) through an in-app flow.
- FR42-PM: The system creates a GitHub branch and pull request from the contributor's edits without requiring git knowledge.
- FR43-PM: Contributors can authenticate via GitHub OAuth when choosing to contribute (not required for general app usage).
- FR44-PM: Contributors can accumulate local edits and batch-submit them as a single contribution.
- FR45-PM: All contributed content is tagged with its origin (human-authored or AI-generated) so reviewers and users can distinguish provenance.

#### Data & Offline
- FR46: The app stores all curriculum data, user progress, and weakness detection statistics locally in SQLite on-device.
- FR47: The app functions fully offline after the initial content download. All SRS review, weakness detection, time compression display, and reading features work without network.
- FR48: The app checks for curriculum database updates on launch and downloads the updated database if a new version is available.
- FR49: Visual mnemonic images are cached locally after first load — subsequent views work offline.
- FR50: WaniKani and Bunpro import require a one-time network connection to access their respective APIs. After import, all data is local.
- FR51: The app receives over-the-air JavaScript bundle updates without requiring a new app store submission, enabling rapid bug fixes and non-native code changes.

#### Accessibility
- FR52: The app supports screen readers (TalkBack on Android, VoiceOver on iOS) for navigation, review sessions, and results.
- FR53: The app provides sufficient color contrast ratios for all UI elements including the cognitive load ring.
- FR54: The app supports scalable text for all learning content.

#### Home Screen & Goal Ring (v2)
- FR55: The daily ring is presented as an adaptive **goal** (not a capacity ceiling): it fills from both lessons and reviews, may **overshoot 100%**, and has **no maximum**.
- FR56: The daily goal recalculates on a **weekly** cadence as the average daily achievement over the prior week (dividing by active days only), subject to a minimum active-days sample before recalculating; otherwise the current goal carries forward.
- FR57: The goal **rises only** and is surfaced via a congratulatory prompt that also offers to change it; it **never auto-drops**. After 2–3 consecutive weeks of misses the system *offers* an opt-in reduction. The goal is user-configurable in Settings, unbounded.
- FR58: The Home screen is composed of **permanent sections with designed empty states** (header greeting with a fully-comprehensible sentence and day-1 fallback, goal ring, Learn CTA, Review CTA, one-week forecast with an inline "wall" annotation on heavy days, reading readiness) plus **conditional content** (at-risk/leech refresher, welcome-back triage, curriculum-update banner, shadow-mode prompt, import nudge). The user always chooses the mode; Home offers, it never auto-starts a session.
- FR59: An **at-risk / refresher** section surfaces when items are genuinely at risk, showing a count plus the top 5–10 items (worst-performing combined with closest-to-dropping-a-stage), a "do a small revision" CTA inline, and a full-list modal/page on tap. Framed as invitation ("ready for a refresher"), never as failure. (Note: also covers R2 streak removal / days-studied-this-month placement in Stats per v2 amendments.)
- FR60: A **reading-readiness meter** frames locked passages as a destination ("you're N items from unlocking this passage"), not a locked door.
- FR61: After an absence, **welcome-back triage** eases the user in ("20 of your 340 due") rather than dumping the full backlog.

#### Unified Browse & Search (v2)
- FR62: A single **unified discovery surface** replaces the separate Learn per-level screens and the Read tab: a flat, virtualized, paginated list where JLPT level is a filter attribute rather than a navigational container.
- FR63: **Passages are first-class rows** in this list alongside radicals/kanji/vocabulary/grammar (the list UNION-joins the `items` and `reading_passages` sources). The dedicated Read tab is removed.
- FR64: The list supports **faceted multi-select filters** (level, type, performance, SRS stage, lock) via drawers, with a **live result count on the Apply control** (disabled at zero) and **self-summarizing pills** that show active selections inline.
- FR65: A **search** input accepts input in whatever form it arrives (English, romaji, kana, kanji) using a fan-out query with parallel OR branches rather than guessing input type; romaji converts to kana in parallel without replacing the raw query. ~200ms debounce.
- FR66: Each passage carries a **bilingual (JA/EN) one-line summary** that search covers and the list row displays.
- FR67: In Browse, **kanji, vocabulary and grammar are always viewable** regardless of lesson eligibility. "Locked" applies to **passages only** (view permission), separate from lesson eligibility (which stays in the lesson planner).
- FR68: A passage **unlocks when ≥90%** of its linked vocabulary and grammar reach Guru or above (not all-or-nothing), so a single leech cannot hold a readable passage shut.
- FR69: Tapping a **locked passage** shows the specific vocabulary/grammar it still needs ("you need these 4 words and 1 grammar point") — a to-do list, not a dead end.
- FR70: In the passage reader, **long-pressing a word** opens its meaning/reading/details in place (word boundaries carrying the linked vocabulary `item_id` are authored in the content pipeline). Stored passage answers (`passage_practice_results`) are read back to drive completed state and to disable inputs on already-correct answers.

#### Item Details & Lesson (v2)
- FR71: **Lesson** pages use a three-section paged flow (1 Introduction → 2 Mnemonic → 3 Examples & links), advanced by Continue. The **details** page remains a single vertical scroll (sections may be collapsed behind disclosures). Lesson and details compositions are split so a section is authored once into the correct surface.
- FR72: Each content type shows **type-appropriate cross-references** rendered from existing dependency edges: radical→example kanji, kanji→vocabulary using it, vocabulary→component kanji (browsable, not collapsed to a single "prerequisites met" line), and grammar→vocabulary that uses the pattern.
- FR73: A shared **`SectionHeading` with an optional info affordance** lets headings carry an explainer (on'yomi/kun'yomi, radical, burned, transitive verb, …) as content, opened as a bottom sheet.
- FR74: An **on'yomi/kun'yomi primer** is shown unprompted to absolute beginners (gated on onboarding path + a `seenKanjiReadingPrimer` flag) as section-1 content on the first kanji that has both reading types, and is reachable thereafter via the heading info affordance.
- FR75: **Personal mnemonic** is one-per-item and rendered as content (not an always-open form): empty → a muted "add your own" line; saved → text with edit + delete icons (delete confirms); editing → input with Save disabled when empty.
- FR76: A passive, **non-blocking study-status banner** orients the viewer (locked → what's needed; prereqs-met-not-started → "you haven't studied this yet"; in-progress/known → nothing). Content stays fully visible in every state; the details page is **never** a lesson entry point.
- FR77: Curriculum **accepted answers** are surfaced behind a disclosure, resolving the naming collision with the user's own synonyms editor.
- FR78: **Furigana `auto`-hiding keys on the vocabulary item's mastery** (Guru+ or known), never inferred from component kanji.
- FR79: **Tap-to-toggle furigana stays stateless** (a peek/self-test). Persistent per-word show/hide **overrides live in Settings** with a reset; resolution order is Settings override → SRS default → global preference mode. Overrides are stored independently of `item_study_status` so tidying a reading view never alters the study schedule.
- FR80: A **comparison view** (sticky side-by-side glyphs, columnized short attributes, stacked prose, component chips with shared parts dimmed) is reachable from a details-page Compare picker and accepts **two preselected items** via route params.

#### Review Flow (v2)
- FR81: Kanji are prompted as **two cards — meaning and on'yomi reading — both required** before the kanji advances. The prompt **labels the reading type** ("Reading — on'yomi"). Kun'yomi is delivered through vocabulary pairing, not the kanji card.
- FR82: A **valid-but-wrong reading type** is a non-terminal `wrong_reading_type` state (no grade, no weakness signal, nudge and re-prompt) — mirroring `wrong_script`.
- FR83: The two cards resolve to a **single SRS state via worst-of-both**, applied once per item per session (no double FSRS update, no schema change).
- FR84: **Return advances** on a correct answer (Return to submit, Return again to continue); the 800ms auto-advance becomes an **opt-in setting, off by default**. Multiple-choice cards get a visible Continue button. The deferred-grade flush contract is preserved when the wait becomes indefinite.
- FR85: A trimmed **inline reveal panel (reading + meaning only)** shows on the correct path as well as the incorrect path (extracted into a shared `AnswerReveal`). Deeper detail is a deliberate trip to a details route **mounted under `review/`** so the session survives.
- FR86: The session **progress counter counts cards** (the unit of work experienced), not items, so it does not stall under the two-card model. On an answer-collision, the reveal adds one line ("what you answered belongs to a different item") and links to the comparison view (FR80) with both items preselected.

#### AI Conversation (v2)
- FR87: A new **AI Conversation tab** (replacing the removed Read slot; shell stays at five tabs) lets the learner converse with an LLM in Japanese, grounded in what they have learned. The tab is always visible; unconfigured, it opens a key-setup screen.
- FR88: The feature is **bring-your-own-key**. Provider transport is normalized by **two adapters** — OpenAI-compatible (with a user-editable base URL, covering OpenAI/OpenRouter/Hugging Face TGI plus local Ollama/LM Studio) and Anthropic. All calls return `Result<T, AppError>`. Key entry lives both in the tab (first run) and in Settings, extending the existing secure credential store.
- FR89: The **empty state is the start picker** (practise recent grammar / choose grammar / role-play / random), with a live recent-grammar suggestion sourced from study-status recency. Past conversations are a secondary surface reached from a top-corner entry point.
- FR90: **Chat is the default mode**; a mic button in the composer promotes to conversation mode mid-session (no up-front mode choice).
- FR91: The AI **replies in the curriculum's furigana bracket format**, rendered by the existing furigana component and obeying the vocabulary-keyed furigana model (FR78). If the format parse fails, the reply renders as **plain text with no flags/furigana** (no error).
- FR92: **Unknown words are flagged** (local lookup, zero token cost), not enforced. A flagged word that exists in the curriculum but is unstudied **deep-links to its details page** ("you'll learn this soon"); an off-curriculum word is display-and-translate only. Flagging also serves as the discoverability affordance for long-press.
- FR93: AI-encountered words **can never enter SRS directly** — every SRS row is keyed to a curriculum `item_id`; off-curriculum words are a display-only dead end by design.
- FR94: A **turn budget** (dynamic by level and completion; exact formula TBD — OA4) steers role-plays toward a natural ending and gives BYOK users a reasoned cost ceiling; it is a steer, not a hard cutoff.
- FR95: The AI **never corrects mid-conversation**; correction is deferred to an **end-of-session summary** (mistakes worth fixing ≤5, words you met split by curriculum membership, and whether/how often the practised grammar was used).
- FR96: The **summary is generated on demand and cached** (never regenerated). Sessions end three ways — AI-initiated (in-band wrap-up signal raises an end popup), user-initiated (always-present End button), or abandoned (closes silently, un-summarised but resumable).
- FR97: Control signals use **hidden in-band structured markers** the app catches and strips before rendering (no normalized tool-calling layer, which is unreliable across BYOK provider/model choices).
- FR98: **Conversation mode (push-to-talk)** is full-screen with chat history hidden: the AI's latest line (shown as readable text and spoken via on-device TTS) and the user's latest transcription, push-to-talk below.
- FR99: Push-to-talk transcription **lands in the composer for confirm/edit/retry before sending** (never straight onto the wire), so the chat log is exact and exiting conversation mode needs no reconciliation. On-device STT is default; **cloud STT is an explicit opt-in setting**, never an automatic fallback.
- FR100: On-device **TTS and STT** ship via the executorch integration (Supertonic Japanese TTS + Whisper Japanese STT). No interim system-TTS engine is adopted.

**Total FRs:** 100 numbered FR IDs (FR1–FR54 with lettered variants FR4b/5b/6b/6c/8b/8c/12b/26b/33b–33h; FR33i–33k-PM post-MVP; FR38–45-PM post-MVP; FR55–FR100 v2) — counting distinct FR labels including lettered/PM suffixes ≈ **118 labeled requirements**.

### Non-Functional Requirements

#### Performance
- NFR1: SRS review interactions (presenting an item, accepting input, displaying result) complete in under 100ms on mid-range devices. The review loop must feel instantaneous — show → type → result → next with zero perceptible lag.
- NFR2: SQLite query response time for standard operations (fetching review queue, loading item details, updating SRS state, weakness score calculation) stays under 100ms on mid-range devices.
- NFR3: App cold start to first interactive screen completes within 3 seconds on mid-range devices. Tapping "Review" launches the first item with no intermediate screens.
- NFR4: Curriculum database update download completes within 30 seconds on a standard mobile connection for incremental updates.
- NFR5: WanaKana romaji-to-hiragana conversion renders in real-time during keystroke input with no visible delay.
- NFR5b: No UI animations are permitted within the review loop (between items). Animations are allowed only for non-blocking UI (cognitive load ring fill, streak counter) and never delay the next review item.

#### Security
- NFR6: WaniKani and Bunpro API keys used for import are stored using platform-appropriate secure storage (Keychain on iOS, Android Keystore on Android) during the import process and can be discarded after import completes.
- NFR7: Import API calls transmit only the respective API key to WaniKani/Bunpro endpoints over HTTPS. No user learning data from this app is sent externally.
- NFR8: No user learning data, progress, weakness statistics, or personal information is transmitted off-device. All learning state remains local to the device.
- NFR9: Anki deck import processes files locally on-device. No imported data is transmitted to any external service.

#### Data Integrity & Reliability
- NFR10: User progress data (SRS state, streaks, cognitive load history, personal mnemonics) survives app updates, OS updates, and curriculum database updates without data loss.
- NFR11: The JSON-to-SQLite compilation pipeline validates schema integrity on every build. A compilation failure blocks the database update from being published.
- NFR12: If a curriculum database download is interrupted, the app continues operating with the existing database version. Partial downloads are discarded, not applied.
- NFR13: Streak tracking persists accurately across timezone changes, device restarts, and offline periods.

#### Accessibility
- NFR14: The app meets WCAG 2.1 Level AA contrast ratio requirements (minimum 4.5:1 for normal text, 3:1 for large text) across all screens.
- NFR15: All interactive elements are navigable and operable via screen reader (TalkBack/VoiceOver) with meaningful labels.
- NFR16: Text content scales to 200% of default size without loss of content or functionality.
- NFR17: Input-based testing is operable via accessibility keyboards and input methods without requiring gesture-based interaction.

#### Integration
- NFR18: WaniKani and Bunpro API integration handles rate limiting, invalid keys, and API changes gracefully with clear error messages and no app crashes. If either API is unreachable, the app offers manual item marking as a fallback.
- NFR19: Anki deck import handles malformed files, unsupported formats, and partial matches gracefully — clearly communicating what was imported, what failed, and why.
- NFR20: Cloudflare R2 image loading handles unavailability gracefully — cached images display from local storage; missing images show a text-based fallback mnemonic rather than a broken image state.

#### Content Scalability
- NFR21: The SQLite database structure supports content growth from N5-only (MVP seed) to full N5–N1 coverage without requiring schema changes or app updates.
- NFR22: Database query performance remains within the <100ms target as content scales from initial seed (~500 items) to full curriculum (~10,000+ items across all JLPT levels).

#### v2 NFRs
- NFR23: The AI Conversation feature raises the platform floor to **iOS 17 / Android 13 (API 33)** with New Architecture (executorch requirement). Accepted as a whole-app launch constraint — v1 minimums (Android 10 / iOS 15) are retired.
- NFR24: AI Conversation requires network at runtime and is exempt from the offline-first guarantee; all other features remain fully offline. The BYOK key is stored in platform-appropriate secure storage and only ever transmitted to the user-configured provider endpoint over HTTPS; no learning data is sent to any endpoint the user did not configure.
- NFR25: On-device model downloads (Whisper `small` ≈ 485 MB iOS / ≈ 1.1 GB Android; the Supertonic model) are one-time, explicit, user-initiated downloads with clear size disclosure; the app is fully usable (chat excluded from voice) before they complete.
- NFR26: BYOK cost is bounded and legible — the turn budget and on-demand summaries keep per-session token cost predictable; usage accounting from each adapter surfaces cost to the user.
- NFR27: Streaming AI responses use `expo/fetch` SSE; partial/failed streams degrade gracefully without crashing or corrupting the persisted transcript.
- NFR28: New `user.db` tables (AI sessions/messages; furigana overrides) are introduced via numbered migrations (`015_furigana_overrides`, then `016+` for AI) preserving the v1 data-integrity guarantee (NFR10).
- NFR29: The first `onLongPress` interactions in the app (passage reader FR70, AI unknown-word FR92) require a **non-gesture alternative** to satisfy the CI-enforced a11y rules.
- NFR30: The pinned executorch **nightly** dependency has no semver/release-note guarantee; upgrades are manual and must be re-verified. Documented as an accepted maintenance cost.

**Total NFRs:** 31 labeled requirements (NFR1–NFR22 including NFR5b; NFR23–NFR30).

### Additional Requirements

- **v2 Bug Batch (stories, not FRs):** BUG1–BUG7 (Home metrics refresh, goal ring lesson-only, kanji reading type flattening, progress counter stall, passage_practice_results unused, furigana auto-hide keying, browse dependency-graph locking).
- **v2 Open Items:** OA1 goal-ring KPI · OA2 study-days KPI · OA3 platform-floor sign-off · OA4 turn-budget formula · OA5 role-play scenario library · OA6 furigana parse-failure behaviour · OA7 long-press a11y.
- **v2 Reversals (R1–R4):** Cognitive-load ceiling → goal ring; streak removed; Read tab removed; review two-card/Return-to-advance.
- **Constraints:** Offline-first (except AI Conversation BYOK); no accounts/subscriptions; dual SQLite (curriculum read-only, user mutable); Expo RN Android & iOS; content parity with WaniKani/Bunpro as quality gate.
- **Post-MVP deferred:** Shadow mode (FR33i–k-PM), AI reading stories (FR38–40-PM), community contribution (FR41–45-PM), Phase 2/3 expansions.

### PRD Completeness Assessment

PRD is comprehensive and revision-aware (v1 + v2 with explicit amendments, reversals, and open items). FR/NFR numbering is dense with lettered and `-PM` suffixes. Open items OA1–OA7 and turn-budget formula (OA4) remain unresolved for implementation. Platform floor change (NFR23) and offline exemption for AI (NFR24) are documented tensions. Bug batch correctly scoped as stories. Overall: strong completeness for coverage validation; open decisions must be tracked through epic/story readiness.

## Epic Coverage Validation

### Epic FR Coverage Extracted

| FR IDs | Epic / Status |
| --- | --- |
| FR5, FR9, FR11, FR14, FR81–FR86 | Epic 1 — Kanji Review Clarity |
| FR20, FR33b–FR33c, FR55–FR61; days-studied (ex-FR18/FR19) | Epic 2 — Goal-Driven Daily Home |
| FR8b–FR8c, FR62–FR70 | Epic 3 — Unified Browse & Passages |
| FR26b, FR27, FR71–FR80 | Epic 4 — Clear Lessons & Honest Details |
| FR87–FR100 | Epic 5 — AI Conversation Practice |
| FR33i-PM–FR33k-PM, FR38-PM–FR45-PM | Deferred (Post-MVP) — intentional |
| FR1–FR4b, FR5b–FR8, FR10, FR12–FR13, FR21–FR33h, FR34–FR54, FR46–FR51 | Shipped baseline (v1) — no new stories unless gap/regression |

**Total FRs claimed in epics coverage map:** All PRD FR labels accounted as Epic 1–5, Deferred, or Shipped baseline.

### Coverage Matrix

Status legend: ✓ Covered (v2 epic story) · ✓ Baseline (shipped, no new story) · ⏸ Deferred post-MVP · ⚠ Gap / ambiguous

| FR | Short description | Epic Coverage | Status |
| --- | --- | --- | --- |
| FR1–FR4b | JLPT kanji/vocab/grammar/radicals + visual mnemonics | Shipped baseline | ✓ Baseline |
| FR5 | Specific reading-type validation | Epic 1 | ✓ Covered |
| FR5b–FR8 | Burn stages, grammar schema/parser/examples, vocab context, reinforcement query | Shipped baseline | ✓ Baseline |
| FR8b–FR8c | Passages via Browse (amended) | Epic 3 | ✓ Covered |
| FR9, FR11 | Review loop + unified session (amended) | Epic 1 | ✓ Covered |
| FR10 | FSRS scheduling | Shipped baseline | ✓ Baseline |
| FR12 | Visible cross-domain reinforcement | Shipped baseline | ✓ Baseline |
| FR12b | Micro-adjustments to related items on review | **Not listed in FR Coverage Map** | ⚠ Ambiguous |
| FR13 | WanaKana | Shipped baseline | ✓ Baseline |
| FR14 | Typo / wrong_reading_type paths | Epic 1 | ✓ Covered |
| FR15–FR17 | Cognitive load → goal ring (amended) | Epic 2 via FR55–FR58 | ✓ Covered |
| FR18–FR19 | Streak removed; days-studied in Stats (amended) | Epic 2 (UX-DR20 / Story 2.2) | ✓ Covered* |
| FR20 | Notification config (streak-at-risk removed) | Epic 2 | ✓ Covered |
| FR21–FR26 | Onboarding / no account | Shipped baseline | ✓ Baseline |
| FR26b, FR27 | Personal + view mnemonics | Epic 4 | ✓ Covered |
| FR28–FR33 | Weakness engine + visibility | Shipped baseline | ✓ Baseline |
| FR33b–FR33c | Time compression | Epic 2 | ✓ Covered |
| FR33d–FR33h | WK/Bunpro/Anki import | Shipped baseline | ✓ Baseline |
| FR33i–k-PM | Shadow mode | Deferred | ⏸ Deferred |
| FR34–FR37b | Admin / CI / LFS / R2 URLs | Shipped baseline | ✓ Baseline |
| FR38–45-PM | AI stories / community PRs | Deferred | ⏸ Deferred |
| FR46–FR51 | Local SQLite, offline, OTA curriculum/JS | Shipped baseline | ✓ Baseline |
| FR52–FR54 | A11y screen reader / contrast / scale | Shipped baseline | ✓ Baseline |
| FR55–FR61 | Goal ring + Home triage | Epic 2 | ✓ Covered |
| FR62–FR70 | Unified Browse & passages | Epic 3 | ✓ Covered |
| FR71–FR80 | Lesson/details/furigana/compare | Epic 4 | ✓ Covered |
| FR81–FR86 | Two-card review flow | Epic 1 | ✓ Covered |
| FR87–FR100 | AI Conversation | Epic 5 | ✓ Covered |

\*PRD amendment text points “days studied” at FR59, but FR59’s body is the at-risk refresher. Days-studied has no dedicated v2 FR ID; Epic 2 still implements it via Story 2.2 / UX-DR20.

### Missing Requirements

#### Critical Missing FRs

None for MVP-scoped v2 delta. All FR55–FR100 and amended v1 FRs map to Epics 1–5.

#### High Priority / Ambiguous

**FR12b** — Micro-adjustments to related items when one is reviewed (boost scheduling priority of associated vocab/grammar).
- Present in PRD and epics Requirements Inventory
- **Absent** from FR Coverage Map (neither Epic nor explicit “shipped baseline” bullet — baseline lists `FR12–FR13` without FR12b)
- Impact: If not already implemented in shipped app, no story owns verifying/fixing this behavior
- Recommendation: Confirm brownfield status; if missing or incomplete, add AC to Epic 1 (queue/reinforcement) or a small baseline-gap story

#### Documentation inconsistencies (not missing coverage)

1. **Days-studied FR ID:** Amendment cites FR59 for streak→days-studied; FR59 definition is at-risk refresher. Treat days-studied as Epic 2 story work without a clean FR ID.
2. **Shipped baseline range `FR34–FR54`:** Includes post-MVP FR38–45-PM IDs which are also listed under Deferred — map intends pipeline/a11y/offline FRs shipped; PM suite correctly deferred. Wording is slightly overlapping but intent is clear.

### Coverage Statistics

| Metric | Count |
| --- | --- |
| Total distinct PRD FR labels (incl. lettered + PM) | ~118 |
| FRs in Epics 1–5 (v2 implementation) | ~62 (FR5/9/11/14/8b–c/20/26b/27/33b–c/55–100) |
| FRs deferred post-MVP | 11 (FR33i–k-PM + FR38–45-PM) |
| FRs claimed shipped baseline | ~45+ (v1 retained) |
| Explicit coverage gaps | 1 ambiguous (FR12b) |
| MVP / v2 coverage (excl. deferred + FR12b) | **~99%** |
| Overall including deferred as intentional | **~99%** (FR12b only open question) |

### Coverage Assessment

Epics document is deliberately **v2 delta-first** with a clear shipped-baseline carve-out for unchanged v1 FRs. Traceability from PRD → FR Coverage Map → Epic stories is strong for the July 2026 UX upgrade and AI Conversation scope. Only FR12b lacks an explicit map entry; post-MVP items are correctly parked.

## UX Alignment Assessment

### UX Document Status

**Found.** Primary: `ux-design-specification.md` (v2, status final, updated 2026-07-20). Companion: `ux-design-directions.html` (visual directions A/C-v2/D/E/F/G/H). Epics inventoriize UX-DR1–UX-DR34 mapped into stories.

### UX ↔ PRD Alignment

**Strong alignment.** UX spine rule states PRD v2 wins on IA/behavior when directions conflict. Confirmed shared commitments:

| Theme | PRD | UX Spec |
| --- | --- | --- |
| Goal ring (not capacity ceiling) | FR55–FR57, R1 | GoalRing rename, overshoot, non-restrictive |
| Streak removal | FR18/19 amended, R2 | No Home streak; days-studied on Stats |
| Unified Browse; no Read tab | FR62–FR70, R3 | Browse/Search; passages as rows |
| Two-card review + Return-advance | FR81–FR86, R4 | Direction A compact; AnswerReveal; card progress |
| AI Conversation tab | FR87–FR100 | Start picker, BYOK, deferred correction, PTT |
| Platform floor | NFR23 | iOS 17 / Android 13 |
| Offline exemption | NFR24 | Clear “requires internet” for Conversation |
| Long-press a11y | NFR29 | Non-gesture alternative required |

Personas (Yuki/Kenji/Mika) and journeys match PRD. No material UX requirements found that contradict PRD FRs for MVP scope.

### UX ↔ Architecture Alignment

**Strong alignment.** Architecture explicitly encodes UX IA and components:

- Tab shell: Home · Browse · AI Conversation · Stats · Settings (Read removed)
- Goal-ring semantics + lesson `addDailyLoad` (BUG2)
- Browse UNION + virtualization / filter indexes for NFR22
- Furigana overrides migration `015`; AI tables `016+`
- BYOK adapters, in-band markers, executorch voice, New Architecture
- Review: worst-of-both, `wrong_reading_type`, details under `review/`
- Performance: <100ms review / query targets retained

Architecture lists the same custom component set family as UX (GoalRing, AnswerReveal, BrowseList, ConversationComposer, FuriganaText, CompareView, etc.).

### Alignment Issues

1. **Tab label naming:** Architecture sometimes says “Browse/Learn”; UX/Epics prefer **Browse** with temporary `learn/*` redirects. Low risk if stories use Browse as canonical.
2. **Directions HTML vs UX/PRD:** Accepted by design — PRD wins on IA; directions own density/tokens. Implementers must not treat HTML mockups as IA source of truth.
3. **Days-studied FR ID mismatch** (same as coverage step): UX/Epics correctly place calm monthly activity on Stats; PRD amendment text mis-points at FR59.

### Warnings

- **OA4 / OA5 / OA7** remain open across PRD, UX, Architecture, and Epics (placeholders OK in Epic 5 / a11y stories) — not blockers if stories keep explicit stubs.
- **Offline-first narrative tension** with always-visible Conversation tab is documented and accepted; UX empty/error states (UX-DR22) must ship with Epic 5 or users will perceive regression.
- **executorch nightly (NFR30)** is an accepted maintenance cost; UX model-download disclosure (UX-DR23) depends on Architecture download story — couple Story 5.2 tightly to size disclosure copy.
- No missing UX documentation warning — UX is present and v2-complete for a user-facing mobile app.

### UX Alignment Verdict

Ready for implementation from a UX↔PRD↔Architecture coherence standpoint. Residual issues are naming/open-item hygiene, not structural misalignment.

## Epic Quality Review

Validated against create-epics-and-stories best practices (user value, independence, dependencies, sizing, ACs, brownfield/migration timing).

### Epic Structure Validation

| Epic | User-value title? | Standalone user outcome? | Verdict |
| --- | --- | --- | --- |
| 1 Kanji Review Clarity | Yes — prove meaning/on'yomi clearly | Yes — review works better alone | ✓ Pass |
| 2 Goal-Driven Daily Home | Yes — adaptive daily goal + triage | Mostly — Home usable alone | ⚠ Soft dep on Epic 3 for FR60 unlock semantics |
| 3 Unified Browse & Passages | Yes — find anything in one list | Yes — placeholder Talk tab OK until Epic 5 | ✓ Pass |
| 4 Clear Lessons & Honest Details | Yes — guided lesson vs honest details | Yes — builds on existing lesson/details | ✓ Pass |
| 5 AI Conversation Practice | Yes — practise Japanese via BYOK chat/voice | Requires Epic 3 tab shell; uses Epic 4 FuriganaText (order 1→5 OK) | ✓ Pass (ordered) |

**No technical-milestone epics** (no “setup DB / API / infra” epics). Platform floor + New Architecture correctly live inside Story 5.1 as enabling ACs for Conversation, not a fake Epic 0.

**Brownfield:** Starter-template story correctly omitted (Architecture: retain Expo 55). Integration via existing dual-DB, tabs, review session — documented.

### Story Inventory & Sizing

| Story | User value | Size | Notes |
| --- | --- | --- | --- |
| 1.1 Two-Card Kanji Grading | High | Large vertical slice | Appropriate |
| 1.2 Review Pacing, Reveal & Card Progress | High | Large | Compare stub → Epic 4 |
| 2.1 Adaptive Goal Ring | High | Large | Includes BUG1/BUG2 |
| 2.2 Home Triage, Post-Session & Days Studied | High | **Very large** | Many FR58–61 + post-session + Stats |
| 3.1 Unified Browse List, Search & Filters | High | Large | Placeholder Conversation tab |
| 3.2 Passage Unlock, Reader & Practice | High | Large | Pipeline + a11y |
| 4.1 Lesson/Details Split, Cross-Refs & Primer | High | Large | Cohesive |
| 4.2 Furigana, Overrides & Compare | High | Large | Migration 015 when needed |
| 5.1 Platform Floor, BYOK Chat & Summary | High | **Very large** | Platform + adapters + chat + summary + migrations |
| 5.2 PTT Voice TTS/STT | High | Large | Naturally follows 5.1 |

Sizing preference “2–3 larger stories per epic” was approved — structure matches. Risk is reviewability of 2.2 and 5.1, not wrong epic shape.

### Acceptance Criteria Quality

- All stories use **Given / When / Then / And** BDD form
- ACs are generally **specific and testable** (e.g. worst-of-both, ≥90% Guru+, Return twice, card progress)
- Error/edge paths covered where critical (`wrong_reading_type`, offline Conversation, model-missing, abandon session, empty Browse)
- Open items OA4/OA5 explicitly allowed as placeholders inside Epic 5 ACs — acceptable if constants stay named

### Dependency Analysis

#### Within-epic

| Epic | Order | Forward deps? |
| --- | --- | --- |
| 1 | 1.1 → 1.2 | None (1.2 builds on 1.1) |
| 2 | 2.1 → 2.2 | None |
| 3 | 3.1 → 3.2 | None |
| 4 | 4.1 → 4.2 | None |
| 5 | 5.1 → 5.2 | None (voice promotes from chat) |

#### Cross-epic

| Dependency | Severity | Assessment |
| --- | --- | --- |
| 1.2 Compare deep-link stubs until 4.2 | Minor | Explicit stub — OK |
| 3.1 Conversation placeholder until 5.1 | Minor | Explicit placeholder — OK |
| 2.2 reading-readiness (FR60) vs 3.2 ≥90% unlock (FR68) | Major | Epic 2 can ship with old lock math; readiness copy may be wrong until Epic 3 |
| 5.1 assumes tab shell after Epic 3 | Expected | Epic N→N+k OK in stated order |
| 5.1 uses FuriganaText from Epic 4 | Expected | Order 4 before 5 required |

#### Database / migrations timing

- Goal-ring fields: Story 2.1 ✓ when first needed
- `015_furigana_overrides`: Story 4.2 ✓
- `016+` AI tables: Story 5.1 ✓
- No “create all tables in Epic 1” violation ✓

### Best Practices Compliance Checklist

| Check | E1 | E2 | E3 | E4 | E5 |
| --- | --- | --- | --- | --- | --- |
| User value | ✓ | ✓ | ✓ | ✓ | ✓ |
| Independence | ✓ | ⚠ | ✓ | ✓ | ✓* |
| Stories sized | ✓ | ⚠ large | ✓ | ✓ | ⚠ large |
| No forward deps | ⚠ stub | ⚠ FR60 | ✓ placeholder | ✓ | ✓ |
| DB when needed | n/a | ✓ | pipeline | ✓ | ✓ |
| Clear ACs | ✓ | ✓ | ✓ | ✓ | ✓ |
| FR traceability | ✓ | ✓ | ✓ | ✓ | ✓ |

\*Independence holds if implementation order Epic 1→5 is respected.

### Quality Findings by Severity

#### Critical Violations

None. No pure technical epics; no hard forward dependency that makes an earlier epic non-shippable.

#### Major Issues

1. **Epic 2 reading-readiness vs Epic 3 unlock rule** — FR60 ships in 2.2; FR68 unlock (≥90% Guru+) ships in 3.2. Recommendation: either (a) move readiness meter ACs to Story 3.2, or (b) add AC in 2.2 that readiness uses the **same** unlock query Epic 3 will own (extract shared helper early), or (c) document that 2.2 uses interim lock until 3.2 and accept temporary inconsistency.

2. **Story 2.2 and Story 5.1 scope concentration** — Each packs many FRs/NFRs. Recommendation: keep as-is only if a single implementer can finish a vertical slice in one cycle; otherwise split 2.2 into “Home shell + triage” vs “post-session + Stats days-studied”, and 5.1 into “platform + BYOK chat” vs “summary + past threads + offline empty state”.

#### Minor Concerns

1. **Story 1.2 → Epic 4 Compare stub** — Document stub contract in Architecture or story notes so FR86 collision isn’t forgotten.
2. **OA4 / OA5 placeholders** in 5.1 — Fine; keep named pure functions so formula swap doesn’t rewrite UI.
3. **FR12b** still unowned (see coverage step).
4. **Epic 5.1 mixes platform enablement with product UX** — Acceptable for brownfield; ensure CI/dev-client rebuild is called out in sprint planning so “chat UI” isn’t blocked silently.

### Remediation Summary

| # | Issue | Action |
| --- | --- | --- |
| M1 | FR60 / FR68 epic split | Align unlock query ownership before implementing 2.2 |
| M2 | Oversized 2.2 / 5.1 | Optional story split if cycle capacity is constrained |
| m1 | Compare stub | Keep route/params contract; verify in 4.2 AC |
| m2 | FR12b | Confirm shipped or add baseline-gap AC |
| m3 | OA4/OA5 | Ship stubs; track OA close in decision log |

### Epic Quality Verdict

**Implementation-ready with conditions.** Epic shape and user-value focus are strong; brownfield and migration timing are correct. Address M1 (readiness/unlock ownership) before or during Epic 2 implementation; treat M2 as capacity risk, not a structural failure.

## Summary and Recommendations

### Overall Readiness Status

**READY** (with conditions)

PRD, UX, Architecture, and Epics are present, v2-aligned, and mutually coherent for brownfield implementation of the July 2026 UX upgrade + AI Conversation delta. No critical structural blockers. Conditions below should be resolved or consciously accepted before / during early sprint work.

### Critical Issues Requiring Immediate Action

None that block starting Epic 1.

**Must-not-ignore before Epic 2 ships:**

1. **FR60 / FR68 ownership** — Reading-readiness (Epic 2) vs ≥90% passage unlock (Epic 3) can diverge if implemented independently. Align unlock query ownership first.
2. **FR12b coverage gap** — Micro-adjustments on related-item review are in the PRD inventory but not in the FR Coverage Map. Confirm shipped or add a story AC.
3. **Days-studied FR ID hygiene** — PRD amendment points at FR59 incorrectly; Epic 2 still implements the behavior — fix the PRD cross-ref when convenient to avoid story confusion.

### Issue Count by Category

| Category | Count | Severity peak |
| --- | --- | --- |
| FR coverage gaps / ambiguities | 1 (FR12b) + 1 ID hygiene | High / Low |
| UX ↔ PRD ↔ Architecture misalignment | 0 structural; 2 naming/open-item notes | Minor |
| Epic quality — major | 2 (FR60/68 split; oversized 2.2 & 5.1) | Major |
| Epic quality — minor | 3 (Compare stub, OA placeholders, platform-in-5.1) | Minor |
| Deferred post-MVP (intentional) | 11 FR labels | N/A |
| Open items OA1–OA7 | Tracked; OA4/OA5 non-blocking in stories | Non-blocking |

**Total actionable issues requiring attention:** ~7 (0 critical blockers, 2 major, ~5 minor/hygiene).

### Recommended Next Steps

1. **Resolve M1 (unlock/readiness)** — Extract or assign a single passage-unlock helper before Story 2.2; prefer shared query owned by Browse/Epic 3 with Home consuming it.
2. **Confirm FR12b** — Grep brownfield for related-item micro-adjustments; if absent, add a small AC under Epic 1 queue work or a baseline-gap note.
3. **Start implementation in Architecture order** — Epic 1 → 2 → 3 → 4 → 5 (platform floor / New Arch opens with 5.1).
4. **Optionally split Stories 2.2 and 5.1** if a single cycle cannot absorb their AC surface.
5. **Keep OA4/OA5/OA7** as named stubs; close via decision log without blocking MVP stories.
6. **Use this report** at sprint kickoff; treat `_bmad-output/` as planning reference, not live backlog (per project CLAUDE.md).

### Final Note

This assessment identified **~7 actionable issues** across coverage, quality, and hygiene categories, plus intentional post-MVP deferrals. **No critical planning failures** prevent Phase 4 / story implementation. Address the FR60/FR68 ownership condition before Home triage ships; otherwise proceed Epic 1–first as planned.

**Assessor:** Implementation Readiness workflow (BMad) · **Date:** 2026-07-20 · **Project:** japanese-learning
