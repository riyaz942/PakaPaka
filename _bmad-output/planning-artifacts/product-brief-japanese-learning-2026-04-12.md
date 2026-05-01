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

japanese-learning is a free, open-source, local-first Japanese learning application that unifies kanji, vocabulary, grammar, and reading into a single cross-platform app (Android & iOS). It replaces the fragmented, expensive multi-tool stack serious Japanese learners are forced to assemble today — delivering WaniKani-level content parity with input-based testing powered by FSRS, then going further with a weakness detection engine that targets what the learner struggles with, visible cross-domain reinforcement that connects kanji/vocabulary/grammar in real-time, and a time compression display that proves the app is faster than their old stack. Seamless WaniKani, Bunpro, and Anki import eliminates switching risk by preserving existing progress. AI-generated visual mnemonics for radicals provide a memorable, visually-rich learning experience from Day 1. The core app is completely free — no subscriptions, no paywalls, no ads. All user data stays on-device, the app works fully offline, and the entire codebase and curriculum are open-source.

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

A single, free, open-source application that matches WaniKani and Bunpro on content depth, then beats them on intelligence and speed:

**Pillar 1 — Content Parity (non-negotiable baseline):**
- **Strict radical → kanji → vocabulary dependency graph** — radicals unlock kanji, kanji unlock vocabulary. Precomputed graph stored in SQLite. No skipping dependencies.
- **WaniKani-depth kanji** — multiple meanings (primary + accepted synonyms), onyomi/kunyomi readings, text mnemonics, and AI-generated visual mnemonics for radicals. Burn/mastered stages for long-term reinforcement.
- **Bunpro-depth grammar** — structured grammar points with accepted forms and conjugation rules, parser-based validation (not just string matching), minimum 5–10 example sentences per grammar point, conjugation-aware answer checking.
- **Contextual vocabulary** — meanings in context (not just dictionary definitions), example sentences tied to grammar points.
- **Input-based SRS testing** across all content types — learners type their answers, not self-grade on flashcards — powered by FSRS for research-backed optimal scheduling.
- **JLPT-aligned parallel progression** (N5→N1) — universally understood framework, not proprietary levels.

**Pillar 2 — Smarter Than Their Current Stack (the switching trigger):**
- **Weakness detection engine** — tracks per-user error rates by item and pattern tag (e.g., て-form vs た-form confusion, reading vs meaning mistakes). Review queue is biased by `FSRS score × 0.7 + weakness score × 0.3`. The user feels "this is targeting what I suck at."
- **Visible cross-domain reinforcement** — when a grammar example uses kanji the learner studied yesterday, it's highlighted explicitly ("食べる ← you learned this yesterday"). Not invisible nudges — felt intelligence.
- **Time compression display** — post-session summary shows items reviewed by domain and total time, with an estimate of equivalent time in a multi-app stack. Reframes value instantly: "18 min here = ~35–40 min in WaniKani + Bunpro."
- **Cognitive load ring** — fitness-tracker-style mental energy model. Ring fills as you study, heavier items cost more. Tells you when you've done enough. No "200 reviews pending" anxiety.

**Pillar 3 — Zero Switching Risk (remove the fear):**
- **Seamless import** — WaniKani progress import via API, Bunpro grammar progress import (via API or export, depending on availability), Anki deck import. Maps external items to internal items, intervals to FSRS state. Users don't lose their progress.
- **Manual item marking** — for users who prefer not to import: mark items as known/in-progress/skip and bulk-mark entire JLPT levels.

**UX — Serious Tool, Not a Toy:**
- **Keyboard-first input** — fast typing, instant feedback (<100ms), no animations that slow the review loop.
- **Dense, information-rich screens** — session flow is show → type → result → next. No menus between items.
- **Visual mnemonics for radicals** — AI-generated mnemonic images pre-generated and served from Cloudflare R2, giving every learner rich visual associations from Day 1.
- **Cross-platform** — Android and iOS from one codebase, all offline-capable, all local data storage.

### Key Differentiators

