---
title: 'Beautify Home tab'
type: 'feature'
created: '2026-07-04'
status: 'done'
context: []
baseline_commit: '84eb493d087ed95827955165a2332a8308671c39'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Home tab is functionally complete but visually flat: a tiny 56px load ring floating over plain full-width buttons and unstyled cards, far from the UX spec's "simplified home" direction (hero ring, large Review/Learn action stack with visual accents, streak card, compact JLPT progress bar).

**Approach:** Restyle the Home screen and its three engagement components (CognitiveLoadRing hero variant, StreakCounter, LevelProgressBar) using only the existing NativeWind semantic tokens, plus the existing `FadeSlideIn` (staggered entrance) and `PressableScale` (press feedback) primitives. Pure presentation change — no data, navigation, or hook logic changes.

## Boundaries & Constraints

**Always:**
- Use semantic Tailwind tokens only (`bg-surface`, `text-primary`, `text-feedback-*`, `content-*`, spacing/radius/typography scale). No raw hex, no deprecated `Colors` object.
- Preserve all existing testIDs (`home-review-button`, `home-learn-button`, `home-streak-counter`), accessibility roles/labels/states, and behavior (due-count logic, disabled state, shadow-mode prompt, focus refetch).
- Respect reduced motion (FadeSlideIn/PressableScale already handle this).
- Keep `mobile/` lint, typecheck, and jest green.

**Ask First:**
- Adding any new npm dependency (e.g., react-native-svg for a true progress arc).
- Changing wording of user-facing strings beyond additive supporting copy.

**Never:**
- Touch hooks, repositories, routing, or review/lesson flows.
- Modify the `small`/`large` ring variants used by the review SessionHeader.
- Move SRS stage breakdown onto Home (UX spec keeps it on Stats).

</frozen-after-approval>

## Code Map

- `mobile/src/app/(tabs)/index.tsx` -- Home screen; layout restructure happens here
- `mobile/src/components/engagement/CognitiveLoadRing.tsx` -- add `hero` variant (size/border/font only; band color logic unchanged)
- `mobile/src/components/engagement/StreakCounter.tsx` -- card polish (flame badge, larger count, at-risk warning color)
- `mobile/src/components/engagement/LevelProgressBar.tsx` -- card polish (percent label, colored per-type dot chips)
- `mobile/src/components/common/FadeSlideIn.tsx`, `PressableScale.tsx` -- existing primitives to reuse, not modify
- `mobile/src/app/(tabs)/index.test.tsx`, engagement `*.test.tsx` -- must stay green; adjust assertions only if presentation text changes

## Tasks & Acceptance

**Execution:**
- [x] `mobile/src/components/engagement/CognitiveLoadRing.tsx` -- add `variant: 'hero'` (~144px, `border-4`, ~28px percent text) to SIZE/fontSize maps -- home needs a hero-scale ring per UX spec (~160px direction) without touching review's `small`
- [x] `mobile/src/components/engagement/StreakCounter.tsx` -- restyle as horizontal card: flame glyph in a tinted `bg-surface-elevated` circle, count in `text-title-lg`, label + at-risk hint (`text-feedback-warning`); keep accessibility label logic and broken-streak branch -- current card is a bare number stack
- [x] `mobile/src/components/engagement/LevelProgressBar.tsx` -- add overall percent to the header row, thicken bar to `h-2.5` with `rounded-radius-full`, render per-type counts as dot-chip rows (colored dot + label + count) -- improves scannability of the compact progress block
- [x] `mobile/src/app/(tabs)/index.tsx` -- restructure: (1) greeting header (`text-title-lg` "おかえり" + `text-body-sm text-secondary` English subline); (2) hero card (`bg-surface rounded-radius-lg`) centering the hero ring with "Today's load" caption; (3) action stack: two `PressableScale` action cards replacing the plain Buttons — Review (accent left-border or tinted `bg-feedback-info/15` treatment, due count prominent, disabled at 0 due) and Today's lesson (neutral surface card) — each with title + one-line description, preserving testIDs/labels/disabled semantics; (4) streak + progress + shadow prompt below; wrap sections in `FadeSlideIn` with staggered `index` -- delivers the UX-spec home hierarchy: action, capacity, habit, momentum
- [x] `mobile/src/app/(tabs)/index.test.tsx` + engagement tests -- run and adjust only assertions tied to changed presentation (e.g., ring label size, streak text layout); add one assertion that hero ring renders at 42% -- keep behavior contract pinned

**Acceptance Criteria:**
- Given the Home tab renders with data loaded, when inspected, then greeting, hero load card, Review and Lesson action cards, streak card, and N-level progress card all render styled with semantic tokens only (no raw hex in the diff).
- Given 2 items are due, when Home renders, then the Review action shows the count and `accessibilityLabel` "Review 2 items due"; given 0 due, then it is disabled with "All caught up" semantics — identical to today.
- Given reduced motion is enabled, when Home mounts, then content renders immediately without entrance animation (via FadeSlideIn's built-in fallback).
- Given the review session header, when unchanged code paths render, then the `small` ring variant is byte-identical in behavior.
- Given `npm run lint && npm run typecheck && npm test` in `mobile/`, when run, then all pass (a11y lint rules included).

## Spec Change Log

## Verification

**Commands:**
- `cd mobile && npm run lint` -- expected: no errors (includes react-native-a11y rules)
- `cd mobile && npm run typecheck` -- expected: clean
- `cd mobile && npx jest src/app/\(tabs\)/index.test.tsx src/components/engagement` -- expected: all pass
- `cd mobile && npm test` -- expected: full suite green

**Manual checks (if no CLI):**
- Home renders correctly in both dark and light schemes (tokens are CSS-variable based; verify no hardcoded colors sneak in).

## Suggested Review Order

**Home screen composition**

- New local ActionCard: PressableScale + glyph tile, mirrors Button's a11y/disabled contract exactly
  [`index.tsx:35`](../../mobile/src/app/(tabs)/index.tsx#L35)

- Greeting header opens the new section stack, staggered via FadeSlideIn indices
  [`index.tsx:154`](../../mobile/src/app/(tabs)/index.tsx#L154)

- Review card: title/subtitle split while preserving the exact pre-existing a11y labels and disabled logic
  [`index.tsx:189`](../../mobile/src/app/(tabs)/index.tsx#L189)

**Hero load ring**

- Hero card centers the new 144px ring variant
  [`index.tsx:162`](../../mobile/src/app/(tabs)/index.tsx#L162)

- `hero` added as a third map entry; `small`/`large` values byte-identical
  [`CognitiveLoadRing.tsx:12`](../../mobile/src/components/engagement/CognitiveLoadRing.tsx#L12)

**Engagement card polish**

- Streak becomes a horizontal card: glyph badge + title-lg count; label strings unchanged
  [`StreakCounter.tsx:35`](../../mobile/src/components/engagement/StreakCounter.tsx#L35)

- Progress header gains a percent readout; per-type counts become colored dot chips
  [`LevelProgressBar.tsx:40`](../../mobile/src/components/engagement/LevelProgressBar.tsx#L40)

**Tests**

- New hero-variant assertion (144px, border-4) — review-triggered patch
  [`CognitiveLoadRing.test.tsx:39`](../../mobile/src/components/engagement/CognitiveLoadRing.test.tsx#L39)

- Home test pins hero size on the ring; mock gains reduced-motion stubs for FadeSlideIn
  [`index.test.tsx:88`](../../mobile/src/app/(tabs)/index.test.tsx#L88)
