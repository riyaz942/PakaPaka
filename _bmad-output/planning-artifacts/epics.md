---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
workflowStatus: complete
completedAt: '2026-05-03'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# japanese-learning - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for japanese-learning, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

#### Learning Content & Progression

- FR1: Learners can study kanji organized by JLPT level (N5→N1) with parallel progression within each level.
- FR2: Learners can study vocabulary organized by JLPT level (N5→N1) with parallel progression within each level.
- FR3: Learners can study grammar points organized by JLPT level (N5→N1) with input-based testing, including verb conjugation practice integrated into grammar reviews.
- FR4: Learners can study radicals as building blocks for kanji, with a strict dependency graph: radicals must be learned before their associated kanji, kanji before associated vocabulary. The dependency graph (`radical_id → kanji_id → vocab_id`) is precomputed and stored in SQLite.
- FR4b: Each radical displays an AI-generated visual mnemonic image that creates a memorable association with the radical's meaning. Images are pre-generated and served from Cloudflare R2.
- FR5: Each kanji and vocabulary item supports multiple accepted answers — a primary meaning plus accepted synonyms stored in a dedicated table. Onyomi and kunyomi readings are tracked separately for kanji.
- FR5b: Items progress through SRS stages including a burn/mastered stage where review intervals become very long, equivalent to WaniKani's burn system.
- FR6: Grammar points use a structured schema: structure pattern, accepted forms, and conjugation rules — not free-text explanations only.
- FR6b: Grammar answer validation uses parser-based, conjugation-aware checking that understands verb forms (e.g., distinguishes て-form from た-form errors) rather than relying solely on Levenshtein string distance.
- FR6c: Each grammar point includes a minimum of 5–10 example sentences that use vocabulary the learner has already studied where possible.
- FR7: Vocabulary items include contextual meanings (usage in context, not just dictionary definitions) and example sentences tied to grammar points.
- FR8: The system presents grammar examples that prioritize vocabulary the learner has already studied, queried as `SELECT sentence WHERE vocab IN user_known_vocab ORDER BY reinforcement_score DESC`.
- FR8b: Learners can read pre-seeded passages (creator-authored) tagged by JLPT level, with comprehension questions that validate understanding.
- FR8c: Reading passages use vocabulary and grammar from the learner's current/completed JLPT level.

#### SRS Engine & Review

- FR9: Learners can prove knowledge through input-based testing — typing answers rather than self-grading. The review loop is keyboard-first: show → type → result → next, with no menus or animations between items.
- FR10: The system schedules reviews using FSRS (Free Spaced Repetition Scheduler) for research-backed optimal intervals.
- FR11: The system provides a unified review session that interleaves kanji, vocabulary, and grammar items intelligently. Sessions start immediately upon tapping "Review" — no intermediate screens.
- FR12: The system maintains a static relationship layer that maps connections between content types (kanji↔vocabulary, kanji↔radicals, grammar↔vocabulary). When a grammar example uses kanji or vocabulary the learner studied recently, it is highlighted explicitly in the UI (e.g., "食べる ← you learned this yesterday"). Reinforcement is visible, not invisible.
- FR12b: The system applies micro-adjustments to related items when one is reviewed (e.g., reviewing a kanji boosts scheduling priority of its associated vocabulary and grammar).
- FR13: Learners can input Japanese text via embedded romaji-to-hiragana conversion (WanaKana) without relying on the OS keyboard.
- FR14: The system detects typos using Levenshtein distance for meaning answers (accepting with warning for minor typos, rejecting with "close!" hint for near-misses) and parser-based conjugation-aware validation for grammar answers.

#### Cognitive Load & Engagement

- FR15: The system tracks daily cognitive load through a visual ring that fills as the learner studies, with heavier items (new kanji) costing more energy than light reviews (mature vocabulary).
- FR16: The system communicates to the learner when they have done enough for the day based on their cognitive load threshold.
- FR17: The cognitive load threshold adapts over time as the learner grows stronger.
- FR18: Learners can maintain a daily streak, with the streak count visible in the app.
- FR19: The system sends opt-in push notifications for daily review reminders and streak-at-risk alerts.
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

### NonFunctional Requirements

#### Performance

- NFR1: SRS review interactions (presenting an item, accepting input, displaying result) complete in under 100ms on mid-range devices. The review loop must feel instantaneous — show → type → result → next with zero perceptible lag. This is non-negotiable for a "serious tool" UX.
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

### Additional Requirements

**Epic 1 / first implementation (Architecture):** Initialize the mobile codebase with `npx create-expo-app@latest japanese-learning --template default@sdk-55` (Expo SDK 55 default template: Expo Router v4, TypeScript strict, React 19.2 / RN 0.83, Native Tabs, `/src` layout). Then add NativeWind v4+, `tailwind.config.js`, and core dependencies per architecture table (`expo-sqlite`, `ts-fsrs`, `wanakana`, `expo-secure-store`, `expo-file-system`, `expo-haptics`, `expo-notifications`, `expo-updates`, `expo-screen-orientation`, `expo-image`).

- **Dual SQLite databases:** `curriculum.db` (read-only, replaceable on update) and `user.db` (read-write, never replaced); use `ATTACH DATABASE` for cross-db joins when needed; curriculum vs user progress must never be conflated on update.
- **SQLite library:** Default `expo-sqlite`; benchmark queue build; fallback to `op-sqlite` if <100ms target is violated.
- **Queue build budget:** FSRS + weakness biasing + interleaving must complete within performance budget; pre-fetch next 3–5 items in the review loop; no blocking work between items.
- **Layer boundaries:** `core/` must not import from `data/` or UI; use Result-type error handling and transactional SQLite writes; batch bulk updates to avoid write-lock issues.
- **Routing structure:** Expo Router under `src/app/` — `(tabs)` for Home/Learn/Read/Stats/Settings; `review/` modal stack (session + summary); `onboarding/` linear flow; drill-down under `learn/`.
- **CI/CD:** `.github/workflows/ci.yml` (lint, typecheck, test); `compile-curriculum.yml` for JSON → SQLite; curriculum seed bundled at `assets/curriculum-seed/curriculum.db`; `curriculum/` JSON + `scripts/compile-curriculum.ts` + schema validation.
- **Git LFS:** Version compiled curriculum SQLite in-repo per architecture.
- **WaniKani API:** v2 integration with rate-limit handling (~60 req/min), mapping table `subject_id` → internal `item_id`, FSRS state conversion.
- **Bunpro / Anki:** Shared mapping + SRS conversion abstraction; documented fallback to manual marking if Bunpro API/export unavailable; Anki `.apkg` local parse only.
- **Grammar validation:** Rule-based conjugation parser for common patterns with Levenshtein fallback where parser does not apply.
- **Cross-platform parity:** Android and iOS feature parity; EAS Build/Submit; Expo Updates for OTA JS.
- **Testing:** Jest for core logic; React Native Testing Library for components (per architecture).
- **Dependency graph:** Precomputed adjacency in `curriculum.db` for fast unlock and reinforcement queries.