1. **Content parity is the floor, not the ceiling:** WaniKani-depth kanji (multiple meanings, onyomi/kunyomi, mnemonics, burn stages) and Bunpro-depth grammar (structured points, conjugation-aware validation, 5–10 example sentences) in one product. If content is weaker, nothing else matters.
2. **Weakness detection targets what you suck at:** The app tracks your error patterns (reading vs meaning mistakes, grammar confusion clusters) and biases your review queue toward weak areas. FSRS handles scheduling; weakness detection handles prioritization. No existing tool does this.
3. **Visible cross-domain reinforcement:** When a grammar sentence uses a kanji you learned yesterday, you see it highlighted. Not invisible nudges — felt intelligence that makes your old multi-app stack feel disconnected.
4. **Time compression proves the value:** Post-session summary shows "18 min → equivalent to ~35–40 min across WaniKani + Bunpro." The time savings are explicit, not implied.
5. **Zero switching risk:** WaniKani/Bunpro/Anki import maps your existing progress into the app. No re-learning what you already know. No leap of faith required.
6. **Free forever:** No subscriptions, no paywalls, no ads. Replaces $150–$450/year in stacked subscriptions.
7. **Local-first / offline:** All data on-device. Works on the train, on a plane, with no signal. No vendor lock-in — your progress is yours.
8. **Serious UX that respects your time:** Keyboard-first, <100ms feedback, no animations that slow the review loop, dense information screens. Anki speed, WaniKani structure.

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
- **Pain:** Fragmentation — great kanji tool but no grammar equivalent at the same quality and price point (free). Switching costs feel high because of accumulated SRS progress. Fear of losing progress is the biggest barrier.
- **Success looks like:** Imports WaniKani progress directly via API — existing kanji knowledge is preserved with SRS intervals mapped to FSRS state. First review session feels calibrated to their level, not a beginner experience. Within a week, they see the weakness detection targeting gaps WaniKani never surfaced and the time compression proving it's faster. Cancels WaniKani with confidence. Gets grammar, reading, and kanji in one place for free.
- **Why they choose this app:** Zero switching risk — import preserves progress instantly. Weakness detection targets their specific gaps. Time compression proves it's faster. All-in-one eliminates fragmentation.

### Secondary Users

**Community Contributors (Post-MVP)**

Advanced learners (N2–N1 level or native speakers) who are motivated by improving the curriculum for others. They contribute mnemonics, fix errors, and propose better example sentences through an in-app contribution pipeline (post-MVP). They may also be open-source developers interested in contributing to the codebase directly via GitHub. Their engagement keeps the content pipeline alive and high-quality once the community contribution features ship.

### User Journey

**Discovery:** Learner finds the app through Reddit recommendations ("best free Japanese learning app"), YouTube reviews, JLPT study guides, app store search, or GitHub. Word-of-mouth from the community grows over time.

**Onboarding:** On first launch, the learner selects their starting point — fresh beginner (N5) or existing learner (choose JLPT level, import from WaniKani/Bunpro/Anki, or manually mark items as known/in-progress/skip). The app configures their SRS queue and daily session intensity (relaxed ~15 min or intense ~30 min). No account required to start learning.

**First session (Day 1):** The learner starts reviewing immediately — no menus, no setup screens between items. Show → type → result → next. Fast. Radicals have vivid visual mnemonics. Grammar validation catches conjugation errors, not just typos. The cognitive load ring fills as they study. At the end, the post-session summary reads: "Kanji: 12 | Grammar: 8 | Vocab: 15 | 18 min — equivalent to ~35 min across separate apps." They finish feeling like they proved something and saved time.

**Aha moment (Week 1–2):** The learner opens a grammar review and sees: "昨日、ラーメンを食べた" with "食べる ← you learned this yesterday" subtly highlighted. The app is connecting kanji, vocabulary, and grammar visibly — not hoping the user notices, but showing them explicitly. Meanwhile, the weakness detection engine noticed they keep confusing て-form and た-form, and is serving more of those. The interlinked, adaptive learning feels smarter than juggling separate apps.

**Routine (Month 1+):** The app becomes a daily ritual — 15–30 minutes in the morning or evening on their phone. The cognitive load ring adapts as they grow stronger. Reading passages use vocabulary and grammar they've been studying. The weakness engine is drilling their specific gaps, not generic content.

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
- Users explore the full breadth of the app (kanji, grammar, reading) rather than using only one domain.
- Users' weakness scores decrease over time — the weakness detection engine is driving real improvement.
- Users who import from WaniKani/Bunpro complete their first review session and continue — the import preserved their progress convincingly.
- Users write personal mnemonics or notes — a sign of deep engagement.

### Business Objectives

