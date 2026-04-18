---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - "{project-root}/_bmad-output/brainstorming/brainstorming-session-2026-03-14-1530.md"
workflowType: "research"
lastStep: 6
research_type: "market"
research_topic: "Competitive and user landscape for open-source / local-first Japanese learning (learner perspective)"
research_goals: "Map how learners discover, choose, and stack Japanese learning tools; identify pain points and gaps where OSS/local-first positioning fits; summarize key competitors and adjacent power-user tools."
user_name: "Riyaz"
date: "2026-03-21"
web_research_enabled: true
source_verification: true
scope_note: "Learner-focused; global online Japanese learning; open-source and local-first product category called out explicitly. Product platform intent (per brainstorming, 2026-03-29): Android, iOS, and local desktop (e.g. Electron + React Native Web)—no hosted product web app."
---

# Research Report: market

**Date:** 2026-03-21  
**Author:** Riyaz  
**Research Type:** market

---

## Research Overview

This report examines the **competitive and user landscape** for Japanese learning through the eyes of **learners**, with emphasis on how **open-source** and **local-first / offline-capable** offerings fit next to mainstream subscription apps and textbook-led study. Industry sizing figures for “Japanese language learning” and “online Japanese learning platforms” **vary materially by definition** (software vs. platforms vs. tutoring); multiple independent estimates nonetheless point to **strong growth** in digital Japanese study, driven by mobile use, JLPT-oriented learners, and interest tied to Japanese media.

**Key learner-facing takeaways:** (1) Most serious learners **assemble a stack** (SRS + grammar + input tools) rather than expecting one app to do everything. (2) **Cost stacking** (multiple subscriptions) and **review overload** are recurring friction points. (3) **Anki + community decks** and **dictionary/reader tooling** (e.g. Yomitan-style workflows) anchor the “power user” segment where OSS and local data are normalized. (4) **Privacy and offline** are emerging positioning axes, though evidence is stronger for **offline/continuity** than for mass-market “privacy-first” purchasing behavior.

**Product direction (aligned with brainstorming, updated 2026-03-29):** The app is planned for **Android, iOS, and desktop** from **one codebase**. Desktop is **local-only**—for example **Electron** (or an equivalent shell) loading a **React Native Web** bundle—so there is **no hosted product web app**. React Native Web here means **shared UI with mobile**, rendered inside the desktop runtime, not a separate public website.

The sections below follow the BMAD market research structure: initialization scope, customer behavior, pain points, decision journey, competitive landscape, then strategic synthesis, methodology, and sources.

---

# Open-Source / Local-First Japanese Learning: Learner Market Research

## Research Initialization

### Research Understanding Confirmed

**Topic:** Competitive and user landscape for open-source / local-first Japanese learning apps, scoped to **learners**.  
**Goals:** Understand tool discovery, stacking behavior, pain points, and where OSS/local-first products can differentiate vs. commercial leaders.  
**Research Type:** Market research  
**Date:** 2026-03-21

### Research Scope

**In scope**

- Self-directed and app-assisted **learners** (not institutional B2B buyers).
- **Global** online Japanese learning behavior; JLPT-oriented and hobbyist motivations.
- **Competitive set:** mass-market apps, specialized SRS (kanji/grammar), Anki ecosystem, reader/dictionary tooling, representative OSS apps on GitHub.

**Out of scope / limitations**

- Primary survey of this project’s users was not conducted; findings synthesize **published industry estimates**, **vendor disclosures**, and **community-sourced patterns** (Reddit aggregations, forums)—treat latter as **directional**, not statistical.
- Market size reports from vendors (QYResearch, 360i Research, GII, etc.) use **different market boundaries**; figures should be read as **order-of-magnitude signals**, not reconciled single “truth.”

### Next Steps (workflow)

