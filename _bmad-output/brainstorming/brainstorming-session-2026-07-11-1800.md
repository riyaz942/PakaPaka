---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Grammar review / test design — what to ask and how to answer so grammar cards assess understanding (vs broken reading prompts like は→は)'
session_goals: 'Surface strong grammar review patterns (meaning, cloze/completion, English hints, etc.), stress-test against particles and similar items, converge on fair diagnostic review modes'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'Cross-Pollination', 'Solution Matrix']
ideas_generated:
  - 'Cloze + English Gloss'
  - 'Full Sentence Production (EN → JP)'
  - 'Image + JP Prompt + Hints'
  - 'Cloze → Production Ladder'
  - 'Guru-stage difficulty flip'
  - 'Grammar-Family Templates'
  - 'Five Grammar Families'
  - 'Particles Pre-Guru: type-in cloze, hints on demand'
  - 'Image object pool + sentence check (bundled assets)'
  - 'Soft nudge incomplete; SRS treats incomplete as incorrect (WK-style)'
  - 'Universal Cloze: MC below Guru, type-in at Guru+'
  - 'MC distractors from same grammar family'
  - 'Pattern cloze: blank = variable bit only; frame fixed'
  - 'Borrow Bunpro: hint ladder, sentence variants, EN→JP'
  - 'Three-rung ladder; Enlightened+ = 50/50 cloze + EN→JP'
  - 'Two-rung hints (nudge→EN), no SRS penalty'
  - '5 sentence variants per grammar point'
  - 'Enlightened = Bunpro-hard cloze; EN fully off (A2)'
technique_execution_complete: true
facilitation_notes: 'Pivoted from image/Q production to universal cloze after を stress-test; corrected Bunpro EN→JP misconception toward Bunpro-hard cloze'
session_active: false
workflow_completed: true
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-07-11

## Session Overview

**Topic:** Grammar review / test design — what to ask and how to answer so grammar cards assess understanding (vs broken reading prompts like は→は)
**Goals:** Surface strong grammar review patterns (meaning, cloze/completion, English hints, etc.), stress-test against particles and similar items, converge on fair diagnostic review modes

### Session Setup

Product/pedagogy design session sparked by a concrete playtest failure: learning particle は and being asked for its "reading" (は) — a kanji-style review pattern that doesn't transfer. Focus is generative exploration of fair, diagnostic grammar review modalities before locking an implementation.

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Grammar review/test design with focus on fair, diagnostic modalities that don't collapse into kanji-style reading drills

**Recommended Techniques:**

- **Question Storming:** Define what "knowing grammar" means and what a review must prove before locking formats
- **Cross-Pollination:** Borrow proven formats from Bunpro, textbooks, JLPT, Anki, classroom drills
- **Solution Matrix:** Map grammar types × review modalities to find strong pairings and kill the は trap

**AI Rationale:** Problem-solving / product design session with a known failure mode. Sequence is define skill → borrow proven patterns → systematically pair formats to content types.

## Technique Execution Results

**Question Storming:**

- **Interactive Focus:** What "knowing grammar" means; cloze vs production; particle edge cases
- **Key Breakthroughs:** Skills = understand / place / produce; image+Q fails for を; consistency > clever per-family UX
- **User Creative Strengths:** Strong product instincts; willing to kill beloved ideas (image Guru) when consistency demanded it
- **Energy Level:** High, decision-oriented

**Cross-Pollination:**

- **Building on Previous:** Borrowed Bunpro cloze/hints/variants; WK near-miss = incorrect
- **New Insights:** Bunpro "EN→JP" for grammar is really cloze + English scaffolding, not full-sentence translation
- **Developed Ideas:** Two-rung hints (no SRS penalty); 5 variants; Enlightened = no English

**Solution Matrix:**

- **Building on Previous:** One row for all families; columns = SRS stages
- **New Insights:** Difficulty = input mode + scaffolding, not task type change
- **Developed Ideas:** Locked universal cloze matrix (MC → type-in → Bunpro-hard)

**Overall Creative Journey:** Started from は reading bug → explored production/images → stress-tested → converged on Bunpro-like universal cloze with stage-based difficulty.

### Creative Facilitation Narrative

Session moved from open pedagogy questions to a concrete, implementable review contract. The decisive turn was rejecting particle-specialized Guru production in favor of one cloze system that survives を and conjugations alike.

### Session Highlights

