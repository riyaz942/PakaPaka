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
workflowType: "prd"
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

japanese-learning is a free, open-source, cross-platform mobile application (Android & iOS) that replaces the fragmented, expensive multi-tool stack serious Japanese learners are forced to assemble today. It unifies kanji, vocabulary, grammar, and reading into a single app with input-based SRS testing powered by FSRS, JLPT-aligned progression (N5→N1), and interconnected learning where reviewing one skill domain reinforces related content across others. The core app is completely free — no subscriptions, no paywalls, no ads — eliminating $150–450/year in stacked tool costs. AI features (reading story generation tailored to what the learner is currently studying) are available via bring-your-own-key or through purchasing API access via OpenRouter for non-technical users. AI-generated visual mnemonics for radicals provide a rich, memorable learning experience from Day 1. All user data stays on-device, the app works fully offline, and both the codebase and curriculum are open-source.

The product targets four primary personas: anime/manga self-learners priced out of paid tools, professionals relocating to Japan who need practical Japanese fast, JLPT test preppers frustrated by paying for multiple specialized subscriptions, and switchers already using WaniKani who want grammar coverage at the same quality without another subscription. The app is built by a learner solving their own problem — strong on kanji but struggling with grammar, with no single free tool covering both at the depth required.

### What Makes This Special

**All-in-one with real depth.** Not a shallow phrase app — WaniKani-level rigor across kanji, vocabulary, grammar, and reading in a single product. The unified review mixer interleaves content types intelligently, and an invisible nudge system creates micro-reinforcement loops (reviewing a kanji boosts its related vocabulary and grammar). Learners feel the interconnection within their first two weeks — the "aha moment" that no multi-app stack delivers.

**AI reading stories built from what you're learning.** Once a learner has enough building blocks, the app generates short stories using exactly the kanji, vocabulary, and grammar they are currently studying. This creates a felt reinforcement through narrative context — the kind of interconnection no multi-app stack can replicate. Available via BYO-key or through OpenRouter purchase for non-technical users.

**Visual mnemonics for radicals from Day 1.** AI-generated mnemonic images for every radical provide a visually-rich learning experience immediately — ₹more memorable than plain text definitions. A pre-generated baseline set stored on Cloudflare R2 means every user benefits without needing an AI key.

**Free forever, open-source.** Zero cost for the core learning experience. No revenue model to protect, no premium tier gating features. AI enrichment is BYO-key or OpenRouter — the app never needs server infrastructure or subscription revenue.

**No equivalent exists.** No other tool — free or paid — combines all JLPT skill domains with input-based testing, FSRS scheduling, AI-generated reading stories built from active learning material, visual radical mnemonics, and local-first architecture. The gap is well-documented in learner communities and validated by market research. The timing is right: FSRS is mature and MIT-licensed, React Native + Expo has stabilized for cross-platform, and BYO-key AI is a viable pattern.

## Project Classification

| Attribute           | Value                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Project Type**    | Cross-platform mobile app (React Native / Expo — Android & iOS)                                                            |
| **Domain**          | EdTech — language learning with structured curriculum and spaced repetition                                                |
| **Complexity**      | Medium — interconnected SRS engine, JSON-to-SQLite data pipeline, community contribution flow, cross-platform code sharing |
| **Project Context** | Greenfield — new product, no existing codebase                                                                             |

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
- Users generate AI reading stories and complete comprehension questions — a sign the interconnected learning is landing.
- Users write personal mnemonics or notes — a sign of deep engagement.
- Users set up an AI key (BYO or via OpenRouter) — indicating they see enough value to invest in AI features.

### Business Success

Since japanese-learning is a free, open-source project with no revenue model, "business success" is measured through adoption, engagement quality, and project sustainability.

**3-month post-launch goals:**

- App published on Google Play Store and Apple App Store.
- Core learning loop stable and functional across both platforms.
- Visual mnemonic images for all N5 radicals generated and live.
- AI reading story generation functional with both BYO-key and OpenRouter paths.
- Initial community of early adopters providing feedback through GitHub issues.

**12-month post-launch goals:**

- ~500 daily active users across all platforms.
- Visual mnemonic images covering N5 and N4 radicals.
- Community contribution pipeline live (post-MVP Phase 2) with first non-creator contributions flowing.
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

| Category       | KPI                                                      | Target (6 months)                   | Measurement                  |
| -------------- | -------------------------------------------------------- | ----------------------------------- | ---------------------------- |
| **Adoption**   | Daily Active Users (DAU)                                 | 500                                 | App analytics                |
| **Retention**  | D30 retention (users active 30 days after first session) | 40%                                 | Cohort analysis              |
| **Engagement** | Multi-domain usage (2+ domains in first month)           | 60% of active users                 | Feature usage tracking       |
| **Engagement** | Review session completion rate                           | 70%+                                | Session start vs. completion |
| **Engagement** | Sessions ending within cognitive load threshold          | 80%+                                | Cognitive load ring tracking |
| **Engagement** | AI story generation usage (users with keys)              | 50%+ generate at least 1 story/week | Feature usage tracking       |
| **Quality**    | App store rating                                         | 4.0+                                | Play Store / App Store       |
| **Quality**    | GitHub stars                                             | 200+                                | GitHub                       |
| **Technical**  | SQLite query response (standard ops, mid-range device)   | <100ms                              | Performance monitoring       |

