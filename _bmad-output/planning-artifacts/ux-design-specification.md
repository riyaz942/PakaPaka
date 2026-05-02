---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "planning-artifacts/product-brief-japanese-learning-2026-04-12.md"
  - "planning-artifacts/prd.md"
  - "planning-artifacts/prd-validation-report.md"
---

# UX Design Specification japanese-learning

**Author:** Riyaz
**Date:** 2026-05-02

---

## Executive Summary

### Project Vision

japanese-learning is a free, open-source, cross-platform mobile app (Android & iOS) that replaces the fragmented, expensive multi-tool stack serious Japanese learners assemble today. It matches WaniKani on kanji depth and Bunpro on grammar depth, then surpasses them with a weakness detection engine that targets what the learner struggles with, visible cross-domain reinforcement that shows kanji/vocabulary/grammar connections explicitly, and a time compression display that proves the app is faster than a multi-app stack on every session. Seamless WaniKani, Bunpro, and Anki import eliminates switching risk. All data is local-first and offline-capable. No accounts, no subscriptions, no ads.

The UX must embody "serious tool, not a toy" — keyboard-first input, <100ms review feedback, dense information-rich screens, and zero animations in the review loop. The app respects the learner's time and intelligence while making its adaptive intelligence visible and felt.

### Target Users

**Yuki (Anime/Manga Self-Learner):** 18-28, budget-conscious, motivated by consuming Japanese media in the original language. Hit a wall with shallow tools like Duolingo. Wants structured depth for free. 15-30 min daily sessions on mobile. Values feeling like they proved something each session.

**Kenji (Relocating Professional):** 25-40, needs practical Japanese fast for daily life in Japan. Limited free time, strong practical motivation. Studies on the train (offline-critical). Needs the app to tell them what to study next without overthinking curriculum.

**Mika (JLPT Test Prepper):** Any age, studying for a specific JLPT level (N3-N1). Disciplined, goal-oriented. Frustrated by paying $150-450/year across multiple subscriptions that don't communicate. Needs all JLPT domains in one place with input-based testing that builds real exam confidence.

**Riyaz (The Switcher):** Active WaniKani user who wants grammar at the same quality without another subscription. Fears losing accumulated progress. Technically savvy. Needs seamless import that proves nothing was lost, and a first session calibrated to their level.

### Key Design Challenges

1. **The review loop is the product.** The show → type → result → next cycle must feel faster than WaniKani. <100ms feedback, keyboard-first, zero animations in the review loop. If this feels sluggish or cluttered, nothing else matters. Anki speed, WaniKani structure.

2. **Making intelligence visible without noise.** Weakness detection, cross-domain reinforcement, and time compression must be felt by the user — not running invisibly in the background. But these insights must surface without slowing the review loop or cluttering dense screens. The balance between "show the intelligence" and "stay out of my way" is the central UX tension.

3. **Cognitive load ring as a novel paradigm.** No SRS app has a mental energy model. Users must immediately understand what the ring means, trust its recommendations, and not feel patronized — informational, not restrictive.

4. **Onboarding complexity for switchers.** Importing from WaniKani/Bunpro/Anki involves API keys, progress mapping, and review calibration. This must feel effortless and trustworthy. If a switcher's first session feels like a beginner experience, the import failed.

5. **Cross-platform Japanese input.** Romaji-to-hiragana conversion (WanaKana) must work seamlessly on both platforms without OS keyboard switching. Typo detection needs clear, non-punishing feedback.

### Design Opportunities

1. **Post-session summary as a viral moment.** Time compression display ("18 min → ~35-40 min across separate apps") plus domain breakdown is inherently shareable. Designing this screen to be screenshot-worthy is a growth lever.

2. **Visible reinforcement as the "aha" differentiator.** The moment a grammar sentence highlights "食べる ← you learned this yesterday" is the emotional switching trigger. This UI element needs to feel magical — subtle enough to not slow the flow, prominent enough to be noticed.

3. **Cognitive load ring as brand identity.** The ring can become the app's visual signature — a fitness-tracker-for-your-brain aesthetic that defines the product's visual language and makes it immediately recognizable in screenshots and recommendations.

## Core User Experience

### Defining Experience

The core experience of japanese-learning is the **unified review session** — a tight, keyboard-first loop of show → type → result → next that interleaves kanji, vocabulary, and grammar in a single stream. This is where 80%+ of daily usage lives. Every other feature — onboarding, import, stats, reading passages, weakness tracking — exists to serve, feed, or enhance this loop.

The review loop is the product. It must feel faster than WaniKani, denser than Bunpro, and more structured than Anki. The user types an answer, gets instant feedback (<100ms), and moves to the next item with zero friction. No menus between items, no animations that delay the next card, no decision points mid-session. The user's only job during a review is to recall and type.

What makes this loop different from every other SRS tool: the intelligence is visible. Weakness-targeted items appear more often (the user feels "this is targeting what I suck at"), cross-domain connections are highlighted in real-time ("食べる ← you learned this yesterday"), and the cognitive load ring fills as they study — telling them when they've done enough instead of showing a terrifying backlog.

### Platform Strategy

**Primary platform:** Mobile (Android & iOS via React Native / Expo) from a single codebase.

**Input model:** Touch for navigation, keyboard-first for the review loop. Japanese text input via embedded WanaKana (romaji → hiragana conversion) — users type in romaji and see hiragana appear in real-time. No OS keyboard switching required.

**Offline-first:** All SRS review sessions, FSRS scheduling, weakness detection, cognitive load tracking, streak tracking, and reading passages work fully offline after initial content download. Network is needed only for first-launch database download, curriculum updates, visual mnemonic image loading (cached locally), and one-time WaniKani/Bunpro import.

**Session context:** Designed for 15-30 minute sessions on commutes, during breaks, or at home. The app must be instantly responsive — cold start to first interactive screen within 3 seconds, tap "Review" to first item with no intermediate screens.

**Desktop (post-MVP):** Electron + React Native Web targeting macOS, Windows, Linux. Same codebase, same experience.

### Effortless Interactions

**Starting a review session:** Tap "Review" → first item appears instantly. No loading screens, no intermediate menus, no session configuration. The app decides what to serve based on FSRS scheduling + weakness biasing. The user's decision is binary: start reviewing, or don't.

**Japanese text input:** Romaji-to-hiragana conversion happens in real-time as the user types — no mode switching, no fumbling with OS keyboards. Fat-finger tolerance via Levenshtein distance: minor typos in English meaning answers are accepted with a gentle warning; near-misses in Japanese reading answers get a "close!" hint rather than a harsh rejection.

