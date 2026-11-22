# Audit kanji mnemonics — mark the ones that need a summary or a chain fix

You are auditing the kanji mnemonics of a Japanese-learning app. Three
problems exist. Some were written with long, clause-stacked sentences that a
tired learner cannot skim. Some meaning mnemonics never highlight the radicals
the story is built from — the taught component's word is missing from the text
or present but not wrapped in a `<radical>` tag, so the app cannot colour the
borrowed pieces. And some meaning mnemonics never distinguish the kanji's
**own** meaning — the word the story lands on — from a borrowed component: the
landing word is left bare, or wrapped in `<radical>` the same as a component,
so the app renders "a piece I already know" and "the thing this story is
building toward" in the same colour. The landing word gets its own `<kanji>`
tag instead. Your job is to read every kanji mnemonic and produce the list of
slugs that need work. You are **marking only** — do not rewrite anything.

## File to read

- `curriculum/kanji/mnemonics.json` (every level)

It is `{ "<slug>": { "meaning_mnemonic": ..., "reading_mnemonic": ...,
"description"?: ..., "_meta": ... } }`. Judge only `meaning_mnemonic` and
`reading_mnemonic`. Never judge `description` — it is reference prose for
look-alike disambiguation, shown on demand, and follows different rules.

## Step 1 — the chain check is mechanical; run it first

A kanji's meaning story must name every taught component radical by its taught
meaning word and wrap that word in `<radical>…</radical>` — the highlight is
what lets the learner see which words came from below. It must also name the
kanji's **own** meaning — the word the story lands on — and wrap that word in
`<kanji>…</kanji>` instead, so the app renders it in a different colour from a
borrowed component. The reading mnemonic must contain the kanji's primary
reading verbatim inside `<reading>…</reading>`. All of this is exact string
work, so do not eyeball it across 395 items. From the repo root, run:

```python
import json
import sys

sys.path.insert(0, "curriculum/_build")

from generate_content import mnemonic_context as mc
from generate_content.validate_mnemonics import (
    _hira, _meaning_words, _references, _strip_tags, _tagged_spans)

# The sidecar holds every level; kanji/items.json holds every kanji.
known = {it["slug"] for it in mc.load_items("kanji")}

report = {}
with open("curriculum/kanji/mnemonics.json", encoding="utf-8") as f:
    sidecar = json.load(f)
for slug, entry in sidecar.items():
    if slug not in known:
        report[slug] = {
            "components": [], "landing": "unresolved", "landing_meaning": None,
            "reading": "unresolved", "primary_reading": None}
        continue
    ctx = mc.kanji_context(slug)
    text = entry["meaning_mnemonic"]
    plain = _strip_tags(text, "radical")
    spans = _tagged_spans(text, "radical")
    comps = []
    for c in ctx["components"]:
        words = _meaning_words(c["meaning_synonyms"])
        if not words:
            continue
        if not _references(plain, words):
            status = "missing"    # the story never uses the taught word
        elif not any(_references(span, words) for span in spans):
            status = "untagged"   # the word is there but not highlighted
        else:
            continue
        comps.append({"form": c["form"], "meaning": c["meaning"], "status": status})
    # The landing word: the kanji's own meaning, which must be wrapped in
    # <kanji> — not <radical>, even though the old convention used to
    # allow that. Present-but-in-a-<radical>-tag still counts as untagged
    # here, since _strip_tags(text, "kanji") only removes <kanji> spans.
    own_words = _meaning_words(ctx["meaning_synonyms"])
    landing = "ok"
    if own_words:
        own_plain = _strip_tags(text, "kanji")
        own_spans = _tagged_spans(text, "kanji")
        if not _references(own_plain, own_words):
            landing = "missing"
        elif not any(_references(span, own_words) for span in own_spans):
            landing = "untagged"
    reading = "ok"
    primary = ctx["primary_reading"]
    if primary:
        rtext = entry["reading_mnemonic"]
        if _hira(primary) not in _hira(_strip_tags(rtext, "reading")):
            reading = "missing"
        elif not any(_hira(primary) in _hira(s)
                     for s in _tagged_spans(rtext, "reading")):
            reading = "untagged"
    if comps or landing != "ok" or reading != "ok":
        report[slug] = {
            "components": comps, "landing": landing,
            "landing_meaning": ctx["meaning"] if landing != "ok" else None,
            "reading": reading, "primary_reading": primary}

with open("curriculum/_build/reports/kanji-chain-check.json", "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"{len(report)} slug(s) chain-marked")
```

It takes a few seconds and writes
`curriculum/_build/reports/kanji-chain-check.json`:

```json
{
  "tooth": {
    "components": [{ "form": "歯", "meaning": "tooth", "status": "untagged" }],
    "landing": "ok",
    "landing_meaning": null,
    "reading": "ok",
    "primary_reading": "し"
  },
  "new": {
    "components": [],
    "landing": "untagged",
    "landing_meaning": "new",
    "reading": "ok",
    "primary_reading": "しん"
  }
}
```