**Leading indicators:**

- First-session completion rate (do users finish their first review session?)
- Day 7 return rate (do users come back after the first week?)
- AI key setup rate (do users configure an AI key within the first week?)
- Reading story engagement (do users with keys read and complete comprehension questions?)

## User Journeys

### Journey 1: Yuki — The Fresh Beginner (Primary User, Success Path)

Yuki is 22, works part-time at a bookstore, and has been watching anime unsubtitled for years — catching words here and there but never truly understanding. She tried Duolingo for three months and hit a wall: the lessons felt like a game, not real learning. She looked into WaniKani but can't justify $9/month on her budget. A Reddit thread recommends japanese-learning as "the free WaniKani + Bunpro killer."

**Opening scene:** Yuki downloads the app from the Play Store on her commute home. No account creation, no email, no paywall. She selects "I'm a beginner (N5)" and picks "relaxed" session intensity (~15 min/day). The app configures her first review queue in seconds.

**Rising action:** Her first session teaches five radicals — each with a vivid AI-generated mnemonic image that makes the radical's meaning stick instantly. She then learns three kanji built from those radicals through input-based testing — she types the readings, not self-grades on flashcards. She gets one wrong and sees a "close!" hint (Levenshtein typo detection caught her fat finger, not a knowledge gap). The cognitive load ring fills as she studies. After 15 minutes, the ring glows — "You've done great for today." No "187 reviews pending" anxiety. She closes the app feeling accomplished.

**Climax (Week 2):** Yuki opens her grammar review and sees a sentence using 食べる — the same kanji she reviewed yesterday, in a vocabulary word she learned three days ago. She didn't plan this connection. The app's invisible nudge system surfaced it naturally. She types the answer correctly. This is the "aha moment" — one app is connecting kanji, vocabulary, and grammar automatically. Three separate apps never did this.

**Resolution (Month 2+):** Yuki is on a 45-day streak. She picks up a manga volume and recognizes kanji she learned in the app. She set up her API key via OpenRouter last week — now she generates reading stories that use her current vocabulary. Reading a story about a girl visiting a bookstore, she recognizes every kanji and grammar point. The app made her current setup feel inefficient — one app is doing what three separate tools couldn't.

**Capabilities revealed:** Onboarding (level selection, no account), visual radical mnemonics, input-based SRS testing, FSRS scheduling, WanaKana input, typo detection, cognitive load ring, invisible nudge system, unified review mixer, AI reading stories, personal mnemonics, streak tracking, OpenRouter key setup.

---

### Journey 2: Mika — The Switcher with Existing Knowledge (Primary User, Edge Case)

Mika is 31, has been using WaniKani for 18 months and knows ~1,200 kanji. She's studying for N2. WaniKani covers kanji well, but she also needs grammar — and paying $9/month for WaniKani plus $5/month for Bunpro is $168/year for two tools that don't talk to each other. She hears about japanese-learning on a WaniKani community forum.

**Opening scene:** Mika downloads the app and selects "I have existing knowledge." She picks N3 as her starting point. The app presents the N5 and N4 kanji and vocabulary lists — she taps through, marking items as "already known" (skip) or "in progress" (inject into SRS at an appropriate interval). For the handful of N5 grammar points she's shaky on, she marks them "in progress." The bulk-marking takes about 4 minutes.

**Rising action:** Her first review session is a unified mix — N3 grammar she's never seen (new items), N4 vocabulary she marked as "in progress" (short intervals), and the occasional mature kanji review. The session feels calibrated to _her_ knowledge, not a generic level. Grammar examples use vocabulary she already knows — the app checked before constructing the sentence.

**Climax:** Mika realizes she's studying grammar with the same rigor and input-based testing that made WaniKani effective for kanji — but in the same app, for free. She cancels her WaniKani subscription. One week later she cancels Bunpro. She's saving $168/year and getting a more integrated experience.

**Resolution:** Mika passes N2 four months later. Her review sessions covered kanji, vocabulary, grammar, and AI reading stories — all in one daily session. The stories used exactly the N2 grammar and vocabulary she was studying, giving her reading practice that reinforced her SRS reviews through narrative context.

**Capabilities revealed:** Onboarding for existing learners (bulk item marking — skip/in-progress), manual knowledge import, FSRS interval injection for partially-known items, grammar examples filtered by known vocabulary, unified review mixer across content types, AI reading stories built from active learning material.

---

### Journey 3: Admin/Maintainer — Keeping the Engine Running (MVP)

Riyaz is the project creator and sole content manager during early growth. He manages the GitHub repo, generates visual mnemonic images for radicals, curates curriculum content, monitors app stability, and handles app store submissions.

**Opening scene:** Riyaz generates a batch of AI visual mnemonic images for the N5 radicals — creating memorable visual associations for each one. He uploads them to Cloudflare R2 and updates the curriculum JSON to reference the new image URLs.

**Rising action:** He pushes the updated JSON to GitHub. GitHub Actions automatically triggers: the JSON-to-SQLite compilation runs, validates schema integrity, and produces a new versioned SQLite database. The compiled database is committed to the repo via Git LFS. No manual build step required.

