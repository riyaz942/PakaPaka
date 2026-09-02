# Restyle brief — kanji meaning mnemonics, Rev 8

You are rewriting the **meaning mnemonic** of already-drafted kanji into a
tighter house style. You are not inventing new content and not touching
anything else: reading mnemonics, descriptions and reviewed items are out of
scope and are not in your input.

## What is wrong with the current prose

It is a *scene* when it should be a *reason*. Three sentences give each
component its own little event and bolt the meaning onto the end, so nothing in
it explains why those parts mean that thing. Compare:

**Before** (216 characters, three sentences):

> A badge shaped like an open `<radical>`mouth`</radical>` swings above a fat
> purse of `<radical>`money`</radical>`. The gatekeeper will not sell you a
> drink until he stamps it. Once your name is in his ledger you are an
> `<kanji>`employee`</kanji>`.

**After** (74 characters, one sentence):

> An `<kanji>`employee`</kanji>` is just one more `<radical>`mouth`</radical>`
> the company has to feed with its own `<radical>`money`</radical>`.

The mouth and the money now *are* the argument. In the old version a gatekeeper
who is not even in the decomposition did all the work, and the two real
components just stood there being described.

## The rules

1. **One sentence. Not two.** The gate rejects two. This is the rule that fixes
   everything else: with three sentences available the model stages each
   component separately, and with one it has to make them combine.
2. **Length: 60–180 characters**, tags stripped. Finishing at 75 is a success.
3. **The sentence must be a reason.** A reader should see why those components
   imply that meaning. If the sentence merely describes the parts sitting near
   each other, it is wrong.
4. **Every component is load-bearing.** Delete a component's clause; if the
   sentence still makes the same point, you decorated instead of explaining.
5. **No invented bystanders.** No gatekeeper, squirrel or hiker who is not in
   the decomposition. If your sentence needs one to make its point, the point is
   not coming from the components.
6. **Plain English a ten-year-old would use.** *tied* not *lashed*, *bundle* not
   *sheaf*, *tips over* not *lurches*. If it sounds like a novel, it is wrong.
7. **Commas are fine, semicolons and colons are not.** A four-component kanji
   fits in one sentence with a subordinate clause. It does not need a
   colon-joined reveal at the end.
8. **Funny still matters** — but the absurdity has to be the mechanism. "A
   ridiculous way to `<kanji>`transport`</kanji>` a boat, and it works" is the
   joke *and* the reason.

## Tagging — this is a hard gate

- Every component in the item's `components` list must appear in the story,
  wrapped in `<radical>…</radical>` where the story actually uses it. The tagged
  span must contain the component's taught meaning word itself — one of the
  words in its `meaning_synonyms`. Tagging "sheeps" when the taught word is
  "sheep" fails.
- The kanji's **own meaning** must appear once, wrapped in `<kanji>…</kanji>`.
  **It may sit anywhere in the sentence** — first word, middle, or last. "An
  `<kanji>`employee`</kanji>` is just one more mouth…" opens on it and is
  correct. Put it where the sentence reads best; never contort the wording to
  push it to the end.
- **Use the item's `meaning`, not a synonym.** That is the word the learner is
  quizzed on. Using 米 as "USA" or 鳥 as "chicken" is a defect even though both
  are accepted answers.
- If a component's taught word happens to *be* the kanji's meaning word, tag that
  same word **twice, on two different spans** — once in `<radical>` where the
  component does its work, once in `<kanji>` for the kanji's own word. Reach for
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
  sentence shape, setting or gag structure across two items in your batch. "X is
  just one more Y" is a good sentence once and a tic by the fourth time. Give
  the last item the same effort as the first.
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
