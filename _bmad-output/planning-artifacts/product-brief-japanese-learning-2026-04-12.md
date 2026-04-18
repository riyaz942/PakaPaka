---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowCompleted: true
inputDocuments:
  - "_bmad-output/brainstorming/brainstorming-session-2026-03-14-1530.md"
  - "_bmad-output/planning-artifacts/research/market-open-source-local-first-japanese-learning-learners-research-2026-03-21.md"
date: 2026-04-12
author: Riyaz
---

# Product Brief: japanese-learning

## Executive Summary

japanese-learning is a free, open-source, local-first Japanese learning application that unifies kanji, vocabulary, grammar, reading, listening, and AI-powered conversation practice into a single cross-platform app (Android, iOS, desktop). It replaces the fragmented and expensive multi-tool stack that serious Japanese learners are forced to assemble today — delivering WaniKani-level rigor with input-based testing powered by FSRS, JLPT-aligned progression across all skill domains, and a polished, rewarding UX with cognitive load management and streak celebrations. The core app is completely free with no subscriptions; AI features are optional via bring-your-own-key. A community-driven content pipeline — where users contribute and review curriculum improvements through a gamified in-app process — ensures the learning material improves continuously without burning out maintainers. All user data stays on-device, the app works fully offline, and the entire codebase and curriculum are open-source.

---

## Core Vision

### Problem Statement

Japanese learners today are forced to assemble a fragmented, expensive stack of specialized tools to achieve meaningful progress. Kanji requires one paid subscription (WaniKani, ~$9/mo), grammar requires another (Bunpro, ~$5/mo), vocabulary drilling means configuring Anki decks, and listening, reading, and conversation practice each demand yet another tool. No single application covers kanji, grammar, vocabulary, reading, listening, and conversation with real depth — learners must juggle multiple apps, multiple subscriptions, and multiple progression systems that don't talk to each other.

### Problem Impact

- **Financial barrier:** Stacking even two specialist tools costs $150–$450/year, putting serious Japanese study out of reach for students, hobbyists, and learners in lower-income contexts.
- **Cognitive fragmentation:** Switching between apps with different UX, different progression models, and different SRS algorithms creates unnecessary mental overhead and breaks the learning flow.
- **False confidence from honor-system SRS:** Anki — the most popular free alternative — relies on self-reported recall ("good/bad/neutral") rather than input-based testing. Learners can overestimate their knowledge, leading to gaps that surface only during real-world use.
- **Rigid progression:** Existing tools lock learners into proprietary level systems. Moving from N5 to N4, skipping known material, or customizing the learning path is difficult or impossible.
- **Review burnout and churn:** The "200 reviews pending" anxiety is the number one reason learners abandon SRS apps. Current tools offer no mechanism to manage cognitive load intelligently.

### Why Existing Solutions Fall Short

- **WaniKani** delivers excellent input-based kanji learning but covers only kanji/vocabulary, is paid, and uses a proprietary progression system disconnected from JLPT levels.
- **Bunpro** attempts grammar SRS but suffers from content quality issues, rigid progression between JLPT levels, and a UX that doesn't feel like genuine learning.
- **Anki** is free and flexible but relies on an honor-system SRS, has a steep learning curve, offers no structured curriculum, and lacks input-based testing.
- **Duolingo** has polished UX and habit-forming design but lacks the depth needed for serious Japanese study — it's a starting point, not a learning system.
- **No existing tool** combines all skill domains (kanji, vocab, grammar, reading, listening, conversation) with input-based testing, JLPT-aligned progression, and a free/open-source model.

### Proposed Solution

A single, free, open-source application that covers the full breadth of Japanese learning with real depth:

- **Input-based SRS testing** across all content types — learners type their answers, not self-grade on flashcards — powered by FSRS for research-backed optimal scheduling.
- **JLPT-aligned parallel progression** (N5→N1) across kanji, vocabulary, grammar, reading, and listening — learners advance through a universally understood framework, not proprietary levels.
- **Interconnected learning** where reviewing kanji reinforces related vocabulary, grammar examples prioritize known words, and a unified review mixer intelligently interleaves content types.
- **AI as optional enhancement** (BYO-key) for conversation practice, personalized mnemonics, and content generation — the core app works 100% offline without AI.
- **"Wild capture"** via camera (OCR) and microphone (ASR) — learners encounter Japanese in movies, books, or signs and pull it directly into their study flow.
- **Rewarding, polished UX** — cognitive load ring (adapts like a fitness tracker), progressive streaks with milestone animations, and a design that feels as inviting as Duolingo while delivering WaniKani-level substance.
- **Community-powered curriculum** — users contribute mnemonics, corrections, and content through a frictionless in-app flow (invisible GitHub PRs). A gamified review system and threshold-based auto-merge keep quality high without maintainer burnout.
- **Cross-platform from one codebase** — Android, iOS, and local desktop (Electron + React Native Web), all offline-capable, all with local data storage.

### Key Differentiators

1. **All-in-one with depth:** Not a shallow phrase app — WaniKani-level rigor across kanji, vocabulary, grammar, reading, listening, and conversation in a single product.
2. **Free forever (core):** No subscriptions, no paywalls, no ads. AI features are optional via bring-your-own-key. Replaces $150–$450/year in stacked subscriptions.
3. **Input-based SRS with FSRS:** Learners prove knowledge by typing answers. Scheduling uses FSRS — the same research-backed algorithm adopted by Anki — not an honor system.
4. **Self-improving through community:** A gamified contribution and review pipeline turns everyday users into open-source contributors. The curriculum gets better over time, automatically.
5. **Local-first / offline:** All data on-device. Works on the train, on a plane, with no signal. No vendor lock-in — your progress is yours.
6. **Rewarding UX that prevents burnout:** Cognitive load ring manages daily mental energy. Streak celebrations with progressive animations. The app feels accomplishing, not overwhelming.

---

## Target Users

### Primary Users

**Persona 1: Yuki — The Anime/Manga Self-Learner**

- **Profile:** 18–28 years old, self-taught, motivated by consuming Japanese media (anime, manga, light novels, games) in the original language. May be a student or early-career professional. Budget-conscious.
- **Current situation:** Has tried Duolingo and hit a wall — it's too shallow for real Japanese. May have tried WaniKani's free levels or dabbled with Anki but found the setup intimidating or the honor-system unsatisfying. Uses multiple fragmented tools or has stalled entirely.
- **Pain:** Can't justify paying for WaniKani + Bunpro + other tools. Wants to actually *read* manga and *understand* anime without subtitles, but no single free tool gives them a structured path to get there.
- **Success looks like:** Opens the app every morning or evening for 15–30 minutes. Progresses through JLPT levels and can feel the difference when watching anime — recognizing grammar patterns, reading kanji in manga panels. The app feels rewarding, not like homework.
- **Why they choose this app:** Free, all-in-one, input-based testing that actually proves they know the material, polished UX with streak animations and the cognitive load ring keeping them motivated without burning out.

**Persona 2: Kenji — The Relocating Professional**

- **Profile:** 25–40 years old, professional who has accepted a role in Japan or is planning to relocate. May have some baseline Japanese from previous study or may be starting from scratch. Has limited free time but strong practical motivation.
- **Current situation:** Needs functional Japanese for daily life and work — reading signs, basic conversation, emails. Textbooks feel slow and disconnected from real-world application. May have started with a textbook (Genki, Minna no Nihongo) but wants a more guided, practice-oriented approach.
- **Pain:** Textbooks require too much time and self-direction. Paid apps are another recurring cost on top of relocation expenses. Needs something that fits into a busy schedule and delivers practical results fast.
- **Success looks like:** Can navigate daily life in Japan — ordering food, reading station signs, following basic work conversations. Studies 15–30 minutes daily on the train or at home. Trusts the app to tell them what to study next without overthinking curriculum.
- **Why they choose this app:** JLPT-aligned progression gives a clear roadmap. Offline works on the Tokyo metro. Wild capture (camera OCR) lets them scan signs and menus into their study flow. Free means no subscription to cancel if priorities shift.

