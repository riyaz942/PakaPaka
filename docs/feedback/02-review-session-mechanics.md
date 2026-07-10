# Plan 02 — Review session mechanics

**Priority:** P1 — depends on Plan 01 landing first (stage transitions are meaningless until cards can actually change stage).

**Feedback addressed:**
> On the review section, in that session, when I incorrectly answer some quizzes, it should ask again till I answer all the quizzes correctly, similar to WaniKani. And it should show my current state as well. If I answer the meaning and reading correctly, it upgrades to guru, or if I answer one incorrectly, it downgrades to apprentice, something like that?

---

## Current behaviour

The session is a flat, forward-only walk through a fixed array. In `mobile/src/providers/ReviewSessionProvider.tsx:245`, `gradeCurrentItem` ends with:

```ts
setCurrentIndex((i) => i + 1);
```

Every grade — correct or incorrect — advances. `isComplete` is `currentIndex >= totalItems` (`ReviewSessionProvider.tsx:134`). An item answered wrong is graded `Again`, written to the DB, and never seen again this session. The user finishes a session having never once produced the right answer for the items they got wrong, which is the exact opposite of what a review session is for.

There is also a WaniKani-semantics mismatch. WaniKani requires **both** the meaning and the reading to be answered before an item's SRS stage moves. We ask exactly one prompt per item per session, chosen by rep parity in `mobile/src/core/srs/promptResolver.ts:11`:

```ts
const parity = Math.abs(srsState.reps) % 2;
return parity === 0 ? 'reading' : 'meaning';
```

So a kanji is graded on its reading today and its meaning in two weeks, and one FSRS card carries both. That is a defensible FSRS-native design — it is just not the WaniKani design the feedback describes, and it means "answer meaning and reading correctly → guru" is currently not expressible.

## Decisions to make

Two questions, and they are independent. Answer both before writing code.

**Q1: One card per item, or one card per (item, prompt type)?**

- **Option A (keep one card).** Alternate prompts as today. Cheap. But we can never say "you know the reading but not the meaning", the weakness engine can't distinguish reading-weakness from meaning-weakness at the SRS level (though `weakness_stats.lastErrorType` already tracks it separately), and the feedback's mental model stays wrong.
- **Option B (split the card).** `srs_states` becomes keyed on `(item_id, prompt_type)`. An item's displayed stage is the *minimum* of its cards' stages, which is what WaniKani shows. This is the WaniKani model and it's what the user is asking for. It is a migration on the primary key of the SRS table, plus a rework of `queueBuilder`, `useReviewQueue`, and `fsrsConverter` (WaniKani's API already gives separate meaning/reading SRS data, so the import gets *more* faithful, not less).

Option B is the right destination. It is also a big change. Recommend: **do the in-session re-queue first (below), which is independently valuable and does not depend on this choice**, then take Option B as its own story.

**Q2: What does "ask again till correct" do to the FSRS grade?**

WaniKani grades on the *first* attempt and uses subsequent attempts only to force the correct answer into working memory. Mirror that: **the first attempt determines the grade; the re-ask is pedagogical, not scored.** Otherwise a user can grind a wrong item back to `Good` and corrupt their own scheduling.

## Changes

### 1. In-session re-queue of incorrect items

Model the session as a mutable working queue rather than an index into a frozen array.

In `ReviewSessionProvider`:

- Hold `workingQueue: ReviewItem[]` (seeded from `queue`) and `cursor: number`.
- On grade:
  - Write the FSRS grade **once**, on first attempt, exactly as today (this preserves all the boost/weakness/cognitive-load side effects already in `gradeCurrentItem`).
  - If the first attempt was incorrect, append the item to the end of `workingQueue` marked `{ retry: true }`.
  - A `retry` item that is answered correctly is simply removed. A `retry` item answered incorrectly is appended again — and, per WaniKani, shown again later in the session rather than immediately, so the user can't pattern-match off the reveal they just read.
- `isComplete` becomes "the working queue is exhausted", not "cursor passed the original length".
- Guard against a retry appended right at the tail landing as the very next card. Re-insert at `max(cursor + 3, length)` so at least two other items intervene, unless the queue is too short to allow it.

`SessionHeader` progress (`currentIndex / totalItems`) needs redefining. Show progress against *distinct items retired*, not cards shown, or the bar goes backwards when a retry is appended. `totalItems` stays the original queue length; `currentIndex` becomes the count of items that have been answered correctly at least once.

Side-effect accounting to keep straight:
- `domainCountsRef` / `correctCountRef` must count each item **once**, on first attempt, or the summary and shadow-mode retention rate double-count retries.
- `computeLoadIncrement` (cognitive load) should also fire once per item. A retry is not new load.
- `recordOutcome` (weakness) — the existing typo rule says "a typo followed by a correct retry records one typo + one correct". Apply the same shape: an incorrect followed by a correct retry records one incorrect. Do **not** record the retry's `correct`, or accuracy inflates.

### 2. Show the SRS stage transition

`SRSStageIndicator` already renders the *current* stage on the prompting card (`mobile/src/components/review/ReviewCard.tsx:136`). What's missing is the *change*.

`gradeItem` already returns the next state, and `mapFsrsStateToStageLabel` gives us both labels. Surface the delta on the correct/incorrect reveal:

- Correct, stage advanced: `Apprentice → Guru` with the guru accent colour and an upward affordance.
- Incorrect, stage dropped: `Guru → Apprentice`, muted, no shaming.
- No change: show the stage statically, no transition chrome.

This needs `gradeCurrentItem` to hand the resulting `SRSState` back (or expose `lastTransition: { from: SRSStageLabel; to: SRSStageLabel } | null` on the context) so `ReviewCard` can render it. Today `gradeItem`'s result is computed at `ReviewSessionProvider.tsx:155` and dropped into the DB write without ever reaching the UI.

Note this is *only* meaningful after Plan 01 — today `from` and `to` are always `'apprentice'`.

### 3. Summary screen reflects retries

`review/summary.tsx` should distinguish "24 items reviewed, 19 correct first try" from "24 items reviewed, 24 eventually correct". First-try accuracy is the honest number and the one that matches `correctCount`.

## Acceptance criteria

- An item answered incorrectly reappears later in the same session and the session does not complete until it is answered correctly.
- A re-asked item does not appear as the immediately-next card when the queue has ≥3 remaining items.
- The FSRS grade written for an item is the grade of its **first** attempt; retries write nothing.
- `weakness_stats`, cognitive load, and `domainCounts` each count an item once per session.
- The correct/incorrect reveal names the stage transition when the stage changed, and stays silent when it didn't.
- Session progress never moves backwards.

## Files touched

- `mobile/src/providers/ReviewSessionProvider.tsx`
- `mobile/src/components/review/ReviewCard.tsx`
- `mobile/src/components/review/SessionHeader.tsx`
- `mobile/src/app/review/index.tsx`
- `mobile/src/app/review/summary.tsx`

## Deferred to its own story

Splitting `srs_states` to `(item_id, prompt_type)` (Q1 Option B) — migration, `queueBuilder`, `useReviewQueue`, `promptResolver`, `fsrsConverter`, and the stage-display `min()` rule.