Since japanese-learning is a free, open-source project with no revenue model, "business success" is measured through adoption, community health, and project sustainability — not financial metrics.

**3-month post-launch goals:**
- App published on Google Play Store and Apple App Store.
- Core learning loop stable and functional across both platforms.
- Visual mnemonic images for all N5 radicals generated and live.
- WaniKani and Bunpro import functional — switchers can preserve their progress.
- Initial community of early adopters providing feedback through GitHub issues.

**12-month post-launch goals:**
- ~500 daily active users across all platforms.
- Visual mnemonic images covering N5 and N4 radicals.
- Measurable retention improvement from weakness detection engine vs. pure FSRS baseline.
- Positive app store ratings (4.0+ average).
- Recognition in Japanese learning communities (Reddit, Discord, YouTube) as a credible free alternative to WaniKani + Bunpro.

### Key Performance Indicators

| Category | KPI | Target (6 months) | Measurement |
| --- | --- | --- | --- |
| **Adoption** | Daily Active Users (DAU) | 500 | App analytics |
| **Retention** | D30 retention (users active 30 days after first session) | 40% | Cohort analysis |
| **Engagement** | Multi-domain usage (2+ domains in first month) | 60% of active users | Feature usage tracking |
| **Engagement** | Review session completion rate | 70%+ | Session start vs. completion |
| **Switching** | WaniKani/Bunpro/Anki import completion rate | 80%+ of imports started | Import flow tracking |
| **Quality** | App store rating | 4.0+ | Play Store / App Store |
| **Quality** | GitHub stars | 200+ | GitHub |

**Leading indicators (early signals of future success):**
- First-session completion rate (do users finish their first review session?)
- Day 7 return rate (do users come back after the first week?)
- WaniKani import usage (are switchers importing progress immediately?)
- Time compression reaction (do users share post-session summaries? — virality signal)
- Weakness score improvement over 30 days (is the detection engine actually working?)

**Metrics we explicitly avoid (vanity metrics):**
- Total downloads without retention context
- Page views or GitHub traffic without engagement depth
- Social media mentions without conversion to actual users

---

## MVP Scope

### Core Features (MVP)

**1. Kanji & Vocabulary Learning (WaniKani Parity)**
- Strict radical → kanji → vocabulary dependency graph. Precomputed and stored in SQLite. Radicals must be learned before their associated kanji, kanji before associated vocabulary.
- Multiple accepted answers per item (primary meaning + accepted synonyms). Onyomi and kunyomi readings tracked separately.
- Input-based SRS testing — users type readings and meanings, no honor-system self-grading.
- FSRS scheduling with burn/mastered stages for long-term reinforcement — items eventually reach a "burned" state where review intervals are very long.
- Text mnemonics for kanji and vocabulary. AI-generated visual mnemonics for radicals (pre-generated, stored on Cloudflare R2).
- Smart input with embedded WanaKana (romaji-to-hiragana conversion) and Levenshtein-based typo detection (accept with warning for English typos, reject with "close!" hint for Japanese typos).
- Users can write personal (local-only) mnemonics for any item.

**2. Visual Mnemonics for Radicals**
- Each radical has an AI-generated visual mnemonic image that creates a memorable visual association with the radical's meaning.
- Baseline image set is pre-generated by the project creator and stored on Cloudflare R2 — available to all users from Day 1.
- Images are referenced in the app's curriculum data and cached locally after first load.
- Post-MVP: Users with an AI API key can regenerate alternative mnemonic images if they don't connect with the default ones.

**3. Grammar Learning (Bunpro Parity)**
- JLPT-aligned grammar points (N5→N1) with structured grammar point schema: structure pattern, accepted forms, conjugation rules.
- Parser-based validation — conjugation-aware answer checking that understands verb forms, not just Levenshtein string distance.
- Minimum 5–10 example sentences per grammar point, using vocabulary the learner has already studied where possible.
- Contextual vocabulary meanings in grammar examples — not just dictionary definitions.
- FSRS scheduling for grammar review intervals.

**4. Reading Passages**
- Pre-seeded reading passages (creator-authored) tagged by JLPT level.
- Passages use vocabulary and grammar from the learner's current/completed JLPT level.
- Visible cross-domain reinforcement: known kanji and vocabulary are subtly highlighted in passages ("食べる ← you learned this yesterday"), making the interconnection explicit.
- Comprehension questions attached to each passage validate understanding.