**Climax:** A user files a GitHub issue: "The app crashes when I try to mark all N4 kanji as known at once." Riyaz reproduces the bug on his test device — it's a SQLite write lock issue when bulk-updating hundreds of items simultaneously. He fixes the query to batch the updates and pushes a patch. The fix goes through Expo's OTA update system — users get it without downloading a new app store build.

**Resolution:** As the user base grows, Riyaz accepts direct GitHub PRs from technically-savvy community members. The in-app contribution pipeline (post-MVP) will later enable non-technical users to contribute improvements directly from the app.

**Capabilities revealed:** Visual mnemonic image generation pipeline, Cloudflare R2 media management, GitHub Actions CI/CD pipeline (JSON → SQLite compilation), Git LFS for database distribution, app store management, OTA updates via Expo, bug triage and patching.

---

### Journey 4: Community Contributor — Improving the Curriculum (Post-MVP)

Sato is a native Japanese speaker living in London who teaches Japanese part-time. She discovered japanese-learning when a student recommended it. She's impressed by the structure but notices a few grammar explanations that could be clearer and some example sentences that sound unnatural.

**Opening scene:** While browsing a grammar point in the app, Sato sees an example sentence that's grammatically correct but awkward — no native speaker would say it that way. She taps "suggest edit" and rewrites the sentence. The app asks if she'd like to contribute this to the community. She logs in with GitHub.

**Rising action:** Behind the scenes, the app pulls the latest `main`, creates a branch, commits her JSON edit, and opens a PR back to `main` — all in a few seconds behind a loading spinner. Sato sees "Contribution submitted!" She doesn't know what a PR is. She doesn't need to.

**Climax:** Over the next week, Sato submits five more corrections and two new mnemonics. She notices her local edits accumulating and batch-submits them in one go. The app doesn't nag her after every edit — it lets contributions pile up and offers a "submit all" option when she's ready.

**Resolution:** Riyaz (admin) reviews and merges Sato's PRs. GitHub Actions recompile the JSON into SQLite. The next time any user opens the app and checks for updates, Sato's improved sentences are live. The curriculum is better because a native speaker used the app.

**Capabilities revealed:** In-app content editing, invisible GitHub PR generation (branch/commit/PR), batch contribution submission, GitHub OAuth login (contributor-only), content review pipeline.

---

### Journey 5: Kenji — Offline on the Tokyo Metro (Primary User, Edge Case)

Kenji relocated to Tokyo two weeks ago. He uses the app on his morning commute — 35 minutes on the Marunouchi Line, where cell signal drops in and out of tunnels. He's studying N4 vocabulary and grammar for daily survival: ordering food, reading station signs, following basic work conversations.

**Opening scene:** Kenji opens the app underground. No loading spinner, no "connect to continue." The app works immediately — his review queue, progress data, and all curriculum content are stored locally in SQLite. He starts his morning review.

**Rising action:** Mid-session, his train passes through a tunnel with no signal. Nothing changes. The app doesn't stutter, doesn't show an error, doesn't lose his progress. He finishes a 20-minute session entirely offline.

**Climax:** At lunch, Kenji tries the AI reading story feature (he set up his API key via OpenRouter during onboarding). The app generates a short story about ordering at a ramen shop, using exactly the grammar and vocabulary he's been studying this week. Comprehension questions follow. This feature needs network — the app told him so when he configured it — but everything else works without it. The generated story is cached locally, so he can re-read it on tomorrow's commute.

**Resolution:** On the weekend, Kenji connects to Wi-Fi at home. The app checks for curriculum updates — a new version of the SQLite database is available (community contributions merged during the week). It downloads the delta in seconds. His progress is untouched. Monday morning, back on the metro, fully offline, the updated content is ready.

**Capabilities revealed:** Full offline operation (local SQLite), graceful degradation for AI features (network required, clearly communicated), database version checking and update download, progress persistence across sessions, no-account usage.

---

### Journey Requirements Summary

| Journey                   | Key Capabilities Revealed                                                                                                               | Phase    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Yuki (fresh beginner)** | Onboarding, input-based SRS, FSRS, WanaKana, typo detection, cognitive load ring, nudge system, review mixer, visual mnemonics, streaks | MVP      |
| **Mika (switcher)**       | Existing knowledge import, bulk item marking, FSRS interval injection, vocabulary-aware grammar, unified mixer, AI reading stories      | MVP      |
| **Riyaz (admin)**         | Visual mnemonic generation, R2 media management, CI/CD pipeline, Git LFS, app store management, OTA updates, bug triage                 | MVP      |
| **Kenji (offline)**       | Full offline operation, local SQLite, graceful AI degradation, database versioning/updates, no-account usage                            | MVP      |
| **Sato (contributor)**    | In-app editing, invisible PR generation, batch submission, GitHub OAuth, content review pipeline                                        | Post-MVP |

**Cross-cutting capabilities across all MVP journeys:** Local-first data architecture, JLPT-aligned progression, input-based testing, FSRS scheduling, cognitive load management, visual radical mnemonics, AI reading story generation, cross-platform parity (Android & iOS).

## Domain-Specific Requirements

### Content Quality & Moderation

**MVP:** All curriculum content is creator-authored and curated. Visual mnemonic images are pre-generated by the creator with quality review before upload. GitHub Actions validate JSON schema integrity on every commit.

