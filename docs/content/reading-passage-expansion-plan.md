# Reading passage expansion — N5 and N4 to 30 each

Status: **steps 1–2 of 4 done (2026-09-11).** `grammar_detect.py` is built and
calibrated; the seed ladder, `required_grammar` and the coverage invariant are
wired into the gate. Steps 3–4 — authoring the 60 seeds and generating — not
started, so **the N5 seed check is red on purpose**: 5 of 74 grammar points are
assigned and the humour mix is the retired set's 60%. Step 3 clears both.

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

**Built 2026-09-11.** `reading_seeds.grammar_coverage_errors` is the level-wide
check; `ladder_errors` is the per-seed one (cutoffs in range and rising,
`pull_forward` naming only words the cutoff has not reached, `required_grammar`
naming only points inside the seed's own `grammar_cutoff` and never a
`MANUAL_SLUG`, which no rule could confirm). Verified against a synthetic
complete N5 assignment: 74/74 reports clean, deleting one assignment reports
`grammar coverage is 73/74`, and assigning one point to two seeds reports the
duplicate. The real assignment is step 3's to author.

Enforcement runs from both ends: the level check says every point is assigned to
exactly one passage, and the passage gate (check 6) says a passage really
contains what it was assigned.

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

**Built 2026-09-11.** The shipped module runs **29 POS rules** — the 27
planned, plus two the calibration run forced out of the substring table:

| Rule | Why it could not stay text |
|---|---|
| `mae-ni` | 前に matched 駅**の前に**, a place, and stole that に from `ni-direction`. It is now the temporal 前に only after a 連体形 verb. |
| `ni-iku` | に来る matched 日本**に来**ました, a plain destination. It now needs a purpose in front — a 連用形 verb or a サ変可能 noun. |
| `demo-suggestion` | unidic splits でも into で + も, so there was never any でも to match. Now a two-token rule that also needs the sentence to make the offer (どうですか / ませんか / ましょう). |

Two mechanisms were needed that the design did not anticipate:

- **A dictionary-form pass.** `accepted_forms` spells a pattern by its citation
  form — てしまう, になる, と思う — but passages inflect it: 食べて**しまった**,
  上手に**なった**, と**思いました**. None of those contain the literal form, so
  the surface scan missed the pattern outright. The text is scanned twice: once
  as written, once with every inflecting word put back in dictionary form.
  Without this, N4 recall was 71.7%.
- **Selective lemmatisation.** Lemmatising everything is worse than
  lemmatising nothing: unidic reads the に of ようになる as the copula だ, the
  たら of あったら as た, and the く of 広くなった as 広い — so ようになる, たら
  and くなる all vanish. Only 動詞, 形状詞 and the two `れる`/`せる` auxiliary
  classes are put back; particles, other auxiliaries and the adverbial く keep
  their surface.

A third came out of step 2, when the gate started acting on detections rather
than only counting them: **sentence-initial でも is the conjunction "but"**, and
unidic splits it into 格助詞 で + 係助詞 も wherever it stands, so `de-location`
and `mo-also` both fired on it. Left alone it would have failed the gate's own
good fixture for two points the passage never uses. Both rules now subtract a
でも whose previous token ends a sentence; 公園でも遊びます still reads as both.

### 3. `grammar_slugs` becomes derived output

Once detection works, `grammar_slugs` joins `vocabulary_slugs`, `word_spans`,
`word_count` and `body_furigana` as pipeline-derived. The prompt loses a field,
the model loses the ability to misreport, and the gate gains a check it cannot
perform today: **out-of-level grammar the model used but did not declare.** That
hole is currently caught only by the human read.

**Built 2026-09-11.** `grammar_slugs` left the submit tool, the web skeleton and
the prompt; `validate_readings.enrich` derives it. `PROMPT_VERSION` → 2. Two
rules the design did not spell out:

- **An ambiguous surface is out of level only when every reading of it is.**
  ません is `masu` and `masen` at the same characters; blaming a passage for the
  reading it did not mean would reject on the detector's own uncertainty.
- **`MANUAL_SLUGS` never reject.** They are not in `matches` at all, so a point
  no rule can separate from another is not grounds for failing a passage — and,
  from the other side, cannot be assigned as `required_grammar`.

Pointed at the 10 retired N5 drafts, the new check immediately failed 3 of them
for grammar past their own window — `atarashii-kurasu` alone uses の, を, と,
ている and an い-adjective at a `grammar_cutoff` of 8. The old declared-slug
check passed all 10. That is the hole, measured.

### 4. Calibrate before trusting

The 10 reviewed N5 passages and 9 N4 ones are a labelled test set — a human
checked those `grammar_slugs`. The detector runs over all 19 before it gates
anything.