### UX Design Requirements

- UX-DR1: Configure **NativeWind v4+** with Expo; add `global.css` with Tailwind directives; ensure compile-time styles align with `<100ms` review path (no runtime style thrash in hot path).
- UX-DR2: Implement **`tailwind.config.js`** as single source of truth for tokens: dark-first palette (`background`, `surface`, `surface-elevated`, `text-primary` / `secondary` / `muted`, `border`), light theme secondary set, SRS stage colors (`srs-apprentice` … `srs-burned`), feedback colors (`feedback-correct` / `incorrect` / `warning` / `info`), cognitive load ring gradient stops, content-type accents (`content-radical` … `content-reading`), reinforcement tokens (`reinforcement-text`, `reinforcement-bg`).
- UX-DR3: Implement **typography tokens** (`display`, `title-lg`, `title`, `body-lg`, `body`, `body-sm`, `caption`, `overline`) and **spacing** (`space-xs` … `space-2xl`) and **radius** (`radius-sm` … `radius-full`) per UX spec.
- UX-DR4: Build **`CognitiveLoadRing`** (SVG arc, large ~120–180px responsive / small ~32px header), states empty/filling/full/idle, color gradient green→yellow→orange→cyan complete, **numeric percent always paired** with ring (not color-only), `accessibilityRole="progressbar"` + `accessibilityValue`.
- UX-DR5: Build **`ReviewCard`** with states `prompting` | `evaluating` | `correct` | `incorrect` | `typo`; variants for kanji / vocabulary / grammar (cloze + hint affordance); full a11y labels for prompt and result.
- UX-DR6: Build **`WanaKanaInput`** — full-width, real-time romaji→kana, placeholder "type in romaji...", focus management for submit/re-prompt loop; a11y announces converted kana on submit.
- UX-DR7: Build **`ProgressiveHint`** — pill "Hint" control, stacked levels (conjugation scope → lesson tie-in → full cross-domain reinforcement), button shows "Hint N of M", exhausted disabled state; **hint usage feeds weakness analytics** per UX; screen reader announces each new hint panel.
- UX-DR8: Build **`ReinforcementHighlight`** — subdued inline annotation on **correct** answers (and result screen for grammar per progressive rules); `reinforcement-*` tokens; supplementary `accessibilityLabel`.
- UX-DR9: Build **`TimeCompressionSummary`** per **Direction D** — domain counts, session minutes, conservative multi-app equivalence line, date; share-ready layout; full verbalized `accessibilityLabel`s for numbers.
- UX-DR10: Build **`PostSessionShareCard`** — screenshot-optimized card (branding + stats + time compression + streak); native share / save.
- UX-DR11: Build **`ImportSummaryCard`** with states loading / summary / confirmed / error; mapped vs unmatched tables; clear SRS stage mapping copy; a11y summary role.
- UX-DR12: Build **`LevelProgressBar`** for Home — JLPT label, thin gradient fill, compact Kanji/Grammar/Vocab counts; `progressbar` semantics.
- UX-DR13: Build **`SRSStageIndicator`** — pill with **text label + color** (never color-only); token-mapped stage colors.
- UX-DR14: Build **`WeaknessStatCard`** for Stats — pattern name, accuracy, mini trend, improving/declining/stable styling.
- UX-DR15: Build **`StreakCounter`** — flame + count + states (active / at-risk / broken copy); a11y streak announcement.
- UX-DR16: Build **`SessionHeader`** — small ring, item index count, content-type badge; a11y session context on focus.
- UX-DR17: Build **`OnboardingStep`** reusable cards (illustration slot, heading, body, primary/secondary/skip).
- UX-DR18: Build **`TabBar`** — five tabs Home, Learn, Read, Stats, Settings; **hidden during review**; Home badge when reviews pending; tab a11y roles/states.
- UX-DR19: **Home screen (chosen direction):** simplified home — cognitive load ring with optional low-contrast hero graphic behind; **Review** (primary) + **Learn** (secondary) with **dedicated icons/illustrations**; streak card; **JLPT progress bar** with compact domain counts on first view; **SRS stage bucket counts live on Stats tab only** (not Home).
- UX-DR20: **Review layout Direction A (compact):** three zones — fixed header (~56px), center-weighted focal, fixed input bottom; full-width input; safe-area aware; **no raw "pending reviews" anxiety counter** as primary chrome (ring/capacity framing).
- UX-DR21: **Grammar prompts:** no automatic reinforcement line on initial question; reinforcement via ProgressiveHint or **after** answer on result screen per stakeholder decision.
- UX-DR22: **Onboarding Flow F** as specified in UX doc and `ux-design-directions.html` reference.
- UX-DR23: **Feedback pattern:** correct = green + ✓ + light haptic + optional auto-advance setting; incorrect = red + ✗ + medium haptic + **no auto-advance**; typo = amber + soft haptic + re-prompt; **never color-only**.
- UX-DR24: **Session exit:** explicit action with bottom sheet confirmation ("End session? Progress is saved."); no accidental swipe loss; tab bar hidden in session.
- UX-DR25: **Banners:** top push (not overlay); **none during review** — queue until session end.
- UX-DR26: **Button hierarchy:** max one primary per surface; Review vs Learn primary/secondary pairing; disabled = 40% opacity with explanation, not removed.
- UX-DR27: **Empty/loading states** per UX tables (e.g. all caught up, first stats, import skeletons); skeletons match final layouts.
- UX-DR28: **Portrait lock** on phones via `expo-screen-orientation`; tablet rules per spec.
- UX-DR29: **Responsive NativeWind breakpoints** (`md:`, `lg:`) for ring sizing and `lg:max-w-[500px]` content column on tablets.
- UX-DR30: **Motion:** zero animations **between review items**; ring fill subtle and **optional disable** in accessibility settings; respect reduced motion preferences where applicable.
- UX-DR31: **Touch targets** minimum 44×44pt; submit oversized during review.
- UX-DR32: **Focus management** in review: after submit → result announcement; after advance → input focus; `accessibilityLiveRegion="polite"` for dynamic hints/results.
- UX-DR33: **Mnemonic images:** `expo-image` caching; `accessibilityLabel` with text fallback when image unavailable (aligns with NFR20).
- UX-DR34: **Reading vs meaning clarity:** instant type indicator (label/color) for expected answer mode on every item.
- UX-DR35: **Automated a11y checks** in CI (`react-native-a11y` / Axe) per UX testing strategy when pipeline exists.

### FR Coverage Map