**AI-generated reading stories:** Quality is managed through prompt engineering — stories are constrained to use only the learner's known/active items. Generated stories are ephemeral (per-user, cached locally) and do not enter the shared curriculum unless explicitly contributed (post-MVP). Bad generations are handled through regeneration.

**Post-MVP (community contribution phase):**

- Admin-reviewed merges (Riyaz and designated admins). GitHub Actions validate JSON schema integrity on every PR.
- Threshold-based auto-merge (initially 5 community approvals). Disputed-flag system auto-reverts merged content that receives excessive downvotes. Trusted reviewer tier for high-quality contributors.
- **Risk:** Pedagogically incorrect content (wrong readings, misleading grammar explanations) reaching users. Mitigation: schema validation catches structural errors; admin review catches pedagogical errors at initial community scale; community review scales moderation later.

### Accessibility

Mobile accessibility best practices apply:

- Screen reader compatibility (TalkBack on Android, VoiceOver on iOS) for navigation, review sessions, and results.
- Sufficient color contrast ratios for the cognitive load ring and streak UI.
- Scalable text for all learning content.
- Input-based testing must work with accessibility keyboards and input methods.

### Privacy & Data

- No user accounts required for core functionality. No personal data collected or transmitted.
- All learning progress and user data stored locally on-device in SQLite.
- AI API keys (BYO or obtained via OpenRouter) stored in platform-appropriate secure storage (Keychain on iOS, Android Keystore on Android). API calls go directly from the user's device to the AI provider — the app has no intermediary server.
- The OpenRouter redirect flow does not transmit any user learning data — only the key configuration result returns to the app.
- Visual mnemonic images are served from Cloudflare R2 (public URLs) — no authentication or user tracking involved in image loading.

### Curriculum Standards

- All content organized by JLPT levels (N5→N1) — the internationally recognized Japanese Language Proficiency Test framework.
- JLPT alignment provides a universally understood progression model, replacing proprietary level systems.

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Cross-Domain Micro-Reinforcement (Invisible Nudge System + Unified Review Mixer)**
No existing Japanese learning tool creates cross-domain reinforcement loops within a single review session. WaniKani handles kanji in isolation. Bunpro handles grammar in isolation. Neither connects them. This product's invisible nudge system applies micro-adjustments to related items when one is reviewed — reviewing a kanji slightly boosts its associated vocabulary and grammar scheduling. The unified review mixer then interleaves all content types into a single session, creating natural "kanji → vocabulary → grammar" connections the learner experiences without engineering them manually. This is the mechanism behind the "aha moment" — the core differentiator no multi-app stack can replicate.

**2. AI Reading Stories Built From Active Learning Material**
Once a learner has sufficient building blocks (kanji, vocabulary, grammar), the app generates short reading stories that specifically use the content they are currently studying. This is fundamentally different from generic graded readers — the stories are personalized to reinforce exactly what the learner is working on, creating narrative-driven repetition that makes vocabulary and grammar "stick" through context. No existing tool generates reading material tailored to a specific learner's active SRS items.

**3. Visual Mnemonics for Radicals (AI-Generated Baseline)**
Each radical receives an AI-generated visual mnemonic image that creates a memorable association with the radical's meaning. A pre-generated baseline set (created by the project maintainer) is stored on Cloudflare R2 and served to all users from Day 1. This gives the app an immediate visual richness that competitors lack — radicals are the building blocks of all kanji, and making them visually memorable from the start accelerates the entire kanji learning pipeline.

**4. Cognitive Load Ring (Fitness Tracker UX Cross-Pollination)**
Borrowed from fitness tracking (WHOOP/Garmin strain models) and applied to SRS learning. Instead of the anxiety-inducing "200 reviews pending" badge that drives learners away from every existing SRS app, the cognitive load ring tracks daily mental strain — heavier items (new kanji) cost more energy than light reviews (mature vocabulary). The ring fills as the user studies, visually communicating when they've done enough. It adapts over time as the learner grows stronger, like upgrading from 1km to 2km runs. No SRS app uses a mental energy model to manage review load.

**5. Invisible Open-Source Contribution Pipeline (Post-MVP)**
Open-source contribution disguised as standard in-app behavior. Users tap "suggest edit" or "contribute," and the app silently pulls the latest `main`, creates a branch, commits the JSON change, and opens a PR back to `main` using their GitHub token — all behind a loading spinner. The user sees "Contribution submitted!" and never interacts with git. Contributions can accumulate locally and be batch-submitted to avoid prompt fatigue. This pattern transforms everyday app users into open-source contributors without requiring technical knowledge — a model reusable by any open-source content project.

**6. Serverless Content Distribution (JSON → SQLite → Git LFS + R2)**
The entire content pipeline operates without a backend server. Source data lives as structured JSON in GitHub (human-readable diffs for PR review). GitHub Actions compile JSON into an optimized SQLite database on merge. The compiled database is versioned in the repo via Git LFS. Visual mnemonic images are served from Cloudflare R2. The app downloads the SQLite database on startup if the version has changed. This architecture eliminates hosting costs, enables fully offline operation, and supports future community-driven content updates — all without a single server to maintain.

**7. OpenRouter Integration for Non-Technical AI Access**
Instead of requiring users to understand API keys and AI providers, the app offers a guided path: redirect to OpenRouter where users can purchase API credits, then return the key to the app. This bridges the gap between "bring your own key" (which assumes technical knowledge) and "we handle it" (which requires a backend and payment processing). The app stays serverless while making AI features accessible to all users.

