---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'All-in-one Japanese learning application (open source, local-first, cross-platform)'
session_goals: 'Free, open-source, cross-platform app (Android, iOS, local desktop via Electron + RN Web) combining WaniKani-style kanji/vocab, Bunpro-style grammar, AI conversation, image/audio extraction, verb conjugation — all local-first, no hosted product web app'
selected_approach: 'ai-recommended'
techniques_used: ['Morphological Analysis', 'Cross-Pollination', 'First Principles Thinking']
ideas_generated: [19]
context_file: ''
technique_execution_complete: true
facilitation_notes: 'User has a highly developed sense for architectural trade-offs. Successfully navigated complex data structure decisions (JSON vs SQLite, unified vs separate SRS tracking) and engineered a novel self-sustaining open-source contribution pipeline.'
session_active: false
workflow_completed: true
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-03-14

## Session Overview

**Topic:** All-in-one Japanese learning application — open source, local-first, cross-platform

**Goals:**
- SRS-based kanji, vocabulary, grammar, and verb conjugation learning
- Cross-platform **Android, iOS, and desktop** with local data storage (no hosted product web app; desktop is a **local** app)
- Open-source with community-contributed data
- AI-powered listening/conversation practice
- Image and audio text extraction
- Custom mnemonics, notes, and user-added answers
- Data export/import across devices
- Smart input handling (romaji-to-hiragana, typo detection)

### Context Guidance

_No external context file provided._

### Session Setup

_Riyaz wants to brainstorm around building a comprehensive, free, open-source Japanese learning app that rivals paid services like WaniKani and Bunpro. The app should run on **Android, iOS, and desktop** with a local-first data architecture — no server hosting costs and **no requirement to host a public web application**; the desktop experience is delivered as a **local** shell (e.g. **Electron**) loading a **React Native Web** build so the UI stays on the same React/RN codebase as mobile. Key differentiators include community-driven data contributions, AI-powered features (conversation, listening, image/audio extraction), and smart input systems with typo detection. The technology stack needs to support all these requirements while remaining accessible to open-source contributors._

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** All-in-one Japanese learning app with focus on local-first, open-source, cross-platform architecture

**Recommended Techniques:**

- **Morphological Analysis:** Systematically map all feature dimensions (learning modes, data architecture, platform targets, AI integration) and explore parameter combinations
- **Cross-Pollination:** Transfer ideas from WaniKani, Bunpro, Duolingo, Anki, game design, fitness apps, and non-language domains to find genuinely novel approaches
- **First Principles Thinking:** Strip assumptions about local-first data, cross-platform tech, and community contributions to build architecture on solid ground
- **Constraint Mapping:** Explicitly map hard vs soft constraints (no server, cross-platform, open-source data model) to find freedom and pathways

**AI Rationale:** Session requires systematic decomposition of a complex multi-feature product, creative differentiation beyond cloning existing tools, architectural clarity for unconventional constraints (local-first + community data), and stress-testing of assumptions before committing to a tech stack.

## Idea Generation: Morphological Analysis