FR1: Epic 4 — JLPT kanji progression and browse/learn
FR2: Epic 4 — JLPT vocabulary progression
FR3: Epic 4 — JLPT grammar progression and integrated conjugation practice
FR4: Epic 4 — Radical→kanji→vocab dependency graph
FR4b: Epic 4 — Visual mnemonic images for radicals (R2)
FR5: Epic 4 — Multiple accepted answers; onyomi/kunyomi
FR5b: Epic 5 — SRS burn/mastered stages in review lifecycle
FR6: Epic 4 — Structured grammar schema in curriculum
FR6b: Epic 5 — Parser-based grammar validation in review
FR6c: Epic 4 — Example sentences per grammar point (content)
FR7: Epic 4 — Contextual vocabulary meanings
FR8: Epic 4 — Grammar sentence selection for known vocab (data + selection rules); presentation in Epic 5–6
FR8b: Epic 4 — Reading passages and comprehension (content + reader)
FR8c: Epic 4 — Reading aligned to learner JLPT level
FR9: Epic 5 — Input-based testing; keyboard-first review loop
FR10: Epic 5 — FSRS scheduling
FR11: Epic 5 — Unified interleaved review session
FR12: Epic 5 — Relationship layer and visible reinforcement in review/result
FR12b: Epic 5 — Micro-adjustments to related items on review
FR13: Epic 5 — WanaKana embedded input
FR14: Epic 5 — Levenshtein + conjugation-aware validation
FR15: Epic 6 — Cognitive load ring tracking
FR16: Epic 6 — “Enough for today” communication
FR17: Epic 6 — Adaptive cognitive load threshold
FR18: Epic 6 — Streak display
FR19: Epic 6 — Opt-in push notifications
FR20: Epic 6 — Notification preferences
FR21: Epic 2 — JLPT starting level selection
FR22: Epic 3 — Import entry (WaniKani / Bunpro / Anki) in onboarding
FR23: Epic 2 — Per-item known / in-progress / not started
FR24: Epic 2 — Bulk marking of known items
FR25: Epic 2 — Session intensity preference
FR26: Epic 2 — No account required
FR26b: Epic 4 — Personal mnemonics on-device
FR27: Epic 4 — View official mnemonics and radical images
FR28: Epic 6 — Weakness statistics UI
FR29: Epic 6 — Per-item error statistics
FR30: Epic 6 — Pattern tags and confusion clusters (data + logic)
FR31: Epic 6 — Weakness-biased queue priority
FR32: Epic 6 — Visible weakness trends
FR33: Epic 6 — Surfaced confusion clusters to learner
FR33b: Epic 6 — Post-session time compression summary
FR33c: Epic 6 — Credible time-compression methodology
FR33d: Epic 3 — WaniKani API import and FSRS mapping
FR33e: Epic 3 — Bunpro import and FSRS mapping
FR33f: Epic 3 — Anki deck import and FSRS mapping
FR33g: Epic 3 — Unmatched import items flagged
FR33h: Epic 3 — Import summary before finalize
FR33i-PM: Epic 8 — Shadow mode (post-MVP)
FR33j-PM: Epic 8 — Shadow mode comparative stats
FR33k-PM: Epic 8 — Shadow mode switch prompts
FR34: Epic 1 — Maintainer mnemonic generation / R2 (ops; enables FR4b)
FR35: Epic 1 — JSON schema validation in CI
FR36: Epic 1 — JSON→SQLite compile in CI
FR37: Epic 1 — Git LFS for compiled curriculum DB
FR37b: Epic 1 — Mnemonic URLs in curriculum data
FR38-PM: Epic 8 — AI-generated reading stories
FR39-PM: Epic 8 — Multi-provider AI keys
FR40-PM: Epic 8 — BYO / OpenRouter key paths
FR41-PM: Epic 8 — In-app curriculum edit proposals
FR42-PM: Epic 8 — Invisible GitHub PR flow
FR43-PM: Epic 8 — GitHub OAuth for contributors
FR44-PM: Epic 8 — Batch contribution submit
FR45-PM: Epic 8 — Content provenance tagging
FR46: Epic 1 — Local SQLite for curriculum + progress
FR47: Epic 1 — Offline-capable app after initial content
FR48: Epic 1 — Curriculum DB version check and download
FR49: Epic 1 — Cached mnemonic images for offline
FR50: Epic 3 — One-time network for WK/Bunpro import (with Epic 1 connectivity plumbing)
FR51: Epic 1 — OTA JS updates (Expo Updates)
FR52: Epic 7 — Screen reader support (implemented across flows; epic gates compliance)
FR53: Epic 7 — Contrast for UI including cognitive load ring
FR54: Epic 7 — Scalable learning text

## Epic List

### Epic 1: Installable app with local curriculum and update pipeline

Learners and maintainers get a store-ready shell: bundled or downloaded **curriculum** and separate **user progress** databases, validated **JSON→SQLite** automation, **versioned curriculum** distribution, **R2-backed** radical imagery in content, **offline-first** behavior after content is present, **curriculum updates** without losing progress, and **OTA** fixes for JS — matching the architecture first-mile story (Expo SDK 55 template + NativeWind + dual DB) without requiring later epics for the app to open and show real data.

**FRs covered:** FR34, FR35, FR36, FR37, FR37b, FR46, FR47, FR48, FR49, FR51

**Implementation notes:** `create-expo-app` default@sdk-55; `curriculum.db` + `user.db`; GitHub Actions compile + LFS; `expo-image` cache; NFR2–3, NFR10–12, NFR21–22 addressed incrementally with this foundation.

---

### Epic 2: First-run path — level, intensity, and calibration without an account

Learners complete **first launch** with **no account**, pick **JLPT starting level**, set **session intensity**, **mark known or in-progress items** (including **bulk** actions), and land in a state where the app can serve meaningful work — independent of import (Epic 3).

**FRs covered:** FR21, FR23, FR24, FR25, FR26

**Implementation notes:** Onboarding Flow F + `OnboardingStep`; pairs with UX-DR17, UX-DR22, home placeholders until Epic 4–6.

---

### Epic 3: Trustworthy import from WaniKani, Bunpro, and Anki

Switchers **bring existing progress**: API or file import, **mapping** to internal items, **FSRS conversion**, **transparent summary** of mapped vs **unmatched** items, **secure key handling** — so the first session reflects true level (feeds Epic 5–6).

**FRs covered:** FR22, FR33d, FR33e, FR33f, FR33g, FR33h, FR50

**Implementation notes:** `ImportSummaryCard` (UX-DR11), `expo-secure-store`, shared mapper abstraction; NFR6–9, NFR18–20.

---

### Epic 4: Structured Japanese content — study, read, and remember

Learners **browse and learn** along **JLPT** tracks with **dependency-ordered radicals→kanji→vocabulary**, rich **grammar** points and **reading passages**, **visual/text mnemonics**, and **personal notes** — the curriculum experience outside the timed review loop.

**FRs covered:** FR1, FR2, FR3, FR4, FR4b, FR5, FR6, FR6c, FR7, FR8, FR8b, FR8c, FR26b, FR27

