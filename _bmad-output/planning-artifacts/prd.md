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

japanese-learning is a free, open-source, cross-platform mobile application (Android & iOS) that replaces the fragmented, expensive multi-tool stack serious Japanese learners are forced to assemble today. It matches WaniKani on kanji depth (strict dependency graph, multiple meanings, onyomi/kunyomi, mnemonics, burn stages) and Bunpro on grammar depth (structured grammar points, conjugation-aware validation, 5–10 example sentences per point), then goes further: a weakness detection engine targets what the learner specifically struggles with, visible cross-domain reinforcement shows kanji/vocabulary/grammar connections explicitly in real-time, and a time compression display proves the app is faster than a multi-app stack on every session. Seamless WaniKani, Bunpro, and Anki import eliminates switching risk by preserving existing progress — users don't re-learn what they already know. AI-generated visual mnemonics for radicals provide a rich, memorable learning experience from Day 1. The core app is completely free — no subscriptions, no paywalls, no ads — eliminating $150–450/year in stacked tool costs. All user data stays on-device, the app works fully offline, and both the codebase and curriculum are open-source.

The product targets four primary personas: anime/manga self-learners priced out of paid tools, professionals relocating to Japan who need practical Japanese fast, JLPT test preppers frustrated by paying for multiple specialized subscriptions, and switchers already using WaniKani who want grammar coverage at the same quality without another subscription. The app is built by a learner solving their own problem — strong on kanji but struggling with grammar, with no single free tool covering both at the depth required.

### What Makes This Special

**Content parity is the floor, not the ceiling.** WaniKani-depth kanji (strict radical→kanji→vocab dependency graph, multiple meanings, onyomi/kunyomi, text mnemonics, burn stages) and Bunpro-depth grammar (structured grammar points with accepted forms, conjugation-aware validation, 5–10 example sentences per point). If content quality doesn't match the best-in-class tools, nothing else matters. This app matches them, then surpasses them.

**Weakness detection makes it smarter.** The app tracks per-user error rates by item and pattern tag (reading vs meaning mistakes, て-form vs た-form confusion clusters). The review queue is biased: `FSRS score × 0.7 + weakness score × 0.3`. Users feel "this is targeting what I suck at." No existing SRS tool does this. This is the switching trigger.

**Visible cross-domain reinforcement.** When a grammar sentence uses 食べる and the learner studied that kanji yesterday, the app highlights it: "食べる ← you learned this yesterday." Not invisible nudges — felt intelligence. The unified review mixer interleaves content types, and the connections are shown explicitly so the user experiences them.

**Time compression proves the value.** Post-session summary: "Kanji: 12 | Grammar: 8 | Vocab: 15 | 18 min — equivalent to ~35–40 min across separate apps." Every session reinforces that this is faster. Not a claim on a landing page — measured and displayed daily.

**Zero switching risk.** WaniKani/Bunpro/Anki import preserves existing progress — burned kanji stay burned, studied grammar stays studied. No re-learning, no leap of faith required.

**Visual mnemonics for radicals from Day 1.** AI-generated mnemonic images for every radical provide a visually-rich learning experience immediately — more memorable than plain text definitions. A pre-generated baseline set stored on Cloudflare R2 means every user benefits.

**Free forever, open-source.** Zero cost for the core learning experience. No revenue model to protect, no premium tier gating features. The app never needs server infrastructure or subscription revenue.

**No equivalent exists.** No other tool — free or paid — combines WaniKani-depth kanji, Bunpro-depth grammar, weakness detection, visible cross-domain reinforcement, time compression, seamless progress import, and local-first architecture. The timing is right: FSRS is mature and MIT-licensed, React Native + Expo has stabilized for cross-platform.

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
- Users' weakness scores improve over time — the detection engine is driving real learning gains.
- Users who import from WaniKani/Bunpro complete their first review session and continue — the import preserved their progress convincingly.
- Users write personal mnemonics or notes — a sign of deep engagement.
- Users share time compression screenshots — a virality signal that the value proposition is resonating.

### Business Success

Since japanese-learning is a free, open-source project with no revenue model, "business success" is measured through adoption, engagement quality, and project sustainability.

**3-month post-launch goals:**

- App published on Google Play Store and Apple App Store.
- Core learning loop stable and functional across both platforms with <100ms review feedback.
- Visual mnemonic images for all N5 radicals generated and live.
- WaniKani and Bunpro import functional — switchers can onboard with zero progress loss.
- Weakness detection engine live and producing measurable accuracy improvements.
- Initial community of early adopters providing feedback through GitHub issues.

**12-month post-launch goals:**

- ~500 daily active users across all platforms.
- Visual mnemonic images covering N5 and N4 radicals.
- Measurable retention improvement from weakness detection vs. pure FSRS baseline.
- Import → continued usage conversion rate above 50%.
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
| **Switching** | WaniKani/Bunpro/Anki import completion rate | 80%+ of imports started | Import flow tracking |
| **Intelligence** | Weakness score improvement (30-day trend) | Measurable decline in error rates on targeted patterns | Weakness engine analytics |
| **Quality** | App store rating | 4.0+ | Play Store / App Store |
| **Quality** | GitHub stars | 200+ | GitHub |
| **Technical** | Review interaction feedback time | <100ms | Performance monitoring |
| **Technical** | SQLite query response (standard ops, mid-range device) | <100ms | Performance monitoring |

**Leading indicators:**

- First-session completion rate (do users finish their first review session?)
- Day 7 return rate (do users come back after the first week?)
- WaniKani/Bunpro import usage (are switchers importing progress immediately?)
- Time compression screenshot sharing (virality signal)
- Weakness score improvement over first 30 days (is the engine actually working?)

## User Journeys

### Journey 1: Yuki — The Fresh Beginner (Primary User, Success Path)

Yuki is 22, works part-time at a bookstore, and has been watching anime unsubtitled for years — catching words here and there but never truly understanding. She tried Duolingo for three months and hit a wall: the lessons felt like a game, not real learning. She looked into WaniKani but can't justify $9/month on her budget. A Reddit thread recommends japanese-learning as "the free WaniKani + Bunpro killer."

