# Reading mnemonics that continue the meaning story

**Date:** 2026-10-17
**Status:** Spec approved in brainstorm; plan not written

---

## 1. Problem and intent

Many kanji and vocabulary reading mnemonics start a new scene that has no connection to the item's meaning mnemonic. The learner then has two unrelated images and nothing that joins the sound to the meaning.

Examples from the app:

| Item | Meaning scene | Reading scene | Verdict |
|------|---------------|---------------|---------|
| 研 polish | drag a sword across a stone on a bench | Ken the dog *polishes* every sword before it goes back on the wall | **Best**: continues the sword, names and tags the meaning, short |
| 品 goods | mouths shout prices for crates of goods | inspector Hin stamps the stacked crates | Good: continues the crates |
| 究 research | a hook lowered in a dark cave | a queue forms at the cave mouth | Good: continues the cave |
| 幸 happiness | a stalk sprouts from your own earth | Koichi sells charms over a shop intercom | **Bad**: new scene, no link |
| 特 special | the temple cow that is never eaten | a konbini intercom says onigiri "took" first place | **Bad**: new scene, no link |

**Success:**
1. Future generation writes reading mnemonics that continue the meaning scene.
2. Stored N5 + N4 items whose reading scene does not connect get a new reading mnemonic. Items that already connect stay unchanged.

**Constraints:** no mass regeneration of reviewed prose; `meaning_mnemonic` and `description` stay byte-identical; `PROMPT_VERSION` does not change (a bump makes `cmd_run` regenerate every stored draft).

---

## 2. Decisions (locked in brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| D1 | What counts as "connected" | The reading scene continues the meaning scene (same object, place or action). A connected reading that does not name the meaning word (品, 究) is **kept**. |
| D2 | Kinds | Kanji and vocabulary |
| D3 | Vocabulary branches | Only the **full-story** reading branch. Words with no reading mnemonic (derivable reading) and words with a one-sentence "already taught by an earlier word" pointer are skipped |
| D4 | Levels | N5 + N4 only. The 50 `flagged_for_rewrite` kanji are all N3+ and are out |
| D5 | Lane | Single-session workflow is the main lane; the subagent lane gets the same steps |
| D6 | Status after rewrite | `draft`; the maintainer reviews in Studio |

**Current numbers (2026-10-17):**

| | N5 + N4 items in scope | Note |
|---|---|---|
| Kanji | 325 (all `reviewed`) | 118 already tag the meaning in the reading, 207 do not |
| Vocabulary | 412 full-story readings (all `reviewed`) | of 502 with a reading mnemonic; 90 are pointers and skipped |

---

## 3. Prompt change (future generation)

**Files:** `curriculum/_build/generate_content/prompts/kanji-mnemonic.md`, `prompts/vocab-mnemonic.md`.

### Kanji prompt

In "The reading mnemonic: the sound and the meaning in one joke", replace the soft line "Tie the scene to the meaning mnemonic where you can" with a hard rule:

- The reading mnemonic **continues the meaning mnemonic's scene**: same object, place or action.
- The reading's fixed cast character enters that scene. Do not give the cast character a scene of its own.
- The meaning word stays tagged `<kanji form="…">` (unchanged rule).
- Length stays one sentence or two short ones, 90–200 characters (unchanged).
- Add 研 polish as the first **Right** example. Add 幸 happiness and 特 special as **Wrong** examples: the sound and the cast are correct, but the scene is unrelated to the meaning story.
- Add a self-check: "Cover the meaning mnemonic. Does the reading still point back to it? If not, it is not finished."

### Vocabulary prompt

Same rule, in the **full-story** branch of `reading_mnemonic` only: the reading continues the scene of the meaning mnemonic written in the same output. The pointer branch and the no-reading branch do not change.

### Not changed

- `PROMPT_VERSION` in `generate_mnemonics.py`.
- `validate_mnemonics.py`. "Same scene" is a judgment; no mechanical gate is added.

---

## 4. Fix workflow (stored N5 + N4 items)

Mirrors the existing `kanji-mnemonic-triage.md` → `kanji-mnemonic-simplify.md` pair.