**Implementation notes:** Learn/Read tabs, `LevelProgressBar` (UX-DR12); FR8 selection logic may share modules with Epic 5–6 for reinforcement.

---

### Epic 5: Unified review loop — type, validate, schedule, interconnect

Learners run the **core product**: **one-tap** mixed **reviews**, **FSRS** intervals, **input-based** answers, **WanaKana**, **typo and conjugation-aware** checking, **visible cross-domain ties** and **related-item boosts** — fast loop per NFR1 / NFR5b / UX “serious tool” bar.

**FRs covered:** FR9, FR10, FR11, FR5b, FR6b, FR12, FR12b, FR13, FR14

**Implementation notes:** `ReviewCard`, `WanaKanaInput`, `ProgressiveHint`, `ReinforcementHighlight`, `SessionHeader`, pre-fetch queue; grammar validation shares parser with FR6 curriculum rules.

---

### Epic 6: Streaks, cognitive load, weakness targeting, and session proof

Learners feel **daily capacity** (ring), **habit** (streak + optional nudges), **targeted drilling**, **stats and confusion insights**, and **credible time-compressed** session proof — the differentiation vs single-domain SRS tools.

**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR28, FR29, FR30, FR31, FR32, FR33, FR33b, FR33c

**Implementation notes:** `CognitiveLoadRing`, `TimeCompressionSummary`, `PostSessionShareCard`, `WeaknessStatCard`, `StreakCounter`, `expo-notifications`; ring fill must not block NFR1.

---

### Epic 7: Accessible, inclusive experience for serious daily use

Learners using **VoiceOver/TalkBack**, **high contrast**, **larger text**, or **accessibility keyboards** get a **WCAG 2.1 AA**-aligned experience across navigation, review, and results — release-quality inclusive polish.

**FRs covered:** FR52, FR53, FR54

**Implementation notes:** Cross-cutting with Epics 1–6; epic owns audits, token verification, CI a11y gates (UX-DR35), NFR14–17.

---

### Epic 8: Post-MVP expansion (shadow mode, AI stories, community curriculum)

Deferred product: **shadow mode**, **AI reading**, **community PR pipeline** — tracked so MVP epics do not silently drop `-PM` FRs.

**FRs covered:** FR33i-PM, FR33j-PM, FR33k-PM, FR38-PM, FR39-PM, FR40-PM, FR41-PM, FR42-PM, FR43-PM, FR44-PM, FR45-PM

**Implementation notes:** No MVP engineering dependency; data model should not block these (per architecture).

---

## Epic 1: Installable app with local curriculum and update pipeline

Learners and maintainers get a store-ready shell: bundled or downloaded **curriculum** and separate **user progress** databases, validated **JSON→SQLite** automation, **versioned curriculum** distribution, **R2-backed** radical imagery in content, **offline-first** behavior after content is present, **curriculum updates** without losing progress, and **OTA** fixes for JS — matching the architecture first-mile story (Expo SDK 55 template + NativeWind + dual DB) without requiring later epics for the app to open and show real data.

### Story 1.1: Bootstrap Expo SDK 55 app with CI and OTA hooks

As a **maintainer**,
I want **the official Expo SDK 55 default template with TypeScript, Expo Router, and baseline CI**,
So that **the team has a reproducible app entrypoint aligned with architecture (EAS-ready, Expo Updates wired minimally)**.

**Acceptance Criteria:**

**Given** a clean checkout of the repo  
**When** a developer runs the documented init command (`npx create-expo-app@latest … --template default@sdk-55`) or uses the committed baseline  
**Then** the app builds for iOS and Android simulators with TypeScript strict and Expo Router resolving `/src/app` routes  
**And** `.github/workflows/ci.yml` runs lint, typecheck, and tests on PR (stub test OK if none yet) per architecture

**Given** the project is configured for Expo Updates  
**When** a release channel build is produced  
**Then** `expo-updates` can report runtime version metadata (no crash on missing update)  
**And** documentation states how OTA will be used for JS-only fixes (FR51 foundation)

### Story 1.2: NativeWind design tokens and global styling

As a **learner**,
I want **consistent NativeWind/Tailwind tokens for colors, type, spacing, and radius**,
So that **later screens match the UX spec without ad-hoc styles (UX-DR1–UX-DR3)**.

**Acceptance Criteria:**

**Given** `tailwind.config.js` defines dark-first semantic colors, SRS stage tokens, feedback tokens, ring gradient tokens, content-type accents, and reinforcement tokens per UX spec  
**When** any screen uses utility classes for backgrounds and text  
**Then** tokens resolve correctly in light and dark theme toggles where implemented  
**And** `global.css` includes Tailwind directives and is imported from the root layout

### Story 1.3: Dual SQLite databases on first launch

As a **learner**,
I want **separate curriculum and user databases opened on launch**,
So that **curriculum can be replaced later without touching my progress (FR46, NFR10)**.

**Acceptance Criteria:**

**Given** the app is launched for the first time  
**When** the database provider initializes  
**Then** `curriculum.db` is opened from the bundled asset path (read-only connection pattern) and `user.db` is created in app sandbox if missing  
**And** only minimal `user.db` tables required for this epic exist (e.g. preferences, schema version row)—no “create all future tables” dump

**Given** a subsequent app start  
**When** initialization runs  
**Then** both databases open without error and no user tables are dropped on curriculum-only operations

### Story 1.4: Five-tab app shell with hidden review route placeholder

As a **learner**,
I want **Home, Learn, Read, Stats, and Settings tabs using Expo Router**,
So that **navigation matches the UX model before features land (UX-DR18 skeleton)**.

**Acceptance Criteria:**

**Given** the tab layout from architecture (`(tabs)/_layout.tsx`)  
**When** I tap each tab  
**Then** I see a placeholder screen with the correct title for Home, Learn, Read, Stats, Settings  
**And** safe areas and portrait orientation lock on phones are applied (`expo-screen-orientation`, UX-DR28)

### Story 1.5: Curriculum JSON validation, SQLite compile, Actions, LFS, and bundled seed

As a **maintainer**,
I want **JSON curriculum validated and compiled to SQLite in CI with artifacts versioned for the app bundle**,
So that **learners ship with real N5 seed content and integrity is enforced (FR35, FR36, FR37, FR37b, NFR11)**.

**Acceptance Criteria:**

**Given** `curriculum/` JSON and `curriculum/schema/curriculum.schema.json`  
**When** `validate-schema` and `compile-curriculum` scripts run locally or in GitHub Actions  
**Then** invalid JSON fails the workflow with a clear error and no partial `curriculum.db` is published  
**And** a successful build produces `curriculum.db` referenced for bundling under `assets/curriculum-seed/` per architecture

**Given** Git LFS is configured for the compiled database  
**When** a contributor clones the repo  
**Then** documentation explains how to pull LFS objects  
**And** mnemonic image URL fields in compiled rows resolve to public R2 URLs (FR37b data shape)

