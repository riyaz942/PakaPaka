# Codebase Issues & Bugs

Manual code review of `mobile/src` and `scripts/`, 2026-07-05.
Baseline: `npm run typecheck`, `npm run lint`, and `npm test` all pass — everything below is logic-level and was found by reading the code.

Severity: **High** = user-visible breakage or data loss · **Medium** = incorrect behavior in real scenarios · **Low** = code quality / fragile-but-working.

> **Status update (2026-10-20):** H1, M1–M8, L5 and L7 are fixed (see git history). L1–L4, L6 and L8–L10 remain open. Line numbers below are from 2026-07-05 and may have moved.

---

## High

### H1. Curriculum OTA update checksum verification is broken in production — updates can never install
`mobile/src/data/curriculum/curriculumUpdate.ts:163-180` (`computeFileSha256Hex`)

```ts
const base64 = await readFileAsBase64(fileUri);
const digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, base64, {
  encoding: CryptoEncoding.BASE64,
});
```

Two independent problems:

1. **Wrong content hashed.** The real `expo-crypto` `digestStringAsync` hashes the input as a UTF-8 *string*. This hashes the base64 **text representation** of the file, not the file's bytes. The manifest's `sha256` is computed over raw file bytes (`scripts/compile-curriculum.ts:184` uses Node `createHash('sha256')` on file contents), so the digests describe different data.
2. **Wrong output encoding.** In the real API, `options.encoding` is the *output* encoding of the digest. `CryptoEncoding.BASE64` produces a 44-character base64 digest, which is compared against the manifest's 64-character hex string (validated by `/^[a-f0-9]{64}$/` at line 75). A 44-char base64 string can **never** equal a 64-char hex string.

Result: on a real device, `validateDownloadedCurriculumFile` always returns `CURRICULUM_CHECKSUM_MISMATCH`, so every OTA curriculum update fails. (Also a performance concern: reading the whole DB into a base64 JS string just to hash it.)

**Why tests don't catch it:** the jest mock (`mobile/__mocks__/expo-crypto.ts`) inverts the semantics — it treats `encoding: BASE64` as the *input* encoding (decodes base64 → raw bytes) and always returns a **hex** digest. The mock implements the behavior the app code *wishes* the API had.

**Fix:** use `expo-crypto`'s `digest(CryptoDigestAlgorithm.SHA256, bytes)` with a `Uint8Array` decoded from the file (or the new `expo-file-system` `File` API), and hex-encode the result. Update the mock to mirror the real API so this class of bug can't hide again.

---

## Medium

### M1. SRS stage labels jump from apprentice to guru after a single review; lapsed items never drop back to apprentice
`mobile/src/core/srs/fsrsScheduler.ts:71-78` (`mapFsrsStateToStageLabel`)

```ts
if (card.state === State.New || card.state === State.Learning) return 'apprentice';
if (card.stability < 21) return 'guru';
```

- The import converter (`fsrsConverter.ts`) maps WaniKani stages 3–4 to `state: 'review'`, stability 2–3, label `apprentice`. After **one** review through the scheduler the item is `Review`-state with low stability, so the label becomes `guru` — despite the comment claiming boundaries "align with fsrsConverter.ts import stage semantics" (importer treats stability < 7 as apprentice territory).
- A lapsed item enters `State.Relearning`, which is neither `New` nor `Learning`, so it also falls through to `guru`/`master` by stability. Failed items should read as apprentice-like, not guru.

Consequences: the SRS breakdown on the Stats tab over-reports maturity, and cognitive load is under-counted (guru multiplier 0.7 vs apprentice 1.0 in `config/constants.ts`).

**Fix:** treat `State.Relearning` as apprentice, and add a low-stability apprentice band for `Review`-state cards (e.g. `stability < 7 → apprentice`) to match the import semantics.

### M2. A correct answer is silently lost if the session ends during the 800ms auto-advance window
`mobile/src/app/review/index.tsx:205-210`, `mobile/src/app/review/index.tsx:115-121`

On a correct answer the grade is only applied by a `setTimeout(..., REVIEW_CORRECT_AUTO_ADVANCE_MS)` that calls `gradeCurrentItem`. The unmount cleanup clears `autoAdvanceTimer`. If the user taps "End session" (or the screen unmounts for any reason) within those 800ms, the item shows "Correct!" but the FSRS state, weakness stats, streak-relevant progress, and cognitive load for that answer are never persisted. On the last item of a session this also means the session can end without that review counting.

**Fix:** grade synchronously on submit and use the timer only for UI advance, or flush the pending grade in `handleEndSession`/unmount.

