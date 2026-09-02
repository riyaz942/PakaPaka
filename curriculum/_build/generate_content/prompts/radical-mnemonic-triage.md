# Audit radical mnemonics — mark the ones that need a summary

You are auditing the radical mnemonics of a Japanese-learning app. Some were
written with long, clause-stacked sentences that a tired learner cannot skim.
Your job is to read every radical mnemonic and produce the list of slugs that
need a rewrite. You are **marking only** — do not rewrite anything.

## Files to read

- `curriculum/radicals/mnemonics/n5.json`
- `curriculum/radicals/mnemonics/n4.json`
- `curriculum/radicals/mnemonics/k.json`

Each is `{ "<slug>": { "mnemonic_text": ..., "description"?: ..., "_meta": ... } }`.
Judge only `mnemonic_text`. Never judge `description` — it is reference prose
for look-alike disambiguation, shown on demand, and follows different rules.

## What "keep" reads like

Reviewed exemplars — the maintainer's picks. Quote-level models of the target
register:

> Picture two chopsticks laid flat on the table, one resting just above the
> other, waiting for your meal. Two parallel lines, two chopsticks — that's
> <radical>two</radical>.

> Picture three thin pancakes stacked flat on a plate, one on top of another
> with a little gap between each — that's exactly the three horizontal lines of
> 三, so every time you see it, you're literally counting <radical>three</radical>.

> Look at that perfect little square — it's a wide-open mouth caught mid-yawn,
> the four straight strokes framing the gaping hole. That squared-off gap is
> exactly what it means: a <radical>mouth</radical>.

What makes them work:

- **One** concrete image, named early — not a parts list.
- Everyday words; nothing to look up.
- The shape observation is the punchline ("Two parallel lines, two chopsticks —
  that's two"), not a separate specification.
- The meaning lands directly ("that's two", "a mouth"), not after a wind-up.

Note that the pancake example runs ~27 words in one sentence. **Length alone is
not the problem.** One simple accumulating picture beats two short but
competing ones.

## What "mark" reads like

Reviewed rejects — the maintainer flagged all four of these:

> Picture a little pot: the short dash on top is the tiny knob you grab, and
> the wide horizontal stroke beneath it is the flat disc resting snugly over
> the rim. Together they snap down into place as the <radical>lid</radical>.

> Picture a single log that someone brought an axe down on: the two strokes
> are the halves falling apart, leaning away from each other where the blade
> split them clean down the middle. That fresh split is your marker for
> <radical>eight</radical>.

> That long vertical is a stair rail bolted down the left edge, and the two
> short slants poking out of it are the treads — shallow ones, barely a boot
> deep, worn shiny in the middle. The rail never swaps sides, so every climb
> starts with a <radical>step (left)</radical>.

> A hand has got hold of a loose flap at the top left, and you can see its
> fingers braced at the bottom right as it drags downward in one long, steady
> pull. What comes away in that pull, in a single unbroken sheet with nothing
> torn, is the hide: the <radical>skin</radical> taken off whole.

The failure modes, named for the `reason` field:

1. **stacked qualifiers** — a dash or comma tail piling on extra details
   ("shallow ones, barely a boot deep, worn shiny in the middle").
2. **diagram-caption narration** — positions and measurements instead of a
   picture ("at the top left", "at the bottom right", "down the left edge").
3. **two things per sentence** — "the short dash on top is X, and the wide
   horizontal stroke beneath it is Y".
4. **delayed resolution** — the meaning arrives after a wind-up ("What comes
   away in that pull … is the hide: the skin") or as "X is your marker for Y".
5. **justification clause** — abstract reasoning bolted onto the picture
   ("The rail never swaps sides, so every climb starts with …").

Mechanical signals, measured on the tag-stripped text (Japanese characters
never count as words):

- any single sentence over 25 words
- 3+ sentences averaging over 18 words
- over ~220 characters **and** more than one clause-heavy sentence

These are signals, not verdicts. The real test: could a tired learner replay
the picture after one skim, at 7am, in English as a second language? If you
have to re-read a sentence to assemble the image, mark it.

## Do NOT mark

- Items whose only fault is being plain. Plain is fine.
- Items you would merely have written differently. Different is not heavy.
- The scene itself is never the problem — a weird scene in plain sentences is
  a keep. You are judging the prose, not the imagery.

## Output

Write `curriculum/_build/reports/radical-simplify-list.json`:

```json
{
  "marked": [
    {
      "slug": "hitoyane",
      "dataset": "n5",
      "reason": "two stroke-specs per sentence; bolted-on resolution"
    }
  ],
  "kept": ["ichi", "ni"],
  "stats": { "total": 0, "marked": 0 }
}
```

- `dataset` is the sidecar file the slug lives in: `n5`, `n4`, or `k`.
- `reason`: under 12 words, naming the failure mode(s) from the list above —
  it feeds the rewrite step.
- Every slug from the three files appears exactly once, in `marked` or `kept`.
- `stats.total` must equal the actual slug count; `stats.marked` the length of
  `marked`.
- Finish by printing a one-line-per-dataset summary to the chat
  (`n5: 12/86 marked`, …) plus the full marked list with reasons.