### Story 1.6: Curriculum version check and atomic on-device update

As a **learner**,
I want **the app to detect newer curriculum and replace it atomically without corrupting progress**,
So that **I stay current and never lose SRS data (FR48, NFR12)**.

**Acceptance Criteria:**

**Given** bundled curriculum metadata includes a semantic version  
**When** the app starts with network available and a newer version is advertised (local mock or static manifest OK for first slice)  
**Then** the download starts, completes, validates, and swaps `curriculum.db` in one atomic operation  
**And** if download fails mid-way, the previous curriculum remains active and no partial file is used (NFR12)

**Given** no network  
**When** the app starts  
**Then** no error banner blocks the UI; last good curriculum continues (graceful degradation)

### Story 1.7: Cached radical mnemonic images and maintainer R2 workflow

As a **learner**,
I want **radical mnemonic images loaded from URLs in curriculum and cached for offline viewing**,
So that **I see visuals without broken states when offline (FR49, FR4b delivery path, NFR20)**.

**Acceptance Criteria:**

**Given** a radical row includes an R2 HTTPS image URL  
**When** the learner views that radical  
**Then** `expo-image` loads, caches, and displays the image  
**And** if the network and cache miss, a text fallback mnemonic or alt label is shown—not a broken image (NFR20, UX-DR33)

**Given** a maintainer follows `docs/` or README instructions generated in this story  
**When** they upload new mnemonic assets to R2 and update JSON URLs  
**Then** the next curriculum compile includes those URLs and CI still passes (FR34 operational path documented)

---

## Epic 2: First-run path — level, intensity, and calibration without an account

Learners complete **first launch** with **no account**, pick **JLPT starting level**, set **session intensity**, **mark known or in-progress items** (including **bulk** actions), and land in a state where the app can serve meaningful work — independent of import (Epic 3).

### Story 2.1: Welcome and JLPT starting level without sign-up

As a **new learner**,
I want **to choose my JLPT starting level on first launch with no account**,
So that **the app respects my entry point and privacy (FR21, FR26, UX-DR17, UX-DR22)**.

**Acceptance Criteria:**

**Given** first launch (`onboarding` flow)  
**When** I complete the welcome step and select a JLPT level (N5–N1)  
**Then** the choice is persisted to `user.db` and onboarding advances  
**And** no email, OAuth, or account collection UI appears (FR26)

### Story 2.2: Session intensity preference

As a **learner**,
I want **to pick relaxed vs intense daily session targets**,
So that **cognitive load defaults match my schedule (FR25)**.

**Acceptance Criteria:**

**Given** onboarding intensity step  
**When** I select a documented preset (e.g. relaxed ~15 min vs intense ~30 min per PRD)  
**Then** the value is stored in user preferences for Epic 6 ring logic to consume  
**And** I can change this later from Settings (stub Settings persistence OK if Settings UI minimal)

### Story 2.3: Per-item study status (known / in progress / not started)

As a **returning learner**,
I want **to mark individual kanji, vocabulary, or grammar items as known, in progress, or not started**,
So that **my queue reflects what I already know (FR23)**.

**Acceptance Criteria:**

**Given** an onboarding calibration list that queries `curriculum.db` for items at my chosen JLPT level (no dependency on the Learn tab UI from Epic 4)  
**When** I change an item’s status  
**Then** the status writes to `user.db` only and survives app restart  
**And** invalid transitions are prevented (e.g. cannot mark “known” without satisfying dependency rules if those rules are enforced in this slice—document behavior)

### Story 2.4: Bulk mark known items for a level or preset

As a **returning learner**,
I want **to bulk-mark sets of items (e.g. all N5 kanji) as known**,
So that **I avoid re-proving obvious material (FR24)**.

**Acceptance Criteria:**

**Given** a bulk action UI tied to curriculum queries (JLPT + item type)  
**When** I confirm bulk mark as known  
**Then** matching items receive the known state in `user.db` using batched writes to avoid SQLite lock stalls (architecture bulk-update note)  
**And** a summary count of updated items is shown

### Story 2.5: Onboarding completion gate to main tabs

As a **learner**,
I want **onboarding to end with a clear handoff to the main app**,
So that **I never feel stuck between flows (UX-DR22)**.

**Acceptance Criteria:**

**Given** required onboarding steps for the chosen path are complete  
**When** I finish the flow  
**Then** `(tabs)` becomes the default route and `user.db` stores `onboarding_completed`  
**And** relaunch skips onboarding unless a “reset onboarding” dev flag or settings action exists for QA

---

## Epic 3: Trustworthy import from WaniKani, Bunpro, and Anki

Switchers **bring existing progress**: API or file import, **mapping** to internal items, **FSRS conversion**, **transparent summary** of mapped vs **unmatched** items, **secure key handling** — so the first session reflects true level (feeds Epic 5–6).

### Story 3.1: Secure storage for import credentials

As a **switcher**,
I want **API keys held in secure storage only for the import session**,
So that **my credentials are not leaked (NFR6, NFR7)**.

**Acceptance Criteria:**

**Given** import screens for WaniKani/Bunpro  
**When** I paste an API key  
**Then** the value is stored with `expo-secure-store` and never logged to analytics or plaintext files  
**And** I can discard the key after successful import (FR33d/FR33e support)

### Story 3.2: WaniKani v2 import with mapping and FSRS conversion

As a **WaniKani user**,
I want **my assignments mapped to internal items with FSRS-equivalent states**,
So that **burned items stay burned and apprentice intervals feel right (FR33d, NFR18)**.

**Acceptance Criteria:**

**Given** a valid WaniKani API key and network  
**When** import runs  
**Then** the client respects documented rate limits (queue/retry) and surfaces readable errors for invalid keys or HTTP failures  
**And** each mapped subject uses the shared mapping table architecture describes, converting WK stages to FSRS fields in `user.db`

### Story 3.3: Bunpro import or documented fallback

As a **Bunpro user**,
I want **grammar progress imported when an API or export exists, or a clear fallback**,
So that **I am not blocked silently (FR33e, NFR18)**.

**Acceptance Criteria:**

**Given** Bunpro connectivity per investigation outcome documented in-repo  
**When** import is available and succeeds  
**Then** grammar items map to internal IDs with FSRS conversion analogous to WK  
**And** when import is unavailable, the UI offers manual marking / skip with explicit limitation text (PRD fallback)

### Story 3.4: Local Anki `.apkg` import

As an **Anki user**,
I want **to pick a deck file and import locally with no cloud upload**,
So that **my decks stay private (FR33f, NFR9, NFR19)**.

**Acceptance Criteria:**

**Given** a supported `.apkg` selected via file picker  
**When** import runs  
**Then** parsing happens entirely on-device and malformed zips show a specific error (NFR19)  
**And** mapped cards update `user.db` FSRS fields; unmatched cards are listed for follow-up (FR33g)

