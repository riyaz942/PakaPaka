# Plan 09 — Curriculum cloze variants & grammar families

**Priority:** P2 content/schema — long pole. Source: brainstorm Theme 1 content items + Action P3. Product contract is ready (Plans 07–08); this plan makes reviews rotate and distractors honest.

---

## Current behaviour

Grammar items in JSON look like (`curriculum/grammar/n5.json` / schema `grammarItem`):

- `primary_form`, `meaning`, `structure`, `conjugation_rules`, `accepted_forms`
- `example_sentences[]` with `japanese`, `english`, `furigana`, `vocabulary_slugs`
- **No** cloze markup, **no** nudge, **no** grammar family tag

Compile path (`scripts/compile-curriculum.ts`) writes `grammar_rules` + `example_sentences` tables. Review never selects a random sentence as the prompt (Plan 07 may derive one interim cloze from these sentences).

There are ~74 N5 grammar items — authoring **5 variants × N items** is the content bottleneck. Seed early particles first.

---

## Locked content model

Per brainstorm schema sketch:

```ts
type GrammarClozeVariant = {
  jpCloze: string;      // e.g. "私＿学生です。"  (blank = variable only)
  english: string;      // full sentence EN — hint rung 2, not on-card by default
  answer: string;       // chunk expected, must be in / align with accepted_forms
  nudge: string;        // short JP/EN pedagogical poke — hint rung 1
};

type GrammarItemExtensions = {
  family: GrammarFamily; // see below
  variants: GrammarClozeVariant[]; // target 5; min 1 for compile
};
```

### Five grammar families (from session)

Use these as the distractor namespaces (exact enum names can be snake_case in JSON):

1. **particles** — は, が, を, に, で, も, …
2. **copula / predication** — です, だ, じゃない, …
3. **conjugations** — て-form, ない-form, dictionary ↔ polite, …
4. **connectors / clause** — から, けど, ので, …
5. **patterns / set phrases** — ～たい, ～ている, ～ましょう, …

Every grammar point gets exactly one `family`. MC distractors (Plan 08) draw from other points **in the same family** first.

---

## Changes

### 9.1 — Schema

Update `curriculum/schema/curriculum.schema.json` `$defs.grammarItem`:

- Add required (or strongly recommended) `family` enum.
- Add `cloze_variants` array (name TBD; prefer `cloze_variants` in JSON for clarity):
  - `jp_cloze` (required)
  - `english` (required)
  - `answer` (required)
  - `nudge` (required for new content; allow empty string only during migration)
- Keep existing `example_sentences` for Learn/detail UI; cloze variants are **review-specific** and may overlap sentences but are not the same table conceptually.
- Validation rules:
  - `answer` must appear as blank replacement consistency: replacing `＿`/`___` in `jp_cloze` with `answer` yields a well-formed sentence (optional automated check).
  - `answer` ∈ `accepted_forms` or normalized-equal after kana NFKC.
  - `cloze_variants.length` ≥ 1 (target 5; enforce ≥ 5 later via content lint, not hard schema min if it blocks compile during rollout).

### 9.2 — Compile pipeline

- Extend `grammar_rules` **or** add `grammar_cloze_variants` table:

```sql
CREATE TABLE grammar_cloze_variants (
  id INTEGER PRIMARY KEY NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  jp_cloze TEXT NOT NULL,
  english TEXT NOT NULL,
  answer TEXT NOT NULL,
  nudge TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

- Store `family` on `grammar_rules` (new column) or `items` metadata.
- Update `scripts/curriculum-schema.ts`, `compile-curriculum.ts`, validate-schema fixtures.
- Recompile `mobile/assets/curriculum-seed/curriculum.db` (Git LFS).

### 9.3 — Review queue picks a random variant

In `useReviewQueue` / mapping:

1. Load all variants for the grammar item.
2. Pick uniformly at random (session-stable optional: hash `itemId + reps` so retries in Plan 02 re-queue see the **same** variant within a session — product choice; default = random per presentation is fine for v1).
3. Populate cloze prompt, answer chunk, nudge, english for hints.
4. Pass `family` into distractor picker (Plan 08).

### 9.4 — Content seeding order

**Wave A (unblock playtest):** early particles + です-adjacent — at least 5 variants each:

- `wa-topic`, `ga-subject`, `o-object`, `mo-also`, and the primary copula point in N5

Reuse/adapt existing `example_sentences` into cloze form (blank the particle/copula). Write nudges like: "Marks the topic — what's being talked about."

**Wave B:** remaining N5 particles and high-frequency conjugations.

**Wave C:** rest of N5, then N4+.

Track authorship in a simple checklist under this plan or `docs/` content notes — do not invent a new CMS.

### 9.5 — Migration from interim Plan 07 derivation

Once Wave A is compiled:

- Prefer authored `cloze_variants`.
- Fall back to Plan 07 sentence derivation only when variants array is empty (dev/old DB).
- Remove fallback after all shipping JLPT bands used in-app have ≥1 variant.

---

## Acceptance criteria

- [x] Schema validates `family` + `cloze_variants` shape.
- [x] Compile writes variants into SQLite; app reads them for reviews.
- [x] Same grammar point shows different sentences across reviews (with ≥2 variants seeded).
- [x] Wave A particles never fall back to bare `primaryForm` prompts.
- [x] Distractor picker can query "other items with same family".
- [x] `npm run validate-schema` and `npm run compile-curriculum` pass.
- [x] Fixture grammar under `scripts/__fixtures__/` updated.
- [x] Wave C — N5 and N4 both complete (2026-09-21). See below.

## Wave C outcome (2026-09-21)

N5 (74 points / 372 variants) landed 2026-07-28. N4 (97 points / 512 variants)
landed 2026-09-21 and closes this plan for every band that ships grammar — N3+
is vocabulary-only.

N4 did not need the authoring push this plan budgeted for. The grammar-lesson
lane had been writing cloze candidates to
`generate_content/drafts/<level>/<slug>-cloze-candidates.json` all along, and
`assemble.py` deliberately parks them there rather than shipping them — 523
candidates existed for all 97 points before this pass started. What was missing
was the promotion step between the drafts and `_build/n4_grammar.py`, which is
the shipped source (`curriculum/grammar/n4.json` is generated from it):

- **`generate_content/promote_cloze.py`** (new) puts every candidate through
  `check_cloze`'s gate and writes only survivors, so promotion can never lower
  the shipped bar. 461 of 523 passed untouched.
- **10 points were hand-repaired** in `n4_grammar.py`, all one bug: the drafted
  blank swallowed the conjugated stem, so `answer` was not in `accepted_forms`
  and the evaluator would have marked a correct learner **wrong** (`降ったら`
  where the point is `たら`; `おく` where it is `ておく`). Each carries a comment
  saying why it is hand-written, and `promote_cloze` skips points that already
  have variants, so the two paths compose.
- **`family`** was added to all 97 points (conjugations 18, copula 12,
  connectors 18, particles 21, patterns 28). N4 previously had none and its MC
  distractors fell back to the interim N5 particle pool.

Two points' `accepted_forms` shape the content rather than the reverse, and are
worth revisiting as content questions, not bugs: `n4-potential` cannot spell the
godan potentials `話せる` / `泳げる` with `[れる, られる, える]`, and
`n4-node-vs-kara` lists only `から`, so its ので contrast sentences are
ungradeable as cloze.

### Furigana

`generate.py` now derives `jp_cloze_furigana` for every variant rather than
leaving it to authors: it fills the blank, annotates the whole sentence so the
tokenizer reads `帰った` correctly, then cuts the answer's annotated span back
out, and emits nothing when that round trip is not exact. 883 of 884 variants
get furigana; the misses are `→`-notation drills, where the app falls back to
the plain prompt.

## Files touched (expected)

- `curriculum/schema/curriculum.schema.json`
- `curriculum/grammar/n5.json` (Wave A+)
- `scripts/curriculum-schema.ts`
- `scripts/compile-curriculum.ts`
- `scripts/validate-schema.ts` (optional cloze consistency checks)
- `mobile/src/data/curriculum/itemRepository.ts` — `getGrammarClozeVariants`, family
- `mobile/src/data/hooks/useReviewQueue.ts`
- `mobile/assets/curriculum-seed/curriculum.db` (LFS)

## Depends on / unlocks

- **Depends on:** Plan 07 contract (what a variant *is*).
- **Feeds:** Plan 08 distractors; Plan 10 nudge/EN content.
- **Can parallelize:** Schema + Wave A authoring while Plan 08 builds MC UI against interim pools.

## Out of scope

- Full EN→JP production cards
- Image assets for grammar
- MaruMori-depth `explanation_markdown` (separate content-quality pipeline)
