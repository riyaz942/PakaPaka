# App overview

What the app is, how a learner moves through it, and what each screen does. Orientation for someone new to the codebase — setup and commands live in the [root README](../README.md); detailed done / not-done status lives in [working-history.md](./working-history.md).

Last checked against the codebase: **2026-10-20**

---

## What the app is

NihongoCore — an offline-first Expo (React Native) Japanese learning app for iOS and Android. Free, no accounts, no subscriptions — all progress lives on-device in SQLite.

- **Content** is a dependency graph (radical → kanji → vocabulary) plus structured grammar and reading passages.
- **Scheduling** is FSRS spaced repetition, biased toward weak points (`0.7 × fsrs + 0.3 × weakness`), served as one interleaved queue. Stage rules: [srs-system-vs-wanikani.md](./srs-system-vs-wanikani.md).
- **Network** is required by exactly one feature: the AI conversation tab (bring-your-own API key). Everything else works fully offline.

## Navigation shape

Five tabs — **Home · Browse · Talk · Stats · Settings** (`src/app/(tabs)/_layout.tsx`).

Lesson, Review and the JLPT Levels page are *not* tabs; they open as full-screen stacks above the tabs (`src/app/_layout.tsx`). Onboarding runs before the tabs and is enforced by `OnboardingRedirect`. The legacy `learn/` and `read/` routes stay mounted with `href: null` so old deep links resolve, but they just redirect to Browse.

## Current flow

```
Onboarding (first launch)
  welcome → [import / restore → import summary] → intensity → [placement | day-one deck] → complete
                                                                                               ↓
                                                                                         Home (tabs)
        ┌───────────────┬───────────────┬───────────────┬──────────┴────┬──────────┐
     Lesson          Review          Browse           Talk           Stats     JLPT Levels
        ↓               ↓               ↓               ↓
   complete →      summary        item / passage    chat → summary
   "Quiz me now" → Review          / compare pages
```

**Onboarding.** Pick a path: *new to Japanese* (gets a short day-one deck of guidance cards), *I know some* (JLPT level plus a one-minute placement check that marks known items as already learned), or *import* (WaniKani API, Bunpro, Anki `.apkg`, or restore from a backup file). Then choose session intensity. The completion screen drops you into either your first lesson or Home.

**Daily loop.** Home shows what's due → Review clears the queue → Lesson introduces new items → finishing a lesson offers "Quiz me now", which jumps straight into a review of the fresh items → back to Home, where the goal ring has moved.

## What each page does

### Home — `(tabs)/index.tsx`

The daily dashboard. The hero **goal ring** is today's lesson allowance plus today's reviews (done and still due). It can go past 100%. There is no stored goal and no ratchet; the target is worked out fresh each day (`resolveDailyGoalTarget`).

Sections: the goal ring, Review (primary CTA with the due count), Today's Lesson (with the remaining allowance), level progress, review forecast, reading readiness (the next passage you can unlock), and an at-risk list that can launch a targeted revision session. Tapping level progress opens the **JLPT Levels** page, where you can see every level and change your active one.

Sections are customizable (Settings → Customize Home): drag to reorder, hide with the eye toggle. Review and Today's Lesson can move but cannot be hidden.

One conditional banner slot shows, by priority: welcome back (after an absence), curriculum updated, import nudge, shadow-mode prompt, and (web only) a stale-backup nudge. With **Vacation mode** on, the ring is replaced by a paused card and both CTAs are disabled — nothing accrues behind it.

The reviews-due count appears here only, never as a tab badge.

### Review — `review/` (full-screen)

Typed-answer SRS session. Romaji-to-kana input, wrong-script and typo hints, and one-tap synonym adding when an answer is rejected. If the typed answer belongs to a *different* item, a compare screen explains the collision without leaving the session.