### M3. Streak only advances when the entire queue is finished
`mobile/src/providers/ReviewSessionProvider.tsx:132-144`

`recordReviewAndUpdateStreak` runs only in the `isComplete` effect, and `isComplete` requires `currentIndex >= totalItems`. A user who reviews 90 of a 100-item queue (queue can be up to `QUEUE_FETCH_LIMIT = 100`) and exits via the exit sheet gets **no** streak credit for the day. Overdue-heavy days therefore punish legitimate streaks.

**Fix:** record the streak on the first graded item of a session (any review activity that day), not on queue completion.

### M4. Related-item boosts are consumed by merely *building* a queue, not by reviewing
`mobile/src/data/hooks/useReviewQueue.ts:229-236`

`clearBoosts` runs at the end of `buildQueue` for every boosted item that entered the queue. Opening the review screen and immediately backing out (or an error later in the session) permanently discards the reinforcement nudges earned from correct answers, so they never influence an actual review ordering the user sees.

**Fix:** clear a boost when its item is graded (or when the session is actually started), not at build time.

### M5. `updatedAt` doubles as FSRS `last_review`, skewing scheduling after non-review writes
`mobile/src/core/srs/fsrsScheduler.ts:41-51` (`toFsrsCard`)

`last_review` and `elapsed_days` are derived from `dbRow.updatedAt`, but `updated_at` is rewritten by non-review code paths — notably import overwrites (`importRepository.persistMappedImportItems` stamps import time) and any future admin writes. An item imported "as reviewed 20 days ago, due in 10" gets `elapsed_days = 0` at its next review, making FSRS under-estimate the real elapsed interval.

**Fix:** store an explicit `last_reviewed_at` column and only update it when grading.

### M6. Unbounded SQL `IN (...)` parameter lists in import and queue paths
`mobile/src/data/curriculum/externalIdMappingRepository.ts:19-26`, `mobile/src/data/user/itemStudyStatusRepository.ts:99-115` (`listStudyStatusesForItems`), `mobile/src/data/user/srsStateRepository.ts:109-131` (`getSrsStatesForItems`)

A WaniKani import passes **every** assignment's subject id (easily several thousand for a mid-level user) into a single `IN (...)` clause. `srsStateRepository.countStartedItemsByIds` chunks at 999 specifically to respect `SQLITE_MAX_VARIABLE_NUMBER`, but these three sibling functions don't. Recent SQLite builds raise the limit to 32,766 so this may currently work, but it's inconsistent, fragile against SQLite build flags, and one of these (external id mapping) sits directly on the import happy path.

**Fix:** extract a shared chunked-`IN` helper and use it everywhere.

### M7. Anki import: summary stage labels disagree with persisted FSRS state
`mobile/src/core/import/ankiMapper.ts:18-60` vs `mobile/src/core/import/fsrsConverter.ts:148-168`

Two near-duplicate stage-label functions have drifted:
- `ankiMapper.getAnkiStageLabel` says `burned` for `ivl >= 365` regardless of queue; `fsrsConverter.getAnkiSrsStageLabel` excludes suspended cards (`queue !== -1`). A suspended mature card shows "burned" in the import summary but is persisted as not burned.
- Master boundary differs: `ivl >= 30` (mapper) vs `ivl > 30` (converter) — an exactly-30-day card is "master" in the summary, "guru" in the DB.
- Mapper checks `type === 3` (relearning) **before** the learning-queue check; converter checks learning first — relearning-in-learning-queue cards get different labels.

**Fix:** delete one copy and share a single stage-label function.

### M8. Passage answer evaluation has no kana/width normalization
`mobile/src/core/answer/evaluatePassageAnswer.ts:6-29`

Passage answers are compared by exact string equality (ASCII-only case folding). Unlike the review path, there is no `wanakana.toHiragana` normalization and no full-width/half-width folding, so a user answering in katakana (or with an IME producing full-width latin) is marked incorrect for a correct answer.

**Fix:** normalize both sides with the same `normalizeKana`/trim pipeline used by `readingEvaluator`.

---

## Low

### L1. `computePriority` parameter naming invites a silent weight swap
`mobile/src/core/srs/weaknessEngine.ts:101-108`, call site `mobile/src/core/srs/queueBuilder.ts:99-100`

The constant `WEAKNESS_WEIGHT` (0.7) is actually the **FSRS** weight, and the call site passes `(…, WEAKNESS_BIAS_WEIGHT, WEAKNESS_WEIGHT)` into parameters named `(weaknessWeight, fsrsWeight)`. The math currently matches the spec (`0.7 × fsrs + 0.3 × weakness`), but the naming makes an accidental swap in a future edit very likely and hard to spot in review. Rename to `FSRS_PRIORITY_WEIGHT` / `WEAKNESS_PRIORITY_WEIGHT`.