**5. Weakness Detection Engine**
- Tracks per-user, per-item error stats: correct count, incorrect count, error type history (reading vs meaning mistakes).
- Tags items by pattern (e.g., "te-form confusion," "kanji reading confusion") to detect confusion clusters.
- Biases the review queue: `priority = fsrs_score × 0.7 + weakness_score × 0.3`. Users feel "this is targeting what I struggle with."
- Weakness stats visible to the user — they can see which patterns are weakest and track improvement over time.

**6. Unified Review Mixer**
- A single review session that intelligently interleaves kanji, vocabulary, and grammar items. Session starts immediately — no menus between tapping "Review" and seeing the first item.
- Visible cross-domain reinforcement: when a grammar example uses a kanji or vocabulary word the learner studied recently, it's highlighted explicitly in the sentence.
- Cognitive load ring tracks daily mental strain — heavier items (new kanji) cost more energy than light reviews (mature vocabulary). The ring fills as the user studies, visually communicating when they've done enough.
- Review loop is keyboard-first: show → type → result → next. <100ms feedback. No animations that slow the flow.

**7. Time Compression Display**
- Post-session summary shows items reviewed broken down by domain (kanji, grammar, vocab) and total time spent.
- Displays an estimated "equivalent time in old stack" comparison (e.g., "18 min → ~35–40 min across separate apps").
- Reframes value on every session — the user sees time savings daily, not just on Day 1.

**8. WaniKani, Bunpro & Anki Import**
- WaniKani progress import via API: maps WaniKani items to internal items, converts WaniKani SRS intervals to FSRS state. Preserves all progress — burned items stay burned, apprentice items enter at short intervals.
- Bunpro grammar progress import: maps Bunpro grammar points to internal grammar items with SRS interval conversion, via Bunpro's API or export functionality (depending on what Bunpro exposes). Preserves grammar study progress so switchers don't re-learn known grammar.
- Anki deck import: parses standard Anki deck formats and maps cards to internal curriculum items where possible, with interval conversion to FSRS state.
- Unmatched imported items (custom Anki cards not in the structured curriculum) are flagged for the user to handle.

**9. Streak System**
- Daily streak tracking with push notification reminders.
- Cognitive load ring adapts over time as the user grows stronger (like upgrading from 1km to 2km runs in fitness).

**11. Onboarding & Customization**
- First-launch setup: select starting JLPT level (N5 for beginners, or higher for existing learners).
- Import path: WaniKani API import, Bunpro import, or Anki deck upload for existing learners.
- Manual item management: mark individual kanji, vocabulary, or grammar points as "already known" (skip), "in progress" (add to SRS at appropriate interval), or "not started." Bulk-marking supported.
- Session intensity preference: relaxed (~15 min) or intense (~30 min) daily sessions.
- No account required to start learning.

**12. CI/CD & Data Pipeline**
- Core curriculum data stored as structured JSON files in the GitHub repository.
- GitHub Actions automatically compile JSON into an optimized SQLite database when changes are merged.
- SQLite database stored in the repository with Git LFS. App downloads the updated database on startup if the version has changed.
- Visual mnemonic images for radicals stored on Cloudflare R2 and referenced by the curriculum data.

**13. Platform: Android & iOS**
- React Native (Expo) codebase targeting Android and iOS.
- Local SQLite database for all curriculum and user progress data.
- Fully offline-capable after initial content download.
- Published to Google Play Store and Apple App Store.

### Out of Scope for MVP