Every slug in that report is **marked** automatically: a `missing` or
`untagged` component or `landing` marks the `meaning` field, a non-`ok`
`reading` marks the `reading` field. The reason starts with `chain:` (e.g.
`chain: component “mouth” missing from the story`, or `chain: landing word
“new” not tagged <kanji>`). The rewrite step reads the report for the detail,
so do not paraphrase component lists into reasons.

A chain-marked slug still gets its prose judged in step 2 — one slug can carry
both a chain mark and a prose mark, on either field.

## Step 2 — prose judgement

### What "keep" reads like

Reviewed exemplars, meaning:

> Look at this single stroke and picture a bent arm flexing hard — the elbow
> cocked, the muscle bulging. That one flexed arm is all you need to see: it's
> pure <radical>power</radical>.

> Look through the window frame and watch the drops falling inside it, one
> after another down the glass. Those little drops caught in the frame are all
> you need to picture. Drops falling inside a window frame: <radical>rain</radical>.

Reviewed exemplars, reading:

> The showroom greeter is Shin, and every time a new model rolls in he shouts
> his own name — <reading>しん</reading>! — as he yanks the cover off. Whatever
> Shin unveils is always brand new.

> A weightlifter named Rio steps up to the bar and gives a warrior's yell as
> she flexes: "<reading>りょく</reading>!" The whole gym feels the raw strength
> in that shout.

What makes them work:

- **One** scene, named early; each sentence carries one beat.
- The taught components are tagged where the story uses them, and the meaning
  lands directly at the end — not after a wind-up.
- A reading story is one cast character, one sound hook, the kana verbatim.
  Done.
- Everyday words; nothing to look up.

### What "mark" reads like

> The raccoon has finally landed. It came down in a snowdrift at the top of
> the map, still gripping the bent <radical>spoon</radical> it levered out of
> the ice cream tub, and it's now sitting back-to-back with a second raccoon
> on a frozen bench, both hunched away from each other against the gale —
> which is exactly the shape of this character. The <radical>spoon</radical> is
> frozen solid to its paws. That wind is coming straight down from the north.

> Word gets out on some pigeon grapevine, and by dusk every <radical>old
> bird</radical> in town has shuffled onto the same <radical>tree</radical>,
> wings too stiff to fly, hopping branch to branch until the whole trunk is
> buried under molting, dust-covered old birds refusing to leave — the tree
> has gathered every last one of them.

> The moment the seed cracks, the person crouched over it doesn't gasp, they
> let out a flat martial grunt - <reading>jits</reading> - like tapping out in
> a wrestling match, because that is exactly the sound <reading>じつ</reading>
> makes crawling out of your mouth when a roof gives way and buries you in the
> truth.

The failure modes, named for the `reason` field:

1. **stacked qualifiers** — a dash or comma tail piling on extra details
   ("wings too stiff to fly, hopping branch to branch").
2. **diagram-caption narration** — positions and measurements instead of a
   picture ("at the top of the map").
3. **two things per sentence** — "the dash on top is X, and the wide stroke
   beneath it is Y".
4. **delayed resolution** — the meaning arrives after a wind-up ("which is
   exactly the shape of this character").
5. **justification clause** — abstract reasoning bolted onto the picture
   ("because that is exactly the sound … makes").
6. **scene chain** — several story beats fused into one sentence ("The moment
   the seed cracks, the person … doesn't gasp, they let out … like …, because
   …"). One beat per sentence.

Mechanical signals, measured on the tag-stripped text (Japanese characters
never count as words):

- any single sentence over 25 words
- 3+ sentences averaging over 18 words
- meaning over ~300 characters, reading over ~260, **and** more than one
  clause-heavy sentence

These are signals, not verdicts. The real test: could a tired learner replay
the scene after one skim, at 7am, in English as a second language? If you have
to re-read a sentence to assemble the image, mark it.

### Do NOT mark

- Items whose only fault is being plain. Plain is fine.
- Items you would merely have written differently. Different is not heavy.
- The scene itself is never the problem — a weird scene in plain sentences is
  a keep. You are judging the prose, not the imagery.
- Do not eyeball tags yourself — the chain report in step 1 covers every real
  tag problem mechanically, including the landing word's `<kanji>` tag.

## Output

Write `curriculum/_build/reports/kanji-simplify-list.json`:

```json
{
  "marked": [
    {
      "slug": "north",
      "fields": ["meaning"],
      "reason": "57-word scene-chain sentence; stacked qualifiers"
    },
    {
      "slug": "tooth",
      "fields": ["meaning"],
      "reason": "chain: component “tooth” present but untagged"
    }
  ],
  "kept": ["red"],
  "stats": { "total": 0, "marked": 0 }
}
```

- `fields`: which of `"meaning"` / `"reading"` need work — one or both. The
  rewrite touches only the listed fields.
- `reason`: under 12 words, naming the failure mode(s) from the list above,
  or `chain: …` from step 1, or both — it feeds the rewrite step.
- Every slug in the sidecar appears exactly once, in `marked` or `kept`.
- `stats.total` must equal the actual slug count; `stats.marked` the length of
  `marked`.
- Finish by printing a one-line summary to the chat (`12/469 marked`) plus
  the full marked list with reasons.