- **Kanji** use two cards (meaning + on'yomi), graded worst-of-both; kun'yomi is taught through vocabulary.
- **Vocabulary** gets a reading card only once every kanji in the word is Guru+; until then it is meaning-only and held at Master.
- **Grammar** uses two cards per point, graded worst-of-both: **Read** (a Japanese sentence with the grammar highlighted — type what the grammar means) and **Build** (an English sentence plus its words — type the whole sentence in Japanese). No multiple choice and no hints. Words in both cards link to their detail pages.

Auto-advance after a correct answer ("Lightning Mode") is optional; otherwise Return advances. Leaving mid-session is guarded by a confirmation sheet. Ends on a summary with items reviewed, correct count, goal contribution and a mascot celebration.

### Lesson — `lesson/` (full-screen)

Auto-planned session that walks new items one card at a time, each split into three paced sections (grammar: Intro · Usage · Examples), navigable forward and back by button or swipe. Nothing commits until the last item, so leaving mid-lesson costs nothing.

A daily lesson allowance caps new items, with a "Learn anyway" escape. Ends on a completion screen offering an immediate quiz of what was just learned.

### Browse — `(tabs)/browse/`

The single discovery surface, replacing the old per-level Learn screens and the separate Read tab. Search plus filter pills (type, level, status) across radicals, kanji, vocabulary, grammar and passages. Items with no mnemonic yet show a "No mnemonic" pill.

Tapping a row opens a detail page: mnemonics, readings, word type and reading composition, example sentences, cross-reference chips to component and derived items, look-alikes, personal mnemonic and user-synonym editors, and per-word furigana overrides. A component kanji you have not learned yet is marked, with a "Learn now (+N items)" button that adds it to your lesson queue. A compare page puts two items side by side. Reading passages unlock at ≥90% Guru+ coverage.

### Talk — `(tabs)/converse/`

AI conversation practice, and the only network-dependent surface. Three states in precedence order: offline notice (scoped to this tab — it says so explicitly), key setup when no provider is configured, or a start picker that grounds the chat in recent or chosen grammar points.

Replies use curriculum-appropriate furigana brackets; each known word links to its detail page and long-press toggles its furigana. Unknown words are flagged but never injected into SRS. Push-to-talk voice uses on-device speech models, downloaded on first use. Sessions end through a centered End pill (or the AI's wrap-up marker) into an on-demand summary — landing on the summary screen does not itself spend a request. Past threads live behind the history icon in the tab header. Provider keys go to secure storage; transcripts stay local.

### Stats — `(tabs)/stats.tsx`

Days studied, items in review, SRS stage breakdown, and weak-pattern clusters. Days-studied lives here by design rather than on Home.

### Settings — `(tabs)/settings/`

- **Session:** intensity (new lesson items per day — reviews are never capped) and items per lesson.
- **Review queue:** weakness-bias toggle, auto-advance (Lightning Mode), vacation mode.
- **Appearance and accessibility:** Light / Dark / Auto theme, reduce motion.
- **Furigana:** Auto (until known) / Always shown / Always hidden, plus per-word override management.
- **Backup:** export your progress (optionally with AI conversations) and restore from a file.
- **Daily reminders**, **BYOK** provider and key, **shadow mode** (run alongside your existing tools and compare results before switching).
- **Customize Home** (`settings/home-layout.tsx`) and **How this works** — the library of guidance cards.
- **About and data sources** (`settings/about.tsx`) — app version, licences, and the third-party attributions from `NOTICE`.

## Known gaps

Tracked in detail in [working-history.md](./working-history.md) and [known-issues.md](./known-issues.md):

- Grammar Read + Build, grammar linked words and grammar mnemonics are built, but their in-app check on a device has not been run.
- Bunpro import is best-effort: most items come back unmatched (story 3-3 still at `review`).
- `lesson_opt_ins` ("Learn now" choices) is not in backup/restore.
- Web learner build (backup plan Part B) is not started.
- `claimStreakCelebration` (`src/data/user/streakRepository.ts`) has a data path but no UI and no callers. Streaks were rejected outright by decision R2, so this is dead code awaiting removal, not a missing feature — do not build UI onto it.
