# App overview

What the app is, how a learner moves through it, and what each screen does. Orientation for someone new to the codebase — setup and commands live in the [root README](../README.md); detailed done / not-done status lives in [working-history.md](./working-history.md).

Last checked against the codebase: **2026-08-02**

---

## What the app is

An offline-first Expo (React Native) Japanese learning app for iOS and Android. Free, no accounts, no subscriptions — all progress lives on-device in SQLite.

- **Content** is a dependency graph (radical → kanji → vocabulary) plus structured grammar and reading passages.
- **Scheduling** is FSRS spaced repetition, biased toward weak points (`0.7 × fsrs + 0.3 × weakness`), served as one interleaved queue.
- **Network** is required by exactly one feature: the AI conversation tab (bring-your-own API key). Everything else works fully offline.

## Navigation shape

Five tabs — **Home · Browse · Talk · Stats · Settings** (`src/app/(tabs)/_layout.tsx`).

Lesson and Review are *not* tabs; they open as full-screen sessions stacked above the tabs (`src/app/_layout.tsx`). Onboarding runs before the tabs and is enforced by `OnboardingRedirect`. The legacy `learn/` and `read/` routes stay mounted with `href: null` so old deep links resolve, but they just redirect to Browse.

## Current flow

```
Onboarding (first launch)
  welcome → [import] → intensity → [placement] → complete
                                                    ↓
                                              Home (tabs)
        ┌───────────────┬───────────────┬──────────┴────┬──────────┐
     Lesson          Review          Browse           Talk       Stats
        ↓               ↓               ↓               ↓
   complete →      summary        item / passage    chat → summary
   "Quiz me now" → Review          detail pages
```

**Onboarding.** Pick a path: *new to Japanese*, *I know some* (JLPT level plus a one-minute placement check that marks known items as already learned), or *import* (WaniKani API, Bunpro, Anki `.apkg`). Then choose session intensity. The completion screen drops you into either your first lesson or Home.

**Daily loop.** Home shows what's due → Review clears the queue → Lesson introduces new items → finishing a lesson offers "Quiz me now", which jumps straight into a review of the fresh items → back to Home, where the goal ring has moved.

## What each page does

### Home — `(tabs)/index.tsx`

The daily dashboard. Hero **goal ring** fills toward a daily load target; going past 100% is encouraged, and the target ratchets up (with a prompt) when you keep beating it — it is not a capacity ceiling.

Below the ring: Review as the primary CTA carrying the due count, Today's Lesson with a remaining-items allowance, a level progress bar, a forecast of upcoming reviews, a reading-readiness pointer to the next unlockable passage, and an at-risk section that can launch a targeted revision session.

One conditional banner slot rotates by priority between welcome-back (after an absence), curriculum-updated, import nudge, and shadow-mode prompts. With **Vacation mode** on, the ring is replaced by a paused card and both CTAs are disabled — nothing accrues behind it.

The reviews-due count appears here only, never as a tab badge.

### Review — `review/` (full-screen)

Typed-answer SRS session. Romaji-to-kana input, wrong-script and typo hints, near-miss "incomplete" teaching reveals, and one-tap synonym adding when an answer is rejected. If the typed answer belongs to a *different* item, a compare screen explains the collision without leaving the session.

Kanji use **two cards** (meaning + on'yomi) graded worst-of-both; kun'yomi is taught through vocabulary. Grammar uses cloze prompts that harden by stage — multiple choice at Apprentice, type-in at Guru, no-English gate at Enlightened.

Auto-advance after a correct answer ("Lightning Mode") is optional; otherwise Return advances. Leaving mid-session is guarded by a confirmation sheet. Ends on a summary with first-try accuracy, elapsed time, and goal contribution.

### Lesson — `lesson/` (full-screen)

Auto-planned session that walks new items one card at a time, each split into three paced sections, navigable forward and back by button or swipe. Nothing commits until the last item, so leaving mid-lesson costs nothing.

A daily lesson allowance caps new items, with a "learn anyway" escape. Ends on a completion screen offering an immediate quiz of what was just learned.

### Browse — `(tabs)/browse/`

The single discovery surface, replacing the old per-level Learn screens and the separate Read tab. Search plus filter pills (type, level, status) across radicals, kanji, vocabulary, grammar and passages.

Tapping a row opens a detail page: mnemonics, readings, example sentences, cross-reference chips to component and derived items, look-alikes, personal mnemonic and user-synonym editors, and per-word furigana overrides. Reading passages unlock at ≥90% Guru+ coverage.

### Talk — `(tabs)/converse/`

AI conversation practice, and the only network-dependent surface. Three states in precedence order: offline notice (scoped to this tab — it says so explicitly), key setup when no provider is configured, or a start picker that grounds the chat in recent or chosen grammar points. The recent-grammar card is highlighted with a grammar-gold border; a lock footnote marks Talk as the only online feature.

Replies use curriculum-appropriate furigana brackets; unknown words are flagged but never injected into SRS. Sessions end through a centered End pill (or the AI's wrap-up marker) into an on-demand summary — landing on the summary screen does not itself spend a request. Past threads live behind the history icon in the tab header. Provider keys go to secure storage; transcripts stay local.

### Stats — `(tabs)/stats.tsx`

Days studied, SRS stage breakdown, and weak-pattern clusters. Days-studied lives here by design rather than on Home.

### Settings — `(tabs)/settings.tsx`

Session intensity, daily goal value, weakness-bias toggle, review auto-advance, vacation mode, light/dark theme, reduce motion, furigana mode plus per-word override management, daily reminder notifications, shadow mode (run alongside your existing tools and compare results before switching), and BYOK provider/key configuration.

## Known gaps

Tracked in detail in [working-history.md](./working-history.md) and [known-issues.md](./known-issues.md):

- Radical mnemonic images are wired end to end but not generated — the app still shows the text fallback.
- N4 grammar cloze variants and families (Wave C) are unauthored.
- `claimStreakCelebration` (`src/data/user/streakRepository.ts`) has a data path but no UI and no callers. Streaks were rejected outright by decision R2, so this is dead code awaiting removal, not a missing feature — do not build UI onto it.
- App icon and adaptive-icon art are still Expo template assets. The launch screen is v2 (warm background, no logo); the icons need real artwork.
