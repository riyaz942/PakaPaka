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

- [ ] Schema validates `family` + `cloze_variants` shape.
- [ ] Compile writes variants into SQLite; app reads them for reviews.
- [ ] Same grammar point shows different sentences across reviews (with ≥2 variants seeded).
- [ ] Wave A particles never fall back to bare `primaryForm` prompts.
- [ ] Distractor picker can query "other items with same family".
- [ ] `npm run validate-schema` and `npm run compile-curriculum` pass.
- [ ] Fixture grammar under `scripts/__fixtures__/` updated.

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