### Story 3.5: Import summary and unmatched transparency

As a **switcher**,
I want **a summary of mapped vs unmatched items and SRS mapping before I confirm**,
So that **I trust the transition (FR33h, FR33g, UX-DR11)**.

**Acceptance Criteria:**

**Given** any successful import partial result  
**When** the summary screen renders  
**Then** counts for mapped/unmatched and SRS stage mapping are visible in `ImportSummaryCard` layout  
**And** confirming persists mapped progress; cancel returns without corrupting prior `user.db` state

### Story 3.6: Onboarding branch to import sources

As a **switcher**,
I want **to choose WaniKani, Bunpro, Anki, or skip import during onboarding**,
So that **I land on the path that matches my history (FR22, FR50)**.

**Acceptance Criteria:**

**Given** onboarding “existing knowledge” branch  
**When** I pick an import source  
**Then** I am routed to the correct subflow and return to onboarding completion with data persisted  
**And** skipping import still allows manual calibration (Epic 2) without dead ends

---

## Epic 4: Structured Japanese content — study, read, and remember

Learners **browse and learn** along **JLPT** tracks with **dependency-ordered radicals→kanji→vocabulary**, rich **grammar** points and **reading passages**, **visual/text mnemonics**, and **personal notes** — the curriculum experience outside the timed review loop.

### Story 4.1: JLPT Learn hub and per-type item lists

As a **learner**,
I want **to browse kanji, vocabulary, and grammar by JLPT level**,
So that **I know what to study next in structure (FR1, FR2, FR3)**.

**Acceptance Criteria:**

**Given** `curriculum.db` seeded content  
**When** I open Learn and pick a JLPT level  
**Then** I see separate lists or filters for kanji, vocabulary, and grammar with counts  
**And** list queries complete within the architecture performance budget on mid-range devices for N5 seed sizes (NFR2 baseline)

### Story 4.2: Radical detail with mnemonic image

As a **learner**,
I want **radical detail with meaning and mnemonic image**,
So that **radicals stick before kanji (FR4, FR4b, FR27)**.

**Acceptance Criteria:**

**Given** a radical with optional R2 URL  
**When** I open its detail page  
**Then** meaning, strokes, and mnemonic image (or text fallback) display using shared image cache behavior from Epic 1  
**And** dependency “required radicals” for a kanji link out correctly when graph data exists (FR4)

### Story 4.3: Item detail screens for kanji, vocabulary, and grammar

*Consolidates original stories 4.3, 4.4, and 4.5 — all follow the same detail-screen pattern.*

As a **learner**,
I want **rich detail screens for kanji (readings, meanings, synonyms, mnemonics), vocabulary (contextual usage, examples), and grammar (structured rules, accepted forms, example sentences)**,
So that **I can study all content types in depth outside reviews (FR5, FR6, FR6c, FR7, FR27)**.

**Acceptance Criteria:**

**Given** a kanji item  
**When** I view detail  
**Then** primary and synonym meanings render from the dedicated answers model  
**And** readings are labeled distinctly to reduce reading-vs-meaning confusion (UX-DR34 alignment on labels)

**Given** a vocabulary item with contextual gloss and linked example sentences  
**When** I open detail  
**Then** contextual meaning and at least one example render when present in seed data  
**And** grammar cross-links display when `grammar` associations exist in curriculum

**Given** a grammar point with `accepted_forms` and `conjugation_rules` JSON  
**When** I view the grammar detail screen  
**Then** structure, accepted forms, and ≥5 example sentences render when data provides them (FR6c)  
**And** conjugation rules are exposed to the same parser module Epic 5 imports for validation (shared package or folder, no duplication)

### Story 4.4: Reading passages with comprehension prompts

As a **learner**,
I want **JLPT-tagged reading passages with questions**,
So that **I practice comprehension in context (FR8b, FR8c)**.

**Acceptance Criteria:**

**Given** a passage at my level  
**When** I open the reader  
**Then** passage text and comprehension prompts render; answering stores practice results in `user.db` minimally (or read-only practice for first slice—document choice)  
**And** passage vocabulary/grammar aligns to stated JLPT constraints in seed data (FR8c)

### Story 4.5: Dependency graph visibility for unlock status

As a **learner**,
I want **to see why a kanji or vocab is locked**,
So that **the radical→kanji→vocab path feels fair (FR4)**.

**Acceptance Criteria:**

**Given** graph edges in `curriculum.db`  
**When** I view a locked item  
**Then** the UI lists unmet prerequisites with links  
**And** unlocked items show clear “available” state

### Story 4.6: Personal mnemonics editor

As a **learner**,
I want **to add or edit personal mnemonics per item**,
So that **I can reinforce memory my way (FR26b)**.

**Acceptance Criteria:**

**Given** an item detail for kanji/vocab/grammar  
**When** I edit my mnemonic text and save  
**Then** text persists in `user.db` and survives curriculum updates  
**And** empty personal mnemonic removes the override without deleting curriculum text

---

## Epic 5: Unified review loop — type, validate, schedule, interconnect

Learners run the **core product**: **one-tap** mixed **reviews**, **FSRS** intervals, **input-based** answers, **WanaKana**, **typo and conjugation-aware** checking, **visible cross-domain ties** and **related-item boosts** — fast loop per NFR1 / NFR5b / UX “serious tool” bar.

### Story 5.1: Review queue builder, FSRS scheduling, and prefetch

*Consolidates original stories 5.1, 5.9, and 5.10 — all review-engine internals: queue construction, state updates, and lookahead.*

As a **learner**,
I want **a unified due queue with FSRS-driven scheduling and prefetched items**,
So that **sessions start instantly, stay honest, and never stutter (FR10, FR11, FR5b, NFR1, NFR2)**.

**Acceptance Criteria:**

**Given** FSRS due fields in `user.db` for multiple item types  
**When** I start a review session from a documented QA entry point for this story only (e.g. `review` route deep link or temporary in-story button; the Home Review button is finalized in Epic 6)  
**Then** the first item appears with no intermediate configuration screen (FR11)  
**And** interleaving policy is deterministic and documented (e.g. weighted round-robin) without requiring Epic 6 weakness yet (weakness can default to 0)

**Given** a graded answer  
**When** results are shown  
**Then** `ts-fsrs` transitions update `user.db` within the performance budget and the next item can load without blocking the UI thread with heavy sync I/O (document batching)  
**And** SRS stage badge uses text + color (UX-DR13)

**Given** a running session  
**When** I am answering item *n*  
**Then** items *n+1…n+k* metadata are prefetched into memory  
**And** measured tap-to-next-item stays within the PRD interaction budget on a mid-range test device (document test method)

### Story 5.2: Review session UI, layout, and card prompting

*Consolidates original stories 5.2 and 5.3 — session chrome and card rendering are one unified UI pass.*

