---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - "planning-artifacts/product-brief-japanese-learning-2026-04-12.md"
  - "planning-artifacts/research/market-open-source-local-first-japanese-learning-learners-research-2026-03-21.md"
  - "brainstorming/brainstorming-session-2026-03-14-1530.md"
documentCounts:
  briefs: 1
  research: 1
  brainstorming: 1
  projectDocs: 0
workflowType: 'prd'
classification:
  projectType: mobile_app
  domain: edtech
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - japanese-learning

**Author:** Riyaz
**Date:** 2026-04-19

## Executive Summary

japanese-learning is a free, open-source, cross-platform mobile application (Android & iOS) that replaces the fragmented, expensive multi-tool stack serious Japanese learners are forced to assemble today. It unifies kanji, vocabulary, grammar, and reading into a single app with input-based SRS testing powered by FSRS, JLPT-aligned progression (N5→N1), and interconnected learning where reviewing one skill domain reinforces related content across others. The core app is completely free — no subscriptions, no paywalls, no ads — eliminating $150–450/year in stacked tool costs. AI features (reading passage generation, conversation practice) are optional via bring-your-own-key. All user data stays on-device, the app works fully offline, and both the codebase and curriculum are open-source with a community contribution pipeline that improves content over time without maintainer burnout.

The product targets four primary personas: anime/manga self-learners priced out of paid tools, professionals relocating to Japan who need practical Japanese fast, JLPT test preppers frustrated by paying for multiple specialized subscriptions, and switchers already using WaniKani who want grammar coverage at the same quality without another subscription. The app is built by a learner solving their own problem — strong on kanji but struggling with grammar, with no single free tool covering both at the depth required.

### What Makes This Special

**All-in-one with real depth.** Not a shallow phrase app — WaniKani-level rigor across kanji, vocabulary, grammar, and reading in a single product. The unified review mixer interleaves content types intelligently, and an invisible nudge system creates micro-reinforcement loops (reviewing a kanji boosts its related vocabulary and grammar). Learners feel the interconnection within their first two weeks — the "aha moment" that no multi-app stack delivers.

**Free forever, community-powered.** Zero cost for the core learning experience. No revenue model to protect, no premium tier gating features. A gamified community contribution pipeline (invisible GitHub PRs, in-app review) turns everyday learners into open-source contributors, ensuring the curriculum improves continuously. AI enrichment is BYO-key — the app never needs server infrastructure or subscription revenue.

**No equivalent exists.** No other tool — free or paid — combines all JLPT skill domains with input-based testing, FSRS scheduling, local-first architecture, and an open-source community content model. The gap is well-documented in learner communities and validated by market research. The timing is right: FSRS is mature and MIT-licensed, React Native + Expo has stabilized for cross-platform, and BYO-key AI is a viable pattern.

## Project Classification

| Attribute | Value |
| --- | --- |
| **Project Type** | Cross-platform mobile app (React Native / Expo — Android & iOS) |
| **Domain** | EdTech — language learning with structured curriculum and spaced repetition |
| **Complexity** | Medium — interconnected SRS engine, JSON-to-SQLite data pipeline, community contribution flow, cross-platform code sharing |
| **Project Context** | Greenfield — new product, no existing codebase |

## Success Criteria

### User Success

**Learning engagement (are users actually learning?):**
- Multi-domain engagement: users actively engage with at least 2 core learning domains (e.g., kanji + grammar, or vocabulary + reading) within their first month. Target: 60% of active users. Single-domain-only usage suggests the app isn't delivering on its all-in-one promise.
- Review session completion: users complete their daily SRS review sessions (not just open the app). Target: 70%+ of sessions started are completed.
- JLPT progression: users advance through JLPT-level content over time — measurable as items mastered per week/month within their current level.
- Streak maintenance: active users maintain streaks of 7+ days. Streak milestone animations reinforce habit formation.

**Cognitive load management (is the burnout prevention working?):**
- Session completion within cognitive load threshold: 80%+ of sessions end with the user at or below the cognitive load ring's recommended limit — not abandoning mid-session from overwhelm or pushing past the ring into fatigue territory. This measures whether the ring is actually shaping behavior, not just decorating the UI.