**Opening scene:** Yuki downloads the app from the Play Store on her commute home. No account creation, no email, no paywall. She selects "I'm a beginner (N5)" and picks "relaxed" session intensity (~15 min/day). The app configures her first review queue in seconds.

**Rising action:** Her first session teaches five radicals — each with a vivid AI-generated mnemonic image that makes the radical's meaning stick instantly. She then learns three kanji built from those radicals through input-based testing — she types the readings, not self-grades on flashcards. She gets one wrong and sees a "close!" hint (Levenshtein typo detection caught her fat finger, not a knowledge gap). The cognitive load ring fills as she studies. After 15 minutes, the ring glows — "You've done great for today." No "187 reviews pending" anxiety. She closes the app feeling accomplished.

**Climax (Week 2):** Yuki opens her grammar review and sees a sentence: "昨日、ラーメンを食べた。" Below 食べる, a subtle highlight reads "← you learned this yesterday." She didn't plan this connection — the app surfaced it explicitly. She also notices the review queue is drilling her on て-form sentences more often — she's been getting those wrong, and the weakness detection engine is targeting her gap. She types the answer correctly. This is the "aha moment." After the session, the summary reads: "Kanji: 8 | Grammar: 6 | Vocab: 12 | 16 min — equivalent to ~30 min across separate apps." She screenshots it and sends it to a friend studying Japanese.

**Resolution (Month 2+):** Yuki is on a 45-day streak. She picks up a manga volume and recognizes kanji she learned in the app. Her weakness stats show て-form accuracy went from 40% to 85% in three weeks. Reading passages in the app use the exact vocabulary she's been studying. The app made her old multi-tool consideration feel unnecessary — one app is doing what three separate tools couldn't, faster and smarter.

**Capabilities revealed:** Onboarding (level selection, no account), visual radical mnemonics, input-based SRS testing, FSRS scheduling, WanaKana input, typo detection, cognitive load ring, visible cross-domain reinforcement, weakness detection engine, unified review mixer, time compression display, personal mnemonics, streak tracking.

---

### Journey 2: Mika — The Switcher with Existing Knowledge (Primary User, Edge Case)

Mika is 31, has been using WaniKani for 18 months and knows ~1,200 kanji. She's studying for N2. WaniKani covers kanji well, but she also needs grammar — and paying $9/month for WaniKani plus $5/month for Bunpro is $168/year for two tools that don't talk to each other. She hears about japanese-learning on a WaniKani community forum.

**Opening scene:** Mika downloads the app and selects "I have existing knowledge." She taps "Import from WaniKani" and enters her WaniKani API key. In seconds, the app maps her 1,200 known kanji and vocabulary to the internal curriculum — burned items stay burned, apprentice items enter at short intervals. She also imports her Bunpro grammar progress. The import summary shows exactly what was mapped and what's new.

**Rising action:** Her first review session is a unified mix — N3 grammar she hasn't studied yet (new items), N4 vocabulary at short intervals, and the occasional mature kanji review. The session feels calibrated to _her_ knowledge, not a generic level. Grammar examples use vocabulary she already knows — highlighted with "← you know this." She notices the weakness engine drilling her on N3 grammar patterns where she's weakest. After the session: "Kanji: 10 | Grammar: 12 | Vocab: 8 | 22 min — equivalent to ~40 min across WaniKani + Bunpro."

**Climax:** After one week, Mika has data: the weakness detection is targeting gaps Bunpro never identified, and the time compression display consistently shows 30–40% time savings. She cancels her WaniKani subscription. A week later she cancels Bunpro. She's saving $168/year and getting a smarter, faster, more integrated experience.

**Resolution:** Mika passes N2 four months later. Her review sessions covered kanji, vocabulary, grammar, and reading — all in one daily session. Her weakness stats show steady improvement in the grammar patterns she initially struggled with.

**Capabilities revealed:** WaniKani progress import (API), Bunpro grammar import, FSRS interval mapping, weakness detection engine, visible cross-domain reinforcement, vocabulary-aware grammar examples, time compression display, unified review mixer across content types.

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

**Climax:** At lunch, Kenji opens the reading section. A pre-seeded passage about ordering at a ramen shop uses exactly the grammar and vocabulary he's been studying. Known kanji are highlighted: "食べる ← you learned this" — the visible reinforcement makes the passage feel tailored to him. Comprehension questions follow. After the session, his time compression summary reads: "Kanji: 8 | Grammar: 5 | Vocab: 10 | Reading: 1 passage | 20 min — equivalent to ~35 min across separate apps."

**Resolution:** On the weekend, Kenji connects to Wi-Fi at home. The app checks for curriculum updates — a new version of the SQLite database is available (community contributions merged during the week). It downloads the delta in seconds. His progress is untouched. Monday morning, back on the metro, fully offline, the updated content is ready.

**Capabilities revealed:** Full offline operation (local SQLite), visible cross-domain reinforcement in reading passages, time compression display, weakness detection, database version checking and update download, progress persistence across sessions, no-account usage.

---

### Journey Requirements Summary

| Journey | Key Capabilities Revealed | Phase |
| --- | --- | --- |
| **Yuki (fresh beginner)** | Onboarding, visual mnemonics, input-based SRS, FSRS, WanaKana, typo detection, cognitive load ring, visible reinforcement, weakness detection, review mixer, time compression, streaks | MVP |
| **Mika (switcher)** | WaniKani import, Bunpro import, FSRS interval mapping, weakness detection, visible reinforcement, vocabulary-aware grammar, time compression, unified mixer | MVP |
| **Riyaz (admin)** | Visual mnemonic generation, R2 media management, CI/CD pipeline, Git LFS, app store management, OTA updates, bug triage | MVP |
| **Kenji (offline)** | Full offline operation, local SQLite, database versioning/updates, no-account usage | MVP |
| **Sato (contributor)** | In-app editing, invisible PR generation, batch submission, GitHub OAuth, content review pipeline | Post-MVP |