As a **learner**,
I want **a focused review screen with header context, safe exit, and clear answer-type prompts**,
So that **I stay oriented, never lose progress, and always know what to type (FR9, UX-DR5, UX-DR16, UX-DR20, UX-DR24, UX-DR34)**.

**Acceptance Criteria:**

**Given** an active review session route outside tabs  
**When** the session renders  
**Then** the tab bar is hidden (UX-DR18) and `SessionHeader` shows item index and type badge  
**And** attempting to leave opens a bottom sheet confirming end session; progress saved to `user.db` on confirm (UX-DR24)

**Given** an item in `prompting` state  
**When** it renders  
**Then** labels/color coding indicate expected answer mode per UX spec  
**And** no celebratory animations block the prompt (NFR5b)

### Story 5.3: Answer input and validation (WanaKana, Levenshtein, conjugation)

*Consolidates original stories 5.4, 5.5, and 5.6 — all answer validation pipelines sharing a common input field.*

As a **learner**,
I want **romaji-to-kana input, fair typo tolerance on meanings, and conjugation-aware grammar validation**,
So that **every answer type is checked accurately and fairly (FR6b, FR13, FR14, UX-DR6, UX-DR23, NFR5)**.

**Acceptance Criteria:**

**Given** a reading prompt  
**When** I type romaji in the answer field  
**Then** hiragana/katakana updates per keystroke with acceptable latency on a mid-range device (NFR5)  
**And** accessibility labels describe the input mode (UX-DR6)

**Given** a meaning prompt with primary and synonym answers  
**When** I submit within Levenshtein accept threshold  
**Then** I see a warning state (typo) and can retry or accept per product rule without advancing SRS incorrectly (document chosen rule)  
**And** near-misses show "close!" hint path (FR14)

**Given** a grammar item with parser-supported rules  
**When** I submit an answer  
**Then** parser validation runs first and incorrect conjugations fail with correct answer shown  
**And** unsupported patterns fall back to Levenshtein with explicit "parser fallback" behavior logged only in dev if needed

### Story 5.4: Progressive hints, reinforcement, and related-item boosts

*Consolidates original stories 5.7 and 5.8 — both leverage the dependency graph for cross-item intelligence during review.*

As a **learner**,
I want **layered hints, visible reinforcement links, and scheduling boosts for related items**,
So that **the review loop reveals connections and strengthens related knowledge (FR12, FR12b, UX-DR7, UX-DR8, UX-DR21)**.
**Acceptance Criteria:**

**Given** a grammar item in review  
**When** I tap Hint repeatedly  
**Then** hint levels advance with updated button copy until exhausted, and screen reader announces new panels (UX-DR7)  
**And** after submit, result view may show `ReinforcementHighlight` when graph data supports a link (FR12), without showing full spoiler on initial prompt (UX-DR21)

**Given** graph relationships exist  
**When** I answer a kanji item correctly  
**Then** related item records receive a bounded priority adjustment persisted for next queue build  
**And** the adjustment is idempotent per session rules (document caps to prevent starvation)

---

## Epic 6: Streaks, cognitive load, weakness targeting, and session proof

Learners feel **daily capacity** (ring), **habit** (streak + optional nudges), **targeted drilling**, **stats and confusion insights**, and **credible time-compressed** session proof — the differentiation vs single-domain SRS tools.

### Story 6.1: Weakness detection pipeline (recording, patterns, queue bias)

*Consolidates original stories 6.1, 6.2, and 6.3 — record errors → detect clusters → bias queue is one end-to-end pipeline.*

As a **learner**,
I want **my misses recorded by type, grouped into confusion clusters, and used to bias my review queue**,
So that **reviews target my real weaknesses (FR29, FR30, FR31, FR33)**.
**Acceptance Criteria:**

**Given** a wrong or typo outcome in review  
**When** the result is committed  
**Then** counters and last-error metadata append in `user.db` without blocking the next item (NFR1)  
**And** schema supports pattern tags from FR30 in following story

**Given** curriculum tags on items  
**When** weakness aggregation runs (on schedule end or stats screen entry)  
**Then** clusters with sustained error rates surface copy such as “You often confuse て-form and た-form” when thresholds met (FR33)  
**And** false positives are damped by minimum sample sizes (document constants)

**Given** weakness scores and FSRS priorities  
**When** the queue is built at session start  
**Then** ordering uses `priority = fsrs_score × 0.7 + weakness_score × 0.3` (or documented tuned default)  
**And** disabling bias in Settings preserves pure FSRS ordering (PRD mitigation)

### Story 6.2: Stats tab with weakness trends and SRS stage breakdown

As a **learner**,
I want **Stats showing weakness cards and SRS stage counts**,
So that **I see proof of progress (FR28, FR32, UX-DR14, UX-DR13)**.

**Acceptance Criteria:**

**Given** the Stats tab  
**When** I open it after some reviews  
**Then** `WeaknessStatCard` list shows pattern accuracy trends and SRS buckets are visible here (not on Home per UX-DR19)  
**And** empty state matches UX empty-state pattern (UX-DR27)

### Story 6.3: Cognitive load ring and daily threshold guidance

*Consolidates original stories 6.5 and 6.6 — ring data model and "enough for today" guidance are tightly coupled.*

As a **learner**,
I want **a cognitive load ring that fills as I study and gentle guidance when I’ve done enough**,
So that **I understand mental spend and feel permission to stop (FR15, FR16, FR17, UX-DR4, UX-DR30)**.
**Acceptance Criteria:**

**Given** item weights by type/difficulty in config  
**When** I complete items in a session  
**Then** cumulative load increases and the ring visual + numeric percent update (never color-only)  
**And** ring updates do not block the <100ms answer path (off-main-thread or lightweight computation)

**Given** session intensity preference from Epic 2  
**When** cumulative load crosses the adaptive threshold  
**Then** informational messaging appears per UX tone (WHOOP-like, not nagging)  
**And** I can still continue reviewing if I choose (FR16 informative-only)

### Story 6.4: Streak tracking and opt-in notifications

*Consolidates original stories 6.7 and 6.8 — both serve the daily habit loop.*

As a **learner**,
I want **a visible streak counter and configurable daily reminders**,
So that **daily habit is reinforced without toxic gamification or spam (FR18, FR19, FR20, UX-DR15, UX-DR19)**.
**Acceptance Criteria:**

**Given** a completed session marks the calendar day  
**When** I view Home  
**Then** `StreakCounter` shows current streak and state (active/at-risk)  
**And** streak survives timezone change and offline use (NFR13)

**Given** notification permission not granted  
**When** I enable reminders in Settings  
**Then** OS permission prompts follow platform rules and scheduling respects “max one/day” PRD principle  
**And** disabling notifications cancels pending scheduled notifications

### Story 6.5: Post-session summary and home screen composition

*Consolidates original stories 6.9 and 6.10 — both are key composition screens that define the app’s daily face.*