**The "aha" moment (when users realize it's working):**
The aha moment occurs in Week 1–2, when a learner notices the interconnection — a kanji they reviewed yesterday appears in a grammar example today, using vocabulary they already know. They realize this one app is doing what three separate apps couldn't. Combined with the cognitive load ring telling them "you've done enough for today" instead of showing 200 pending reviews, the app earns trust as a sustainable daily practice tool.

**User value signals:**
- Users explore the full breadth of the app rather than using only one domain.
- Users capture wild content (camera/microphone) and pull it into their study flow (post-MVP).
- Users write personal mnemonics or notes — a sign of deep engagement.
- Users choose to contribute content back to the community — the strongest signal of perceived value.

### Business Success

Since japanese-learning is a free, open-source project with no revenue model, "business success" is measured through adoption, community health, and project sustainability.

**3-month post-launch goals:**
- App published on Google Play Store and Apple App Store.
- Core learning loop stable and functional across both platforms.
- Initial community of early adopters providing feedback through GitHub issues.
- First community content contributions (mnemonics, corrections) flowing through the PR pipeline.

**12-month post-launch goals:**
- ~500 daily active users across all platforms.
- Self-sustaining community contribution pipeline — content quality improving without sole reliance on the project creator.
- Positive app store ratings (4.0+ average).
- Recognition in Japanese learning communities (Reddit, Discord, YouTube) as a credible free alternative to WaniKani + Bunpro.

### Technical Success

**Database and query performance:**
- SQLite query response time for standard operations (fetching review queue, loading item details, updating SRS state) stays under 100ms on mid-range devices. This is the canary metric — if queries slow down as the database grows (more JLPT levels, more community content, more user progress data), it signals the need for indexing optimization, query refactoring, or database splitting before users feel the drag.
- Database update downloads (JSON-to-SQLite compiled output) remain reasonable in size — users shouldn't need to download hundreds of MB for incremental content updates.

**Offline reliability:**
- App functions fully offline after initial content download. No features degrade or error due to missing network (except BYO-key AI features, which explicitly require connectivity).

**Cross-platform parity:**
- Feature parity between Android and iOS. No platform-specific regressions or degraded experiences.

### Measurable Outcomes

| Category | KPI | Target (6 months) | Measurement |
| --- | --- | --- | --- |
| **Adoption** | Daily Active Users (DAU) | 500 | App analytics |
| **Retention** | D30 retention (users active 30 days after first session) | 40% | Cohort analysis |
| **Engagement** | Multi-domain usage (2+ domains in first month) | 60% of active users | Feature usage tracking |
| **Engagement** | Review session completion rate | 70%+ | Session start vs. completion |
| **Engagement** | Sessions ending within cognitive load threshold | 80%+ | Cognitive load ring tracking |
| **Community** | Content PRs per month | 5–10 | GitHub PR tracking |
| **Community** | Codebase contributions per month | 2–5 | GitHub PR tracking |
| **Quality** | App store rating | 4.0+ | Play Store / App Store |
| **Quality** | GitHub stars | 200+ | GitHub |
| **Technical** | SQLite query response (standard ops, mid-range device) | <100ms | Performance monitoring |

**Leading indicators:**
- First-session completion rate (do users finish their first review session?)
- Day 7 return rate (do users come back after the first week?)
- First community contribution (how quickly does the first non-creator PR arrive?)

## User Journeys

### Journey 1: Yuki — The Fresh Beginner (Primary User, Success Path)

Yuki is 22, works part-time at a bookstore, and has been watching anime unsubtitled for years — catching words here and there but never truly understanding. She tried Duolingo for three months and hit a wall: the lessons felt like a game, not real learning. She looked into WaniKani but can't justify $9/month on her budget. A Reddit thread recommends japanese-learning as "the free WaniKani + Bunpro killer."

**Opening scene:** Yuki downloads the app from the Play Store on her commute home. No account creation, no email, no paywall. She selects "I'm a beginner (N5)" and picks "relaxed" session intensity (~15 min/day). The app configures her first review queue in seconds.

**Rising action:** Her first session teaches five radicals and three kanji through input-based testing — she types the readings, not self-grades on flashcards. She gets one wrong and sees a "close!" hint (Levenshtein typo detection caught her fat finger, not a knowledge gap). The cognitive load ring fills as she studies. After 15 minutes, the ring glows — "You've done great for today." No "187 reviews pending" anxiety. She closes the app feeling accomplished.

**Climax (Week 2):** Yuki opens her grammar review and sees a sentence using 食べる — the same kanji she reviewed yesterday, in a vocabulary word she learned three days ago. She didn't plan this connection. The app's invisible nudge system surfaced it naturally. She types the answer correctly. This is the "aha moment" — one app is connecting kanji, vocabulary, and grammar automatically. Three separate apps never did this.

**Resolution (Month 2+):** Yuki is on a 45-day streak. She picks up a manga volume and recognizes kanji she learned in the app. She writes a mnemonic for a tricky kanji and the app asks if she'd like to contribute it. She logs in with GitHub (first time) and taps "contribute." She doesn't know she just opened a PR. The curriculum gets slightly better because she used the app.

**Capabilities revealed:** Onboarding (level selection, no account), input-based SRS testing, FSRS scheduling, WanaKana input, typo detection, cognitive load ring, invisible nudge system, unified review mixer, personal mnemonics, community contribution flow, streak tracking.

---

### Journey 2: Mika — The Switcher with Existing Knowledge (Primary User, Edge Case)

Mika is 31, has been using WaniKani for 18 months and knows ~1,200 kanji. She's studying for N2. WaniKani covers kanji well, but she also needs grammar — and paying $9/month for WaniKani plus $5/month for Bunpro is $168/year for two tools that don't talk to each other. She hears about japanese-learning on a WaniKani community forum.

**Opening scene:** Mika downloads the app and selects "I have existing knowledge." She picks N3 as her starting point. The app presents the N5 and N4 kanji and vocabulary lists — she taps through, marking items as "already known" (skip) or "in progress" (inject into SRS at an appropriate interval). For the handful of N5 grammar points she's shaky on, she marks them "in progress." The bulk-marking takes about 4 minutes.

**Rising action:** Her first review session is a unified mix — N3 grammar she's never seen (new items), N4 vocabulary she marked as "in progress" (short intervals), and the occasional mature kanji review. The session feels calibrated to *her* knowledge, not a generic level. Grammar examples use vocabulary she already knows — the app checked before constructing the sentence.

**Climax:** Mika realizes she's studying grammar with the same rigor and input-based testing that made WaniKani effective for kanji — but in the same app, for free. She cancels her WaniKani subscription. One week later she cancels Bunpro. She's saving $168/year and getting a more integrated experience.

**Resolution:** Mika passes N2 four months later. Her review sessions covered kanji, vocabulary, grammar, and reading passages — all in one daily session. She starts contributing grammar point corrections through the in-app PR flow, drawing on her experience with Bunpro to flag where explanations could be clearer.

**Capabilities revealed:** Onboarding for existing learners (bulk item marking — skip/in-progress), manual knowledge import, FSRS interval injection for partially-known items, grammar examples filtered by known vocabulary, unified review mixer across content types, community contribution for corrections.

---

### Journey 3: Community Contributor — Improving the Curriculum (Secondary User)

Sato is a native Japanese speaker living in London who teaches Japanese part-time. She discovered japanese-learning when a student recommended it. She's impressed by the structure but notices a few grammar explanations that could be clearer and some example sentences that sound unnatural.

**Opening scene:** While browsing a grammar point in the app, Sato sees an example sentence that's grammatically correct but awkward — no native speaker would say it that way. She taps "suggest edit" and rewrites the sentence. The app asks if she'd like to contribute this to the community. She logs in with GitHub.

**Rising action:** Behind the scenes, the app pulls the latest `main`, creates a branch, commits her JSON edit, and opens a PR back to `main` — all in a few seconds behind a loading spinner. Sato sees "Contribution submitted!" She doesn't know what a PR is. She doesn't need to.

**Climax:** Over the next week, Sato submits five more corrections and two new mnemonics. She notices her local edits accumulating and batch-submits them in one go. The app doesn't nag her after every edit — it lets contributions pile up and offers a "submit all" option when she's ready.

**Resolution:** Riyaz (admin) reviews and merges Sato's PRs. GitHub Actions recompile the JSON into SQLite. The next time any user opens the app and checks for updates, Sato's improved sentences are live. The curriculum is better because a native speaker used the app.

**Capabilities revealed:** In-app content editing, invisible GitHub PR generation (branch/commit/PR), batch contribution submission, GitHub OAuth login (contributor-only), content review pipeline.

---

### Journey 4: Admin/Maintainer — Keeping the Engine Running

Riyaz is the project creator and sole admin during early growth. He reviews community contributions, manages the GitHub repo, monitors app stability, and handles app store submissions.

**Opening scene:** Riyaz opens GitHub on a Monday morning and sees 3 new PRs from community contributors — a mnemonic addition, a grammar example correction, and a batch of synonym suggestions. He reviews each diff in the GitHub UI. The JSON structure is clean and the changes are sensible.

**Rising action:** He merges the PRs. GitHub Actions automatically triggers: the JSON-to-SQLite compilation runs, validates schema integrity, and produces a new versioned SQLite database. The compiled database is committed to the repo via Git LFS. No manual build step required.

**Climax:** A user files a GitHub issue: "The app crashes when I try to mark all N4 kanji as known at once." Riyaz reproduces the bug on his test device — it's a SQLite write lock issue when bulk-updating hundreds of items simultaneously. He fixes the query to batch the updates and pushes a patch. The fix goes through Expo's OTA update system — users get it without downloading a new app store build.

**Resolution:** As the community grows past 50 active contributors, Riyaz designates two trusted reviewers (users whose contributions have been consistently high-quality). He raises the auto-merge threshold from 5 to 8 approvals. The content pipeline scales without him reviewing every PR personally.

**Capabilities revealed:** GitHub PR review workflow, GitHub Actions CI/CD pipeline (JSON → SQLite compilation), Git LFS for database distribution, app store management, OTA updates via Expo, bug triage and patching, trusted reviewer designation, auto-merge threshold management.

---

### Journey 5: Kenji — Offline on the Tokyo Metro (Primary User, Edge Case)

Kenji relocated to Tokyo two weeks ago. He uses the app on his morning commute — 35 minutes on the Marunouchi Line, where cell signal drops in and out of tunnels. He's studying N4 vocabulary and grammar for daily survival: ordering food, reading station signs, following basic work conversations.

**Opening scene:** Kenji opens the app underground. No loading spinner, no "connect to continue." The app works immediately — his review queue, progress data, and all curriculum content are stored locally in SQLite. He starts his morning review.

**Rising action:** Mid-session, his train passes through a tunnel with no signal. Nothing changes. The app doesn't stutter, doesn't show an error, doesn't lose his progress. He finishes a 20-minute session entirely offline.

**Climax:** At lunch, Kenji tries the AI reading passage feature (he added his OpenAI API key during setup). The app generates a short passage about ordering at a ramen shop, using grammar and vocabulary he's been studying. Comprehension questions follow. This feature needs network — the app told him so when he configured it — but everything else works without it.

**Resolution:** On the weekend, Kenji connects to Wi-Fi at home. The app checks for curriculum updates — a new version of the SQLite database is available (community contributions merged during the week). It downloads the delta in seconds. His progress is untouched. Monday morning, back on the metro, fully offline, the updated content is ready.

**Capabilities revealed:** Full offline operation (local SQLite), graceful degradation for AI features (network required, clearly communicated), database version checking and update download, progress persistence across sessions, no-account usage.

---

### Journey Requirements Summary

| Journey | Key Capabilities Revealed |
| --- | --- |
| **Yuki (fresh beginner)** | Onboarding, input-based SRS, FSRS, WanaKana, typo detection, cognitive load ring, nudge system, review mixer, mnemonics, streaks, contribution flow |
| **Mika (switcher)** | Existing knowledge import, bulk item marking, FSRS interval injection, vocabulary-aware grammar, unified mixer, contribution corrections |
| **Sato (contributor)** | In-app editing, invisible PR generation, batch submission, GitHub OAuth, content review pipeline |
| **Riyaz (admin)** | PR review, CI/CD pipeline, Git LFS, app store management, OTA updates, bug triage, trusted reviewer system, auto-merge scaling |
| **Kenji (offline)** | Full offline operation, local SQLite, graceful AI degradation, database versioning/updates, no-account usage |

**Cross-cutting capabilities across all journeys:** Local-first data architecture, JLPT-aligned progression, input-based testing, FSRS scheduling, cognitive load management, community contribution pipeline, cross-platform parity (Android & iOS).

## Domain-Specific Requirements

### Content Quality & Moderation

Community-contributed content (mnemonics, example sentences, corrections, reading passages) flows through the GitHub PR pipeline. Quality assurance mechanisms:
- **MVP:** Admin-reviewed merges (Riyaz and designated admins). GitHub Actions validate JSON schema integrity on every PR.
- **Post-MVP:** Threshold-based auto-merge (initially 5 community approvals). Disputed-flag system auto-reverts merged content that receives excessive downvotes. Trusted reviewer tier for high-quality contributors.
- **Risk:** Pedagogically incorrect content (wrong readings, misleading grammar explanations) reaching users. Mitigation: schema validation catches structural errors; admin review catches pedagogical errors at MVP scale; community review scales moderation post-MVP.

### Accessibility

Mobile accessibility best practices apply:
- Screen reader compatibility (TalkBack on Android, VoiceOver on iOS) for navigation, review sessions, and results.
- Sufficient color contrast ratios for the cognitive load ring and streak UI.
- Scalable text for all learning content.
- Input-based testing must work with accessibility keyboards and input methods.

### Privacy & Data

- No user accounts required for core functionality. No personal data collected or transmitted.
- All learning progress and user data stored locally on-device in SQLite.
- GitHub OAuth token stored securely (platform-appropriate secure storage: Keychain on iOS, Android Keystore on Android) and used only for contribution submissions.
- BYO-key AI API keys stored in platform-appropriate secure storage. API calls go directly from the user's device to the AI provider — the app has no intermediary server.

### Curriculum Standards

- All content organized by JLPT levels (N5→N1) — the internationally recognized Japanese Language Proficiency Test framework.
- JLPT alignment provides a universally understood progression model, replacing proprietary level systems.

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Cross-Domain Micro-Reinforcement (Invisible Nudge System + Unified Review Mixer)**
No existing Japanese learning tool creates cross-domain reinforcement loops within a single review session. WaniKani handles kanji in isolation. Bunpro handles grammar in isolation. Neither connects them. This product's invisible nudge system applies micro-adjustments to related items when one is reviewed — reviewing a kanji slightly boosts its associated vocabulary and grammar scheduling. The unified review mixer then interleaves all content types into a single session, creating natural "kanji → vocabulary → grammar" connections the learner experiences without engineering them manually. This is the mechanism behind the "aha moment" — the core differentiator no multi-app stack can replicate.

**2. Cognitive Load Ring (Fitness Tracker UX Cross-Pollination)**
Borrowed from fitness tracking (WHOOP/Garmin strain models) and applied to SRS learning. Instead of the anxiety-inducing "200 reviews pending" badge that drives learners away from every existing SRS app, the cognitive load ring tracks daily mental strain — heavier items (new kanji) cost more energy than light reviews (mature vocabulary). The ring fills as the user studies, visually communicating when they've done enough. It adapts over time as the learner grows stronger, like upgrading from 1km to 2km runs. No SRS app uses a mental energy model to manage review load.

**3. Invisible Open-Source Contribution Pipeline**
Open-source contribution disguised as standard in-app behavior. Users tap "suggest edit" or "contribute," and the app silently pulls the latest `main`, creates a branch, commits the JSON change, and opens a PR back to `main` using their GitHub token — all behind a loading spinner. The user sees "Contribution submitted!" and never interacts with git. Contributions can accumulate locally and be batch-submitted to avoid prompt fatigue. This pattern transforms everyday app users into open-source contributors without requiring technical knowledge — a model reusable by any open-source content project.

**4. Serverless Content Distribution (JSON → SQLite → Git LFS + R2)**
The entire content pipeline operates without a backend server. Source data lives as structured JSON in GitHub (human-readable diffs for PR review). GitHub Actions compile JSON into an optimized SQLite database on merge. The compiled database is versioned in the repo via Git LFS. Binary media (audio) is served from Cloudflare R2. The app downloads the SQLite database on startup if the version has changed. This architecture eliminates hosting costs, enables fully offline operation, and supports a community-driven content pipeline — all without a single server to maintain.

### Market Context & Competitive Landscape

- **No existing tool** combines all four innovations. WaniKani has strong input-based kanji SRS but no cross-domain reinforcement, no cognitive load management, and a proprietary closed-source model. Bunpro has grammar SRS but operates in isolation from kanji tools. Anki is open-source and uses FSRS but relies on honor-system self-grading, has no structured curriculum, and requires significant setup expertise.
- **The "stack consolidator" positioning** is validated by market research: serious Japanese learners routinely assemble 2–3 paid tools that don't communicate. Community threads explicitly ask whether paying for WaniKani + Bunpro together is worth it.
- **Open-source language learning** has demand signals (KaniManabu, nihongo-master, gen-cards on GitHub) but no project has achieved the combination of depth, polish, and community pipeline this product targets.

### Validation Approach

- **Invisible nudge system:** Validate that cross-domain micro-reinforcement improves retention rates compared to isolated domain review. Measure: do users who encounter related items across domains in a single session retain them better than users reviewing domains separately? A/B testable post-launch.
- **Cognitive load ring:** Validate that the ring reduces session abandonment and review pile-up anxiety. Measure: session completion rate (target 80%+ within threshold) and long-term streak maintenance vs. baseline SRS apps.
- **Contribution pipeline:** Validate that non-technical users successfully contribute content. Measure: first community PR arrival time, contribution success rate (PRs submitted vs. PRs merged), contributor return rate.
- **Serverless distribution:** Validate that Git LFS + SQLite download model scales with content growth. Measure: database download size over time, update frequency, and user-perceived update latency.

### Risk Mitigation

| Innovation | Risk | Fallback |
| --- | --- | --- |
| **Invisible nudge system** | Nudge weights miscalibrated — too aggressive disrupts genuine FSRS scheduling, too subtle has no effect | Ship with conservative default weights; make weights configurable in code; gather data before tuning |
| **Cognitive load ring** | Users ignore the ring or find it patronizing | Make the ring informational, not restrictive — users can always continue past the threshold; iterate on visual design based on feedback |
| **Contribution pipeline** | GitHub OAuth friction deters contributors; PR volume overwhelms admin review | Batch submission reduces prompt fatigue; schema validation in CI catches structural errors automatically; trusted reviewer tier scales moderation |
| **Serverless distribution** | SQLite database grows too large for reasonable mobile downloads as content scales to N1 | Shard database by JLPT level (users download only their current + adjacent levels); implement incremental/delta updates rather than full database replacement |

## Mobile App Specific Requirements

### Project-Type Overview

Cross-platform mobile application built with React Native (Expo) targeting Android and iOS from a single codebase. The app is a daily-use learning tool designed for short sessions (15–30 minutes) on commutes, at home, or during breaks. Fully offline-capable with local data storage. Desktop (Electron + React Native Web) is a post-MVP Phase 2 target using the same codebase.

### Platform Requirements

| Attribute | Specification |
| --- | --- |
| **Framework** | React Native (Expo / Expo managed workflow) |
| **Platforms** | Android, iOS (MVP); Desktop via Electron + React Native Web (post-MVP) |
| **Min Android version** | Android 10 (API 29) or per Expo's supported minimum |
| **Min iOS version** | iOS 15 or per Expo's supported minimum |
| **Build pipeline** | Expo Application Services (EAS) for builds, signing, and submission |
| **OTA updates** | Expo Updates for JS bundle patches without app store resubmission |
| **State management** | Local SQLite for curriculum data and user progress; no remote state |

### Device Permissions

| Permission | Purpose | MVP/Post-MVP |
| --- | --- | --- |
| **Internet** | Database version check and download, BYO-key AI API calls, GitHub OAuth for contributions | MVP |
| **Storage** | Local SQLite database, exported progress files | MVP |
| **Notifications** | Streak reminders and daily review nudges | MVP |
| **Camera** | OCR wild capture (Tesseract for Japanese text extraction from photos) | Post-MVP Phase 1 |
| **Microphone** | ASR wild capture (speech-to-text for audio extraction) | Post-MVP Phase 1 |

### Offline Mode

The app is designed offline-first — network is the exception, not the requirement.

**Fully offline (no network needed):**
- All SRS review sessions (kanji, vocabulary, grammar)
- FSRS scheduling calculations and progress tracking
- Cognitive load ring computation
- Streak tracking and display
- Reading community-contributed passages
- Personal mnemonic creation and editing
- Onboarding and item marking (skip/in-progress)
- Local contribution drafts (queued for later submission)

**Network required:**
- Initial curriculum database download (first launch)
- Database version check and update download (on app open, if Wi-Fi available)
- BYO-key AI features (reading passage generation, future conversation practice)
- GitHub OAuth login and PR submission (contribution pipeline)

**Graceful degradation:**
- If no network: AI features show clear "requires internet" messaging. All other features function normally.
- If database update available but no Wi-Fi: defer download, continue with current version. No user-facing error.

### Push Notification Strategy

| Notification Type | Trigger | Content | Frequency |
| --- | --- | --- | --- |
| **Daily review reminder** | Scheduled time (user-configurable) | "Your daily review is ready — X items waiting" | Once daily |
| **Streak at risk** | No session completed by evening (configurable threshold) | "Don't lose your X-day streak!" | Once daily max |
| **Streak milestone** | Reaching 7, 30, 50, 100, 365 days | "You hit a X-day streak!" | On milestone only |

**Notification principles:**
- All notifications are opt-in and configurable in settings.
- Never more than one notification per day.
- No marketing, upselling, or engagement-farming notifications — only learning-relevant nudges.
- Notification time defaults to a sensible hour but is user-adjustable.

### Store Compliance

**Google Play Store:**
- Standard Expo/EAS build pipeline for AAB generation and signing.
- Privacy policy required (even though no data is collected — document local-only data practices).
- Content rating: suitable for all ages (educational content, no user-generated social features in MVP).
- No in-app purchases or subscriptions — simplifies review.

**Apple App Store:**
- Standard Expo/EAS build pipeline for IPA generation and signing.
- Apple Developer Program membership ($99/year) required.
- App Tracking Transparency: not applicable (no tracking, no analytics SDKs that trigger ATT).
- Privacy nutrition labels: declare local storage only, no data collected or shared.
- Review consideration: BYO-key AI features must be clearly presented as user-initiated, not app-provided services.

### Implementation Considerations

- **Expo managed workflow** preferred for simplicity. Eject to bare workflow only if a native module is unavailable in Expo's ecosystem (evaluate SQLite, secure storage, and notification libraries before committing).
- **SQLite library:** Evaluate `expo-sqlite` vs `react-native-quick-sqlite` (or equivalent) for performance on large curriculum databases. The <100ms query target from Technical Success criteria is the benchmark.
- **Secure storage:** Use `expo-secure-store` for GitHub OAuth tokens and BYO-key AI API keys. Verify platform-appropriate backing (Keychain on iOS, Android Keystore on Android).
- **WanaKana integration:** The `wanakana` npm package runs in JS — verify it performs well within React Native's JS runtime for real-time romaji-to-hiragana conversion during input.
- **Levenshtein distance:** Lightweight computation — can run in JS without native module. Evaluate performance for real-time typo detection during answer input.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — the minimum feature set that lets a learner study kanji, vocabulary, grammar, and reading through input-based SRS in a single free app, experiencing cross-domain interconnection and cognitive load management from Day 1.

**Resource Requirements:** Solo developer (Riyaz). 3-month timeline to MVP launch on both app stores. AI-assisted development (Cursor/LLM coding tools) assumed for velocity.

**Key constraint:** Every feature in MVP must serve the core thesis — "one free app replaces a fragmented paid stack." If a feature doesn't contribute to a user feeling the all-in-one promise within their first two weeks, it's post-MVP.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Yuki (fresh beginner) — full success path
- Mika (switcher) — existing knowledge import and unified review
- Kenji (offline) — full offline operation
- Sato (contributor) — simplified contribution pipeline
- Riyaz (admin) — PR review and CI/CD pipeline

**Must-Have Capabilities:**

1. **Kanji & Vocabulary Learning** — JLPT-aligned progression (N5→N1), input-based SRS testing, FSRS scheduling, radicals as building blocks, bidirectional reinforcement via invisible nudge system, embedded WanaKana, Levenshtein typo detection, personal mnemonics.
2. **Grammar Learning** — JLPT-aligned grammar points with input-based SRS testing, verb conjugation practice integrated into grammar reviews, grammar examples prioritize known vocabulary, FSRS scheduling.
3. **Reading Passages** — Pre-seeded passages (creator-authored, tagged by JLPT level) available to all users from Day 1. AI-generated passages (BYO-key) for personalized content. Comprehension questions for each passage.
4. **Unified Review Mixer** — Single session interleaving kanji, vocabulary, and grammar. Invisible nudge system. Cognitive load ring.
5. **Streak System** — Daily streak tracking with push notification reminders.
6. **Onboarding & Customization** — JLPT level selection, manual item marking (known/in-progress/skip), session intensity preference, no account required.
7. **Community Contribution Pipeline** — Branch-based PR flow (pull main → create branch → commit → open PR to main). GitHub OAuth for contributors only. Admin-reviewed merges. Batch contribution support.
8. **CI/CD & Data Pipeline** — JSON source data in GitHub, GitHub Actions compile to SQLite, SQLite in repo with Git LFS, app downloads updated database on startup.
9. **Platform: Android & iOS** — React Native (Expo), local SQLite, fully offline-capable, published to both app stores.

**Architecture decision (contribution pipeline):** MVP uses a branch-based model (not fork-based). Contributors push branches to the main repo via their GitHub token. PRs are created from contributor branches to `main`. The admin (Riyaz) resolves conflicts and merges. This is simpler than the fork-based model discussed in brainstorming and sufficient for early community scale.

### Post-MVP Features

**Phase 2 (Post-MVP — near-term enhancements):**
- Listening practice with AI-generated audio (Cloudflare R2 delivery)
- Wild capture — camera (OCR) and microphone (ASR)
- Cognitive load ring recovery suggestions — when the ring fills, suggest lighter activities (e.g., reading practice, listening) instead of just signaling "done for the day"
- Dedicated verb conjugation practice section (standalone drills beyond what's integrated in grammar reviews)
- Streak milestone celebrations with progressive animations
- Additional UX polish and transition animations

**Phase 3 (Expansion):**
- Desktop app via Electron + React Native Web (macOS, Windows, Linux)
- AI conversation practice with three targeting modes
- AI-generated personalized mnemonics
- Gamified community review system (swipe to approve/reject, mandatory review gate, threshold-based auto-merge)
- WaniKani and Bunpro import tools
- Cross-device sync via manual export/import
- Bounded upvote/downvote system for community content ranking

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| FSRS implementation complexity | Medium | High | Use existing `ts-fsrs` npm package (MIT-licensed) rather than building from scratch |
| Unified review mixer + nudge system | Medium | Medium | Ship with simple round-robin interleaving first; add weighted nudges iteratively |
| SQLite performance on large datasets | Low | High | Benchmark early with full N5–N1 dataset; the <100ms query target is the tripwire |
| Community contribution OAuth flow | Medium | Medium | Build last — Riyaz is sole contributor initially; defer if timeline is tight |
| App store review rejection | Low | Medium | Submit to TestFlight/internal testing early; plan 2-week buffer before target launch |

**Market Risks:**

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Users don't discover the app | High | High | Seed initial community via Reddit (r/LearnJapanese), YouTube, JLPT study forums. GitHub README as landing page. |
| Users find MVP too limited vs. paid tools | Medium | Medium | Focus on the three domains that matter most (kanji, grammar, reading) with genuine depth; polish over breadth |
| Content quality insufficient without community | Medium | Medium | Creator seeds initial N5 content thoroughly; quality bar set by example before community contributes |

**Resource Risks:**

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| 3-month timeline too aggressive for solo dev | Medium | High | Ruthlessly defer anything not in must-have list. Use AI-assisted development. Build features in dependency order (FSRS engine → SRS UI → review mixer → contribution pipeline). |
| Burnout from solo development | Medium | Medium | Dogfood the app's own cognitive load philosophy — sustainable pace over crunch. Ship a working N5-only vertical slice first, then expand to N4–N1. |

## Functional Requirements

### Learning Content & Progression

- FR1: Learners can study kanji organized by JLPT level (N5→N1) with parallel progression within each level.
- FR2: Learners can study vocabulary organized by JLPT level (N5→N1) with parallel progression within each level.
- FR3: Learners can study grammar points organized by JLPT level (N5→N1) with input-based testing, including verb conjugation practice integrated into grammar reviews.
- FR4: Learners can study radicals as building blocks for kanji, with radicals taught before their associated kanji.
- FR5: Learners can read passages tagged by JLPT level, with comprehension questions that validate understanding.
- FR6: Learners can access pre-seeded reading passages without an AI key.
- FR7: Learners can generate personalized reading passages tailored to their current knowledge level using a BYO AI API key.
- FR8: The system presents grammar examples that prioritize vocabulary the learner has already studied.

### SRS Engine & Review

- FR9: Learners can prove knowledge through input-based testing — typing answers rather than self-grading.
- FR10: The system schedules reviews using FSRS (Free Spaced Repetition Scheduler) for research-backed optimal intervals.
- FR11: The system provides a unified review session that interleaves kanji, vocabulary, and grammar items intelligently.
- FR12: The system applies invisible micro-adjustments (nudges) to related items when one item is reviewed (e.g., reviewing a kanji nudges its associated vocabulary and grammar).
- FR12b: The system maintains a static relationship layer that maps connections between content types (kanji↔vocabulary, kanji↔radicals, grammar↔vocabulary) to drive the nudge system and vocabulary-aware grammar examples.
- FR13: Learners can input Japanese text via embedded romaji-to-hiragana conversion (WanaKana) without relying on the OS keyboard.
- FR14: The system detects typos using Levenshtein distance — accepting English answers with a warning for minor typos, rejecting Japanese answers but showing a "close!" hint for near-misses.

### Cognitive Load & Engagement

- FR15: The system tracks daily cognitive load through a visual ring that fills as the learner studies, with heavier items (new kanji) costing more energy than light reviews (mature vocabulary).
- FR16: The system communicates to the learner when they have done enough for the day based on their cognitive load threshold.
- FR17: The cognitive load threshold adapts over time as the learner grows stronger.
- FR18: Learners can maintain a daily streak, with the streak count visible in the app.
- FR19: The system sends opt-in push notifications for daily review reminders and streak-at-risk alerts.
- FR20: Learners can configure notification timing and opt out of notifications entirely.

### Onboarding & Customization

- FR21: Learners can select their starting JLPT level (N5 for beginners, or higher for existing learners) on first launch.
- FR22: Learners can mark individual kanji, vocabulary, or grammar items as "already known" (skip), "in progress" (add to SRS at appropriate interval), or "not started."
- FR23: Learners can bulk-mark items when importing existing knowledge (e.g., mark all N5 kanji as known).
- FR24: Learners can select session intensity preference (relaxed ~15 min or intense ~30 min daily sessions).
- FR25: Learners can begin using the app without creating an account or providing personal information.

### Personal Content

- FR26: Learners can write personal mnemonics for any kanji, vocabulary, or grammar item, stored locally on-device.
- FR27: Learners can view community-provided mnemonics for kanji, vocabulary, and grammar items.
- FR28: Learners can store a BYO AI API key securely on-device for accessing AI-powered features.

### Community Contribution

- FR29: Contributors can propose edits to curriculum content (kanji descriptions, readings, grammar details, synonyms, example sentences, reading passages) through an in-app flow.
- FR30: The system creates a GitHub branch and pull request from the contributor's edits without requiring git knowledge.
- FR31: Contributors can authenticate via GitHub OAuth when choosing to contribute (not required for general app usage).
- FR32: Contributors can accumulate local edits and batch-submit them as a single contribution.
- FR33: Contributors can contribute AI-generated reading passages back to the community curriculum.
- FR33b: All contributed content is tagged with its origin (human-authored or AI-generated) so reviewers and users can distinguish provenance.

### Administration & Content Pipeline

- FR34: Admins can review and merge community contributions via GitHub pull requests.
- FR35: The system automatically validates contributed content against JSON schema rules via CI (GitHub Actions).
- FR36: The system automatically compiles JSON source data into an optimized SQLite database when PRs are merged (GitHub Actions).
- FR37: The compiled SQLite database is versioned and stored in the repository via Git LFS.

### Data & Offline

- FR38: The app stores all curriculum data and user progress locally in SQLite on-device.
- FR39: The app functions fully offline after the initial content download, with no features degrading except BYO-key AI features.
- FR40: The app checks for curriculum database updates on launch and downloads the updated database if a new version is available.
- FR41: AI-powered features display clear messaging when network connectivity is required but unavailable.

### Accessibility

- FR42: The app supports screen readers (TalkBack on Android, VoiceOver on iOS) for navigation, review sessions, and results.
- FR43: The app provides sufficient color contrast ratios for all UI elements including the cognitive load ring.
- FR44: The app supports scalable text for all learning content.

## Non-Functional Requirements

### Performance

- NFR1: SRS review interactions (presenting an item, accepting input, displaying result) complete in under 200ms on mid-range devices. The review loop must feel instantaneous — any perceptible lag during typing or answer submission breaks the learning flow.
- NFR2: SQLite query response time for standard operations (fetching review queue, loading item details, updating SRS state) stays under 100ms on mid-range devices.
- NFR3: App cold start to first interactive screen completes within 3 seconds on mid-range devices.
- NFR4: Curriculum database update download completes within 30 seconds on a standard mobile connection for incremental updates.
- NFR5: WanaKana romaji-to-hiragana conversion renders in real-time during keystroke input with no visible delay.

### Security

- NFR6: GitHub OAuth tokens are stored using platform-appropriate secure storage (Keychain on iOS, Android Keystore on Android) and never written to unencrypted local storage or logs.
- NFR7: BYO AI API keys are stored using the same secure storage mechanism as OAuth tokens and transmitted only to the user-configured AI provider endpoint over HTTPS.
- NFR8: No user learning data, progress, or personal information is transmitted off-device. All learning state remains local to the device.
- NFR9: The contribution pipeline transmits only the content diff (proposed curriculum changes) to GitHub — never user progress, SRS state, or device information.

### Data Integrity & Reliability

- NFR10: User progress data (SRS state, streaks, cognitive load history, personal mnemonics) survives app updates, OS updates, and curriculum database updates without data loss.
- NFR11: The JSON-to-SQLite compilation pipeline validates schema integrity on every build. A compilation failure blocks the database update from being published.
- NFR12: If a curriculum database download is interrupted, the app continues operating with the existing database version. Partial downloads are discarded, not applied.
- NFR13: Streak tracking persists accurately across timezone changes, device restarts, and offline periods.

### Accessibility

- NFR14: The app meets WCAG 2.1 Level AA contrast ratio requirements (minimum 4.5:1 for normal text, 3:1 for large text) across all screens.
- NFR15: All interactive elements are navigable and operable via screen reader (TalkBack/VoiceOver) with meaningful labels.
- NFR16: Text content scales to 200% of default size without loss of content or functionality.
- NFR17: Input-based testing is operable via accessibility keyboards and input methods without requiring gesture-based interaction.

### Integration

- NFR18: GitHub API integration (OAuth authentication, branch creation, commit, PR creation) handles rate limiting gracefully — queuing requests and informing the user if limits are reached.
- NFR19: BYO AI API calls handle provider errors (rate limits, invalid keys, service unavailable) with clear user-facing error messages and no app crashes.
- NFR20: The app handles GitHub API unavailability gracefully — contribution drafts are preserved locally and can be resubmitted when connectivity is restored.

### Content Scalability

- NFR21: The SQLite database structure supports content growth from N5-only (MVP seed) to full N5–N1 coverage without requiring schema changes or app updates.
- NFR22: Database query performance remains within the <100ms target as content scales from initial seed (~500 items) to full curriculum (~10,000+ items across all JLPT levels).