**[Core #1]: JLPT-Gated Content Architecture**
_Concept:_ All content (kanji, vocab, grammar, reading, listening) is organized into JLPT N5→N1 tiers. Progression is parallel within a level (users don't have to finish all kanji to start grammar), but the JLPT level is the universal organizing principle.
_Novelty:_ Replaces proprietary progression systems (like WaniKani levels) with a standardized, parallel progression model across all learning types.

**[Core #2]: Grammar + Reading Intersection**
_Concept:_ Grammar points are taught using example sentences drawn from actual reading passages. When learning a grammar point, practice includes reading snippets using that exact grammar in context.
_Novelty:_ Weaves grammar into actual reading material rather than using isolated, static example sentences.

**[Core #3]: Grammar + Vocabulary Intersection**
_Concept:_ Grammar examples dynamically prioritize vocabulary the user has already learned.
_Novelty:_ Reduces cognitive load by ensuring the user isn't fighting unknown words and unknown grammar simultaneously.

**[Core #4]: Kanji + Vocabulary + Radical Reinforcement Loop**
_Concept:_ Bidirectional SRS links. Reviewing a kanji reinforces its component radicals and the vocab words that use it. Reviewing vocab reinforces the kanji.
_Novelty:_ Creates a deeply interconnected knowledge graph where learning in one domain boosts confidence in related domains.

**[Core #5]: Comprehension-Based Listening (Local Audio)**
_Concept:_ Pre-recorded audio clips with comprehension prompts ("type what you understand"), not just strict dictation. All audio stored locally and maintained by the community.
_Novelty:_ Local-first, community-driven listening practice tied directly to the user's specific vocab/grammar knowledge.

**[Core #6]: AI as Optional Enhancement Layer**
_Concept:_ The core app is 100% functional with local data. AI (via user's own API key) is an optional toggle to generate extra examples, personalized mnemonics, or conversation practice.
_Novelty:_ Solves the cost/server problem while still offering cutting-edge AI features. AI enriches rather than gates learning.

**[Core #7]: GitHub-Authenticated Community Data Pipeline**
_Concept:_ Mandatory GitHub login for users. When a user generates a great mnemonic or AI example, the app offers to "contribute" it, automatically creating a PR to the central repo using their GitHub identity.
_Novelty:_ Turns everyday users into open-source contributors without requiring git knowledge. Solves authentication for free.

**[Core #8]: AI-Assisted Crowdsourcing**
_Concept:_ Users use their own AI keys to generate content (like reading passages), and the best ones are PR'd back to the community repo (tagged as AI-generated for review).
_Novelty:_ The community dataset grows organically through actual learning sessions powered by distributed AI compute.

**[Core #9]: Hybrid SRS Architecture**
_Concept:_ Separate SRS trackers for each item type (Kanji, Vocab, etc.) using SM-2, connected by a static Relationship Layer (e.g., kanji_to_vocab).
_Novelty:_ Balances the simplicity of flat data structures (easy for open source) with the power of interconnected learning.

**[Core #10]: Invisible Nudge System & Unified Review Mixer**
_Concept:_ Reviewing an item applies a small, invisible "nudge" (interval/ease adjustment) to related items via fixed weights. A unified review session intelligently interleaves all content types based on these relationships.
_Novelty:_ Creates micro-reinforcement loops within a single session (e.g., showing a kanji shortly before a grammar sentence that uses it) without confusing the user with complex stats.

## Idea Generation: GitHub Contribution Flow & Community Review

**[Community #1]: Unrestricted but Curated Contribution Scope**
_Concept:_ Users can propose edits to *anything* in the core dataset (kanji, vocab meanings, grammar) or add entirely new data.
_Novelty:_ Unlike locked-down proprietary apps, the entire curriculum is a living, breathing wiki that can be optimized by the crowd.

**[Community #2]: Bounded Upvote System for Content Alternatives**
_Concept:_ For subjective data like mnemonics, the PR adds to an `alternate_mnemonics` array. Users upvote/downvote these in the app. Only the top X (e.g., top 3) become the "official" public list shown by default. Users can still write personal, local-only mnemonics that never sync.
_Novelty:_ Solves the "what makes a good mnemonic?" debate by letting the community algorithmically sort the best ones to the top without cluttering the UI.

**[Community #3]: Frictionless Invisible PR Generation**
_Concept:_ When a user submits an edit/addition, the app silently uses their GitHub token to fork the repo, create a branch, commit the JSON change, and open a PR against the central repo—all in a few seconds behind a loading spinner.
_Novelty:_ True open-source contribution disguised as standard in-app behavior. Zero git knowledge required from the user.

**[Community #4]: Gamified Community Review System**
_Concept:_ A "Community Review" mode built into the app (swiping left/right to approve/reject pending PRs). If you want to submit data, you are *required* to occasionally review others' data (e.g., must review 5 items to submit 1).
_Novelty:_ Distributed moderation. It solves the open-source maintainer bottleneck by making the user base moderate itself.

**[Community #5]: Threshold-Based Auto-Merge**
_Concept:_ PRs are automatically validated by GitHub Actions (schema checks). Then, instead of just raw numbers, they require a percentage consensus from the Community Review mode—e.g., at least 15 reviews, with a 60% approval threshold. If met, the PR auto-merges.
_Novelty:_ A fully automated, trustless, self-sustaining content pipeline. The core team only steps in for system-level changes or dispute resolution.

**[UX #1]: The Cognitive Load Ring (Fitness App Cross-Pollination)**
_Concept:_ Instead of showing a stressful "100 reviews pending" badge, the app tracks daily "Mental Strain" (e.g., learning a new kanji costs more energy than reviewing an old vocab word). The UI tells the user when their brain is full and suggests "recovery" activities like light listening practice instead of pushing them to burnout.
_Novelty:_ Borrows the "recovery day / strain" concept from fitness trackers to combat the single biggest reason people quit SRS apps: review pile-up anxiety.

**[UX #2]: AI Conversation as Dynamic Target Practice**
_Concept:_ Before starting an AI conversation, the user selects from three targeting modes: 1) Manual: User picks specific grammar/vocab to practice. 2) SRS Integration: System secretly selects due/struggling items for the AI to weave into the chat for review. 3) Random Challenge: System secretly selects random known items for surprise practice. The AI is prompted to naturally force the user to interact with these targets.
_Novelty:_ Turns open-ended AI chat into a structured, pedagogical tool that directly ties back to the user's specific learning state and SRS needs, rather than just "talk to a bot."

## Idea Generation: Technical Architecture & Input Systems

**[Tech #1]: Unified Codebase — Mobile (RN) + Local Desktop (Electron + React Native Web)**
_Concept:_ Use Expo (or equivalent) to manage the **React Native** codebase for **Android** and **iOS**. Use **React Native Web** to produce a DOM-targeted bundle that is **not** deployed as a hosted website; instead, ship it **inside a desktop shell** such as **Electron** so the desktop app runs **entirely locally** (offline-capable UI, no product hosting). One repository, shared components and logic, with platform splits only where native vs. web rendering requires it.
_Novelty:_ Satisfies **local-first** and **no hosting** while still giving **three installable targets** (Android, iOS, desktop) from one codebase—desktop is “web tech in a box,” not a SaaS web app.

**[Tech #2]: JSON-to-SQLite Pipeline for Human-Readable Reviews**
_Concept:_ The GitHub repository stores all core data as structured JSON files (not SQLite, and not CSV, because JSON handles nested data like arrays of radicals/meanings best and has excellent GitHub diff UI). When a PR is merged, a GitHub Action automatically compiles the JSON into an optimized SQLite database file. The app downloads this pre-compiled SQLite file on startup if the version has changed.
_Novelty:_ Solves the tension between "human reviewers need to read PR diffs easily" (JSON) and "mobile apps need fast, relational local queries" (SQLite).

**[Tech #3]: Embedded WanaKana & Smart Typo Detection**
_Concept:_ Use the open-source WanaKana library for instant romaji-to-hiragana conversion without relying on the OS keyboard. Implement Levenshtein distance for typo detection: if English answer is 1 character off, accept with warning; if Japanese answer is 1 character off, reject but show a "close!" warning to prevent punishing fat-fingers.
_Novelty:_ Replicates the highly-polished input feel of premium web apps inside a completely offline mobile environment.

## Overall Creative Journey
We stripped the app concept down to its architectural foundations. Instead of just "an app with all the features," we designed a self-sustaining ecosystem where the data structure (JSON → SQLite), the review logic (Hybrid SRS with invisible nudges), and the community moderation (Gamified PR approvals) all work together to create an app that improves itself over time without drowning maintainers or overwhelming users.

### Creative Facilitation Narrative
_Riyaz came in with a clear vision for an all-in-one Japanese learning app but needed to solve the massive architectural challenge of making it free, local-first, and community-driven. Through Morphological Analysis, we mapped out a hybrid SRS system that links vocab, kanji, and grammar invisibly. We then designed a brilliant GitHub-backed contribution pipeline that turns app users into open-source contributors seamlessly. Finally, we locked in the technical direction: **Expo/React Native** for mobile, **React Native Web + Electron** (or similar) for **local desktop**, with **SQLite** for on-device data—no hosted web app required for the product itself._

### Session Highlights
**User Creative Strengths:** Exceptional at balancing ideal user experience with realistic technical constraints. Quickly identified the flaws in raw JSON data fetching and the need for a hybrid SRS approach.
**AI Facilitation Approach:** Analytical provocation. Pushed the user to define exactly how systems communicate (SRS relationships) and how data flows (GitHub PRs to mobile DB).
**Breakthrough Moments:** The realization that the GitHub PR review process could be gamified into the app itself, requiring users to review community content as a "payment" for submitting their own.
**Energy Flow:** High analytical engagement; user drove significant architectural decisions (SM-2, hybrid SRS, percentage-based community review).

## Idea Organization and Action Planning

**Thematic Organization:**

**Theme 1: Data Architecture & Pipeline**
_Focus: How data is stored, shipped, and consumed without a server._
- JSON core data stored on GitHub for human-readable diffs and PRs.
- GitHub Actions automatically compile JSON into a highly-optimized SQLite file.
- App downloads the SQLite file via GitHub Releases on startup for 0-latency offline access.

**Theme 2: Self-Sustaining Community Moderation**
_Focus: Solving the open-source maintainer bottleneck._
- Invisible PR generation: users submit edits directly in-app; app handles the git fork/branch/PR flow silently.
- App includes a "Community Review" mode (Tinder-style swipe to approve/reject PRs).
- Gamified mandate: to submit an edit, you must review others' edits.
- Percentage-based auto-merge (e.g., 60% approval from 15 reviews).

**Theme 3: The Hybrid SRS Engine**
_Focus: Making learning interconnected without making data a mess._
- SM-2 based individual trackers for Kanji, Vocab, and Grammar.
- A static "Relationship Layer" maps links (e.g., Kanji↔Vocab).
- An "Invisible Nudge" system where reviewing one item slightly boosts/penalizes related items.
- A Unified Review Mixer that intelligently interleaves different content types.

**Theme 4: Pedagogical AI & UX**
_Focus: Making the app feel good and using AI as an enhancer, not a crutch._
- The "Cognitive Load Ring" replaces stressful "100 reviews pending" badges to reduce burnout.
- AI Conversation is a targeted practice tool where the system secretly forces you to use struggling SRS items.
- AI is strictly an optional layer (BYO-Key) across all features, keeping the core app free.
- WanaKana embedded for offline smart input with Levenshtein distance typo detection (rejects Japanese typos, warns on English typos).

**Action Planning (Immediate Next Steps):**

1. **Initialize the Core Data Repo:** Create the GitHub repository and define the JSON schemas for Kanji, Radical, Vocab, and Grammar.
2. **Build the SQLite Pipeline:** Write a quick script (for a GitHub Action) that ingests those JSON files and spits out a SQLite database.
3. **Setup app skeleton:** Initialize the React Native (Expo) app and the **desktop shell** path (e.g. Electron loading the **React Native Web** build). Verify local SQLite database reading works on **iOS, Android, and desktop** (no dependency on a hosted web deployment).
4. **Build the SM-2 Engine:** Implement the basic SM-2 logic for the local user data trackers.

## Session Summary and Insights

**Key Achievements:**
- Solved the "Free vs Server Cost" dilemma via GitHub Releases + SQLite.
- Solved the "Open Source Maintainer Burnout" dilemma via mandatory in-app community reviews and percentage-based auto-merging.
- Designed a hybrid SRS system that balances flat, maintainable data structures with deeply interconnected learning loops.

**Session Reflections:**
This session took a highly complex, multi-faceted product idea and distilled it into a series of elegant technical solutions. By pushing hard on "First Principles," we avoided the trap of building a heavy backend server, and instead designed a truly decentralized, self-healing open-source ecosystem. The app is not just a tool for learning Japanese; it is an engine for crowdsourcing the best Japanese curriculum in the world.