**User Creative Strengths:** Consistency bias under stress-test; clear UX preferences (type-in, hints without penalty)
**AI Facilitation Approach:** Coach → correct Bunpro misconception → matrix lock
**Breakthrough Moments:** Universal cloze; Enlightened = English off; blank = variable only
**Energy Flow:** Generative then convergent; user-driven move to organization

## Idea Organization and Prioritization

**Thematic Organization:**

### Theme 1 — Universal Cloze Contract
- JP cloze for all grammar families; never ask "reading" for grammar
- Blank = variable chunk only; frame fixed
- 5 sentence variants per grammar point (all stages)
- MC distractors from same grammar family

### Theme 2 — Stage-Based Difficulty Ladder
- `< Guru`: MC cloze
- Guru → Master: type-in cloze
- Enlightened+: type-in cloze, English fully unavailable (Bunpro-hard)

### Theme 3 — Feedback & Help UX
- Hints on demand: nudge → English (pre-Enlightened only); no SRS penalty for using hints
- Near-miss / incomplete answers = incorrect for SRS + teaching nudge (WK-style)

### Shelved (explored, not adopted)
- Image + Japanese question Guru production
- Full EN → JP sentence production as Enlightened mode
- Enlightened 50/50 cloze + EN→JP mix
- Live Google Image Search for review images

**Prioritization Results** (facilitator recommendation, user confirmed via Complete):

- **Top Priority / High-Impact:**
  1. Stop grammar reading prompts; ship universal JP cloze
  2. Stage ladder: MC → type-in → Enlightened no-English
  3. Answer = grammar chunk only (fixed frame)

- **Quick Wins:**
  1. Disable/replace reading review path for grammar items in app
  2. Two-rung hint UI (nudge → EN) with no SRS penalty
  3. Near-miss fail + nudge copy

- **Later / Content-Heavy:**
  1. Author 5 cloze variants (+ English + nudge) per grammar point
  2. Same-family distractor pools in curriculum data
  3. Tag grammar points with family for distractor selection

**Locked review matrix:**

| Stage | Prompt | Answer | English / hints |
|--------|--------|--------|-----------------|
| `< Guru` | JP cloze · 5 variants | MC · same-family distractors | Hint ladder: nudge → EN; no SRS penalty |
| Guru → Master | JP cloze · 5 variants | Type-in chunk | Hint ladder: nudge → EN; no SRS penalty |
| Enlightened+ | JP cloze · 5 variants | Type-in chunk | **No English**; nudge only or none |

**Action Planning:**

### P1 — Kill reading reviews for grammar (this week)
1. Audit current grammar review prompt types in lesson/review flow
2. Gate: if content type = grammar → never ask reading
3. Route to cloze (even a single variant stub) so playtest of は stops asking は→は
- **Resources:** Review session UI + answer evaluation path
- **Success:** は review never shows "reading"; blank expects は in context

### P2 — Implement stage ladder input modes
1. Map SRS stage → input mode (MC / type-in / Enlightened flags)
2. Wire MC options from same-family candidate list
3. Hide English entirely at Enlightened+
- **Resources:** SRS stage on item; review card component; preferences optional later
- **Success:** Same grammar item changes input/scaffolding at Guru and Enlightened

### P3 — Curriculum schema for cloze variants
1. Define schema: `variants[]` with `jpCloze`, `english`, `answer`, `nudge`, `family`
2. Seed 5 variants for early particles (は, が, を, も, です-adjacent as needed)
3. Compile into curriculum.db; teach review queue to pick random variant
- **Resources:** Curriculum JSON + compile pipeline + content authoring time
- **Success:** Reviews rotate sentences; not one memorized line

### P4 — Feedback polish
1. Near-miss detector for incomplete but plausible answers
2. Copy: acknowledge idea + show full target; still mark incorrect
3. Confirm hints never flip grade to fail/hard
- **Success:** WK-like honesty; learners understand why incomplete failed

## Session Summary and Insights

**Key Achievements:**

- Resolved the core question: grammar tests **placement in context**, not reading
- Converged on a Bunpro-aligned, stage-scaled cloze system that works for all five grammar families
- Explicitly shelved inconsistent Guru production after を stress-test
- Corrected EN→JP misconception: Bunpro-hard = cloze without English, not full translation

**Session Reflections:**

- Best ideas came from killing complexity in favor of one consistent experience
- Content (5 variants × points) is the long pole; product contract is ready to implement
- Document path: `_bmad-output/brainstorming/brainstorming-session-2026-07-11-1800.md`