**Persona 3: Mika — The JLPT Test Prepper**

- **Profile:** Any age, actively studying for a specific JLPT level (typically N3–N1). Disciplined and goal-oriented. May already use WaniKani, Bunpro, or Anki and is frustrated by the cost of stacking tools or gaps between them.
- **Current situation:** Paying for WaniKani (~$9/mo) for kanji and Bunpro (~$5/mo) for grammar, or grinding Anki decks with varying quality. Grammar and kanji progression systems don't talk to each other. The JLPT exam is a hard deadline.
- **Pain:** Spending $150–$450/year across multiple subscriptions. Bunpro's grammar feels rigid and hard to navigate between levels. Anki's self-grading doesn't give real confidence before exam day. No single tool covers all JLPT domains (kanji, vocab, grammar, reading, listening).
- **Success looks like:** All JLPT study in one place with input-based testing that builds real exam confidence. Can set their current level, skip what they already know, and focus preparation on weak areas. Passes the target JLPT level.
- **Why they choose this app:** Replaces two paid subscriptions with one free tool. Input-based testing mirrors exam rigor. FSRS scheduling is optimized for retention. Can manually mark known items to skip and set "halfway learned" items into the SRS system.

**Persona 4: Riyaz — The Switcher**

- **Profile:** Active learner already using one or more paid tools (e.g., WaniKani for kanji). Likes the quality of input-based SRS but frustrated by the lack of an equivalent tool for grammar without paying another subscription. Technically savvy — comfortable with apps, possibly interested in the open-source aspect.
- **Current situation:** Uses WaniKani and likes it, but there's no comparable free option for grammar. Doesn't want to pay for Bunpro on top of WaniKani. Has considered Anki but doesn't want the honor-system model. Has accumulated progress that they don't want to lose.
- **Pain:** Fragmentation — great kanji tool but no grammar equivalent at the same quality and price point (free). Switching costs feel high because of accumulated SRS progress.
- **Success looks like:** Imports or manually marks existing kanji knowledge (skip what's already mastered, set in-progress items into SRS). Gets the same input-based kanji experience plus grammar, reading, and listening in one place. Stops paying for separate subscriptions.
- **Why they choose this app:** All-in-one replaces the need for multiple tools. Manual import (select what to skip, mark items as partially learned) bridges the transition. Free eliminates subscription fatigue. Community-driven content means quality improves over time.

### Secondary Users

**Community Contributors**

Advanced learners (N2–N1 level or native speakers) who are motivated by improving the curriculum for others. They contribute mnemonics, fix errors, propose better example sentences, and review others' contributions through the gamified in-app review system. They may also be open-source developers interested in contributing to the codebase. Their engagement keeps the content pipeline alive and high-quality.

### User Journey

**Discovery:** Learner finds the app through Reddit recommendations ("best free Japanese learning app"), YouTube reviews, JLPT study guides, app store search, or GitHub. Word-of-mouth from the community grows over time.

**Onboarding:** On first launch, the learner selects their starting point — fresh beginner (N5) or existing learner (choose JLPT level, optionally mark individual items as known/in-progress/skip). The app configures their SRS queue and daily session intensity (relaxed ~15 min or intense ~30 min). No account required to start learning.

**First session (Day 1):** The learner completes their first review session — typing answers for kanji readings, vocabulary meanings, or grammar fill-in-the-blank. The cognitive load ring fills as they study, giving a visual sense of accomplishment. They finish feeling like they proved something, not just flipped cards.

**Aha moment (Week 1–2):** The learner notices the app connecting things — a kanji they learned yesterday appears in a grammar example today, using vocabulary they already know. The interlinked learning feels smarter than juggling separate apps. The streak counter starts to matter.

**Routine (Month 1+):** The app becomes a daily ritual — 15–30 minutes in the morning or evening, mostly on phone, occasionally on desktop for longer sessions. The cognitive load ring adapts as they grow stronger, like upgrading from 1km to 2km runs. Streak milestone animations (50 days, 100 days) feel rewarding. They encounter Japanese in the wild — a sign, a movie scene — and use the camera or microphone to capture it into their study flow.

**Contribution (Month 3+):** The learner writes a mnemonic that helps them remember a tricky kanji. The app offers to contribute it to the community. They log in with GitHub, and the contribution flows silently into the review pipeline. They start reviewing others' contributions too. The curriculum gets better because they use the app.

**Long-term (Month 6+):** The learner levels up through JLPT tiers. They can see real improvement — reading manga panels, catching grammar in anime dialogue, navigating a Japanese website. The app is their single tool. They tell other learners about it.

---

## Success Metrics

### User Success Metrics

**Learning Engagement (are users actually learning?):**
- **Multi-domain engagement:** Users actively engage with at least 2 core learning domains (e.g., kanji + grammar, or vocabulary + reading) within their first month — not just one isolated feature. Single-domain-only usage suggests the app isn't delivering on its all-in-one promise.
- **Review session completion:** Users complete their daily SRS review sessions (not just open the app). Target: 70%+ of sessions started are completed.
- **JLPT progression:** Users advance through JLPT-level content over time — measurable as items mastered per week/month within their current level.
- **Streak maintenance:** Active users maintain streaks of 7+ days. Streak milestone animations (50, 100 days) reinforce habit formation.

**The "Aha" Moment (when users realize it's working):**
The aha moment occurs in Week 1–2, when a learner notices the interconnection — a kanji they reviewed yesterday appears in a grammar example today, using vocabulary they already know. They realize this one app is doing what three separate apps couldn't: connecting the dots across skill domains. Combined with the cognitive load ring telling them "you've done enough for today" instead of showing 200 pending reviews, the app earns trust as a sustainable daily practice tool.

**User Value Signals:**
- Users explore the full breadth of the app (kanji, grammar, reading, listening) rather than using only one domain.
- Users capture wild content (camera/microphone) and pull it into their study flow.
- Users write personal mnemonics or notes — a sign of deep engagement.
- Users choose to contribute content back to the community — the strongest signal of perceived value.

### Business Objectives

Since japanese-learning is a free, open-source project with no revenue model, "business success" is measured through adoption, community health, and project sustainability — not financial metrics.

**3-month post-launch goals:**
- App published on Google Play Store, Apple App Store, and desktop download page (macOS, Windows, Linux).
- Core learning loop stable and functional across all platforms.
- Initial community of early adopters providing feedback through GitHub issues.
- First community content contributions (mnemonics, corrections) flowing through the PR pipeline.

**12-month post-launch goals:**
- ~500 daily active users across all platforms.
- Self-sustaining community contribution pipeline — content quality improving without sole reliance on the project creator.
- Positive app store ratings (4.0+ average).
- Recognition in Japanese learning communities (Reddit, Discord, YouTube) as a credible free alternative to WaniKani + Bunpro.

### Key Performance Indicators

| Category | KPI | Target (6 months) | Measurement |
| --- | --- | --- | --- |
| **Adoption** | Daily Active Users (DAU) | 500 | App analytics |
| **Retention** | D30 retention (users active 30 days after first session) | 40% | Cohort analysis |
| **Engagement** | Multi-domain usage (2+ domains in first month) | 60% of active users | Feature usage tracking |
| **Engagement** | Review session completion rate | 70%+ | Session start vs. completion |
| **Community** | Content PRs per month (synonyms, fixes, AI content) | 5–10 | GitHub PR tracking |
| **Community** | Codebase contributions per month (features, bugs) | 2–5 | GitHub PR tracking |
| **Quality** | App store rating | 4.0+ | Play Store / App Store |
| **Quality** | GitHub stars | 200+ | GitHub |

**Leading indicators (early signals of future success):**
- First-session completion rate (do users finish their first review session?)
- Day 7 return rate (do users come back after the first week?)
- First community contribution (how quickly does the first non-creator PR arrive?)
- Wild capture usage (are users engaging with OCR/ASR features?)

**Metrics we explicitly avoid (vanity metrics):**
- Total downloads without retention context
- Page views or GitHub traffic without engagement depth
- Social media mentions without conversion to actual users

---

## MVP Scope

### Core Features (MVP)

**1. Kanji & Vocabulary Learning**
- JLPT-aligned kanji and vocabulary progression (N5→N1), with parallel progression within each level.
- Input-based SRS testing — users type readings and meanings, no honor-system self-grading.
- FSRS scheduling for research-backed optimal review intervals.
- Radicals taught as building blocks for kanji. Bidirectional reinforcement: reviewing kanji nudges related vocabulary and radicals via the invisible nudge system.
- Mnemonics displayed for each item. Users can write personal (local-only) mnemonics.
- Smart input with embedded WanaKana (romaji-to-hiragana conversion) and Levenshtein-based typo detection (accept with warning for English typos, reject with "close!" hint for Japanese typos).

**2. Grammar Learning**
- JLPT-aligned grammar points (N5→N1) with input-based SRS testing.
- Grammar examples dynamically prioritize vocabulary the user has already learned (reducing cognitive load).
- Grammar points taught with example sentences drawn from reading passages where possible.
- FSRS scheduling for grammar review intervals.

**3. Reading Passages (BYO-Key AI + Community Content)**
- AI-generated short stories/passages tailored to the user's current knowledge level — built from kanji, vocabulary, and grammar they have already learned. Requires user's own AI API key.
- Comprehension questions attached to each passage — users answer questions about what they read to validate understanding, not just passive reading.
- Community-contributed reading passages available to all users (no AI key required). AI-generated passages can be contributed back to the community repo for others to access as static content.
- Reading passages tagged by JLPT level.

**4. Unified Review Mixer**
- A single review session that intelligently interleaves kanji, vocabulary, and grammar items.
- The invisible nudge system applies micro-adjustments to related items when one is reviewed (e.g., reviewing a kanji slightly boosts its associated vocabulary).
- Cognitive load ring tracks daily mental strain — heavier items (new kanji) cost more energy than light reviews (mature vocabulary). The ring fills as the user studies, visually communicating when they've done enough for the day.

**5. Streak System**
- Daily streak tracking with animations for maintaining consistency.
- Cognitive load ring adapts over time as the user grows stronger (like upgrading from 1km to 2km runs in fitness).

**6. Onboarding & Customization**
- First-launch setup: select starting JLPT level (N5 for beginners, or higher for existing learners).
- Manual item management: mark individual kanji, vocabulary, or grammar points as "already known" (skip), "in progress" (add to SRS at appropriate interval), or "not started."
- Session intensity preference: relaxed (~15 min) or intense (~30 min) daily sessions.
- No account required to start learning.

**7. Community Contribution Pipeline (Simplified)**
- Users can contribute updates to kanji descriptions, readings, grammar details, synonyms, and AI-generated reading passages through the in-app PR flow (invisible GitHub PRs using the user's GitHub token).
- GitHub login only required when a user chooses to contribute — not for general app usage.
- Contributions can accumulate locally and be batch-submitted to avoid prompt fatigue.
- Admin-reviewed: Riyaz and designated admins manually review and merge PRs via GitHub. No gamified in-app review for MVP.

**8. CI/CD & Data Pipeline**
- Core curriculum data stored as structured JSON files in the GitHub repository.
- GitHub Actions automatically compile JSON into an optimized SQLite database when PRs are merged.
- SQLite database stored in the repository with Git LFS. App downloads the updated database on startup if the version has changed.
- Binary media (audio for future listening features) planned for Cloudflare R2 — not required for MVP.

**9. Platform: Android & iOS**
- React Native (Expo) codebase targeting Android and iOS.
- Local SQLite database for all curriculum and user progress data.
- Fully offline-capable after initial content download.
- Published to Google Play Store and Apple App Store.

### Out of Scope for MVP

| Feature | Rationale | Target Phase |
| --- | --- | --- |
| **Listening practice** | Requires AI-generated audio pipeline and Cloudflare R2 media delivery. Core learning loop works without it. | Post-MVP Phase 1 |
| **Wild capture (OCR/ASR)** | Camera and microphone input adds complexity across platforms. Not essential for the core SRS learning loop. | Post-MVP Phase 1 |
| **AI conversation practice** | BYO-key conversational AI with SRS-targeted practice modes. Valuable but not core to MVP learning loop. | Post-MVP Phase 2 |
| **AI-generated personalized mnemonics** | Enhancement to existing mnemonic system. Users can write their own mnemonics in MVP. | Post-MVP Phase 2 |
| **AI content generation (beyond reading)** | AI-generated vocabulary examples, grammar explanations, etc. Reading passages cover the MVP AI use case. | Post-MVP Phase 2 |
| **Desktop app (Electron)** | Electron + React Native Web adds significant build complexity. Mobile covers primary use case (daily practice on phone). | Post-MVP Phase 2 |
| **Gamified community review** | Swipe-to-review, mandatory review-before-contribute gate, threshold-based auto-merge. Admin review sufficient for MVP scale. | Post-MVP Phase 2 |
| **Streak milestone celebrations** | Animated celebrations for 50-day, 100-day milestones. Basic streak counter and cognitive load ring sufficient for MVP. | Post-MVP Phase 1 |
| **Advanced UX polish** | Milestone animations, transition effects, celebration sequences. Core UX (cognitive load ring, streak counter) ships in MVP. | Post-MVP Phase 1 |
| **WaniKani / Bunpro import** | Automated import from other tools. Manual item marking (skip/in-progress) covers the switcher use case for MVP. | Post-MVP Phase 2 |
| **Cross-device sync** | Manual export/import decided in brainstorming. Not essential for MVP single-device usage. | Post-MVP Phase 2 |
| **Bounded upvote/downvote system** | Community content voting and ranking. Admin curation sufficient at MVP scale. | Post-MVP Phase 2 |

### MVP Success Criteria

The MVP is considered successful when:

1. **Core learning loop works:** Users can learn kanji, vocabulary, and grammar through input-based SRS testing with FSRS scheduling across Android and iOS.
2. **Reading feature delivers:** Users with an AI key can generate reading passages with comprehension questions tailored to their knowledge. Community-contributed passages are accessible to all users.
3. **Interconnection is felt:** The unified review mixer interleaves content types, and the invisible nudge system creates the "aha moment" — kanji showing up in grammar examples using known vocabulary.
4. **Cognitive load ring functions:** Users see their daily mental energy tracked and get a clear signal of when they've done enough.
5. **Contribution pipeline flows:** Users can submit content improvements via in-app PR generation. Merged PRs trigger CI/CD to rebuild the SQLite database automatically.
6. **App is stable and published:** Available on Google Play Store and Apple App Store with stable performance.

**Go/no-go for post-MVP expansion:** No specific targets required. Once MVP is running and available to users, post-MVP features begin development immediately.

### Future Vision

**Post-MVP Phase 1 (near-term enhancements):**
- Listening practice with AI-generated audio (Cloudflare R2 delivery).
- Wild capture — camera (OCR) and microphone (ASR) for pulling real-world Japanese into the study flow.
- Streak milestone celebrations with progressive animations (50 days, 100 days).
- Additional UX polish and transition animations.

**Post-MVP Phase 2 (ecosystem expansion):**
- Desktop app via Electron + React Native Web (macOS, Windows, Linux).
- AI conversation practice with three targeting modes (manual, SRS integration, random challenge).
- AI-generated personalized mnemonics and expanded content generation.
- Gamified community review system (swipe to approve/reject, mandatory review gate, threshold-based auto-merge).
- WaniKani and Bunpro import tools for switchers.
- Cross-device sync via manual export/import.
- Bounded upvote/downvote system for community content ranking.

**Long-term vision (2–3 years):**
- The most comprehensive free Japanese learning tool in the world — covering all JLPT levels across all skill domains with a self-sustaining, community-curated curriculum.
- A model for open-source language learning that could extend to other languages using the same architecture, community pipeline, and data model.