- Pass condition: **recall ≥95%** against the reviewed declarations.
- Expect the detector to also find grammar those passages never declared. Those
  are declaration bugs, found for free.

**Result 2026-09-11 — passes.** `--calibrate`:

| Level | Recall |
|---|---|
| N5 | 122 / 123 = **99.2%** |
| N4 | 45 / 46 = **97.8%** |
| overall | 167 / 169 = **98.8%** |

Both misses are the passage being wrong, not the detector:

- 赤い箱 declares `ka-question` and **contains no か at all.**
- 引っ越し declares `n4-teiru-result` for 片付い**ていません**, which the
  longest-form rule reads as `mada-teinai` — the pattern that sentence opens
  with まだ. The passage declared `mada-teinai` nowhere.

The declaration bugs the run found are larger than the misses: across the 19
passages the detector finds **37 of 74** N5 slugs where the declarations claim
34, and **24 of 97** N4 slugs where the declarations claim 20. Both sets are
being retired, so these are not worth fixing in place — they are evidence the
gate was needed.

A second command, `--selftest`, pins 32 individual discriminations (は inside
はじめて is not `wa-topic`; たい inside 冷たい is not `tai`; ても does not eat
the て of てもらいました; 学校から is `kara-from` but 寒いから is
`kara-because`). It needs no corpus and no API, so it is the cheap check to run
after any edit to the rules. Same role `validate_readings.py --fixtures` plays
for the gate.

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

**Built 2026-09-11.** `reading_context` reads `vocab_cutoff`, `pull_forward` and
`grammar_cutoff` off the seed; `position` now orders the level and derives
nothing. `READING_CORE_SLUGS` is deleted. The retired 10 seeds carry the numbers
the old `position/N` rule produced (`ceil(p/10 × 718)` and `ceil(p/10 × 74)`)
and the old flat list as `pull_forward`, trimmed per seed to what the cutoff has
not already reached — which is the graded release in miniature: 34 words pulled
forward at seed 1, 27 at seed 6, 16 at seed 7, one at seeds 8–9, none at seed 10.
One correction: `neko-to-shukudai` gets `grammar_cutoff` 23 rather than the
derived 15, because the passage uses `ni-indirect` (先生に出しません) and always
did — nothing read the body before.

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
1. grammar_detect.py + 27 POS rules                                   ✅ DONE
   → verify: ≥95% recall against the 19 reviewed passages' declared slugs;
     report every extra slug found as a declaration bug
     — 98.8% overall (N5 99.2%, N4 97.8%); 29 rules shipped, not 27

2. Seed schema: explicit cutoffs, required_grammar, coverage check      ✅ DONE
   → verify: N5 assignment covers 74/74 and N4 97/97;
     build fails when one assignment is deleted
     — the check is built and proven on a synthetic complete N5 assignment
       (74/74 clean; 73/74 on a deletion; duplicate reported). The real
       assignment is authored in steps 3–4, so the live number is 5/74 and the
       N5 seed check is red until then. N4 has no seeds at all yet.
     — also: gate check 6 rewritten onto detection, `grammar_slugs` derived,
       2 new fixtures (11 total), detector fix for sentence-initial でも

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
| `curriculum/_build/generate_content/grammar_detect.py` | **Done.** Tokenizer-backed detection. `--selftest` (32 pinned discriminations, no corpus) and `--calibrate` (recall over the 19 shipped passages). |
| `curriculum/_build/generate_content/reading_seeds.py` | **Schema done**, seeds are steps 3–4: `vocab_cutoff` / `grammar_cutoff` / `pull_forward` / `required_grammar` on every seed, `ladder_errors` + `grammar_coverage_errors`, `TONE_MIX_BOUNDS` → `(0.75, 0.85)`. |
| `curriculum/_build/generate_content/reading_context.py` | **Done.** Cutoffs read from the seed instead of `position/N`; `READING_CORE_SLUGS` deleted in favour of per-seed `pull_forward`. |
| `curriculum/_build/generate_content/validate_readings.py` | **Done.** Check 6 is `_grammar_errors` over detected grammar (out-of-level + required-but-absent); `grammar_slugs` enrichment; `untaught-grammar-slug` fixture replaced by `out-of-level-grammar` + `missing-required-grammar`. |
| `curriculum/_build/generate_content/generate_readings.py` | **Done.** `grammar_slugs` out of the submit tool and the web skeleton; required-grammar brief in; `PROMPT_VERSION` → 2. |
| `curriculum/_build/generate_content/prompts/reading-passage.md` | **Done.** Drops the `grammar_slugs` field; adds the required-grammar brief. |
| `curriculum/_build/n5_readings.py`, `n4_readings.py` | Regenerated sets. |
| `curriculum/readings/n5.json`, `n4.json` | 30 passages each. |