### Market Context & Competitive Landscape

- **No existing tool** combines these innovations. WaniKani has strong input-based kanji SRS but no cross-domain reinforcement, no AI reading stories, no visual radical mnemonics, no cognitive load management, and a proprietary closed-source model. Bunpro has grammar SRS but operates in isolation from kanji tools. Anki is open-source and uses FSRS but relies on honor-system self-grading, has no structured curriculum, and requires significant setup expertise.
- **The "stack consolidator" positioning** is validated by market research: serious Japanese learners routinely assemble 2–3 paid tools that don't communicate. Community threads explicitly ask whether paying for WaniKani + Bunpro together is worth it.
- **The switching trigger** must be a felt, immediate advantage in week 1-2 — not feature lists. The AI reading stories (built from exactly what you're learning) and visual radical mnemonics (memorable from Day 1) are designed to deliver that moment.
- **Open-source language learning** has demand signals (KaniManabu, nihongo-master, gen-cards on GitHub) but no project has achieved the combination of depth, polish, and AI-enhanced learning this product targets.

### Validation Approach

- **Invisible nudge system:** Validate that cross-domain micro-reinforcement improves retention rates compared to isolated domain review. Measure: do users who encounter related items across domains in a single session retain them better than users reviewing domains separately? A/B testable post-launch.
- **AI reading stories:** Validate that personalized stories built from active learning material improve retention and engagement. Measure: do users who read AI stories retain vocabulary/grammar better than those who only do SRS reviews? Do they report feeling more confident in comprehension?
- **Visual radical mnemonics:** Validate that AI-generated mnemonic images improve radical recall vs. text-only definitions. Measure: radical recall accuracy at D7 and D30 for users with visual mnemonics vs. text-only baseline.
- **Cognitive load ring:** Validate that the ring reduces session abandonment and review pile-up anxiety. Measure: session completion rate (target 80%+ within threshold) and long-term streak maintenance vs. baseline SRS apps.
- **OpenRouter purchase flow:** Validate that non-technical users successfully obtain and configure an API key through the OpenRouter redirect. Measure: conversion rate from "set up AI" prompt to successful key configuration.
- **Serverless distribution:** Validate that Git LFS + SQLite download model scales with content growth. Measure: database download size over time, update frequency, and user-perceived update latency.

### Risk Mitigation

| Innovation                   | Risk                                                                                                    | Fallback                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invisible nudge system**   | Nudge weights miscalibrated — too aggressive disrupts genuine FSRS scheduling, too subtle has no effect | Ship with conservative default weights; make weights configurable in code; gather data before tuning                                                                         |
| **AI reading stories**       | Generated stories are too easy/hard, use vocabulary outside the learner's active set, or feel generic   | Strict prompt engineering constraining stories to only use learned items; difficulty calibration based on SRS maturity levels; user feedback mechanism to rate story quality |
| **Visual radical mnemonics** | Pre-generated images don't resonate with all learners; image quality inconsistent across radicals       | Users can write personal text mnemonics as fallback; post-MVP allows regeneration with own key; iterate on image generation prompts based on feedback                        |
| **Cognitive load ring**      | Users ignore the ring or find it patronizing                                                            | Make the ring informational, not restrictive — users can always continue past the threshold; iterate on visual design based on feedback                                      |
| **OpenRouter purchase flow** | Users confused by redirect flow; OpenRouter changes their API/pricing; key configuration fails          | Clear step-by-step guide within the app; fallback to manual BYO-key entry; support multiple AI providers so users aren't locked to one                                       |
| **Serverless distribution**  | SQLite database grows too large for reasonable mobile downloads as content scales to N1                 | Shard database by JLPT level (users download only their current + adjacent levels); implement incremental/delta updates rather than full database replacement                |

## Mobile App Specific Requirements

### Project-Type Overview

Cross-platform mobile application built with React Native (Expo) targeting Android and iOS from a single codebase. The app is a daily-use learning tool designed for short sessions (15–30 minutes) on commutes, at home, or during breaks. Fully offline-capable with local data storage. Desktop (Electron + React Native Web) is a post-MVP Phase 2 target using the same codebase.

### Platform Requirements

| Attribute               | Specification                                                          |
| ----------------------- | ---------------------------------------------------------------------- |
| **Framework**           | React Native (Expo / Expo managed workflow)                            |
| **Platforms**           | Android, iOS (MVP); Desktop via Electron + React Native Web (post-MVP) |
| **Min Android version** | Android 10 (API 29) or per Expo's supported minimum                    |
| **Min iOS version**     | iOS 15 or per Expo's supported minimum                                 |
| **Build pipeline**      | Expo Application Services (EAS) for builds, signing, and submission    |
| **OTA updates**         | Expo Updates for JS bundle patches without app store resubmission      |
| **State management**    | Local SQLite for curriculum data and user progress; no remote state    |

### Device Permissions

| Permission        | Purpose                                                                                                     | MVP/Post-MVP     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| **Internet**      | Database version check and download, AI API calls (story generation), visual mnemonic image loading from R2 | MVP              |
| **Storage**       | Local SQLite database, cached mnemonic images, exported progress files                                      | MVP              |
| **Notifications** | Streak reminders and daily review nudges                                                                    | MVP              |
| **Camera**        | OCR wild capture (Tesseract for Japanese text extraction from photos)                                       | Post-MVP Phase 2 |
| **Microphone**    | ASR wild capture (speech-to-text for audio extraction)                                                      | Post-MVP Phase 2 |

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
- Visual mnemonic image loading from Cloudflare R2 (cached locally after first load)
- AI reading story generation (BYO-key or OpenRouter key)

**Graceful degradation:**

- If no network: AI features show clear "requires internet" messaging. All other features function normally.
- If database update available but no Wi-Fi: defer download, continue with current version. No user-facing error.

### Push Notification Strategy

| Notification Type         | Trigger                                                  | Content                                        | Frequency         |
| ------------------------- | -------------------------------------------------------- | ---------------------------------------------- | ----------------- |
| **Daily review reminder** | Scheduled time (user-configurable)                       | "Your daily review is ready — X items waiting" | Once daily        |
| **Streak at risk**        | No session completed by evening (configurable threshold) | "Don't lose your X-day streak!"                | Once daily max    |
| **Streak milestone**      | Reaching 7, 30, 50, 100, 365 days                        | "You hit a X-day streak!"                      | On milestone only |

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
- No in-app purchases or subscriptions — the OpenRouter redirect is an external purchase (user buys from OpenRouter directly, not through the app). This avoids Google Play billing requirements.

**Apple App Store:**

- Standard Expo/EAS build pipeline for IPA generation and signing.
- Apple Developer Program membership ($99/year) required.
- App Tracking Transparency: not applicable (no tracking, no analytics SDKs that trigger ATT).
- Privacy nutrition labels: declare local storage only, no data collected or shared.
- Review consideration: AI features must be clearly presented as user-initiated, using the user's own API key. The OpenRouter redirect must be framed as the user purchasing their own third-party service — not the app selling a service. This is important for avoiding Apple's 30% IAP requirement. The app facilitates key entry, it does not provide the AI service.
- Review consideration: Visual mnemonic images loaded from Cloudflare R2 are static educational content, not user-generated content requiring moderation.

### Implementation Considerations

- **Expo managed workflow** preferred for simplicity. Eject to bare workflow only if a native module is unavailable in Expo's ecosystem (evaluate SQLite, secure storage, and notification libraries before committing).
- **SQLite library:** Evaluate `expo-sqlite` vs `react-native-quick-sqlite` (or equivalent) for performance on large curriculum databases. The <100ms query target from Technical Success criteria is the benchmark.
- **Secure storage:** Use `expo-secure-store` for AI API keys (BYO and OpenRouter). Verify platform-appropriate backing (Keychain on iOS, Android Keystore on Android).
- **Image caching:** Visual mnemonic images from R2 need efficient caching — evaluate `expo-image` or `react-native-fast-image` for CDN image loading with local cache. Images should persist across sessions and work offline after first load.
- **OpenRouter integration:** Implement as an in-app browser redirect (WebView or system browser) to OpenRouter's signup/purchase flow. After purchase, OpenRouter provides an API key that the user pastes back into the app (or via a deep link/redirect URI if OpenRouter supports it). Research OpenRouter's onboarding flow for the exact integration pattern.
- **AI story generation:** Prompt engineering for story generation must strictly constrain output to the learner's known/active items. Consider a structured prompt that includes the list of learned kanji, vocabulary, and grammar points and instructs the model to use only those.
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
- Riyaz (admin) — content curation, visual mnemonic generation, CI/CD pipeline

**Must-Have Capabilities:**

1. **Kanji & Vocabulary Learning** — JLPT-aligned progression (N5→N1), input-based SRS testing, FSRS scheduling, radicals as building blocks with visual mnemonics, bidirectional reinforcement via invisible nudge system, embedded WanaKana, Levenshtein typo detection, personal mnemonics.
2. **Visual Mnemonics for Radicals** — AI-generated mnemonic images for each radical, pre-generated by the project creator and stored on Cloudflare R2. Displayed in-app for all users from Day 1 without requiring an AI key.
3. **Grammar Learning** — JLPT-aligned grammar points with input-based SRS testing, verb conjugation practice integrated into grammar reviews, grammar examples prioritize known vocabulary, FSRS scheduling.
4. **AI-Generated Reading Stories** — Once a learner has sufficient building blocks, AI generates short stories using their active kanji, vocabulary, and grammar. Comprehension questions validate understanding. AI access via BYO-key or OpenRouter purchase. Stories tagged by JLPT level and specific content reinforced.
5. **Unified Review Mixer** — Single session interleaving kanji, vocabulary, and grammar. Invisible nudge system. Cognitive load ring.
6. **Streak System** — Daily streak tracking with push notification reminders.
7. **Onboarding & Customization** — JLPT level selection, manual item marking (known/in-progress/skip), session intensity preference, AI key setup (BYO or OpenRouter redirect), no account required.
8. **CI/CD & Data Pipeline** — JSON source data in GitHub, GitHub Actions compile to SQLite, SQLite in repo with Git LFS, visual mnemonic images on Cloudflare R2, app downloads updated database on startup.
9. **Platform: Android & iOS** — React Native (Expo), local SQLite, fully offline-capable (except AI story generation), published to both app stores.

**Architecture decision (AI access):** The app supports two paths to AI features: (1) technical users enter their own API key from any supported provider (OpenAI, Anthropic, etc.), stored securely on-device; (2) non-technical users are redirected to OpenRouter to purchase API credits, after which the OpenRouter key is returned to the app. This keeps the app serverless — no payment processing, no backend, no subscription management.

### Post-MVP Features

**Phase 2 (Post-MVP — near-term enhancements):**

- Community contribution pipeline — in-app PR generation (branch-based model), GitHub OAuth for contributors, batch submission support, admin-reviewed merges
- Regeneratable visual mnemonics — users with an AI API key can generate alternative radical images if they don't connect with the default ones
- Listening practice with AI-generated audio (Cloudflare R2 delivery)
- Cognitive load ring recovery suggestions — when the ring fills, suggest lighter activities (e.g., reading practice, listening) instead of just signaling "done for the day"
- Dedicated verb conjugation practice section (standalone drills beyond what's integrated in grammar reviews)
- Streak milestone celebrations with progressive animations
- Additional UX polish and transition animations

**Phase 3 (Expansion):**

- Desktop app via Electron + React Native Web (macOS, Windows, Linux)
- Wild capture — camera (OCR) and microphone (ASR)
- AI conversation practice with three targeting modes
- AI-generated personalized text mnemonics
- Gamified community review system (swipe to approve/reject, mandatory review gate, threshold-based auto-merge)
- WaniKani and Bunpro import tools
- Cross-device sync via manual export/import
- Bounded upvote/downvote system for community content ranking

### Risk Mitigation Strategy

**Technical Risks:**

| Risk                                      | Likelihood | Impact | Mitigation                                                                                                         |
| ----------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| FSRS implementation complexity            | Medium     | High   | Use existing `ts-fsrs` npm package (MIT-licensed) rather than building from scratch                                |
| Unified review mixer + nudge system       | Medium     | Medium | Ship with simple round-robin interleaving first; add weighted nudges iteratively                                   |
| SQLite performance on large datasets      | Low        | High   | Benchmark early with full N5–N1 dataset; the <100ms query target is the tripwire                                   |
| AI story generation quality/consistency   | Medium     | Medium | Invest in prompt engineering upfront; constrain outputs to known items; cache good outputs for reuse               |
| OpenRouter integration complexity         | Low        | Medium | Research OpenRouter's API and redirect patterns early; fallback to BYO-key-only if redirect flow proves unreliable |
| Visual mnemonic image generation at scale | Medium     | Medium | Start with N5 radicals only (~50 images); iterate on generation prompts before expanding to N4+                    |
| App store review rejection                | Low        | Medium | Submit to TestFlight/internal testing early; plan 2-week buffer before target launch                               |

**Market Risks:**

| Risk                                      | Likelihood | Impact | Mitigation                                                                                                                                                      |
| ----------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users don't discover the app              | High       | High   | Seed initial community via Reddit (r/LearnJapanese), YouTube, JLPT study forums. GitHub README as landing page.                                                 |
| Users find MVP too limited vs. paid tools | Medium     | Medium | Focus on creating the "undeniable advantage" — AI reading stories and visual mnemonics deliver a richer experience than any single competitor in the first week |
| Switching trigger too weak                | Medium     | High   | Validate before building: Reddit polls, landing page waitlist, demo video. Look for users asking to switch, not just praising the idea                          |
| AI key setup is too much friction         | Medium     | Medium | Make AI features optional — core SRS loop works without AI. OpenRouter path reduces friction for non-technical users                                            |

**Resource Risks:**

| Risk                                         | Likelihood | Impact | Mitigation                                                                                                                                             |
| -------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3-month timeline too aggressive for solo dev | Medium     | High   | Ruthlessly defer anything not in must-have list. Use AI-assisted development. Community contribution deferred to post-MVP reduces scope significantly. |
| Visual mnemonic generation is time-consuming | Medium     | Low    | Start with N5 radicals only; batch-generate using consistent prompts; expand to N4 post-launch                                                         |
| Burnout from solo development                | Medium     | Medium | Dogfood the app's own cognitive load philosophy — sustainable pace over crunch. Ship a working N5-only vertical slice first, then expand to N4–N1.     |

## Functional Requirements

### Learning Content & Progression

- FR1: Learners can study kanji organized by JLPT level (N5→N1) with parallel progression within each level.
- FR2: Learners can study vocabulary organized by JLPT level (N5→N1) with parallel progression within each level.
- FR3: Learners can study grammar points organized by JLPT level (N5→N1) with input-based testing, including verb conjugation practice integrated into grammar reviews.
- FR4: Learners can study radicals as building blocks for kanji, with radicals taught before their associated kanji.
- FR4b: Each radical displays an AI-generated visual mnemonic image that creates a memorable association with the radical's meaning. Images are pre-generated and served from Cloudflare R2.
- FR5: Once a learner has accumulated sufficient building blocks (kanji, vocabulary, grammar), they can generate AI reading stories that specifically use the content they are currently studying.
- FR6: AI reading stories include comprehension questions that validate understanding — not just passive reading.
- FR7: Learners can generate personalized reading stories tailored to their current active learning material using an AI API key (BYO or obtained via OpenRouter).
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
- FR27: Learners can view the pre-generated visual mnemonic images for radicals and text mnemonics for kanji, vocabulary, and grammar items.
- FR28: Learners can store an AI API key securely on-device for accessing AI-powered features (story generation).
- FR28b: Learners can obtain an AI API key through two paths: (1) entering their own BYO key from any supported provider, or (2) being redirected to OpenRouter to purchase API credits and returning the key to the app.

### AI Reading Stories

- FR29: The system determines when a learner has reached sufficient proficiency (enough active kanji, vocabulary, and grammar) to unlock AI reading story generation for their current level.
- FR30: AI-generated stories are constrained to use only kanji, vocabulary, and grammar the learner has already studied or is actively reviewing — creating narrative reinforcement of current learning material.
- FR31: Each generated story includes comprehension questions that test understanding of both content and grammar patterns used in the story.
- FR32: Generated stories are cached locally so they can be re-read offline after initial generation.
- FR33: The system supports multiple AI providers (OpenAI, Anthropic, OpenRouter) via the stored API key, with appropriate error handling for each provider's API.

### Administration & Content Pipeline

- FR34: The project creator generates and manages visual mnemonic images for radicals, uploading them to Cloudflare R2.
- FR35: The system automatically validates curriculum content against JSON schema rules via CI (GitHub Actions).
- FR36: The system automatically compiles JSON source data into an optimized SQLite database when changes are merged (GitHub Actions).
- FR37: The compiled SQLite database is versioned and stored in the repository via Git LFS.
- FR37b: Visual mnemonic image URLs are stored in the curriculum data and referenced by the app to load images from Cloudflare R2.

### Community Contribution (Post-MVP)

- FR38-PM: Contributors can propose edits to curriculum content (kanji descriptions, readings, grammar details, synonyms, example sentences) through an in-app flow.
- FR39-PM: The system creates a GitHub branch and pull request from the contributor's edits without requiring git knowledge.
- FR40-PM: Contributors can authenticate via GitHub OAuth when choosing to contribute (not required for general app usage).
- FR41-PM: Contributors can accumulate local edits and batch-submit them as a single contribution.
- FR42-PM: All contributed content is tagged with its origin (human-authored or AI-generated) so reviewers and users can distinguish provenance.

### Data & Offline

- FR43: The app stores all curriculum data and user progress locally in SQLite on-device.
- FR44: The app functions fully offline after the initial content download, with no features degrading except AI story generation which requires network.
- FR45: The app checks for curriculum database updates on launch and downloads the updated database if a new version is available.
- FR46: Visual mnemonic images are cached locally after first load — subsequent views work offline.
- FR47: AI-powered features (story generation) display clear messaging when network connectivity is required but unavailable.
- FR48: Generated AI stories are stored locally and accessible offline after generation.

### Accessibility

- FR49: The app supports screen readers (TalkBack on Android, VoiceOver on iOS) for navigation, review sessions, and results.
- FR50: The app provides sufficient color contrast ratios for all UI elements including the cognitive load ring.
- FR51: The app supports scalable text for all learning content.

## Non-Functional Requirements

### Performance

- NFR1: SRS review interactions (presenting an item, accepting input, displaying result) complete in under 200ms on mid-range devices. The review loop must feel instantaneous — any perceptible lag during typing or answer submission breaks the learning flow.
- NFR2: SQLite query response time for standard operations (fetching review queue, loading item details, updating SRS state) stays under 100ms on mid-range devices.
- NFR3: App cold start to first interactive screen completes within 3 seconds on mid-range devices.
- NFR4: Curriculum database update download completes within 30 seconds on a standard mobile connection for incremental updates.
- NFR5: WanaKana romaji-to-hiragana conversion renders in real-time during keystroke input with no visible delay.

### Security

- NFR6: AI API keys (whether BYO or obtained via OpenRouter) are stored using platform-appropriate secure storage (Keychain on iOS, Android Keystore on Android) and never written to unencrypted local storage or logs.
- NFR7: AI API keys are transmitted only to the user-configured AI provider endpoint over HTTPS. The app never proxies API calls through any intermediary.
- NFR8: No user learning data, progress, or personal information is transmitted off-device. All learning state remains local to the device. AI story generation prompts include only curriculum-level data (which items the user is studying), not personal information.
- NFR9: The OpenRouter redirect flow uses standard OAuth/redirect patterns and does not expose any user data to OpenRouter beyond what is required for the key purchase.

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

- NFR18: AI API calls (to OpenAI, Anthropic, OpenRouter, or other supported providers) handle provider errors (rate limits, invalid keys, service unavailable, insufficient credits) with clear user-facing error messages and no app crashes.
- NFR19: The OpenRouter redirect flow handles edge cases gracefully — browser not available, user cancels purchase, redirect fails — with clear messaging and fallback to manual BYO-key entry.
- NFR20: Cloudflare R2 image loading handles unavailability gracefully — cached images display from local storage; missing images show a text-based fallback mnemonic rather than a broken image state.

### Content Scalability

- NFR21: The SQLite database structure supports content growth from N5-only (MVP seed) to full N5–N1 coverage without requiring schema changes or app updates.
- NFR22: Database query performance remains within the <100ms target as content scales from initial seed (~500 items) to full curriculum (~10,000+ items across all JLPT levels).