**Cross-cutting capabilities across all MVP journeys:** Local-first data architecture, JLPT-aligned progression, input-based testing, FSRS scheduling with burn stages, weakness detection engine, visible cross-domain reinforcement, time compression display, cognitive load management, visual radical mnemonics, keyboard-first UX, seamless progress import (WaniKani/Bunpro/Anki), cross-platform parity (Android & iOS).

## Domain-Specific Requirements

### Content Quality & Moderation

**MVP:** All curriculum content is creator-authored and curated with WaniKani/Bunpro-level depth. Grammar points use structured schemas with conjugation rules and minimum 5–10 example sentences. Visual mnemonic images are pre-generated by the creator with quality review before upload. GitHub Actions validate JSON schema integrity on every commit. Content parity is the #1 quality gate — if explanations or examples are weaker than WaniKani/Bunpro, no other feature saves the product.

**Content parity validation:** Before public launch, N5 content should be reviewed by active WaniKani/Bunpro users for depth, accuracy, and explanation quality. Feedback should be incorporated before launch.

**Post-MVP (community contribution phase):**

- Admin-reviewed merges (Riyaz and designated admins). GitHub Actions validate JSON schema integrity on every PR.
- Threshold-based auto-merge (initially 5 community approvals). Trusted reviewer tier for high-quality contributors.
- **Risk:** Pedagogically incorrect content reaching users. Mitigation: schema validation catches structural errors; admin review catches pedagogical errors at initial community scale; community review scales moderation later.

### Accessibility

Mobile accessibility best practices apply:

- Screen reader compatibility (TalkBack on Android, VoiceOver on iOS) for navigation, review sessions, and results.
- Sufficient color contrast ratios for the cognitive load ring and streak UI.
- Scalable text for all learning content.
- Input-based testing must work with accessibility keyboards and input methods.

### Privacy & Data

- The app targets users aged 13 and older. COPPA does not apply: no user accounts are created, no personal data is collected, and no information from children (or any user) is transmitted or stored externally.
- No user accounts required for core functionality. No personal data collected or transmitted.
- All learning progress, weakness detection statistics, and user data stored locally on-device in SQLite.
- WaniKani and Bunpro API keys used during import are stored in platform-appropriate secure storage (Keychain on iOS, Android Keystore on Android) and can be discarded after import completes.
- Import transmits only the respective API key to WaniKani/Bunpro endpoints — no learning data from this app is sent externally.
- Anki deck import processes files entirely locally on-device.
- Visual mnemonic images are served from Cloudflare R2 (public URLs) — no authentication or user tracking involved in image loading.

### Curriculum Standards

- All content organized by JLPT levels (N5→N1) — the internationally recognized Japanese Language Proficiency Test framework.
- JLPT alignment provides a universally understood progression model, replacing proprietary level systems.

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Weakness Detection Engine (FSRS + Adaptive Prioritization)**
No existing SRS tool adaptively prioritizes review items based on per-user error patterns. FSRS handles optimal scheduling (when to review), but the weakness detection engine handles prioritization (what to review first). By tracking error rates per item and per pattern tag (e.g., "te-form confusion," "kanji reading vs meaning mistakes"), the engine biases the review queue: `priority = fsrs_score × 0.7 + weakness_score × 0.3`. The user feels the app is "targeting what I suck at" — a switching trigger no existing tool delivers. Technical implementation: per-item stats table (`item_id`, `correct_count`, `incorrect_count`, `last_errors[]`), pattern tags on items (`grammar_tag: "te-form"`, `kanji_tag: "reading_confusion"`), and a priority calculation that runs at queue build time.

**2. Visible Cross-Domain Reinforcement (Explicit Connection UI)**
Previous iterations described this as an "invisible nudge system." The critical insight: making reinforcement invisible wastes its switching power. When a grammar example uses 食べる and the learner studied that kanji yesterday, the app highlights it explicitly: "食べる ← you learned this yesterday." Grammar sentences are selected to prefer vocabulary the user already knows (`SELECT sentence WHERE vocab IN user_known_vocab ORDER BY reinforcement_score DESC`). The unified review mixer interleaves all content types, and the connections are shown — not hoped-for. This transforms "all-in-one" from a feature list into felt intelligence.

**3. Time Compression Display**
Post-session summary explicitly shows items reviewed by domain (kanji, grammar, vocab), total time, and an estimated "equivalent time in old stack." This reframes the value proposition on every session — not a one-time landing page claim, but daily proof. The estimate is calculated from known session patterns in WaniKani/Bunpro (separate logins, separate queues, no cross-domain mixing). Simple but powerful — users who see "18 min → ~35–40 min" daily develop conviction that their old stack is inefficient.

**4. Shadow Mode (Risk-Free Transition — Post-MVP)**
Users who import progress can run the app alongside their existing tools without committing to a full switch. Reviews are scheduled normally; the app tracks its own retention and time metrics. Users naturally compare these with their WaniKani/Bunpro experience. After 1–2 weeks of side-by-side data, users have evidence (not faith) to decide. No existing language learning tool offers a "try before you commit" model that preserves your existing progress. For MVP, direct import (WaniKani/Bunpro/Anki) addresses the core switching risk; shadow mode adds a gentler transition path post-MVP.

**5. Visual Mnemonics for Radicals (AI-Generated Baseline)**
Each radical receives an AI-generated visual mnemonic image that creates a memorable association with the radical's meaning. A pre-generated baseline set (created by the project maintainer) is stored on Cloudflare R2 and served to all users from Day 1. Radicals are the building blocks of all kanji — making them visually memorable from the start accelerates the entire learning pipeline.

**6. Cognitive Load Ring (Fitness Tracker UX Cross-Pollination)**
Borrowed from fitness tracking (WHOOP/Garmin strain models) and applied to SRS learning. Instead of the anxiety-inducing "200 reviews pending" badge that drives learners away from every existing SRS app, the cognitive load ring tracks daily mental strain — heavier items (new kanji) cost more energy than light reviews (mature vocabulary). The ring fills as the user studies, visually communicating when they've done enough. No SRS app uses a mental energy model to manage review load.

