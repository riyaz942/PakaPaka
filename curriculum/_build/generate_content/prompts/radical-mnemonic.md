# Write the mnemonic for one {{LEVEL}} radical

Radicals are the building blocks the learner combines into kanji, and this is
the shortest thing they will read all session. One mnemonic: a single strange,
funny, concrete scene that turns this shape into its meaning. Follow the
teaching voice above.

That one mnemonic does two jobs at once, which is why it has to be a single
picture and not a list of possibilities:

1. It is what the learner reads beside the radical's illustration.
2. It is the prompt that illustration is generated from — so it must describe
   **one** image that can actually be drawn.

Every kanji built from this radical will later reuse *this exact image* in its
own story, so the picture you choose here is permanent. Make it worth reusing.

## How long

Aim for **roughly 150–300 characters** — two to three sentences. This is the
size that has worked: one look at the shape, one thing happening in it, and the
meaning. It is short on purpose. A radical is a part, not a lesson.

Treat it as the target, not a rule. Going a little over to finish a picture is
fine. Padding is not — no second joke, no restated ending, no sentence that adds
words without adding picture.

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

1. **`mnemonic_text`** — the scene. Walk the strokes — say what *that* line and
   *that* hook look like — and let the picture grow out of them, so the shape
   and the meaning are glued together. End on the meaning “{{MEANING}}”, so the
   last thing in their head is the answer.

2. **`description`** — **optional. Omit this key entirely unless this radical
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

## Hard rules

- Plain prose only. No markdown, headings, lists, bold/italic, furigana, or
  romaji. Stored as plain strings.
- No highlight tags. Radicals are the bottom of the chain — they borrow nothing,
  so there is nothing to colour. `<radical>`, `<kanji>` and `<reading>` belong
  in the kanji and vocabulary prompts, never here.
- The meaning “{{MEANING}}” (or one of its accepted answers) must be
  recognisable in the mnemonic.
- One concrete, drawable scene — not two competing images, not a menu of
  options. An illustrator reads this and draws exactly one picture.
- Description, when you write one: mention every look-alike listed above and
  **no other Japanese character**. Descriptions carry no furigana, so stray
  Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