**New prompt files** (in `curriculum/_build/generate_content/prompts/`):
- `reading-link-triage.md` — marks only, changes no prose.
- `reading-link-rewrite.md` — rewrites `reading_mnemonic` for marked items.

Both cover kanji and vocabulary in one pass.

### Step 1 — Select (mechanical)

A snippet in `reading-link-triage.md`, run from the repo root, writes `curriculum/_build/reports/reading-link-candidates.json`:

- Kanji: slugs in `kanji/n5.json` + `kanji/n4.json` with a non-empty `reading_mnemonic` and `review_status: reviewed`.
- Vocabulary: slugs in `vocabulary/n5.json` + `vocabulary/n4.json` with a non-empty `reading_mnemonic` and no `reading_taught_by` (from `mnemonic_context.vocab_context`).

Each candidate carries: kind, slug, level, character/form, taught meaning, primary reading, cast character for that reading, the stored `meaning_mnemonic` and `reading_mnemonic`.

### Step 2 — Triage (judgment)

For each candidate the agent answers one question: **does the reading scene continue the meaning scene?** Rules from D1. Naming the meaning word is not required to pass.

Output `curriculum/_build/reports/reading-link-list.json`:

```json
{
  "marked": [
    { "kind": "kanji", "slug": "happiness", "reason": "shop intercom scene; meaning scene is a sprouting stalk" }
  ],
  "kept": [ { "kind": "kanji", "slug": "polish" } ],
  "stats": { "total": 737, "marked": 1, "kept": 736 }
}
```

- Every candidate appears exactly once, in `marked` or `kept`.
- `reason` is 12 words or fewer and names both scenes.
- **Stop.** The maintainer reviews the list and may move items between `marked` and `kept`.

### Step 3 — Rewrite (marked items only)

For each marked item the agent writes a new `reading_mnemonic` that obeys §3:

- continues the meaning scene;
- uses the fixed cast character for the reading;
- contains the reading kana verbatim in `<reading>`, and the English sound hook in `<reading>`;
- tags the meaning: `<kanji form="…">` for kanji, `<vocabulary form="…">` for vocabulary;
- one sentence or two short ones.

The agent writes into `curriculum/kanji/mnemonics.json` / `curriculum/vocabulary/mnemonics.json`:
- only `reading_mnemonic` changes;
- `_meta.review_status` → `draft`;
- `_meta.prompt_version` unchanged.

### Step 4 — Gate and build

- Each rewritten item must pass `validate_draft` with the **fresh-draft** rules (`enforce_readability=True`: tighter length band, required meaning tag, reading kana present).
- On failure: repair with the gate errors, at most 2 attempts. Still failing → reported to the maintainer and not written.
- Then `generate.py`, `npm run validate-schema`, `npm run compile-curriculum`.
- The maintainer reviews the new drafts in Studio.

### Lanes

- `docs/workflows/radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md` — new "Reading-link fix" section with Steps 1–4. Main lane.
- `docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md` — short section: same steps, triage and rewrite in groups of ≤4.
- `docs/working-history.md` — add the plan row and keep its status current.

---

## 5. Verification

1. **Triage calibration.** Run triage on the five example items first. Expected: kept 品 goods, 研 polish, 究 research; marked 幸 happiness, 特 special. If not, fix the triage prompt and rerun before the full 737.
2. **Rewrite pilot.** Rewrite 幸 and 特 first. The maintainer approves both before the rest of the marked list runs.
3. **Prompt check.** Generate fresh drafts for 2–3 N3 kanji with the updated `kanji-mnemonic.md`; do not save them. They pass the gate and their reading continues the meaning scene.
4. **No collateral change.** A script compares every `meaning_mnemonic` and `description` with `HEAD` — zero diffs. Unmarked items are byte-identical.
5. **Build.** `generate.py`, `validate-schema`, `compile-curriculum` clean.

No app code changes, so no Jest tests.

---

## 6. Out of scope

- N3, N2, N1 kanji (including the 50 `flagged_for_rewrite`).
- Rewriting connected readings that do not name the meaning word (D1).
- Vocabulary pointer readings and words with no reading mnemonic.
- Radicals (they have no reading mnemonic).
- A mechanical "same scene" gate.
