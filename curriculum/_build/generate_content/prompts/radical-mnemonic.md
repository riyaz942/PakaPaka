# Write the mnemonic for one {{LEVEL}} radical

Radicals are the building blocks the learner combines into kanji, and this is
the shortest thing they will read all session. You write **two texts for one
scene**: a single strange, funny, concrete picture that turns this shape into
its meaning, told twice. Follow the teaching voice above.

The two fields have different readers, which is why they are different texts:

1. **`image_prompt`** is read by the illustrator only. It is the prompt the
   radical's illustration is generated from — the full scene, walked stroke by
   stroke, with every visual detail spelled out. The learner never sees it.
2. **`mnemonic_text`** is what the learner reads beside that illustration: the
   *same scene*, retold in short, skimmable sentences with the detail trimmed.

Every kanji built from this radical will later reuse *this exact image* in its
own story, so the picture you choose here is permanent. Make it worth reusing.

## How long

- `mnemonic_text`: **roughly 100–180 characters** — one or two short
  sentences. One look at the shape, one thing happening in it, and the
  meaning. It is short on purpose. A radical is a part, not a lesson.
- `image_prompt`: **roughly 150–300 characters** — two to three sentences.
  Longer is fine here: the illustrator needs the strokes, the positions and
  the action specified, and nobody skims a prompt.

Treat both as targets, not rules. Going a little over to finish a picture is
fine. Padding is not — no second joke, no restated ending, no sentence that
adds words without adding picture.

## Sentence shape

This governs `mnemonic_text`. Short sentences. One idea per sentence — most
under 18 words, none over 25. The learner reads this tired, on a phone, often
in English as a second language, so the picture has to survive a skim. When a
sentence wants a second clause, a dash, or an "-ing" tail ("roots gripping the
soil"), make it two sentences instead. Concrete everyday words are always
fine; a long winding sentence never is.

`image_prompt` is exempt — clause-stacked specification is a virtue in a
prompt for an illustrator.

## How funny

Lean funnier than you think you should. At this length you cannot build up to
anything, so the image itself has to be the joke: something absurd caught
mid-action, an object behaving badly, a scale that is wrong on purpose. Tasteful
and forgettable is the failure mode here — the picture the learner can't unsee
is the one that survives a week of reviews. Keep it a picture, though; a pun
with nothing to look at draws nothing.

## The radical

- Form: **{{FORM}}**
- Meaning we teach: **{{MEANING}}** (accepted answers: {{MEANING_SYNONYMS}})

## Look-alikes the learner will confuse this with

These are the reviewed confusables from our curriculum data. They are the only
ones you may mention — the list is exhaustive, and inventing a confusable
teaches a wrong contrast.

{{LOOK_ALIKES}}

## What to write

Call the `submit_radical_mnemonic` tool exactly once with:

1. **`image_prompt`** — the scene for the illustrator. Walk the strokes — say
   what *that* line and *that* hook look like, where each sits, what it is
   doing — and let the picture grow out of them, so the shape and the meaning
   are glued together. Specify **one** image that can actually be drawn.

2. **`mnemonic_text`** — the same scene for the learner, simplified. Keep the
   actor, the setting and the action; cut the measurements and the second
   clause of every pair. Keep one short shape phrase ("curls shut", "split
   apart"). End on the meaning “{{MEANING}}”, so the last thing in their head
   is the answer, and wrap that word in `<radical>...</radical>` — see
   "Highlighting" below.

3. **`description`** — **optional. Omit this key entirely unless this radical
   actually needs it.** The mnemonic is what the learner reads; a description
   that retells it in flatter words is noise they scroll past. Write one only
   when there is something the picture cannot carry:

   - **look-alikes are listed above** — then it is required, and this is the
     whole job: name each one and spell out the exact visual difference (which
     stroke is longer, which corner closes, what is missing). Be specific — “the
     top stroke crosses in one and stops short in the other”, not “they look
     similar”.
   - a real nuance about where this shape turns up, or which position it takes
     in a kanji, that a learner would otherwise get wrong.

   When you do write one: plain factual prose, no story, no jokes, and shorter
   than the mnemonic. If all you can think of to say is “this shape means X”,
   that is the signal to omit it.

## Highlighting

Wrap the word the picture resolves to — the meaning “{{MEANING}}”, or whichever
accepted answer you actually used — in `<radical>...</radical>`. Do this in
**both** fields: the app renders it in the radical accent colour in
`mnemonic_text`, so the learner's eye lands on the answer; in `image_prompt`
it marks the word the picture must resolve to (the image pipeline strips the
tag before drawing).

    ...and the whole thing tips over into a shouting <radical>mouth</radical>.

Exactly one tag per field, around the meaning word itself and nothing else —
not the sentence it sits in. `<kanji>` and `<reading>` belong to the layers
above; never use them here. The tag does not count toward the length, and the
`description` carries no tags at all.

## Hard rules

- Plain prose only. No markdown, headings, lists, bold/italic, furigana, or
  romaji. Stored as plain strings. `<radical>` is the one exception.
- The meaning “{{MEANING}}” (or one of its accepted answers) must be
  recognisable in `mnemonic_text`, inside the `<radical>` tag.
- One concrete, drawable scene shared by both fields — not two competing
  images, not a menu of options. An illustrator reads `image_prompt` and draws
  exactly one picture; a learner reads `mnemonic_text` and recognises the same
  one.
- Description, when you write one: mention every look-alike listed above and
  **no other Japanese character**. Descriptions carry no furigana, so stray
  Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