**Knowing what to study next:** The app eliminates decision fatigue entirely. FSRS determines when to review, weakness detection determines what to prioritize, and the dependency graph determines what to unlock next. The user never has to think about curriculum sequencing — they just show up and the app serves the right items.

**Ending a session:** The cognitive load ring fills as the user studies. When they've done enough, the ring signals completion — not with a hard stop, but with a clear visual cue that says "you've done great for today." The user can always continue, but the recommendation is visible. No "200 reviews pending" anxiety, no guilt for stopping.

**Progress import (switchers):** Enter a WaniKani API key → the app maps items, converts SRS intervals, and presents a clear summary of what was imported. The first review session after import is calibrated to the user's existing level. Burned kanji stay burned. The import should feel like the app already knew them.

### Critical Success Moments

**First session (Day 1):** The user completes their first review session — radicals with vivid visual mnemonics, kanji with input-based testing, immediate feedback on every answer. The cognitive load ring fills and glows — "you've done enough for today." The post-session summary shows time compression: "Kanji: 5 | Vocab: 8 | 12 min." The user closes the app feeling accomplished, not overwhelmed. This is where the app earns the right to a second session.

**The "aha" moment (Week 1-2):** A grammar review sentence contains 食べる and the UI highlights "← you learned this yesterday." The user didn't plan this connection — the app surfaced it. Simultaneously, the weakness engine is serving more て-form drills because the user keeps getting those wrong. The app feels like it's paying attention. This is the emotional switching trigger — the moment where "all-in-one" becomes "smarter than my old stack."

**The time compression proof (every session):** Post-session summary: "Kanji: 12 | Grammar: 8 | Vocab: 15 | 18 min — equivalent to ~35-40 min across separate apps." This isn't a one-time marketing claim — it's measured and displayed after every single session. Daily reinforcement that this is faster builds conviction over weeks.

**Import trust (switchers, Day 1):** After importing WaniKani progress, the user's first review session serves items at their actual level — not beginner content. Burned kanji don't appear. Apprentice items appear at short intervals. The user thinks "it already knows what I know." If this fails — if the first session feels like starting over — the switcher uninstalls.

**Weakness improvement (Month 1+):** The user opens their weakness stats and sees "て-form accuracy: 45% → 78% over 3 weeks." The app didn't just drill the weakness — it can prove the improvement. This is the long-term retention hook: measurable evidence that the adaptive engine is working.

### Experience Principles

1. **Speed is respect.** Every millisecond of delay in the review loop communicates disrespect for the user's time. <100ms feedback is not a nice-to-have — it's the defining quality bar. No animations in the review loop. No intermediate screens. No loading states during sessions. The app must feel faster than thought.

2. **Intelligence must be felt, not claimed.** The weakness detection engine, cross-domain reinforcement, and time compression display exist to make the user feel "this app is smarter than my old stack." But intelligence that runs invisibly is intelligence that doesn't exist to the user. Every adaptive behavior must have a visible signal — a highlighted connection, a targeted review, a time savings number. Show the work.

3. **Inform, don't restrict.** The cognitive load ring recommends when to stop, but never forces it. Weakness stats show patterns, but don't hide content. The app trusts the user's judgment while providing better information than any other tool. Informational, not parental.

4. **Zero decisions during review.** The user's only job in a review session is to recall and type. What to review, when to review, how to order items, when to stop — the app handles all of it. Decision fatigue is the enemy of daily habit formation. The app decides; the user learns.

5. **Prove the value on every session.** Don't ask the user to trust on faith. Time compression shows savings daily. Weakness stats show improvement weekly. Cross-domain reinforcement shows connections in real-time. The app's intelligence is measured, displayed, and provable — not a landing page promise.

## Desired Emotional Response

### Primary Emotional Goals

**Focused mastery:** The dominant emotion during a review session is the flow state of a well-paced challenge. Not gamified excitement, not dread — the quiet satisfaction of proving knowledge through typing. The review loop should feel like a skilled practice session: intense, efficient, rewarding.

**Felt intelligence:** The app should feel smart — like it's paying attention to the user specifically. Not AI-assistant smart (conversational), but coach smart (targeted, personal, measured). Weakness detection, visible reinforcement, and time compression create the sensation that this tool understands the user better than their old stack did.

**Vindication:** For switchers and cost-conscious learners, the emotional payoff is "I was paying $168/year for two apps and this free thing is actually smarter." Time compression triggers this on every session. It's not just satisfaction — it's proof that the switch was right.

### Emotional Journey Mapping

| Stage | Primary Emotion | Supporting Emotions | Design Implication |
| --- | --- | --- | --- |
| **Discovery / First launch** | Curiosity + relief | "This is free? And it covers everything?" | Clean onboarding, no paywall anxiety, immediate credibility |
| **During review** | Focused flow | Quiet confidence, proving knowledge | Distraction-free review loop, <100ms feedback, no interruptions |
| **Correct answer** | Brief satisfaction | Momentum, competence | No celebration animations — the speed of moving to the next item IS the reward |
| **Wrong answer** | Clarity without shame | Acceptance, learning | "Close!" hints teach, not punish. Weakness engine acknowledges the gap without drama |
| **Cognitive load ring fills** | Permission + accomplishment | Completion, self-care | "You've done enough" feels like finishing a workout, not being told to stop |
| **Post-session summary** | Vindication + momentum | Value confirmation, progress | Time compression proves the value; domain breakdown shows breadth |
| **"Aha" moment (Week 1-2)** | Surprise + trust | Connection, intelligence | Visible reinforcement creates an emotional bond with the app's adaptive engine |
| **Weakness improvement (Month 1+)** | Pride + evidence | Growth, confidence | "45% → 78%" is measurable proof — not a feeling, a fact |
| **Returning daily** | Ritual comfort + anticipation | Trust, habit | The app is a trusted daily practice tool, not a chore |

### Micro-Emotions

**Confidence vs. Confusion:** The app must always communicate clearly what type of answer is expected (reading vs. meaning, hiragana vs. English). Ambiguity in what's being asked creates confusion and erodes trust. Every review item must be instantly parseable: "I know what you want from me."

**Trust vs. Skepticism:** Time compression estimates must be conservative and credible. Import summaries must be transparent about what was mapped and what wasn't. Weakness stats must feel honest — if the user suspects the numbers are inflated or manipulated, the entire intelligence layer loses its power.

**Accomplishment vs. Frustration:** The cognitive load ring reframes session endings from "I gave up" to "I completed my capacity." Wrong answers are learning data, not failures — the weakness engine uses them productively, and the user can see that happening.

