# Restyle brief — kanji meaning mnemonics, Rev 6

You are rewriting the **meaning mnemonic** of already-drafted kanji into a
tighter house style. You are not inventing new content and not touching
anything else: reading mnemonics, descriptions and reviewed items are out of
scope and are not in your input.

## What is wrong with the current prose

It is roughly twice as long as it should be, written in novel-register English,
and structured as a tour of the character's parts rather than as one thing
causing the next. Compare:

**Before** (311 characters):

> A line of `<radical>`ground`</radical>` lies flat on the floor. A
> `<radical>`stick`</radical>` stands planted straight into it, and lashed to
> its top is a heavy sheaf of `<radical>`grain`</radical>`, drooping under its
> own weight. An axe strikes the base and splits it apart in
> `<radical>`eight`</radical>`, like a cracking log. The rig lurches, and you
> leap onto the toppling grain, riding it downhill.

**After** (171 characters):

> A `<radical>`stick`</radical>` planted in the `<radical>`ground`</radical>`
> holds up a heavy bundle of `<radical>`grain`</radical>`. Suddenly it snaps
> into `<radical>`eight`</radical>` pieces. You leap onto the falling grain and
> `<kanji>`ride`</kanji>` it down the hill like a sled.

Same four components, same picture, half the words. Note what went: "lashed",
"sheaf", "drooping under its own weight" and "lurches" are novel words, not
learner words. The axe arrived from nowhere to justify "eight" and then left —
a staged event, not a link in the chain. And the old ending trailed off in an
"-ing" tail instead of landing on the meaning.

A second target, for a kanji whose components are eight / sheep / water:

> Imagine `<radical>`eight`</radical>` `<radical>`sheep`</radical>` standing by
> the `<radical>`water`</radical>`. The water rises and spreads until the sheep
> and the fence are gone under it. It keeps going, flat and endless, until it is
> one giant `<kanji>`ocean`</kanji>`.

## The rules

1. **Length: 120–220 characters**, counting the text with the tags stripped out.
   The gate rejects anything over 260. Finishing at 130 is a success.
2. **Two or three sentences.** Most under 14 words, none over 20. No dash-joined
   second clause, no "-ing" tail, no colon-joined reveal at the end.
3. **Plain English a ten-year-old would use.** *tied* not *lashed*, *bundle* not
   *sheaf*, *caught* not *snagged*, *tips over* not *lurches*, *splits* not
   *cleaves*. If a sentence sounds like a novel, it is wrong.
4. **One causal chain.** Each sentence is caused by the one before it, and the
   last one produces the meaning. If two sentences could swap places without
   breaking the scene, you wrote a list — rewrite it.
5. **Components enter as ordinary things the scene already needs** — a count, an
   object, a place — not as their own staged mini-event. "eight
   `<radical>`sheep`</radical>` by the water" beats a whole sentence about an axe
   splitting a log into eight. This is where nearly all the excess length is.
6. **Keep the scene.** Reuse the actor, setting and object of the original where
   they survive rules 1–5. You are compressing and plainly re-telling a picture,
   not inventing a new one. Cutting a staged event that only existed to justify a
   component is expected and is not "changing the scene".
7. **Funny still matters.** Absurd situation, deadpan telling. The absurdity has
   to be the mechanism the learner remembers, not a joke parked beside it. Never
   nudge the reader and never explain the joke.

## Tagging — this is a hard gate

- Every component in the item's `components` list must appear in the story,
  wrapped in `<radical>…</radical>` where the story actually uses it. The tagged
  span must contain the component's taught meaning word itself — one of the
  words in its `meaning_synonyms`. Tagging "sheeps" when the taught word is
  "sheep" fails.
- The kanji's **own meaning** — the word the story lands on — must appear once,
  wrapped in `<kanji>…</kanji>`. The span must contain the item's `meaning` or
  one of its `meaning_synonyms`. **Many of your inputs are missing this tag
  entirely; adding it is part of the job.**
- **Land on the item's `meaning`, not on a synonym.** That is the word the
  learner is quizzed on, so it is the word the story must end on. Landing 米 on
  "USA" or 鳥 on "chicken" is a defect even though both are accepted answers.
- If a component's taught word happens to *be* the kanji's meaning word, tag that
  same word **twice, on two different spans** — once in `<radical>` where the
  component enters the scene, once in `<kanji>` where the story lands. Reach for
  a `meaning_synonyms` entry only when it is a near-exact substitute for the
  primary meaning, never when it shifts the sense.
- Tag nothing else. No `<reading>` tag in this field. Never nest tags. Close
  every tag you open.

## Other hard rules

- Never name a component, radical or kanji that is not in that item's own
  `components` list. Each item is independent — a sibling in your batch sharing a
  component does not widen what this item may reference.
- No Japanese characters in the text at all. Plain prose only: no markdown, no
  headings, no lists, no bold, no italic, no backticks, no furigana brackets, no
  romaji, no emoji. The only markup allowed is the two tags above.
- **Make the batch's items feel different from each other.** Do not reuse a
  scene shape, setting, animal, gag structure or sentence rhythm across two items
  in your batch, and do not let two land the same way. Give the last item the
  same effort as the first.
- If an item is **already** in the target style — short, plain, one causal chain,
  landing on the meaning — keep its wording and change only what the rules above
  require (usually just adding the missing `<kanji>` tag). Do not rewrite good
  prose for the sake of rewriting.

## Output

Write ONE file: `curriculum/_build/restyle/out/<batch-name>.json` (for
`batch-07.json`, write `restyle/out/batch-07.json`). It is a flat JSON object
mapping each slug to its new meaning mnemonic string, and nothing else:

```json
{
  "k-ride": "A <radical>stick</radical> planted in the ...",
  "k-ocean": "Imagine <radical>eight</radical> ..."
}
```

Every slug in your batch must appear exactly once. No commentary in the file, no
other keys, no `_meta`, no reading mnemonic, no description.