**7. Serverless Content Distribution (JSON → SQLite → Git LFS + R2)**
The entire content pipeline operates without a backend server. Source data lives as structured JSON in GitHub. GitHub Actions compile JSON into an optimized SQLite database on merge. The compiled database is versioned in the repo via Git LFS. Visual mnemonic images are served from Cloudflare R2. This architecture eliminates hosting costs, enables fully offline operation, and supports future community-driven content updates.

**8. Invisible Open-Source Contribution Pipeline (Post-MVP)**
Open-source contribution disguised as standard in-app behavior. Users tap "suggest edit" and the app silently creates a GitHub PR. This pattern transforms everyday users into open-source contributors without requiring technical knowledge.

### Market Context & Competitive Landscape

- **No existing tool** combines these innovations. WaniKani has strong input-based kanji SRS but no weakness detection, no cross-domain reinforcement, no time compression display, no cognitive load management, and a proprietary closed-source model. Bunpro has grammar SRS but operates in isolation from kanji tools and has no adaptive prioritization. Anki is open-source and uses FSRS but relies on honor-system self-grading, has no structured curriculum, and requires significant setup expertise.
- **The "stack consolidator" positioning** is validated by market research: serious Japanese learners routinely assemble 2–3 paid tools that don't communicate. Community threads explicitly ask whether paying for WaniKani + Bunpro together is worth it.
- **The switching trigger** is NOT "all-in-one" — that gets attention, not commitment. The trigger is: weakness detection makes users feel "this is targeting what I suck at," time compression proves "this saves me 15 min/day," and seamless import removes the fear of losing progress. These are felt, immediate advantages within the first week.
- **Switching cost is the real barrier** — not feature parity. WaniKani/Bunpro/Anki import directly addresses the entrenched habit problem identified in market feedback by preserving existing progress.
- **Open-source language learning** has demand signals (KaniManabu, nihongo-master, gen-cards on GitHub) but no project has achieved the combination of content depth, adaptive intelligence, and switching infrastructure this product targets.

### Validation Approach

- **Weakness detection engine:** Validate that weakness-biased review queues improve retention and reduce confusion clusters over time. Measure: do users with weakness detection enabled retain items better at D30 than pure FSRS? Do confusion cluster sizes shrink over time?
- **Visible cross-domain reinforcement:** Validate that explicit connection highlighting improves the "aha moment" timing and multi-domain engagement. Measure: time to first multi-domain session, user-reported interconnection awareness.
- **Time compression display:** Validate that showing time savings improves retention and reduces churn. Measure: do users who see time compression summaries have higher D30 retention than those who don't? Do they share summaries (virality signal)?
- **Progress import:** Validate that WaniKani/Bunpro/Anki importers successfully preserve progress and that imported users continue using the app. Measure: import completion rate, import → continued usage conversion rate, first-session completion rate for importers.
- **Visual radical mnemonics:** Validate that AI-generated mnemonic images improve radical recall vs. text-only definitions. Measure: radical recall accuracy at D7 and D30.
- **Cognitive load ring:** Validate that the ring reduces session abandonment and review pile-up anxiety. Measure: session completion rate (target 80%+ within threshold) and long-term streak maintenance.
- **Serverless distribution:** Validate that Git LFS + SQLite download model scales with content growth. Measure: database download size over time, update frequency, and user-perceived update latency.

### Risk Mitigation

| Innovation | Risk | Fallback |
| --- | --- | --- |
| **Weakness detection engine** | Weakness weights miscalibrated — too aggressive pushes weak items at the expense of new content, too subtle has no effect | Ship with conservative default ratio (0.7/0.3); make weights configurable in code; gather data before tuning; users can disable weakness biasing |
| **Visible reinforcement** | Highlighting feels noisy or distracting during fast review sessions | Make highlighting subtle (color tint, not popup); allow users to toggle visibility in settings; ensure highlights don't slow the <100ms feedback loop |
| **Time compression display** | Estimated "old stack time" feels inaccurate or dishonest — users distrust the comparison | Base estimates on documented WaniKani/Bunpro session patterns; be conservative in estimates; show methodology in settings; let users hide the comparison |
| **WaniKani/Anki import** | WaniKani API changes or rate limits; Anki deck formats vary widely; item mapping is incomplete | Version-lock WaniKani API integration; support common Anki export formats only; clearly communicate unmapped items; fallback to manual bulk-marking |
| **Shadow mode (Post-MVP)** | Users stay in shadow mode indefinitely and never switch fully; adds complexity to the review engine | Shadow mode is a UX framing, not a separate engine — reviews work identically; show "you've been comparing for X weeks" prompts; no forced conversion. Deferred to post-MVP; MVP relies on direct import to address switching risk. |
| **Visual radical mnemonics** | Pre-generated images don't resonate; image quality inconsistent | Users can write personal text mnemonics as fallback; post-MVP allows regeneration with own key; iterate on prompts based on feedback |
| **Cognitive load ring** | Users ignore the ring or find it patronizing | Make the ring informational, not restrictive — users can always continue; iterate on visual design based on feedback |
| **Content parity** | Grammar explanations or kanji coverage perceived as weaker than WaniKani/Bunpro | Invest heavily in N5 content quality before launch; get feedback from existing WaniKani/Bunpro users; iterate on explanations and example sentences |
| **Serverless distribution** | SQLite database grows too large as content scales to N1 | Shard database by JLPT level; implement incremental/delta updates |

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

| Permission | Purpose | MVP/Post-MVP |
| --- | --- | --- |
| **Internet** | Database version check/download, WaniKani/Bunpro API import, visual mnemonic image loading from R2 | MVP |
| **Storage** | Local SQLite database, cached mnemonic images, imported Anki deck files, exported progress files | MVP |
| **Notifications** | Streak reminders and daily review nudges | MVP |
| **Camera** | OCR wild capture (Tesseract for Japanese text extraction from photos) | Post-MVP Phase 2 |
| **Microphone** | ASR wild capture (speech-to-text for audio extraction) | Post-MVP Phase 2 |

### Offline Mode

The app is designed offline-first — network is the exception, not the requirement.

**Fully offline (no network needed):**