**Momentum vs. Anxiety:** No "200 reviews pending" counter. No guilt-inducing backlog displays. The app shows what's ready now, not what's overdue. The cognitive load ring replaces quantity-based anxiety with capacity-based progress.

### Design Implications

**Focused mastery → Distraction-free review loop.** No animations between items. No celebratory popups on correct answers. No sound effects. The reward for a correct answer is the immediate appearance of the next item. Speed is the celebration.

**Felt intelligence → Visible adaptive signals.** Every piece of adaptive behavior must have a corresponding UI signal. Weakness-targeted items are served more frequently (the user feels the targeting). Cross-domain connections are highlighted explicitly (the user sees the connections). Time savings are calculated and displayed (the user reads the proof). Intelligence that runs silently is intelligence that doesn't exist.

**Vindication → Screenshot-worthy post-session summary.** The time compression display must be designed for sharing — clean layout, clear numbers, domain breakdown, and the killer comparison line ("18 min → ~35-40 min across separate apps"). This screen is both an emotional payoff and a growth lever.

**Permission → Non-restrictive cognitive load ring.** The ring recommends, never restricts. Visual language should echo fitness trackers (Apple Watch activity rings, WHOOP strain) — completion feels earned, not imposed. The user can always continue past the ring's recommendation.

**Clarity without shame → Constructive error feedback.** Wrong answers show the correct answer immediately with no delay. Typo detection distinguishes knowledge gaps from fat fingers. The "close!" hint on near-misses communicates "you almost had it" rather than "you failed." Weakness pattern recognition turns errors into data: "You often confuse て-form and た-form" is diagnostic, not judgmental.

### Emotional Design Principles

1. **Earned satisfaction, not manufactured delight.** The emotional reward comes from real learning — proving knowledge through input-based testing, seeing measurable improvement, experiencing visible intelligence. No artificial gamification (no XP, no leaderboards, no confetti). The product respects the user enough to let real progress be the motivation.

2. **Speed is the primary emotional signal.** Instant feedback (<100ms) communicates respect. Moving to the next item without delay communicates momentum. A review session that flows without interruption communicates "this tool was built by someone who actually does reviews." Slowness, in any form, communicates disrespect.

3. **Errors are data, not failures.** Every wrong answer feeds the weakness detection engine, and the user knows this. The emotional reframe: "I got it wrong, but the app will use that to help me." Wrong answers are investments in future targeting, not marks against the user. The weakness stats screen makes this explicit.

4. **Prove, don't promise.** Time compression shows daily savings. Weakness stats show weekly improvement. Cross-domain reinforcement shows connections in real-time. Import summaries show exactly what was preserved. The app never asks the user to trust on faith — every claim about intelligence, speed, or value is backed by visible evidence within the app itself.

5. **Permission to stop is permission to return.** The cognitive load ring's most important emotional function is making tomorrow's session feel safe. If today ends with "you've done enough" instead of "187 reviews still pending," the user returns tomorrow without dread. Sustainable daily practice depends on the app never making the user feel behind.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**WaniKani — Input-Based Kanji SRS**

WaniKani is the closest UX benchmark for japanese-learning's kanji and review loop experience. It's what switchers (Riyaz/Mika personas) will directly compare against.