As a **learner**,
I want **a screenshot-friendly session summary with time savings and a Home screen with ring, actions, streak, and progress**,
So that **I feel the value every session and know what to do next at a glance (FR33b, FR33c, UX-DR9, UX-DR10, UX-DR12, UX-DR19, UX-DR26)**.
**Acceptance Criteria:**

**Given** a completed or user-ended session  
**When** I reach the summary route  
**Then** `TimeCompressionSummary` shows domains, minutes studied, and conservative multi-app estimate with methodology tooltip or settings link (FR33c)  
**And** optional share uses `PostSessionShareCard` with native share sheet (UX-DR10)

**Given** Home tab after onboarding  
**When** I open the app  
**Then** primary Review and secondary Learn buttons follow button hierarchy (UX-DR26) with icons/illustrations per direction decision  
**And** `LevelProgressBar` shows compact domain counts; Review button reflects availability without terror backlog copy (UX-DR20 philosophy)

---

## Epic 7: Accessible, inclusive experience for serious daily use

Learners using **VoiceOver/TalkBack**, **high contrast**, **larger text**, or **accessibility keyboards** get a **WCAG 2.1 AA**-aligned experience across navigation, review, and results — release-quality inclusive polish.

### Story 7.1: Screen reader, keyboard, and input accessibility

*Consolidates original stories 7.1 and 7.4 — both navigation/input accessibility for assisted users.*

As a **learner using assistive technology**,
I want **meaningful screen reader semantics, keyboard navigation, and accessible input methods**,
So that **I can complete core flows with VoiceOver/TalkBack or external keyboards (FR52, FR54, NFR15, NFR17)**.

**Acceptance Criteria:**

**Given** VoiceOver (iOS) or TalkBack (Android) enabled  
**When** I traverse Home, Learn, and a full review item cycle  
**Then** each interactive control announces purpose and state (tabs, buttons, input, hints, results)  
**And** live regions announce dynamic results politely (UX-DR32)

**Given** a Bluetooth keyboard connected  
**When** I focus the answer field and press Enter  
**Then** the answer submits and focus moves predictably through result → next prompt  
**And** every gesture-only affordance has an on-screen alternative (NFR17)

### Story 7.2: Visual accessibility (contrast, scaling, reduced motion)

*Consolidates original stories 7.2, 7.3, and 7.6 — all visual accommodation settings.*

As a **learner with visual or motion sensitivities**,
I want **WCAG AA contrast, scalable text to 200%, and optional reduced motion**,
So that **the app is comfortable for daily use regardless of visual ability (FR53, FR54, NFR14, NFR16, UX-DR30)**.

**Acceptance Criteria:**

**Given** token pairs from `tailwind.config.js`  
**When** automated contrast checks run in CI or script  
**Then** normal text ≥4.5:1 and large text ≥3:1 against declared backgrounds including ring states  
**And** failures block merge or are tracked as defects with fix path (team policy documented)

**Given** OS text size increased toward 200%  
**When** I open review and Home layouts  
**Then** focal zones grow/scroll without hiding the submit action permanently  
**And** Japanese prompt text scales per UX typography rules without overlapping illegibly

**Given** system reduced motion or in-app toggle  
**When** enabled  
**Then** ring fill uses stepped updates or static state changes without continuous animation  
**And** review loop remains free of inter-item animations (NFR5b)

### Story 7.3: Automated accessibility checks in CI

As a **maintainer**,
I want **CI to run basic accessibility linting on components**,
So that **regressions are caught early (UX-DR35)**.

**Acceptance Criteria:**

**Given** CI pipeline  
**When** PR runs  
**Then** configured `react-native-a11y` or Axe step executes on representative screens or component tests  
**And** failures print actionable rule names

---

## Epic 8: Post-MVP expansion (shadow mode, AI stories, community curriculum)

Deferred product: **shadow mode**, **AI reading**, **community PR pipeline** — tracked so MVP epics do not silently drop `-PM` FRs.

### Story 8.1: Shadow mode (positioning, stats, switch prompts)

*Consolidates original stories 8.1 and 8.2 — both shadow mode features, small scope.*

As a **switcher (post-MVP)**,
I want **shadow mode framing with comparative stats and gentle switch prompts after sustained use**,
So that **I can trial the app alongside paid tools and decide when to commit (FR33i-PM, FR33j-PM, FR33k-PM)**.

**Acceptance Criteria:**

**Given** feature flag `shadow_mode` off by default  
**When** enabled in a future build  
**Then** UI copy positions parallel use without breaking FSRS scheduling assumptions (architecture note)  
**And** post-session stats include comparison metrics specified in PRD when data exists (FR33j-PM)

**Given** shadow mode active for ≥14 days  
**When** threshold met  
**Then** a non-blocking prompt offers “ready to switch fully?” with dismiss and snooze  
**And** no forced migration path

### Story 8.2: AI-generated reading and community contribution backlog

As a **product owner**,
I want **scoped discovery stories for AI reading and GitHub-based contributions**,
So that **engineering estimates post-MVP work (FR38-PM–FR45-PM)**.

**Acceptance Criteria:**

**Given** PRD post-MVP bullets  
**When** this story completes  
**Then** a short design note lists API key storage risks, OAuth scope minimization, and PR automation constraints  
**And** no MVP code paths depend on these features being enabled

---

## Create Epics and Stories — Step 4 validation

**Date:** 2026-05-03

| Check | Result |
| --- | --- |
| **FR coverage** | Pass — every FR in the Requirements Inventory appears in the FR Coverage Map; stories per epic implement that scope. |
| **Starter template** | Pass — Story 1.1 matches Architecture: `create-expo-app` with `default@sdk-55`. |
| **DB / entity discipline** | Pass — Story 1.3 limits initial `user.db` schema; no “create all tables upfront” story. |
| **Epic user value** | Pass — epics are outcome-oriented (onboarding, import, content, review, intelligence, a11y, deferral). |
| **Epic independence** | Pass with notes — Epic 2 does not require Epic 3. Epic 3 requires Epic 1 (DB). Epics 4–6 stack as product slices; Epic 7 cross-cuts. |
| **Within-epic story order** | Pass after edits — Story 2.3 uses onboarding-only `curriculum.db` queries (no Epic 4 Learn dependency). Story 5.1 uses a QA entry point until Home Review is finalized in Story 6.5. |
| **NFR / UX-DR** | Pass — NFRs and UX-DRs are reflected in story ACs where applicable; full NFR matrix can be traced via epic scope + architecture doc. |

**Adjustments in this validation pass:** Story **2.3** and **5.1** acceptance criteria were tightened to remove forward cross-epic assumptions.

**Consolidation pass (2026-06-21):** Related backlog stories combined to reduce from 35 remaining stories to 21. Epics 4 (3→1 detail screens), 5 (10→4 review engine), 6 (10→5 intelligence layer), 7 (6→3 accessibility), 8 (3→2 post-MVP). All acceptance criteria preserved; no FR coverage changes.