| Feature | Rationale | Target Phase |
| --- | --- | --- |
| **AI-generated reading stories** | BYO-key/OpenRouter AI story generation tailored to active learning material. Powerful but adds complexity (AI provider integration, prompt engineering, key management). Pre-seeded passages cover reading for MVP. | Post-MVP Phase 1 |
| **Community contribution pipeline** | In-app PR generation, GitHub OAuth, batch submissions, admin review flow. No one uses contribution features early — focus on core learning loop. | Post-MVP Phase 1 |
| **Regeneratable visual mnemonics** | Users re-generating alternative radical mnemonic images with their own AI key. Baseline pre-generated images are sufficient for MVP. | Post-MVP Phase 1 |
| **Listening practice** | Requires AI-generated audio pipeline and Cloudflare R2 media delivery. Core learning loop works without it. | Post-MVP Phase 1 |
| **Streak milestone celebrations** | Animated celebrations for 50-day, 100-day milestones. Basic streak counter sufficient for MVP. Avoid animations that slow the flow. | Post-MVP Phase 1 |
| **Shadow mode** | Run the app alongside existing tools with comparative retention/time stats. Valuable for building switcher trust, but direct import covers the critical switching risk for MVP. | Post-MVP Phase 1 |
| **Wild capture (OCR/ASR)** | Camera and microphone input adds complexity across platforms. Not essential for the core SRS learning loop. | Post-MVP Phase 2 |
| **AI conversation practice** | BYO-key conversational AI with SRS-targeted practice modes. | Post-MVP Phase 2 |
| **AI-generated personalized mnemonics** | AI-generated text mnemonics beyond the visual radical images. Users can write their own in MVP. | Post-MVP Phase 2 |
| **Desktop app (Electron)** | Electron + React Native Web adds significant build complexity. Mobile covers primary use case. | Post-MVP Phase 2 |
| **Gamified community review** | Swipe-to-review, mandatory review-before-contribute gate, threshold-based auto-merge. | Post-MVP Phase 2 |
| **Cross-device sync** | Not essential for MVP single-device usage. | Post-MVP Phase 2 |
| **Bounded upvote/downvote system** | Community content voting and ranking. | Post-MVP Phase 2 |

### MVP Success Criteria

The MVP is considered successful when:

1. **Content parity is credible:** Kanji depth matches WaniKani (dependency graph, multiple meanings, onyomi/kunyomi, mnemonics, burn stages). Grammar depth matches Bunpro (structured points, conjugation-aware validation, 5–10 examples per point). A WaniKani/Bunpro user should NOT think "this explains it better" about their old tool.
2. **Weakness detection is felt:** Users notice the app targeting their specific weak areas within the first week. The review queue feels personalized, not generic.
3. **Cross-domain reinforcement is visible:** Users see explicit connections between kanji, vocabulary, and grammar in their review sessions — highlighted, not invisible.
4. **Time compression reframes value:** Post-session summaries consistently show meaningful time savings vs. multi-app stacks.
5. **Import works seamlessly:** WaniKani users can import kanji/vocabulary progress, Bunpro users can import grammar progress, and Anki users can import decks — all without re-learning known material.
6. **App is stable and published:** Available on Google Play Store and Apple App Store with <100ms review feedback and keyboard-first UX.

**The real test (Day 5):** After five days, the user should think: "This is doing what WaniKani + Bunpro do… but smarter and faster." If they think "this is a cool combined app," the MVP failed — you built a bundle, not a replacement.

**Go/no-go for post-MVP expansion:** No specific targets required. Once MVP is running and available to users, post-MVP features begin development immediately.

### Future Vision

**Post-MVP Phase 1 (near-term enhancements):**
- Shadow mode — run the app alongside existing tools (WaniKani, Bunpro) with comparative retention and time stats. Users build trust from side-by-side data before committing to a full switch.
- AI-generated reading stories — BYO-key/OpenRouter, stories built from active learning material, comprehension questions. Adds AI reinforcement on top of the core SRS + weakness detection loop.
- Community contribution pipeline — in-app PR generation, GitHub OAuth, batch submissions, admin review workflow.
- Regeneratable visual mnemonics — users with an AI key can generate alternative radical images.
- Listening practice with AI-generated audio (Cloudflare R2 delivery).
- Streak milestone celebrations with progressive animations (50 days, 100 days).

**Post-MVP Phase 2 (ecosystem expansion):**
- Desktop app via Electron + React Native Web (macOS, Windows, Linux).
- Wild capture — camera (OCR) and microphone (ASR) for pulling real-world Japanese into the study flow.
- AI conversation practice with three targeting modes (manual, SRS integration, random challenge).
- AI-generated personalized text mnemonics and expanded content generation.
- Gamified community review system (swipe to approve/reject, mandatory review gate, threshold-based auto-merge).
- Cross-device sync via manual export/import.
- Bounded upvote/downvote system for community content ranking.

**Long-term vision (2–3 years):**
- The most comprehensive free Japanese learning tool in the world — covering all JLPT levels across all skill domains with a self-sustaining, community-curated curriculum.
- A model for open-source language learning that could extend to other languages using the same architecture, community pipeline, and data model.