*What it does well:*
- **The review loop is fast and focused.** Show item → type answer → immediate feedback → next. No menus between items. The loop feels like a test you're taking at your own pace — serious, not playful.
- **Input-based testing builds real confidence.** Typing readings and meanings forces active recall. Users know they actually learned something because they proved it. Self-grading (Anki's model) never provides this certainty.
- **Radical → kanji → vocabulary dependency graph is elegant.** Users understand why they're learning radicals because the payoff (kanji that use those radicals) comes quickly. The progression feels logical and earned.
- **Mnemonic system creates community.** User-submitted mnemonics alongside official ones give users a sense of ownership and connection.
- **SRS stages are clearly communicated.** Apprentice → Guru → Master → Enlightened → Burned gives users a tangible sense of progress on every item.

*What it gets wrong:*
- **Review pile-up creates dread.** The "X reviews pending" counter is the #1 reason users burn out. Coming back after a break to 400+ reviews is psychologically devastating. No mechanism to manage cognitive load.
- **No weakness targeting.** Items that consistently confuse the user get reviewed at the same frequency as items the user always gets right. The SRS is mechanical, not adaptive.
- **Kanji-only scope.** Users need grammar too, forcing them to buy Bunpro separately. The tools don't communicate — no cross-domain reinforcement.
- **Rigid progression.** Users can't skip content they already know without going through it. Returning learners are forced to re-prove knowledge from Level 1.
- **Subscription wall.** $9/month means many learners hit the free tier ceiling (3 levels) and can't continue.

*What we take:* The review loop speed and input-based testing discipline. The dependency graph UX. The SRS stage visibility.
*What we fix:* Cognitive load management (ring replaces pending counter), weakness detection, cross-domain scope, import for switchers.

---

**Bunpro — Grammar SRS**

Bunpro is the grammar benchmark. Users who currently pay for both WaniKani + Bunpro are our primary switching target.

*What it does well:*
- **Structured grammar progression by JLPT level.** Users know exactly where they are in the JLPT framework. The progression feels mapped to a real-world goal (passing an exam).
- **Cloze-style grammar testing.** Fill-in-the-blank sentences test grammar in context rather than in isolation. This is closer to real usage than flashcard-style review.
- **Multiple example sentences per grammar point.** Seeing the same grammar point in different contexts builds genuine understanding, not pattern matching on a single sentence.
- **Grammar explanations with external resource links.** Connecting to Tae Kim, Imabi, and other resources acknowledges that grammar needs deeper explanation than a flashcard can provide.

*What it gets wrong:*
- **The review interface feels cluttered.** Too much information on screen during reviews — hints, notes, grammar point details, and navigation compete for attention. The review loop doesn't feel as clean as WaniKani's.
- **Transition between JLPT levels is jarring.** Moving from N5 to N4 doesn't feel like natural progression — it feels like starting a new course. No smooth continuity.
- **Answer validation is inconsistent.** Sometimes grammatically correct alternative forms are rejected. This creates frustration and distrust in the system — the user knows they're right but the app says they're wrong.
- **No connection to kanji/vocabulary.** Grammar examples use kanji the user may not know, with no indication of whether the user has studied those kanji elsewhere. The isolation from kanji tools is felt.
- **Dense UI without clear hierarchy.** Study pages pack a lot of useful information but lack visual hierarchy — everything feels equally important, so nothing stands out.

*What we take:* JLPT-structured grammar progression. Multiple example sentences per grammar point. Cloze-style contextual testing.
*What we fix:* Clean review loop (WaniKani-level focus), conjugation-aware validation (no false rejections), cross-domain connection to kanji/vocabulary (visible reinforcement), visual hierarchy in information display.

---

**Apple Watch Activity Rings / WHOOP Strain — Fitness Tracking UX**

The cognitive load ring borrows directly from fitness tracking's "fill the ring" paradigm. These products solved the exact problem we face: motivating daily behavior without creating guilt or anxiety.

*What they do well:*
- **The ring is instantly legible.** One glance tells you where you are. No numbers needed to understand progress — the visual fill communicates everything. Empty ring = start of day. Full ring = goal met. Overflowing = you went above and beyond.
- **Completion feels earned, not imposed.** Closing the ring creates genuine satisfaction — a small daily win. The visual metaphor of "closing" something creates emotional closure.
- **WHOOP's strain model is informational, not prescriptive.** WHOOP tells you your strain level but doesn't stop you from exercising. It provides data for decision-making, not restrictions. This is exactly the tone we need: "here's where you are" not "you must stop."
- **Progressive adaptation.** Activity goals adjust over time based on performance. The ring grows with the user — what was hard last month becomes the new baseline. This maps directly to our cognitive load adaptation (FR17).
- **Social sharing of rings is a growth loop.** Activity ring screenshots are shared constantly — a natural viral mechanism. Our post-session summary has the same potential.

*What they get wrong (for our context):*
- **Apple's "close your rings" can become anxiety-inducing.** The "you haven't stood up in an hour" nagging tone is patronizing. We must avoid this — the cognitive load ring should inform, not nag.
- **WHOOP requires a subscription.** We're free. But the data-rich, serious-tool aesthetic of WHOOP (not the playful Apple Fitness+ aesthetic) is closer to our emotional target.

*What we take:* Ring as primary progress visualization. Informational tone (WHOOP-style, not Apple-nag-style). Progressive adaptation. Screenshot-worthy completion state.
*What we fix:* The ring recommends, never restricts or nags. No push notifications tied to ring status beyond the daily review reminder.

---

**Duolingo — Gamified Language Learning**

Duolingo is the product everyone compares to but explicitly NOT our emotional target. It's a useful study in what works for engagement and what fails for serious learners.

*What it does well:*
- **Onboarding is frictionless.** First lesson starts within 60 seconds of download. No account required to begin. The time-to-value is the best in the industry. We should match this: no account, immediate first review.
- **Streak system is habit-forming.** The daily streak with "freeze" protection is simple and powerful. Duolingo's streak is the #1 reason casual users return daily. Our streak system should be equally simple.
- **Progress visualization is clear.** The skill tree / path shows exactly where you are, what's next, and what's locked. Users never wonder "what should I study?" This maps to our "zero decisions" principle.
- **Error recovery is gentle.** Getting an answer wrong in Duolingo doesn't feel punishing — you see the correct answer and move on. The emotional cost of failure is low, which keeps engagement high.

*What it gets wrong (for serious learners):*
- **Gamification obscures actual learning.** XP, gems, leaderboards, hearts, and "you're in the Diamond League!" create a game where the goal becomes playing the game, not learning the language. Serious learners find this insulting.
- **No input-based testing for Japanese.** Multiple choice and word banks test recognition, not production. Users can "pass" without being able to produce the language. This is the fundamental flaw for serious study.
- **Shallow content depth.** Grammar explanations are minimal. Kanji coverage is surface-level. There's no path to N3+ proficiency. Duolingo is a starting point, not a learning system.
- **Celebratory animations slow the loop.** Confetti, level-up screens, and "Great job!" popups interrupt flow. For a user who wants to review 50 items in 15 minutes, every 2-second animation is an insult.
- **Streak anxiety can be toxic.** The streak becomes a source of guilt and obligation rather than motivation. Losing a 200-day streak feels devastating, not motivating.

*What we take:* Frictionless onboarding (no account, immediate value). Simple streak mechanic. Gentle error recovery tone. Clear progress visualization.
*What we avoid:* All gamification beyond streaks (no XP, no gems, no leaderboards, no hearts). Celebratory animations in the review loop. Multiple-choice testing. Shallow content marketed as depth.

### Transferable UX Patterns

**Navigation Patterns:**

- **WaniKani's dashboard → review flow:** Single tap to enter review. No intermediate screens. The dashboard shows what's available; the review loop is distraction-free. This pattern maps directly to our home screen → unified review.
- **Duolingo's "what's next" clarity:** The user never wonders what to study. The app's progression model makes the next action obvious. Our FSRS + weakness + dependency graph should produce the same clarity without a visible skill tree.

**Interaction Patterns:**

- **WaniKani's type-and-submit loop:** The fastest SRS interaction pattern in the market. Type → Enter → feedback → next item. No confirmation dialogs, no "are you sure?" No extra taps. We must match or exceed this speed.
- **Apple Watch ring fill as progress feedback:** Continuous visual feedback during activity (session), not just at the end. The cognitive load ring should fill visibly during the review session, giving real-time feedback on session progress.
- **Bunpro's cloze-style grammar testing:** Fill-in-the-blank within a sentence tests grammar in context. More authentic than isolated grammar flashcards. We adopt this for grammar reviews.

**Visual Patterns:**

- **WHOOP's data-rich, serious aesthetic:** Dark backgrounds, clean typography, numerical precision. Communicates "this is a serious performance tool" without being clinical. Aligns with our "serious tool, not a toy" principle.
- **Apple Watch ring's color-coded progress:** Three rings, three colors, instantly legible. Our single cognitive load ring should be equally readable at a glance — color shifts as it fills (green → yellow → orange → complete).
- **WaniKani's SRS stage color coding:** Apprentice (pink) → Guru (purple) → Master (blue) → Enlightened (blue) → Burned (gray/gold). Color conveys mastery level at a glance. We should have equivalent visual vocabulary for item stages.

### Anti-Patterns to Avoid

1. **"200 reviews pending" anxiety counter (WaniKani/Anki).** Never show a raw count of pending reviews as the primary home screen element. The cognitive load ring replaces this with capacity-based framing. Show "what's ready now," not "what's overdue."

2. **Celebratory animation interruptions (Duolingo).** No confetti, no "Great job!" popups, no level-up screens between review items. Every animation in the review loop is stolen time. The reward is the next item.

3. **Inconsistent answer validation (Bunpro).** Rejecting grammatically correct alternative forms destroys trust faster than any other UX failure. Grammar validation must accept all valid forms or clearly explain why a specific form was expected. False rejections are a critical anti-pattern.

4. **Gamification as motivation substitute (Duolingo).** XP, gems, leaderboards, and hearts replace genuine learning feedback with game metrics. Serious learners see through this immediately. Our motivation comes from measurable real progress: weakness improvement, time compression, visible connections.

5. **Cluttered review screens (Bunpro).** During review, the only things on screen should be: the prompt, the input field, and (after answering) the result. Hints, notes, grammar details, and navigation belong on detail screens, not in the review loop. Information density is good on dashboards; distraction is bad in the review loop.

6. **Rigid "start from Level 1" for returning learners (WaniKani).** Users with existing knowledge must never be forced through content they already know. Import and manual marking must be first-class onboarding paths, not afterthoughts.

### Design Inspiration Strategy

**What to Adopt:**

| Pattern | Source | Why |
| --- | --- | --- |
| Type-and-submit review loop | WaniKani | Fastest SRS interaction pattern; users already trained on it |
| Ring-based progress visualization | Apple Watch / WHOOP | Instantly legible, emotionally satisfying, screenshot-worthy |
| Frictionless onboarding | Duolingo | No account, immediate value — proven to maximize first-session completion |
| JLPT-structured grammar progression | Bunpro | Users expect JLPT alignment; universally understood framework |
| Cloze-style grammar testing | Bunpro | Tests grammar in context, more authentic than isolated flashcards |
| Simple streak mechanic | Duolingo | Habit-forming without complexity; proven daily return driver |
| SRS stage color coding | WaniKani | Visual vocabulary for mastery level at a glance |

**What to Adapt:**

| Pattern | Source | Adaptation |
| --- | --- | --- |
| Dashboard → review flow | WaniKani | Add cognitive load ring and cross-domain summary to dashboard; keep one-tap review entry |
| Ring fill progression | Apple Watch | Single ring (not three); color shifts during fill; informational, not prescriptive (WHOOP tone, not Apple nag tone) |
| Error feedback | Duolingo | Keep the gentle tone but add diagnostic value: "close!" hints + weakness pattern recognition |
| Progress visualization | Duolingo | Replace skill tree with JLPT-level progression + dependency graph; show unlocked/locked items without gamified wrapper |
| Data-rich aesthetic | WHOOP | Adapt the serious, performance-tool visual language for a learning context; dark mode as default with light option |

**What to Avoid:**

| Anti-Pattern | Source | Conflict |
| --- | --- | --- |
| XP / gems / leaderboards | Duolingo | Conflicts with "earned satisfaction, not manufactured delight" principle |
| Pending review counter as primary metric | WaniKani | Conflicts with "permission to stop is permission to return" principle |
| Celebratory animations in review loop | Duolingo | Conflicts with "speed is respect" principle |
| Multiple-choice / word bank testing | Duolingo | Conflicts with input-based testing that builds real confidence |
| Cluttered review screens | Bunpro | Conflicts with "zero decisions during review" principle |
| Nagging notifications tied to progress | Apple Watch | Conflicts with "inform, don't restrict" principle |

## Design System Foundation

### Design System Choice

**NativeWind (Tailwind CSS for React Native)** — utility-first styling system with a custom design token layer and hand-built components.

NativeWind brings Tailwind CSS's utility-first approach to React Native, providing rapid layout and styling without imposing a visual opinion. All core UI components (cognitive load ring, review cards, reinforcement highlights, WanaKana input, time compression summary) are custom-built with full control over aesthetics and performance.

### Rationale for Selection

1. **No component library fits the aesthetic.** The "serious tool, not a toy" / WHOOP-style aesthetic doesn't align with Material Design (Paper), iOS-native (React Native Elements), or any existing component library. Every pre-built library would require heavy theming to override its default personality. NativeWind imposes no visual opinion.

2. **Core components must be custom regardless.** The cognitive load ring, review loop cards, cross-domain reinforcement highlights, WanaKana romaji-to-hiragana input field, and time compression summary don't exist in any component library. These are the heart of the product. A component library adds dependency weight for components we wouldn't use in the critical path.

3. **Utility-first is fast for solo development.** Tailwind's utility classes eliminate the need to name and organize hundreds of StyleSheet objects. For a solo developer iterating rapidly on screen layouts, `className="flex-1 bg-gray-900 px-4 py-2"` is faster than managing separate style constants for every layout variation.

4. **Performance alignment.** NativeWind compiles to React Native's StyleSheet API at build time — no runtime style computation overhead. This supports the <100ms review loop performance target.

5. **Dark mode is native.** Tailwind's dark mode support (`dark:bg-gray-900`) works naturally with NativeWind, enabling the WHOOP-style dark-first aesthetic without a separate theming system.

### Implementation Approach

**Foundation Layer:**
- NativeWind v4+ configured with Expo
- Custom `tailwind.config.js` defining the project's design tokens (colors, spacing, typography, border radius)
- Dark mode as default theme, light mode as secondary option

**Design Token System:**
- **Colors:** Dark-first palette. Background tiers (surface, elevated, overlay). Accent colors for SRS stages (matching WaniKani's visual vocabulary: apprentice, guru, master, enlightened, burned). Semantic colors for correct/incorrect/warning/info. Cognitive load ring gradient (green → yellow → orange → complete).
- **Typography:** System fonts (San Francisco on iOS, Roboto on Android) for UI. Monospace or clear sans-serif for Japanese text display. Size scale optimized for mobile reading at arm's length.
- **Spacing:** Consistent spacing scale (4px base unit). Dense layout for review screens, comfortable spacing for dashboards and settings.
- **Animation:** Zero animations in the review loop. Subtle transitions allowed only for non-blocking UI (cognitive load ring fill, screen transitions outside review). All animations must be interruptible.

**Custom Component Library:**
- `ReviewCard` — the core review loop item display (prompt, input field, result)
- `CognitiveLoadRing` — SVG-based circular progress with color gradient
- `WanaKanaInput` — text input with real-time romaji-to-hiragana conversion
- `ReinforcementHighlight` — inline text annotation ("← you learned this yesterday")
- `TimeCompressionSummary` — post-session summary card with domain breakdown
- `SRSStageIndicator` — color-coded mastery level badge
- `WeaknessStatCard` — pattern accuracy trend display
- `StreakCounter` — simple daily streak display

### Customization Strategy

**Tailwind Config as Single Source of Truth:**
All visual decisions flow through `tailwind.config.js`. Color palette, spacing scale, typography, border radius, and breakpoints are defined once and used everywhere via utility classes. Changing the accent color or spacing scale is a single-file edit that propagates globally.

**Component Composition over Inheritance:**
Custom components are composed from NativeWind utility classes, not from extending a base component library. This keeps the dependency tree shallow and avoids fighting a library's internal opinions.

**Platform-Specific Adjustments:**
Where iOS and Android need different treatment (safe areas, keyboard behavior, haptic feedback), use React Native's `Platform.select()` within the custom components rather than platform-specific style overrides. Keep the Tailwind layer platform-agnostic.

**Accessibility Integration:**
Accessibility props (`accessibilityRole`, `accessibilityLabel`, `accessibilityHint`) are built into every custom component from the start — not retrofitted. Color contrast ratios (WCAG 2.1 AA) are validated against the design token palette before implementation.

## Defining Core Experience

### Defining Experience

**"Type → prove → see the connections."**

The user sees a prompt. They type the answer. They get instant feedback. And woven through the session, they see the app connecting their knowledge across domains — a kanji appearing in a grammar sentence, a weakness being targeted, a time savings being measured. It's WaniKani's review loop with visible intelligence layered on top.

This is what users describe to a friend: *"It's like WaniKani but it does grammar too, and it actually shows you how everything connects. And it's free."*

The defining experience is not any single feature — it's the combination of input-based proving (WaniKani's core strength) with felt cross-domain intelligence (what no tool does today). Remove the input-based testing and it's Duolingo. Remove the visible intelligence and it's a WaniKani clone. Both together create something new.

### User Mental Model

**What users bring to this app:**

Users arrive with one of two mental models, depending on their background:

**WaniKani/Bunpro users (switchers):** They expect the WaniKani review loop — show item, type answer, see result, next item. They expect SRS stages (apprentice → burned). They expect JLPT-level organization. What they don't expect is cross-domain connections, weakness targeting, or a cognitive load ring. These are the "surprise and delight" moments for switchers — familiar foundation with novel intelligence on top.

**Duolingo/casual learners (beginners):** They expect a structured path — "start here, do this next." They expect gentle error handling. They may expect multiple choice or word banks and will need to adjust to input-based testing. The onboarding must frame typing as "proof of real learning" rather than "harder mode." The cognitive load ring will feel natural to this audience (familiar from fitness apps) even though the SRS mechanics are new.

**Shared mental model across all users:**
- "I open the app, it tells me what to study, I do it, I close the app." Zero decisions.
- "If I get something wrong, I expect to see it again sooner." Basic SRS expectation.
- "I should be able to see my progress." Level, streak, items learned.
- "Japanese input should just work." No one wants to configure keyboards mid-review.

**Where users will get confused without clear design:**
- Reading vs. meaning prompts — "What type of answer do you want?" must be instantly obvious (color coding, label, input placeholder).
- Cognitive load ring — novel concept, needs immediate visual legibility without explanation. The ring should be self-evident: empty → filling → full = done.
- Cross-domain reinforcement highlights — "← you learned this yesterday" must feel like helpful context, not visual clutter. If it's too prominent, it distracts from the review. If it's too subtle, users miss the defining differentiator.

### Success Criteria

**The core experience succeeds when:**

1. **The review loop feels faster than WaniKani.** Users who have used WaniKani should perceive the review speed as equal or faster. Measurable: <100ms from answer submission to result display. No perceptible delay between items.

2. **Users notice the intelligence within the first week.** Cross-domain reinforcement ("← you learned this yesterday") is seen and remembered. Weakness targeting is felt ("it keeps drilling my weak spots"). Time compression is read and believed. If users don't notice these within 5-7 days, the visible intelligence layer has failed.

3. **Users complete sessions without abandoning.** The cognitive load ring successfully shapes behavior — 80%+ of sessions end at or near the ring's recommended threshold rather than mid-session abandonment from overwhelm or fatigue.

4. **Switchers don't miss their old tools.** After one week, WaniKani/Bunpro importers should not think "my old tool did X better." Content parity + visible intelligence + time compression should create net-positive comparison on every dimension.

5. **Users can describe it in one sentence.** If asked "what app do you use for Japanese?", the user should be able to say something like "It's a free app that does kanji and grammar together, and it actually targets your weak spots." The defining experience should be communicable.

### Novel UX Patterns

The defining experience combines established patterns with three novel elements:

**Established (no education needed):**
- Input-based SRS review loop (WaniKani users know this)
- JLPT-level progression (universally understood)
- Streak counter (Duolingo users know this)
- Romaji-to-hiragana input (WaniKani users know this via WanaKana)

**Novel (need intuitive design, not tutorials):**

1. **Cognitive load ring.** Borrowed from fitness tracking (Apple Watch activity rings), applied to SRS learning. Users understand "fill the ring" from fitness apps. The metaphor transfers: empty ring = fresh start, filling = doing work, full = goal reached. No tutorial needed if the visual design is clear. Color gradient (green → yellow → orange → complete) provides additional signal without words.

2. **Visible cross-domain reinforcement.** No learning app highlights connections between content types in real-time. The "← you learned this yesterday" annotation is a new UI pattern. Design challenge: it must be noticeable on first encounter but not distracting on the 50th. Solution: subtle color tint + small text, positioned below or beside the connected word — present but not competing with the review prompt.

3. **Time compression display.** No learning app shows "equivalent time in your old stack" as a post-session metric. This is a comparison-framing pattern borrowed from utility bill comparisons ("you used 20% less energy than similar homes"). Design challenge: must feel credible, not marketing. Solution: show raw numbers (items × domains × minutes) alongside the comparison estimate, so users can verify the math.

**Innovation within familiar patterns:**
- The unified review mixer interleaves content types (kanji, vocab, grammar) in a single session — WaniKani and Bunpro each have isolated review sessions. The interleaving itself is novel but the per-item interaction (type → submit → result) is familiar.
- Weakness-biased queue ordering is invisible to the user as a "feature" — they just notice "it keeps drilling the things I get wrong." The intelligence is felt, not presented as a UI element.

### Experience Mechanics

**1. Initiation:**

The user opens the app. The home screen shows the cognitive load ring (empty or partially filled from earlier today), a "Review" button, and a summary of what's ready (e.g., "42 items ready"). One tap on "Review" launches the first item instantly — no intermediate screens, no session configuration, no "choose what to study" menu. The app has already decided based on FSRS scheduling + weakness biasing + dependency graph.

**2. Interaction — The Review Loop:**

Each item in the loop follows this sequence:

- **Prompt appears:** Item displayed with clear type indicator (radical/kanji/vocabulary/grammar). For kanji: the character is shown large and centered. For grammar: a cloze sentence with a blank. A label or color code indicates what's being asked (reading vs. meaning).
- **User types:** Input field is pre-focused. For reading questions: romaji input converts to hiragana in real-time via WanaKana. For meaning questions: standard English keyboard. The user types their answer and submits (Enter key or submit button).
- **Result displays immediately (<100ms):** Correct → green flash, answer confirmed, brief display of item details (mnemonic, additional readings, SRS stage). Incorrect → red flash, correct answer shown, "close!" hint if near-miss, weakness pattern note if applicable. The cognitive load ring increments visibly.
- **Cross-domain reinforcement (contextual):** If the current item connects to something the user recently studied, a subtle annotation appears: "食べる ← you learned this yesterday" or "Uses radical 口 (mouth) — Guru stage." Present but not blocking.
- **Next item:** Appears immediately. No transition animation. No "tap to continue." The loop continues until the user stops or the cognitive load ring signals completion.

**3. Feedback — During Session:**

- **Cognitive load ring:** Fills continuously during the session, visible in a corner or header. Color shifts as it fills. The user glances at it periodically — "I'm about 70% through my capacity today."
- **Correct/incorrect streak:** No explicit counter, but the rhythm of green/red flashes gives the user an intuitive sense of how they're doing.
- **Weakness targeting:** Users feel this rather than see it — "Why am I getting so many て-form questions?" The targeting is deliberate but presented as natural review ordering, not a labeled "weakness mode."

**4. Completion — Session End:**

The session ends when: (a) the user stops manually, (b) the cognitive load ring reaches its threshold and the app suggests stopping, or (c) all due items are reviewed.

**Post-session summary appears:**
- Cognitive load ring in completed state (full circle, satisfying visual)
- Domain breakdown: "Kanji: 12 | Grammar: 8 | Vocab: 15"
- Time spent: "18 min"
- Time compression: "≈ 35-40 min across separate apps"
- Streak counter updated
- Optional: weakness pattern update ("て-form accuracy: 52% → 55% this week")

This screen is designed to be screenshot-worthy — the viral moment. Clean layout, clear numbers, the cognitive load ring as the visual anchor.

## Visual Design Foundation

### Color System

**Philosophy:** Dark-first, data-rich, performance-tool aesthetic. The palette communicates "serious instrument for serious learners" — closer to WHOOP or a pro audio tool than Duolingo or a children's learning app. Colors are functional: every color in the interface serves a purpose (SRS stage, answer feedback, cognitive load state, content type). No decorative color.

**Dark Theme (Default):**

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#0A0A0F` | App background — near-black with a cool blue undertone |
| `surface` | `#141420` | Cards, review items, input fields |
| `surface-elevated` | `#1E1E2E` | Modal backgrounds, dropdown menus, overlays |
| `surface-hover` | `#252538` | Pressed/active states on interactive elements |
| `border` | `#2A2A3C` | Subtle dividers, card borders, input outlines |
| `text-primary` | `#EEEEF0` | Primary text — headings, review prompts, answers |
| `text-secondary` | `#9898A8` | Secondary text — labels, hints, metadata |
| `text-muted` | `#5C5C6E` | Tertiary text — disabled states, placeholder text |

**Light Theme (Secondary):**

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#F8F8FA` | App background — warm off-white |
| `surface` | `#FFFFFF` | Cards, review items, input fields |
| `surface-elevated` | `#F0F0F4` | Modal backgrounds, overlays |
| `surface-hover` | `#E8E8EE` | Pressed/active states |
| `border` | `#D8D8E0` | Dividers, card borders |
| `text-primary` | `#1A1A2E` | Primary text |
| `text-secondary` | `#686878` | Secondary text |
| `text-muted` | `#9898A8` | Tertiary text |

**SRS Stage Colors:**

Inspired by WaniKani's visual vocabulary — users who switch will feel familiar recognition. Adapted for dark backgrounds with higher saturation.

| Stage | Hex | Token |
| --- | --- | --- |
| **Apprentice** | `#DD4488` | `srs-apprentice` — Pink/magenta. New and fragile. |
| **Guru** | `#8844CC` | `srs-guru` — Purple. Growing confidence. |
| **Master** | `#3388DD` | `srs-master` — Blue. Solid knowledge. |
| **Enlightened** | `#00AADD` | `srs-enlightened` — Cyan. Near-mastery. |
| **Burned** | `#CCAA00` | `srs-burned` — Gold. Permanently learned. Earned. |

**Feedback Colors:**

| State | Hex | Token | Usage |
| --- | --- | --- | --- |
| **Correct** | `#22CC88` | `feedback-correct` | Correct answer flash, positive indicators |
| **Incorrect** | `#EE4466` | `feedback-incorrect` | Wrong answer flash, error states |
| **Close/Warning** | `#EEAA22` | `feedback-warning` | Typo accepted with warning, "close!" hints |
| **Info** | `#4488EE` | `feedback-info` | Informational highlights, reinforcement annotations |

**Cognitive Load Ring Gradient:**

The ring color shifts as it fills, providing at-a-glance progress without reading numbers:

| Fill % | Hex | Meaning |
| --- | --- | --- |
| 0-40% | `#22CC88` (green) | Fresh, plenty of capacity |
| 40-70% | `#EECC44` (yellow) | Building — good progress |
| 70-90% | `#EE8833` (orange) | Approaching threshold — consider wrapping up |
| 90-100% | `#44BBEE` (cyan glow) | Complete — goal reached, satisfying finish state |

The completed ring state uses cyan (not red or orange) to communicate accomplishment rather than warning. The ring "completes" with a cool, satisfying glow — not an alarm.

**Content Type Accent Colors:**

Subtle accent used on type indicators and category labels during review:

| Content Type | Hex | Token |
| --- | --- | --- |
| **Radical** | `#44AAEE` | `content-radical` — Light blue |
| **Kanji** | `#EE4488` | `content-kanji` — Pink |
| **Vocabulary** | `#AA44DD` | `content-vocabulary` — Purple |
| **Grammar** | `#22BBAA` | `content-grammar` — Teal |
| **Reading** | `#EEAA22` | `content-reading` — Amber |

**Cross-Domain Reinforcement Color:**

| Element | Hex | Token |
| --- | --- | --- |
| Reinforcement text | `#6688BB` | `reinforcement-text` — Muted blue-gray |
| Reinforcement background | `#1A2233` | `reinforcement-bg` — Barely-there tint |

The reinforcement annotation ("← you learned this yesterday") uses deliberately subdued colors — present and readable but never competing with the review prompt for attention.

### Typography System

**Philosophy:** System fonts for maximum performance and platform-native feel. Japanese text displayed large and clear. Type hierarchy is steep — review prompts are dramatically larger than supporting text, enforcing the "one thing on screen matters" principle.

**Font Stack:**

| Role | Font | Fallback |
| --- | --- | --- |
| **UI text** | System default (San Francisco on iOS, Roboto on Android) | `-apple-system, 'Segoe UI', sans-serif` |
| **Japanese display** | System default with Japanese coverage (Hiragino Sans on iOS, Noto Sans JP on Android) | `sans-serif` |
| **Monospace** (code, technical) | System monospace (SF Mono on iOS, Roboto Mono on Android) | `monospace` |

No custom web fonts. System fonts eliminate loading time, render natively, and feel natural on each platform.

**Type Scale:**

| Token | Size | Weight | Line Height | Usage |
| --- | --- | --- | --- | --- |
| `display` | 48px | 700 | 1.1 | Kanji character display in review (single character, centered) |
| `title-lg` | 28px | 700 | 1.2 | Screen titles, post-session summary headline |
| `title` | 22px | 600 | 1.3 | Section headers, grammar sentence display |
| `body-lg` | 18px | 400 | 1.5 | Review prompts (meaning/reading labels), grammar cloze text |
| `body` | 16px | 400 | 1.5 | Standard body text, mnemonic text, explanations |
| `body-sm` | 14px | 400 | 1.4 | Secondary information, metadata, SRS stage labels |
| `caption` | 12px | 500 | 1.3 | Timestamps, reinforcement annotations ("← you learned this yesterday"), tertiary labels |
| `overline` | 11px | 600 | 1.2 | Category labels (RADICAL, KANJI, GRAMMAR), uppercase tracking |

**Key typography decisions:**
- Kanji characters render at 48px in review — large enough to see stroke details clearly on mobile.
- The review prompt label ("Reading" / "Meaning") uses `body-lg` at 18px — clearly visible but not competing with the kanji display.
- Reinforcement annotations use `caption` at 12px — intentionally small. Present for those who notice, invisible during fast review flow.
- Grammar cloze sentences use `body-lg` at 18px — readable at arm's length, large enough to see the blank clearly.

### Spacing & Layout Foundation

**Base Unit:** 4px

All spacing is derived from multiples of 4px, creating a consistent rhythm across every screen.

| Token | Value | Usage |
| --- | --- | --- |
| `space-xs` | 4px | Tightest spacing — between icon and label, inline elements |
| `space-sm` | 8px | Between related elements — label and input, heading and subheading |
| `space-md` | 16px | Standard component padding — card internal padding, list item spacing |
| `space-lg` | 24px | Section separation — between cards, between content blocks |
| `space-xl` | 32px | Major section breaks — between screen sections |
| `space-2xl` | 48px | Screen-level padding — top/bottom margins for primary content |

**Layout Principles:**

1. **Dense in review, comfortable everywhere else.** Review screens minimize spacing — the prompt, input, and result are tightly packed to keep the eye focused. Dashboard, settings, and stats screens use comfortable spacing for browsability.

2. **Center-weighted review layout.** During review, the primary content (kanji character or grammar sentence) is vertically centered on screen. Input field sits below it. Nothing above or beside competes for attention. The cognitive load ring sits in a fixed header position — always visible but never in the focal area.

3. **Full-width input on mobile.** The text input field stretches edge-to-edge (with `space-md` padding) during review. Maximum touch target, maximum typing area. No cramped input boxes.

4. **Safe area awareness.** All content respects iOS safe areas (notch, home indicator) and Android navigation bars. The cognitive load ring header accounts for status bar height on both platforms.

**Layout Zones:**

The app uses a three-zone layout model during review:

| Zone | Position | Content | Height |
| --- | --- | --- | --- |
| **Header** | Fixed top | Cognitive load ring (small), session progress count, item type indicator | ~56px |
| **Focal** | Center, flex | Review prompt (kanji/grammar sentence), result display, reinforcement annotations | Flexible — fills available space |
| **Input** | Fixed bottom | Text input field, submit button, keyboard | ~56px + keyboard height |

Outside review (dashboard, stats, settings), the layout switches to a standard scrollable content model with a bottom tab navigation.

**Border Radius:**

| Token | Value | Usage |
| --- | --- | --- |
| `radius-sm` | 6px | Input fields, small badges, SRS stage indicators |
| `radius-md` | 12px | Cards, buttons, modal corners |
| `radius-lg` | 20px | Large cards, post-session summary container |
| `radius-full` | 9999px | Cognitive load ring, circular avatars, pill-shaped badges |

### Accessibility Considerations

**Color Contrast:**
All text/background combinations meet WCAG 2.1 AA minimum requirements:
- `text-primary` (#EEEEF0) on `background` (#0A0A0F) = contrast ratio ~17:1 (exceeds AAA)
- `text-secondary` (#9898A8) on `background` (#0A0A0F) = contrast ratio ~6.5:1 (exceeds AA)
- `text-secondary` (#9898A8) on `surface` (#141420) = contrast ratio ~5.2:1 (meets AA)
- `feedback-correct` (#22CC88) on `surface` (#141420) = contrast ratio ~7.1:1 (exceeds AA)
- `feedback-incorrect` (#EE4466) on `surface` (#141420) = contrast ratio ~5.0:1 (meets AA)

**Color-Independent Communication:**
- SRS stages use color + text label (never color alone). Screen readers announce "Apprentice stage" not just a color.
- Correct/incorrect feedback uses color + icon (checkmark/X) + text. Color-blind users get full information.
- Cognitive load ring uses color gradient + percentage number. The ring is not the sole indicator — a numeric "72%" is always displayed alongside.

**Touch Targets:**
- All interactive elements have minimum 44×44px touch targets (Apple HIG) / 48×48dp (Material Design).
- The review input field and submit button exceed minimums — full-width input, large submit area.

**Text Scaling:**
- All typography scales to 200% without layout breakage. The review layout uses flexible height for the focal zone, accommodating larger text.
- Japanese character display (`display` at 48px) scales proportionally — critical for low-vision users studying kanji stroke details.

**Motion:**
- Zero animations in the review loop (by design — performance principle). This also benefits users with vestibular disorders.
- The cognitive load ring fill animation is subtle and continuous (not pulsing or flashing). Can be disabled in accessibility settings.
- No auto-playing animations anywhere in the app. All transitions are optional and interruptible.