### L2. `resolveReinforcement` re-ranks inside the sort comparator
`mobile/src/core/content/reinforcementResolver.ts:115-122`

The comparator does `relatedItems.find(...)` and recomputes `rankLink` for both sides on every comparison — O(n² log n) with map lookups, and duplicate related-item ids will always resolve to the first occurrence. Precompute ranks into a map before sorting.

### L3. First-launch bundled import never records install metadata if the seed DB has no version row
`mobile/src/data/database.ts:54-66`

If `curriculum_metadata.version` is missing, `setCurriculumInstallMetadata` is skipped, `curriculum_update_source` stays null, and the bundled asset is re-imported on **every** launch. Harmless with a valid seed, but a bad seed build turns into a persistent slow-start with no error surfaced.

### L4. `addDailyLoad` is a read-modify-write outside the statement
`mobile/src/data/user/cognitiveLoadRepository.ts:45-66`

The current load is read, incremented in JS, then upserted. Safe today (single JS thread), but `ON CONFLICT ... SET load = load + excluded.load`-style arithmetic in SQL would remove the lost-update hazard entirely.

### L5. ~~Dev grade buttons can double-grade with a pending auto-advance timer~~ — fixed (`DevGradeButtons` removed)
`mobile/src/app/review/index.tsx:372`, `mobile/src/app/review/index.tsx:208-210`

`__DEV__`-only: after a correct answer, pressing a `DevGradeButtons` grade during the 800ms window grades the current item, then the timer fires and grades the *next* item unseen. Clear `autoAdvanceTimer` inside `gradeCurrentItem` or the dev handler.

### L6. `INTERLEAVE_WEIGHTS` in config is typed `Record<string, number>`
`mobile/src/config/constants.ts:15`

Loses key exhaustiveness — a typo'd or missing item type wouldn't be a type error. The re-export in `queueBuilder.ts` is properly typed; the source constant should be `Record<ContentItemType, number>` too.

### L7. ~~Curriculum update error path can leak a database handle~~ — fixed (reopens only after a close for swap)
`mobile/src/data/curriculum/curriculumUpdate.ts:556-562`

When `downloadAndSwapCurriculum` fails *before* `curriculumDb.closeAsync()` (e.g. download failure), `checkAndApplyCurriculumUpdate` still calls `reopenCurriculumDatabase()` and hands back a **second** open handle while the original remains open in the provider. expo-sqlite tolerates multiple handles, but the old one is never closed.

### L8. WaniKani rate-limit reset heuristic can mis-wait
`mobile/src/data/import/wanikaniClient.ts:30-48`

`parseRateLimitReset` guesses epoch-vs-delta by comparing against current time. A skewed device clock (behind the server) makes an epoch value look like a delta near the boundary, producing a wildly long sleep. Consider capping the computed wait (e.g. 60s max).

### L9. Meaning typo threshold is measured against the *closest accepted answer's* length
`mobile/src/core/answer/meaningEvaluator.ts:71-86`

WaniKani-style tolerance is usually scaled by the answer being typed. Using the candidate length means a 3-char user answer compared against a 6-char candidate gets a 2-edit allowance; edge-case generosity/strictness asymmetries. Minor, but worth a deliberate decision + test.

### L10. Duplicate Anki notes with the same `sfld` silently overwrite each other
`mobile/src/core/import/ankiMapper.ts:106-124`, `mobile/src/data/user/importRepository.ts:48-73`

Two notes whose sort field maps to the same curriculum item both enter `mapped` (inflating `mappedCount`), and the later row overwrites the earlier SRS state via `ON CONFLICT`. Deduplicate by resolved `itemId`, keeping the most mature card.

---

## Cross-cutting observations

- **Mock fidelity** is the root enabler of H1: `mobile/__mocks__/expo-crypto.ts` implements different semantics than the real module. Worth an audit pass over the other mocks (`expo-file-system`, `expo-sqlite`) to confirm they match real API behavior, since the whole data layer is tested exclusively against them.
- **Duplicated per-repo helpers**: `parseItemId` is copy-pasted in 5+ repositories, and the Anki stage-label logic exists twice (M7). Consolidation would prevent future drift.
- **Timezone/date handling** (streaks, `todayKey`) is consistently local-time and looks correct, including the month-rollover in `yesterdayKey`.
