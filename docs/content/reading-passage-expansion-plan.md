# Reading passage expansion — N5 and N4 to 30 each

Status: **planned, not started (2026-09-11).** No code or content written yet.

Grows the reading corpus from 19 passages to 60, makes **100% grammar coverage
per level a build invariant**, and replaces the model's self-declared
`grammar_slugs` with a derived, tokenizer-backed detection.

Successor to [phase-4-reading-passage-tooling.md](./phase-4-reading-passage-tooling.md),
which built the N5 lane and shipped its 10 passages. That runbook still
describes the tooling; this plan describes what changes and why.

## Scope

| Level | Passages today | Target | Note |
|---|---|---|---|
| N5 | 10 (generated, reviewed) | **30** | All 30 regenerated. The 10 existing are retired; their reviewed topics are reused as seed briefs. |
| N4 | 9 (hand-authored) | **30** | Retired and replaced, as the N5 hand-authored set already was. |
| N3 / N2 / N1 | 0 | deferred | Out of scope. See § Why N3+ is deferred. |

Counts come from one passage per ~25 new vocabulary items, which is about three
passages a week at ~15 new items a day. N4 is the smallest level in the app (529
words against N5's 718), so it gets the same count as N5 and grows by **length**
instead:

| Level | Words per passage |
|---|---|
| N5 | 35 → 110 across the 30 |
| N4 | 100 → 200 across the 30 |

## Settled decisions

- **N5 regenerates in full.** The existing 10 were written against a 10-step
  ladder; their windows and grammar assignments do not survive a move to 30.
- **N4's 9 hand-authored passages are retired.** They carry no `word_count`, no
  seeds, and an earnest tone that the humour target rules out.
- **Humour rises to 80%, not 100%.** `TONE_MIX_BOUNDS` goes from `(0.50, 0.60)`
  to `(0.75, 0.85)`. Some subjects fight comedy, and 30 gags in a row at one
  level flattens out. The other 20% stays light and warm, just not built around
  a joke.
- **Vocabulary coverage is not a goal.** The SRS delivers vocabulary; readings
  consolidate it. For reference, the 10 shipped N5 passages touch 145 of 718
  words (20%) and 34 of 74 grammar points (46%).
- **Grammar coverage is 100%, enforced.** Every grammar point in the level
  appears in at least one passage. This is the substance of the plan.

## Grammar coverage — the design

Four parts. Each reuses what the pipeline already has.

### 1. Grammar is assigned to passages, not left to chance

A seed today says what a passage *may* use. It gains what it **must** use:

- `required_grammar` — the grammar slugs first available at this seed's step.
  Across 30 N5 seeds that is 74 slugs at 2–3 per passage; across 30 N4 seeds,
  97 slugs at 3–4.
- A level-wide check in `validate_readings.py` fails the build when any slug of
  the level is unassigned, or assigned to two seeds.

Full grammar coverage stops being a target and becomes an invariant. Remove one
assignment and the build breaks.

### 2. Grammar is detected in the text, not taken on the model's word

This is the real gap. `reading_context.py` states it in its own docstring: the
gate checks the passage's **declared** `grammar_slugs` and nothing more, because
there is no extraction of "the grammar this text uses" from a tokenizer. The
model writes that list, so `required_grammar` would be unenforceable as things
stand.

New module `curriculum/_build/generate_content/grammar_detect.py`:

- Tokenizes with the existing fugashi/unidic tagger — the same one `furigana.py`
  and `level_check.py` share. One tokenizer, not three.
- Matches `accepted_forms`, which **every grammar item already carries and which
  is already human-reviewed**: `desu` → です/だ/でした/ではありません, `te-iru`
  → ている/てる/ています.
- **Longest form wins.** ではありません is `dewa-arimasen` and not also `desu`;
  ています is `te-iru` and not bare `masu`.
- **One-character forms get a part-of-speech rule, never a substring match.**
  N5 has 24 such slugs (は が を の に で と も か ね よ, the `te-form` /
  `ta-form` / adjective-conjugation classes, `toki`, `goro`); N4 has 3
  (`n4-ba`, `n4-aida`, `n4-to-conditional`). は counts only as 係助詞;
  `no-possessive` only when the next token is a noun; `no-nominalizer` only
  after a plain verb form.
- Anything no rule can decide is reported as `manual`. It is never passed
  silently.

Authoring work is **27 POS rules** (24 N5 + 3 N4). The other 144 of the 171
slugs are longest-match over data that already exists.

### 3. `grammar_slugs` becomes derived output

Once detection works, `grammar_slugs` joins `vocabulary_slugs`, `word_spans`,
`word_count` and `body_furigana` as pipeline-derived. The prompt loses a field,
the model loses the ability to misreport, and the gate gains a check it cannot
perform today: **out-of-level grammar the model used but did not declare.** That
hole is currently caught only by the human read.

### 4. Calibrate before trusting

The 10 reviewed N5 passages and 9 N4 ones are a labelled test set — a human
checked those `grammar_slugs`. The detector runs over all 19 before it gates
anything.

- Pass condition: **recall ≥95%** against the reviewed declarations.
- Expect the detector to also find grammar those passages never declared. Those
  are declaration bugs, found for free.

## The positional window breaks at 30 seeds — resolved, option (a)

**Decided 2026-09-11: option (a), an authored ladder.** Recorded here with the
evidence because the fix is not obvious from the code.

`reading_context.py` gives seed *i* of *N* the first `ceil(i/N × V)` vocabulary
items by `sort_order`. At 30 seeds, N5 passage 1 gets the first 24 words:

> 私 私たち 僕 あなた 君 彼 これ それ あれ どれ この その あの どの ここ そこ
> あそこ どこ こちら そちら あちら どちら こんな そんな

All pronouns and demonstratives. Worse, and independent of seed count:

- **The first N5 verb (行く) is word 377 of 718.** All 138 N5 verbs sit at 377+.
- The first い/な adjective is word 66; words 1–100 are pronouns, numerals and
  time nouns.

So a prefix window supplies **no verb at all until past the halfway point of the
level**. `READING_CORE_SLUGS` already papers over this with a flat always-allowed
list of ~35 words, its verb section included. At 10 seeds that patch was a
supplement; at 30 seeds it becomes the entire vocabulary of the first half of the
level, which hollows out the level gate exactly as that module's docstring warns.

### The fix — an authored ladder

Each seed declares its own window instead of deriving it from `position/N`:

```python
{
    "slug": "tama-to-shukudai",
    "vocab_cutoff": 180,                                 # N5 words 1-180
    "pull_forward": ["iku", "taberu", "miru", "kaku"],   # plus these later words
    "grammar_cutoff": 12,
    "required_grammar": ["masu", "masen", "wo"],
    ...
}
```

`vocab_cutoff` replaces the proportional slice. `pull_forward` replaces the flat
`READING_CORE_SLUGS` list with a **graded release**: early seeds pull forward
three or four verbs, later seeds more, and past roughly seed 20 the cutoff has
reached word 377 on its own and nothing needs pulling. `READING_CORE_SLUGS` is
deleted.

The ladder is **authored once, checked in, and read by the generator** — the same
status the topic briefs and tone tags already have. It is not chosen while the
model writes. Three reasons:

1. **A model-chosen window makes the gate vacuous.** Every word it used would be
   allowed by definition.
2. **Regeneration must reproduce.** `reading_context.py`: *"Deliberately
   planner-free and deterministic: the same seed list yields the same allowed
   sets on every machine."*
3. **Grammar coverage needs all 30 planned together.** Each slug is assigned to
   exactly one passage, which cannot be guaranteed one passage at a time.

Drafted by script (verbs ranked on storytelling usefulness), then read through
and corrected by hand before check-in.

**Cost accepted:** the first passages unlock later than their number suggests —
passage 3 may need a learner at ~30% of N5 rather than ~10%. The learner is
protected either way, because `computePassageUnlock` already withholds a passage
until 90% of its linked items are Guru+.

### Options not taken

| Option | Why not |
|---|---|
| **A separate reading order** — a checked-in permutation of the level used only by this lane | Two orderings to keep in step, and it breaks the premise that the window is what the learner has actually met. |
| **Reorder N5 vocabulary itself** | `sort_order` drives lesson delivery (`lessonPlanner.ts` sorts available items by it), so this changes the experience for every learner. Out of scope. |

Worth recording separately: that a learner is 52% through N5's vocabulary before
meeting a single verb is a **curriculum-ordering question in its own right**, not
only a reading problem. It is not addressed here.

## Work plan

```
1. grammar_detect.py + 27 POS rules
   → verify: ≥95% recall against the 19 reviewed passages' declared slugs;
     report every extra slug found as a declaration bug

2. Seed schema: explicit cutoffs, required_grammar, coverage check
   → verify: N5 assignment covers 74/74 and N4 97/97;
     build fails when one assignment is deleted

3. Author the N5 ladder (cutoffs + pull_forward) and 30 N5 seeds; generate
   → verify: every seed's window contains at least 5 verbs and 5 adjectives;
     generate.py --level n5 + validate-schema + compile-curriculum clean;
     all 74 N5 grammar slugs detected across the 30 bodies

4. N4 — author 30 seeds, retire the 9 hand-authored
   → verify: same, 97/97
```

Steps 1 and 2 are roughly two sessions before a single passage is written. That
is the price of a gate strong enough to skim behind.

## Consequences

- **`grammar_slugs` changes on the 19 existing passages** if any survive, because
  the field becomes derived. `linkedCount` in `computePassageUnlock` rises
  slightly, so unlock gets marginally stricter — and more truthful. Both sets are
  being retired anyway, so this only matters if step 4 slips.
- **Unlock logic needs no change.** `computePassageUnlock` (90% Guru+ over linked
  vocabulary and grammar) works unaltered at any passage count. More passages
  means a steadier drip, not a different rule.
- **Kanji windows are not added.** A vocabulary window already fixes which kanji
  appear, and a vocabulary item at Guru implies its kanji were learned. Linking
  kanji into the unlock gate would raise the bar with no new information.
- **Maintainer review is ~15 hours for 60 passages** if every one is read. The
  intended split is a deep read of the first 5 per level — where the windows are
  tightest and failures cluster — and a skim of the rest. What the human still
  catches after the gate is tone, humour, and whether the story holds together.

## Why N3+ is deferred

- **N3, N2 and N1 have no grammar files at all** (`curriculum/grammar/` holds
  only `n5.json` and `n4.json`). Roughly 630 grammar points must be authored
  before one N3+ passage can be generated under this design.
- Their vocabulary exists (2250 / 2250 / 4000) but ships without mnemonics.

At the cadence used here those levels would want about 70 / 95 / 150 passages.
Not scheduled.

## Files this touches

| File | Change |
|---|---|
| `curriculum/_build/generate_content/grammar_detect.py` | New. Tokenizer-backed detection. |
| `curriculum/_build/generate_content/reading_seeds.py` | 30 N5 + 30 N4 seeds; `vocab_cutoff` / `grammar_cutoff` / `pull_forward` / `required_grammar`; `TONE_MIX_BOUNDS` → `(0.75, 0.85)`. |
| `curriculum/_build/generate_content/reading_context.py` | Cutoffs read from the seed instead of `position/N`; `READING_CORE_SLUGS` deleted in favour of per-seed `pull_forward`. |
| `curriculum/_build/generate_content/validate_readings.py` | `grammar_errors`; level-wide coverage check; `grammar_slugs` enrichment. |
| `curriculum/_build/generate_content/prompts/reading-passage.md` | Drops the `grammar_slugs` field; adds the required-grammar brief. |
| `curriculum/_build/n5_readings.py`, `n4_readings.py` | Regenerated sets. |
| `curriculum/readings/n5.json`, `n4.json` | 30 passages each. |