1. Initialization and scope — **complete**
2. Customer behavior and segments — **complete**
3. Pain points and needs — **complete**
4. Decision processes and journey — **complete**
5. Competitive landscape — **complete**
6. Synthesis, recommendations, methodology — **complete**

**Status:** Scope confirmed 2026-03-21; document written as single deliverable per user request (equivalent to workflow [C] continuation).

---

## Customer Behavior and Segments

### Customer Behavior Patterns

**Modular “stack” behavior.** Aggregations of community recomm endations describe Japanese learners combining **Anki**, **WaniKani**, and **textbook-style grammar** rather than relying on one product end-to-end—reflecting a **DIY curriculum** norm among engaged learners.  
_Behavior drivers:_ desire for depth (kanji, grammar, immersion) no single brand fully covers.  
_Interaction preferences:_ mobile for daily drills; desktop for dictionaries, readers, and card creation.  
_Source:_ [JLPT Samurai — Reddit-recommended apps summary](https://jlptsamurai.com/2026/01/17/what-does-reddit-say-the-most-recommended-japanese-learning-apps-according-to-reddit/)

**Youth-skewed casual cohort on mass-market apps.** Duolingo’s public write-up states **86% of Japanese learners** on the platform are under 30, with **70% aged 13–22**, and a notable share citing **“just for fun”** motivation (often media-driven). This segment behaves differently from JLPT-focused SRS users (session length, tolerance for depth, willingness to pay).  
_Source:_ [Duolingo — Who Studies Japanese and Why](https://blog.duolingo.com/who-studies-japanese-on-duolingo/)

**Power-user local workflows.** Advanced learners gravitate toward **offline dictionary popups**, **local dictionary files**, and **AnkiConnect** bridges—behavior consistent with **local-first** tooling (even when the “app” is a browser extension + local DB). Yomitan is documented as **offline-capable** with local dictionaries and Anki integration; Chrome Web Store listings describe **100k+ users** and **open-source** positioning.  
_Source:_ [Yomitan — Getting started](https://yomitan.wiki/getting-started/), [Yomitan — Chrome Web Store](https://chromewebstore.google.com/detail/yomitan-popup-dictionary/likgccmbimhjbgkjambclfkhldnlhbnn?hl=en)

### Demographic Segmentation

| Segment (learner lens)    | Typical behavior                                         | Implication for OSS/local-first                                             |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Casual / gamified**     | Short daily sessions; Duolingo-style loops               | Hard to win on habit alone; need **low friction** and **clear progression** |
| **JLPT / exam**           | Structured levels, mock tests, vocabulary+grammar drills | **JLPT framing** aids discovery; crowded with free JLPT apps                |
| **Serious self-directed** | Anki decks, readers, immersion                           | **Highest fit** for local data, export, customization                       |
| **Privacy-sensitive**     | Seeks minimal accounts / local processing                | Niche but **differentiated** if credibly enforced                           |

_Demographic note:_ Duolingo-heavy stats skew **younger**; SRS/Reddit-heavy patterns skew **more committed** and often older—**two demand curves** in one “Japanese learning” label.  
_Source:_ [Duolingo — Who Studies Japanese](https://blog.duolingo.com/who-studies-japanese-on-duolingo/)

### Psychographic Profiles

- **Optimizers:** enjoy systems (SRS intervals, stats); tolerate setup cost; likely to try **Anki**, **custom decks**, **GitHub tools**.
- **Minimizers:** want a guided path; pay for **curation** (WaniKani/Bunpro) or accept **ad-supported** freemium (Duolingo).
- **Skeptics:** wary of **subscription stacks** and **data use**; receptive to **FOSS**, **offline**, and **bring-your-own-key** AI patterns (aligns with your brainstorming direction).

### Behavior Drivers and Influences

- **Social proof:** Reddit, YouTube, Discord, and school peers drive app choice.
- **Curriculum anchors:** Genki/Minna and JLPT materials shape **what** learners believe they need.
- **Sunk cost / routine:** switching apps is painful once thousands of SRS items exist—**import/export** and **open data** are leverage for OSS products.

### Customer Interaction Patterns

_Research and discovery:_ web search, Reddit, “best app” articles, YouTubers.  
_Evaluation:_ free tiers (Duolingo, WaniKani early levels, Bunpro trial).  
_Habit formation:_ streaks and notifications (commercial apps); **Anki** users rely on **self-discipline** unless UX bridges the gap.  
_Source:_ [Bunpro pricing — 30-day trial, no card](https://bunpro.jp/pricing), [WaniKani — subscription plans](https://knowledge.wanikani.com/account-and-membership/payment-and-billing/subscription-plans/)

**Confidence:** **Medium–high** on modular stacking and Duolingo demographic claims; **medium** on quantified “privacy-first” demand (see pain points).

---

## Customer Pain Points and Needs

### Customer Challenges and Frustrations

**Subscription fatigue and stacking costs.** Learners comparing tools face many **$5–15/month** offerings; combining even two specialized apps (e.g. kanji + grammar) plus a general app creates **recurring cost** and cognitive overhead. Third-party roundups document this banding across language apps (useful as **directional** pricing context).  
_Source:_ [Can I Learn It — costs of language apps](https://canilearnit.com/costs-of-language-apps/)

**“Not all-in-one.”** Community threads question whether **WaniKani + Bunpro** together are worth the price—implicit need for **integrated** kanji+grammar+reading paths (your product thesis).  
_Source:_ [WaniKani Community — price worth it thread](https://community.wanikani.com/t/is-the-price-of-wanikani-bunpro-really-worth-it-for-learning-japanese/63399?page=11)

**UX / trust issues on specialized apps.** Blog and forum commentary cite **clunky flows**, **external links instead of in-app teaching**, or **audio quality** concerns for some grammar SRS products—learners punish **friction** even when pedagogy is strong.  
_Source:_ [KaiwaBloom — Bunpro alternative commentary](https://www.kaiwabloom.com/post/bunpro-alternative) _(interpret as competitive content; triangulate with user reviews)_

### Unmet Customer Needs

- **Single coherent progression** across kanji, vocab, grammar, and reading—without locking into **proprietary level systems** (JLPT-aligned models are culturally legible).
- **True ownership of progress data** (export, sync without vendor lock-in).
- **Offline-capable depth** beyond phrase-tour apps; continuity on **commutes, travel, poor connectivity**. Third-party articles argue offline access supports consistency (treat as **supporting narrative**, not peer-reviewed evidence).  
  _Source:_ [Translaio — offline apps roundup](https://www.translaio.com/top-apps/best-apps-to-learn-english-offline-2026-guide-for-real-learners/)

### Barriers to Adoption (for OSS / local-first specifically)

- **Setup tax:** Anki and dictionary pipelines reward power users; mainstream learners fear **complexity**.
- **Content trust:** learners ask “who curated this?”—**community governance** must be visible and safe.
- **Discovery:** OSS projects lack Duolingo-scale marketing; **GitHub ≠ app store distribution**.

### Pain Point Prioritization (learner impact × OSS fit)

| Priority | Pain                                         | Why it matters                                             |
| -------- | -------------------------------------------- | ---------------------------------------------------------- |
| High     | Review overload / anxiety                    | Room for **UX innovation** (your “cognitive load” ideas)   |
| High     | Cost of stacking specialists                 | **Free core + optional AI key** matches wallet sensitivity |
| Medium   | Privacy / data use                           | Differentiator if proven; not always top of funnel         |
| Medium   | Weak listening/speaking in kanji-first tools | **AI optional layer** or **local audio** can stand out     |

---

## Customer Decision Processes and Journey

### Decision Stages (learner journey)

1. **Awareness:** social feed, friends, anime/manga interest, school, work relocation.
2. **Light exploration:** install Duolingo or a JLPT quiz app; watch “how I learned Japanese” content.
3. **Structured commitment:** choose SRS for kanji (WaniKani/Anki) and grammar (Bunpro/textbook).
4. **Optimization:** add **readers**, **pitch-accent tools**, **output** (tutors, AI).
5. **Maintenance or churn:** burnout from reviews; tool switch if progress stalls.

### Decision Factors and Criteria

Typical criteria include: **price**, **curriculum quality**, **mobile quality**, **offline mode**, **community**, **alignment with JLPT**, and **time-to-first-success**. Serious learners overweight **export**, **customization**, and **interlinking** (grammar examples using known vocab).

### Information Gathering Patterns

- **Search + Reddit + YouTube** for validation.
- **Free trials** for premium SRS ([Bunpro](https://bunpro.jp/pricing), [WaniKani free levels](https://knowledge.wanikani.com/account-and-membership/payment-and-billing/subscription-plans/)).
- **GitHub stars / FOSS license** matter for a **subset** choosing Anki decks (e.g. Kaishi) or experimental apps.

### Touchpoints

_Digital:_ App stores, Discord, forums, TikTok/YouTube, GitHub.  
_Offline:_ classrooms, tutors, textbooks—still shape **expectations** apps must meet.

---

## Competitive Landscape

### Market Size and Growth (context only)

Industry reports provide **non-identical** estimates; together they indicate a **large and growing** digital Japanese learning market:

- One report summarized via search indexing cites **~USD 1.39B (2024)** for Japanese language learning software scaling to **~USD 2.4B (2031)** at ~8.5% CAGR.  
  _Source:_ [QY Research — Japanese Language Learning (indexed summary)](https://www.qyresearch.com/reports/4637353/japanese-language-learning)

- Another segment focuses on **online Japanese learning platforms** with **higher CAGR** figures in summary pages (definitions may include platforms/tutoring).  
  _Source:_ [360i Research — Online Japanese Learning Platform](https://www.360iresearch.com/library/intelligence/online-japanese-learning-platform)

**Confidence:** **Low–medium** on exact dollars; **higher** on directional growth and digital shift.

### Key Market Players (learner view)

| Player / pattern                                                                                                                                                                               | Role                       | Learner perception (summary)                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Duolingo**                                                                                                                                                                                   | Mass habit + top-of-funnel | Huge reach; often **not** deemed sufficient alone for Japanese depth. Duolingo states **17M+ learners** across Japanese courses (EN/ZH, etc.). |
| _Source:_ [Duolingo — Who Studies Japanese](https://blog.duolingo.com/who-studies-japanese-on-duolingo/)                                                                                       |
| **WaniKani**                                                                                                                                                                                   | Kanji/radical SRS          | Strong kanji outcomes for many; **narrow scope**; **paid** after early levels. **~$9/mo**, **$89/yr**, **$299 lifetime** (per knowledge base). |
| _Source:_ [WaniKani — Subscription plans](https://knowledge.wanikani.com/account-and-membership/payment-and-billing/subscription-plans/)                                                       |
| **Bunpro**                                                                                                                                                                                     | Grammar SRS                | **Free tier + $5/mo + $150 lifetime** (web, per official pricing page). Integrations marketed toward WaniKani users.                           |
| _Source:_ [Bunpro — Pricing](https://bunpro.jp/pricing)                                                                                                                                        |
| **Anki (+ decks)**                                                                                                                                                                             | OSS SRS backbone           | **Free/libre** client; ecosystem quality varies; **Core 2k**, **Kaishi**, **JP1X**-style decks frequently recommended.                         |
| _Sources:_ [Kaishi GitHub](https://github.com/donkuri/kaishi), [Migaku — deck roundup](https://migaku.com/blog/japanese/best-japanese-anki-decks)                                              |
| **JLPT prep apps**                                                                                                                                                                             | Exam drills                | Many **free + IAP**; strong for **mock tests**; weaker on **deep pedagogy** or **unified SRS** across skills.                                  |
| _Example:_ [MyJLPT (Play listing)](https://play.google.com/store/apps/details?id=com.quangan.myjlpt.net&hl=ja)                                                                                 |
| **Reader / dictionary layer**                                                                                                                                                                  | Input/literacy             | **Yomitan** (offline dictionaries, Anki bridge) exemplifies **local-first** literacy tooling.                                                  |
| _Sources:_ [Yomitan wiki](https://yomitan.wiki/getting-started/), [Chrome Web Store](https://chromewebstore.google.com/detail/yomitan-popup-dictionary/likgccmbimhjbgkjambclfkhldnlhbnn?hl=en) |

### Open-Source and OSS-Adjacent Examples

Illustrative projects (not exhaustive): **KaniManabu** (WaniKani-style OSS for Apple platforms), **Nihongo Master** (React/TS, PWA, offline positioning per README summaries), **ytsub-v3** (Anki-like web stack), **gen-cards** (local flashcards + custom SRS advisor). These show **demand signals** and **design patterns**, not guaranteed product-market fit.  
_Sources:_ [KaniManabu](https://github.com/Atelier-Shiori/KaniManabu), [nihongo-master](https://github.com/BillyMRX1/nihongo-master), [ytsub-v3](https://github.com/hi-ogawa/ytsub-v3), [gen-cards](https://github.com/joshuamotoaki/gen-cards)

### Strengths and Weaknesses (category SWOT: OSS/local-first Japanese app)

**Strengths:** no subscription for core; **data portability**; appeals to **privacy** and **tinkerers**; can integrate **community content**; aligns with **offline** needs.  
**Weaknesses:** **content moderation** burden; **discovery** vs incumbents; **polish** expectations set by paid apps; **AI features** require careful trust model (BYO key helps).  
**Opportunities:** **integration** (kanji + grammar + reading) learners already patch together; **JLPT** as map; **JSON→SQLite** distribution model with media on **Cloudflare R2**, reducing server costs (your brainstorm).  
**Threats:** incumbents add **AI** and **mobile polish**; free JLPT apps cover “good enough” exam prep; **maintenance** of community pipelines.

---

## Strategic Synthesis and Recommendations (learner-focused)

### Executive Summary

Learners treat **Japanese** as a **multi-tool problem**: mass-market apps capture **breadth and habit**, while **serious progression** often involves **paid specialists** (kanji/grammar) or **Anki + immersion stack**. **Open-source / local-first** products win when they **remove lock-in**, **work offline**, and **connect skills** (kanji ↔ vocab ↔ grammar ↔ reading) better than a patched bundle of tabs. A **native mobile + local desktop** footprint (no hosted product web app) matches learners who already split time between **phone drills** and **desktop literacy workflows**. The main go-to-market challenge is **not pedagogy alone**—it is **trust, content quality, and onboarding** that match Duolingo-level simplicity for the casual cohort **without** sacrificing depth for optimizers.

### Positioning Recommendations

1. **Lead with learner outcomes, not ideology:** “JLPT-aligned, works offline, your data exports”—then **open source** as proof.
2. **Own the “stack consolidator” story:** explicitly replace **WaniKani + Bunpro + reader** friction for a segment that already pays **two subscriptions**.
3. **Power-user bridges:** one-click **Anki export**, compatibility with **dictionary file** ecosystems, clear **SRS algorithm** transparency.
4. **BYO AI** as optional: matches **cost** concerns and **privacy** expectations for a vocal minority.
5. **Community content:** pair **gamified review** of contributions (your brainstorm) with **visible quality** cues (votes, provenance, AI-generated tags).

### Risks to Mitigate

- **Underestimating UX:** learners abandon OSS that feels like engineering homework on **mobile or desktop**.
- **Overpromising “all-in-one”** before listening/speaking depth exists.
- **Community moderation** failures erode trust faster than proprietary competitors.

### Success Metrics (learner outcomes)

- Activation: % completing **first meaningful lesson loop** in week one.
- Retention: **D30** review completion vs industry churn patterns.
- NPS / community: contributors per **month**; PR merge time.
- Differentiation: % users citing **offline** or **data ownership** as primary reason (survey later).

---

## Market Research Methodology and Source Documentation

### Methodology

- **Web search** (March 2026) for industry sizing, official pricing, representative OSS repos, and learner-behavior commentary.
- **Triangulation** where sources conflict (especially **market size**).
- **Brainstorming input** aligned to product direction: `_bmad-output/brainstorming/brainstorming-session-2026-03-14-1530.md` (platforms: **Android, iOS, local desktop** via **Electron + React Native Web**; no hosted web app for the product).

### Primary URLs Consulted

| Topic                                                  | URL                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Japanese market sizing (example)                       | https://www.qyresearch.com/reports/4637353/japanese-language-learning                                                                            |
| Online platform sizing (example)                       | https://www.360iresearch.com/library/intelligence/online-japanese-learning-platform                                                              |
| Duolingo Japanese learner stats                        | https://blog.duolingo.com/who-studies-japanese-on-duolingo/                                                                                      |
| Reddit app recommendations aggregation                 | https://jlptsamurai.com/2026/01/17/what-does-reddit-say-the-most-recommended-japanese-learning-apps-according-to-reddit/                         |
| WaniKani pricing                                       | https://knowledge.wanikani.com/account-and-membership/payment-and-billing/subscription-plans/                                                    |
| Bunpro pricing                                         | https://bunpro.jp/pricing                                                                                                                        |
| Language app price bands                               | https://canilearnit.com/costs-of-language-apps/                                                                                                  |
| Yomitan docs / store                                   | https://yomitan.wiki/getting-started/ , https://chromewebstore.google.com/detail/yomitan-popup-dictionary/likgccmbimhjbgkjambclfkhldnlhbnn?hl=en |
| Kaishi deck                                            | https://github.com/donkuri/kaishi                                                                                                                |
| KaniManabu                                             | https://github.com/Atelier-Shiori/KaniManabu                                                                                                     |
| Nihongo Master                                         | https://github.com/BillyMRX1/nihongo-master                                                                                                      |
| WaniKani + Bunpro price discussion                     | https://community.wanikani.com/t/is-the-price-of-wanikani-bunpro-really-worth-it-for-learning-japanese/63399?page=11                             |
| Privacy-first positioning example                      | https://lingofy.dev/                                                                                                                             |
| Offline learner article (English-focused; directional) | https://www.translaio.com/top-apps/best-apps-to-learn-english-offline-2026-guide-for-real-learners/                                              |

### Limitations

- No **primary** learner interviews or app analytics for this document.
- **Market reports** are gated/paywalled; summaries may **omit methodology**.
- **Community aggregations** can mis-sample (Reddit ≠ all learners).

---

## Market Research Conclusion

**Summary:** Learners cluster into **casual**, **JLPT/exam**, and **serious self-directed** paths. The last group already behaves in ways **compatible with open-source and local-first** products, but **onboarding, content trust, and mobile polish** determine adoption. Commercial specialists (**WaniKani**, **Bunpro**) and the **Anki + reader** stack define the **competitive baseline** your all-in-one OSS concept must beat on **integration and economics**, not on a single isolated feature.

**Next steps:** validate positioning with **10–15 learner interviews** (mix of Duolingo-only, JLPT prep, Anki users); prototype **one vertical slice** (e.g. N5 kanji+vocab+grammar link) and measure **session completion** vs a two-app baseline.

---

**Market Research Completion Date:** 2026-03-21  
**Source Verification:** Web search + official pricing pages + representative repos; conflicting market sizes noted explicitly.  
**Confidence:** Directional **medium–high** on behavior/competition; **low–medium** on exact market $.