- All SRS review sessions (kanji, vocabulary, grammar) with weakness detection
- FSRS scheduling calculations, weakness score computation, and progress tracking
- Cognitive load ring computation
- Time compression display (post-session summaries)
- Streak tracking and display
- Reading pre-seeded passages with visible reinforcement highlighting
- Personal mnemonic creation and editing
- Onboarding and item marking (skip/in-progress)
- All imported progress (WaniKani/Bunpro/Anki data is local after import)

**Network required:**

- Initial curriculum database download (first launch)
- Database version check and update download (on app open, if Wi-Fi available)
- Visual mnemonic image loading from Cloudflare R2 (cached locally after first load)
- WaniKani/Bunpro progress import via API (one-time during onboarding)

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
- Privacy policy required (even though no data is collected — document local-only data practices and WaniKani/Bunpro API usage for import).
- Content rating: suitable for all ages (educational content, no user-generated social features in MVP).
- No in-app purchases or subscriptions.

**Apple App Store:**

- Standard Expo/EAS build pipeline for IPA generation and signing.
- Apple Developer Program membership ($99/year) required.
- App Tracking Transparency: not applicable (no tracking, no analytics SDKs that trigger ATT).
- Privacy nutrition labels: declare local storage only. WaniKani/Bunpro import uses third-party API keys provided by the user — declare accordingly.
- Review consideration: Visual mnemonic images loaded from Cloudflare R2 are static educational content, not user-generated content requiring moderation.

### Implementation Considerations

- **Expo managed workflow** preferred for simplicity. Eject to bare workflow only if a native module is unavailable in Expo's ecosystem (evaluate SQLite, secure storage, and notification libraries before committing).
- **SQLite library:** Evaluate `expo-sqlite` vs `react-native-quick-sqlite` (or equivalent) for performance on large curriculum databases. The <100ms query target includes weakness score calculation at queue build time.
- **Dependency graph storage:** The `radical_id → kanji_id → vocab_id` graph should be precomputed at database build time (GitHub Actions) and stored as adjacency lists in SQLite for fast traversal. Graph queries must stay within the <100ms target.
- **Weakness detection data model:** Per-item stats table (`item_id`, `correct_count`, `incorrect_count`, `last_errors[]`, `pattern_tags[]`). Weakness score calculated at queue build time, not on every item render. Index on `item_id` and `pattern_tag` for efficient confusion cluster queries.
- **Grammar validation parser:** Start with a rule-based parser for common conjugation patterns (て-form, た-form, ない-form, ます-form, passive, causative). Each grammar point's `conjugation_rules[]` field drives the parser. For patterns without parser support, fall back to Levenshtein distance with the "close!" hint.
- **WaniKani API integration:** WaniKani v2 API is well-documented. Import flow: fetch user's assignments and reviews, map `subject_id` to internal `item_id` via a maintained mapping table, convert WaniKani SRS stages to FSRS state. Handle rate limiting (60 requests/min) with queuing.
- **Bunpro import integration:** Investigate Bunpro's API or export capabilities (API v1 may support grammar point review data). Map Bunpro grammar point IDs to internal grammar items. Convert Bunpro SRS state to FSRS intervals. If Bunpro does not expose a public API or export, document the limitation and offer manual grammar marking as a fallback.
- **Anki deck import:** Parse `.apkg` files (SQLite-backed zip archives). Map note fields to internal items using fuzzy matching on Japanese text and meanings. Convert Anki scheduling state to FSRS intervals.
- **Time compression estimate:** Calculate based on: number of items reviewed × average review time per item in a single-tool setup (separately for kanji and grammar, with login/switching overhead factored in). Be conservative — overestimating savings erodes trust.
- **Image caching:** Visual mnemonic images from R2 need efficient caching — evaluate `expo-image` or `react-native-fast-image` for CDN image loading with local cache. Images should persist across sessions and work offline after first load.
- **Secure storage:** Use `expo-secure-store` for WaniKani and Bunpro API keys during import. Verify platform-appropriate backing (Keychain on iOS, Android Keystore on Android).
- **WanaKana integration:** The `wanakana` npm package runs in JS — verify it performs well within React Native's JS runtime for real-time romaji-to-hiragana conversion during input.
- **Review loop performance:** The show → type → result → next loop must have zero blocking operations between items. Pre-fetch the next 3–5 items in the queue to eliminate any perceptible delay. Result display and item transition must complete within a single frame (16ms).

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Replacement MVP — not just "all-in-one" (that's a bundle, not a replacement). The minimum feature set that makes an active WaniKani/Bunpro user think "this is at least as good… and something feels easier" within 5 days. Content parity is the baseline. Weakness detection, visible reinforcement, and time compression are the switching triggers. Direct import (WaniKani/Bunpro/Anki) removes the switching risk.

**Resource Requirements:** Solo developer (Riyaz). 3-month timeline to MVP launch on both app stores. AI-assisted development (Cursor/LLM coding tools) assumed for velocity. Scope is significant — ruthless prioritization required.

**Key constraint:** Every feature in MVP must serve one of three pillars: (1) content parity with WaniKani/Bunpro, (2) smarter adaptation than the current stack, or (3) zero switching risk. If a feature doesn't make the user feel "this is smarter and faster" within their first week, it's post-MVP.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

- Yuki (fresh beginner) — full success path
- Mika (switcher) — WaniKani/Bunpro import, unified review
- Kenji (offline) — full offline operation
- Riyaz (admin) — content curation, visual mnemonic generation, CI/CD pipeline

**Must-Have Capabilities:**

1. **Kanji & Vocabulary Learning (WaniKani Parity)** — Strict radical→kanji→vocabulary dependency graph (precomputed, stored in SQLite). Multiple accepted answers per item (primary + synonyms). Onyomi/kunyomi readings tracked separately. FSRS scheduling with burn/mastered stages. Input-based SRS testing. AI-generated visual mnemonics for radicals (pre-generated, Cloudflare R2). Text mnemonics for kanji/vocabulary. Personal mnemonics. Embedded WanaKana. Levenshtein typo detection.
2. **Grammar Learning (Bunpro Parity)** — JLPT-aligned structured grammar points with accepted forms and conjugation rules. Parser-based conjugation-aware validation (not just Levenshtein). Minimum 5–10 example sentences per grammar point. Grammar examples prefer vocabulary the learner already knows. Contextual vocabulary meanings (not just dictionary definitions). FSRS scheduling.
3. **Reading Passages** — Pre-seeded, creator-authored passages tagged by JLPT level. Passages use vocabulary and grammar from the learner's current/completed level. Visible cross-domain reinforcement: known kanji/vocabulary highlighted in context. Comprehension questions validate understanding.
4. **Weakness Detection Engine** — Per-user, per-item error tracking (correct/incorrect counts, error type history). Pattern tagging (confusion clusters like て-form vs た-form, reading vs meaning mistakes). Review queue biased by `FSRS score × 0.7 + weakness score × 0.3`. Weakness stats visible to the user.
5. **Visible Cross-Domain Reinforcement** — Grammar sentences selected to prefer known vocabulary (`WHERE vocab IN user_known_vocab ORDER BY reinforcement_score`). Kanji/vocabulary recently studied are highlighted explicitly in grammar examples and reading passages ("食べる ← you learned this yesterday"). Connections are shown, not invisible.
6. **Unified Review Mixer** — Single session interleaving kanji, vocabulary, and grammar. Session starts immediately — show → type → result → next. Keyboard-first, <100ms feedback, no animations between items. Cognitive load ring.
7. **Time Compression Display** — Post-session summary shows items reviewed by domain (kanji, grammar, vocab), total time, and estimated equivalent time in a multi-app stack. Displayed after every session.
8. **WaniKani, Bunpro & Anki Import** — WaniKani progress import via API (maps items, converts intervals to FSRS state). Bunpro grammar progress import (via API or export, depending on availability) with SRS interval conversion. Anki deck import (parses standard export formats, maps to curriculum items). Unmatched items flagged for user.
9. **Streak System** — Daily streak tracking with push notification reminders. Cognitive load ring adapts over time.
10. **Onboarding & Customization** — JLPT level selection. Import path (WaniKani API / Bunpro import / Anki deck). Manual item marking (known/in-progress/skip) with bulk-marking. Session intensity preference. No account required.
11. **CI/CD & Data Pipeline** — JSON source data in GitHub, GitHub Actions compile to SQLite, SQLite in repo with Git LFS, visual mnemonic images on Cloudflare R2, app downloads updated database on startup.
12. **Platform: Android & iOS** — React Native (Expo), local SQLite, fully offline-capable, published to both app stores.

**Architecture decision (content parity):** Grammar item schema uses structured data (`id`, `structure`, `accepted_forms[]`, `conjugation_rules[]`) rather than free-text explanations. The dependency graph (`radical_id → kanji_id → vocab_id`) is precomputed and stored in SQLite for fast traversal. Multiple accepted answers are stored in a dedicated table per item. This data model ensures content quality matches WaniKani/Bunpro and supports the weakness detection engine's pattern tagging.

### Post-MVP Features

**Phase 2 (Post-MVP — near-term enhancements):**

- Shadow mode — run the app alongside existing tools (WaniKani, Bunpro) with comparative retention and time stats. Users build trust from side-by-side data before committing to a full switch. Reviews are scheduled normally; the app tracks its own metrics for comparison.
- AI-generated reading stories — BYO-key/OpenRouter, stories built from active learning material, comprehension questions. Adds AI reinforcement on top of the core SRS + weakness detection loop.
- Community contribution pipeline — in-app PR generation (branch-based model), GitHub OAuth for contributors, batch submission support, admin-reviewed merges
- Regeneratable visual mnemonics — users with an AI API key can generate alternative radical images
- Listening practice with AI-generated audio (Cloudflare R2 delivery)
- Cognitive load ring recovery suggestions — when the ring fills, suggest lighter activities instead of just signaling "done for the day"
- Dedicated verb conjugation practice section (standalone drills beyond what's integrated in grammar reviews)
- Streak milestone celebrations with progressive animations

**Phase 3 (Expansion):**

- Desktop app via Electron + React Native Web (macOS, Windows, Linux)
- Wild capture — camera (OCR) and microphone (ASR)
- AI conversation practice with three targeting modes
- AI-generated personalized text mnemonics
- Gamified community review system (swipe to approve/reject, mandatory review gate, threshold-based auto-merge)
- Cross-device sync via manual export/import
- Bounded upvote/downvote system for community content ranking

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| FSRS + weakness detection interaction | Medium | High | Use existing `ts-fsrs` npm package for scheduling; weakness layer sits on top and only biases queue ordering, never overrides FSRS intervals. Ship with conservative 0.7/0.3 ratio. |
| Parser-based grammar validation complexity | Medium | High | Start with conjugation-aware validation for common verb forms (て-form, た-form, ない-form); expand coverage iteratively. Fallback to Levenshtein for patterns without parser support. |
| WaniKani API stability / item mapping | Medium | Medium | Version-lock integration against current WaniKani API v2; maintain item mapping table; if API changes, fallback to manual bulk-marking. |
| Bunpro API availability / export format | Medium | Medium | Investigate Bunpro's API or export capabilities early; if no public API/export exists, offer manual grammar marking as fallback and document limitation. |
| Anki deck format variability | Medium | Medium | Support only standard `.apkg` export format initially; clearly document supported formats; unmatched items use manual marking fallback. |
| SQLite performance with weakness stats | Low | High | Benchmark weakness score calculation on queue build; index per-item stats tables; the <100ms query target includes weakness scoring. |
| Content parity perception | High | Critical | Invest heavily in N5 content quality (explanations, examples, mnemonics) before launch. Get feedback from active WaniKani/Bunpro users. If content is perceived as weaker, nothing else saves the product. |
| Visual mnemonic image generation at scale | Medium | Medium | Start with N5 radicals only (~50 images); iterate on generation prompts before expanding to N4+. |
| App store review rejection | Low | Medium | Submit to TestFlight/internal testing early; plan 2-week buffer before target launch. |

**Market Risks:**

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Users don't discover the app | High | High | Seed initial community via Reddit (r/LearnJapanese), YouTube, JLPT study forums. GitHub README as landing page. Share time compression screenshots as viral hooks. |
| Switching trigger too weak | Medium | High | Validate before building: Reddit polls, landing page waitlist, demo video. The switching trigger is NOT "all-in-one" — it's "smarter and faster." Weakness detection, time compression, and seamless import deliver this. |
| Content quality doesn't match WaniKani/Bunpro | Medium | Critical | This is the #1 risk. If content is weaker, no UX or intelligence feature saves the product. Invest disproportionate effort in N5 content. Get WaniKani/Bunpro user feedback before public launch. |
| Import doesn't preserve enough progress | Medium | Medium | Map all WaniKani and Bunpro items and SRS states comprehensively. Test with real exports. Show clear import summary with no surprises. |

**Resource Risks:**

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| 3-month timeline too aggressive for solo dev | High | High | Scope is significant with import/weakness detection/time compression. Timeline is flexible. Use AI-assisted development aggressively. Consider shipping N5 content only at launch, expanding JLPT levels post-launch. |
| Parser-based grammar validation is complex to build | Medium | Medium | Start with top 10 most confused grammar patterns; expand parser coverage iteratively based on user error data. |
| Visual mnemonic generation is time-consuming | Medium | Low | Start with N5 radicals only; batch-generate using consistent prompts; expand to N4 post-launch. |
| Burnout from solo development | Medium | Medium | Dogfood the app's own cognitive load philosophy — sustainable pace over crunch. Ship a working N5-only vertical slice first. |

## Functional Requirements

### Learning Content & Progression

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

### SRS Engine & Review

- FR9: Learners can prove knowledge through input-based testing — typing answers rather than self-grading. The review loop is keyboard-first: show → type → result → next, with no menus or animations between items.
- FR10: The system schedules reviews using FSRS (Free Spaced Repetition Scheduler) for research-backed optimal intervals.
- FR11: The system provides a unified review session that interleaves kanji, vocabulary, and grammar items intelligently. Sessions start immediately upon tapping "Review" — no intermediate screens.
- FR12: The system maintains a static relationship layer that maps connections between content types (kanji↔vocabulary, kanji↔radicals, grammar↔vocabulary). When a grammar example uses kanji or vocabulary the learner studied recently, it is highlighted explicitly in the UI (e.g., "食べる ← you learned this yesterday"). Reinforcement is visible, not invisible.
- FR12b: The system applies micro-adjustments to related items when one is reviewed (e.g., reviewing a kanji boosts scheduling priority of its associated vocabulary and grammar).
- FR13: Learners can input Japanese text via embedded romaji-to-hiragana conversion (WanaKana) without relying on the OS keyboard.
- FR14: The system detects typos using Levenshtein distance for meaning answers (accepting with warning for minor typos, rejecting with "close!" hint for near-misses) and parser-based conjugation-aware validation for grammar answers.

### Cognitive Load & Engagement

- FR15: The system tracks daily cognitive load through a visual ring that fills as the learner studies, with heavier items (new kanji) costing more energy than light reviews (mature vocabulary).
- FR16: The system communicates to the learner when they have done enough for the day based on their cognitive load threshold.
- FR17: The cognitive load threshold adapts over time as the learner grows stronger.
- FR18: Learners can maintain a daily streak, with the streak count visible in the app.
- FR19: The system sends opt-in push notifications for daily review reminders and streak-at-risk alerts.
- FR20: Learners can configure notification timing and opt out of notifications entirely.

### Onboarding & Customization

- FR21: Learners can select their starting JLPT level (N5 for beginners, or higher for existing learners) on first launch.
- FR22: Learners can import existing progress via WaniKani API, Bunpro import, or Anki deck upload during onboarding.
- FR23: Learners can mark individual kanji, vocabulary, or grammar items as "already known" (skip), "in progress" (add to SRS at appropriate interval), or "not started."
- FR24: Learners can bulk-mark items when importing existing knowledge (e.g., mark all N5 kanji as known).
- FR25: Learners can select session intensity preference (relaxed ~15 min or intense ~30 min daily sessions).
- FR26: Learners can begin using the app without creating an account or providing personal information.

### Personal Content

- FR26b: Learners can write personal mnemonics for any kanji, vocabulary, or grammar item, stored locally on-device.
- FR27: Learners can view the pre-generated visual mnemonic images for radicals and text mnemonics for kanji, vocabulary, and grammar items.
- FR28: Learners can view their weakness detection statistics — per-item error history, confusion clusters, and pattern accuracy trends over time.

### Weakness Detection Engine

- FR29: The system tracks per-user, per-item error statistics: correct count, incorrect count, and error type history (e.g., reading mistake vs meaning mistake for kanji, conjugation error type for grammar).
- FR30: Items are tagged with pattern labels (e.g., `grammar_tag: "te-form"`, `kanji_tag: "reading_confusion"`) to enable confusion cluster detection — identifying groups of items the learner consistently confuses.
- FR31: The review queue is biased by weakness: `priority = fsrs_score × 0.7 + weakness_score × 0.3`. Items the learner struggles with appear more frequently than pure FSRS scheduling would dictate.
- FR32: Weakness statistics are visible to the learner — they can see which patterns are weakest and track improvement over time (e.g., "te-form accuracy: 45% → 72% over 2 weeks").
- FR33: Confusion clusters are surfaced to the learner (e.g., "You often confuse て-form and た-form") to build awareness of specific weak areas.

### Time Compression Display

- FR33b: After each review session, the system displays a summary showing items reviewed broken down by domain (kanji, grammar, vocabulary), total time spent, and an estimated equivalent time in a multi-app stack (e.g., "18 min → ~35–40 min across separate apps").
- FR33c: The time compression estimate is based on documented session patterns in separate tools (separate logins, separate review queues, no cross-domain mixing) and is conservative to maintain credibility.

### Progress Import

- FR33d: Learners can import their WaniKani progress via the WaniKani API — items are mapped to internal curriculum items, and WaniKani SRS intervals are converted to FSRS state. Burned items remain burned, apprentice items enter at short intervals.
- FR33e: Learners can import their Bunpro grammar progress — grammar points are mapped to internal grammar items, and Bunpro SRS intervals are converted to FSRS state. Import method depends on Bunpro's available API/export functionality.
- FR33f: Learners can import Anki decks — the system parses standard Anki export formats and maps cards to internal curriculum items where a match exists, converting intervals to FSRS state.
- FR33g: Unmatched imported items (e.g., custom Anki cards not in the structured curriculum) are clearly flagged for the learner to handle manually.
- FR33h: The import process provides a clear summary of what was imported, what was mapped, and what remains unmatched before finalizing.

### Shadow Mode (Post-MVP)

- FR33i-PM: Learners who import progress can enable shadow mode — reviews are scheduled normally, but the app explicitly positions itself as a parallel tool ("try before you commit") rather than a replacement.
- FR33j-PM: Post-session stats in shadow mode show retention rate, items covered across domains, and total time — providing data the user can compare with their existing tool experience.
- FR33k-PM: Shadow mode displays periodic prompts after 1–2 weeks of usage: "You've been comparing for X days — ready to switch fully?" without forcing a decision.

### Administration & Content Pipeline

- FR34: The project creator generates and manages visual mnemonic images for radicals, uploading them to Cloudflare R2.
- FR35: The system automatically validates curriculum content against JSON schema rules via CI (GitHub Actions).
- FR36: The system automatically compiles JSON source data into an optimized SQLite database when changes are merged (GitHub Actions).
- FR37: The compiled SQLite database is versioned and stored in the repository via Git LFS.
- FR37b: Visual mnemonic image URLs are stored in the curriculum data and referenced by the app to load images from Cloudflare R2.

### AI-Generated Reading Stories (Post-MVP)

- FR38-PM: Learners with an AI API key (BYO or obtained via OpenRouter) can generate reading stories that use their active kanji, vocabulary, and grammar — creating narrative reinforcement of current learning material.
- FR39-PM: The system supports multiple AI providers (OpenAI, Anthropic, OpenRouter) via stored API key, with appropriate error handling.
- FR40-PM: Learners can obtain an AI API key through two paths: (1) entering their own BYO key, or (2) being redirected to OpenRouter to purchase API credits.

### Community Contribution (Post-MVP)

- FR41-PM: Contributors can propose edits to curriculum content (kanji descriptions, readings, grammar details, synonyms, example sentences) through an in-app flow.
- FR42-PM: The system creates a GitHub branch and pull request from the contributor's edits without requiring git knowledge.
- FR43-PM: Contributors can authenticate via GitHub OAuth when choosing to contribute (not required for general app usage).
- FR44-PM: Contributors can accumulate local edits and batch-submit them as a single contribution.
- FR45-PM: All contributed content is tagged with its origin (human-authored or AI-generated) so reviewers and users can distinguish provenance.

### Data & Offline

- FR46: The app stores all curriculum data, user progress, and weakness detection statistics locally in SQLite on-device.
- FR47: The app functions fully offline after the initial content download. All SRS review, weakness detection, time compression display, and reading features work without network.
- FR48: The app checks for curriculum database updates on launch and downloads the updated database if a new version is available.
- FR49: Visual mnemonic images are cached locally after first load — subsequent views work offline.
- FR50: WaniKani and Bunpro import require a one-time network connection to access their respective APIs. After import, all data is local.
- FR51: The app receives over-the-air JavaScript bundle updates without requiring a new app store submission, enabling rapid bug fixes and non-native code changes.

### Accessibility

- FR52: The app supports screen readers (TalkBack on Android, VoiceOver on iOS) for navigation, review sessions, and results.
- FR53: The app provides sufficient color contrast ratios for all UI elements including the cognitive load ring.
- FR54: The app supports scalable text for all learning content.

## Non-Functional Requirements

### Performance

- NFR1: SRS review interactions (presenting an item, accepting input, displaying result) complete in under 100ms on mid-range devices. The review loop must feel instantaneous — show → type → result → next with zero perceptible lag. This is non-negotiable for a "serious tool" UX.
- NFR2: SQLite query response time for standard operations (fetching review queue, loading item details, updating SRS state, weakness score calculation) stays under 100ms on mid-range devices.
- NFR3: App cold start to first interactive screen completes within 3 seconds on mid-range devices. Tapping "Review" launches the first item with no intermediate screens.
- NFR4: Curriculum database update download completes within 30 seconds on a standard mobile connection for incremental updates.
- NFR5: WanaKana romaji-to-hiragana conversion renders in real-time during keystroke input with no visible delay.
- NFR5b: No UI animations are permitted within the review loop (between items). Animations are allowed only for non-blocking UI (cognitive load ring fill, streak counter) and never delay the next review item.

### Security

- NFR6: WaniKani and Bunpro API keys used for import are stored using platform-appropriate secure storage (Keychain on iOS, Android Keystore on Android) during the import process and can be discarded after import completes.
- NFR7: Import API calls transmit only the respective API key to WaniKani/Bunpro endpoints over HTTPS. No user learning data from this app is sent externally.
- NFR8: No user learning data, progress, weakness statistics, or personal information is transmitted off-device. All learning state remains local to the device.
- NFR9: Anki deck import processes files locally on-device. No imported data is transmitted to any external service.

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

- NFR18: WaniKani and Bunpro API integration handles rate limiting, invalid keys, and API changes gracefully with clear error messages and no app crashes. If either API is unreachable, the app offers manual item marking as a fallback.
- NFR19: Anki deck import handles malformed files, unsupported formats, and partial matches gracefully — clearly communicating what was imported, what failed, and why.
- NFR20: Cloudflare R2 image loading handles unavailability gracefully — cached images display from local storage; missing images show a text-based fallback mnemonic rather than a broken image state.

### Content Scalability

- NFR21: The SQLite database structure supports content growth from N5-only (MVP seed) to full N5–N1 coverage without requiring schema changes or app updates.
- NFR22: Database query performance remains within the <100ms target as content scales from initial seed (~500 items) to full curriculum (~10,000+ items across all JLPT levels).
