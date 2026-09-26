# Write the mnemonic for one {{LEVEL}} radical

Radicals are the building blocks the learner combines into kanji, and this is
the shortest thing they will read all session. You write **two texts for one
scene**, told twice. Follow the teaching voice above.

The two fields have different readers, which is why they are different texts:

1. **`image_prompt`** is read by the illustrator only. It is the prompt the
   radical's illustration is generated from — the full scene, with every
   visual detail spelled out. The learner never sees it.
2. **`mnemonic_text`** is what the learner reads beside that illustration: the
   *same scene*, said as simply as possible.

Every kanji built from this radical will later reuse *this exact image* in its
own story, so the picture you choose here is permanent. Make it easy to recall.

## Straightforward first

The learner must get the idea in one quick read. Say plainly what the radical
is made of, then give one simple picture that leads to the meaning. No riddle,
no build-up, no clever phrasing to decode. If the reader has to think about
what a sentence means, it is too clever.

## The radical

- Form: **{{FORM}}**
- Meaning we teach: **{{MEANING}}** (accepted answers: {{MEANING_SYNONYMS}})

## Taught radicals this radical is built from

{{COMPONENTS}}

Pick the pattern that fits the list above.

**A combination of radicals** (the list names two or more). Open by naming the
parts — "This radical is a combination of X and Y." — then one sentence that
puts those parts in a simple scene which lands on the meaning. Use each part's
meaning word as written above, so the learner connects it to the radical they
already know. Worked example, for 動 built from 重 “heavy” and 力 “power”:

    This radical is a combination of <part form="重">heavy</part> and
    <part form="力">power</part>. Imagine <part form="重">heavy</part> boxes
    on the left, and someone with <part form="力">power</part> trying to
    <radical form="動">move</radical> them.

Vary the opening wording a little ("is made of", "combines", "puts together")
but keep it that direct. Do not describe strokes — the parts are the shapes.

**A single shape** (the list says none). Say what the shape looks like, then
the meaning:

    This radical looks like two chopsticks lying side by side. Two lines, two
    chopsticks — that is <radical form="二">two</radical>.

## How long

- `mnemonic_text`: **roughly 60–170 characters** — one or two short
  sentences. It is short on purpose. A radical is a part, not a lesson.
- `image_prompt`: **roughly 150–300 characters** — two to three sentences.
  Longer is fine here: the illustrator needs the objects, positions and action
  specified, and nobody skims a prompt.

Padding is the failure mode — no joke on top of the picture, no restated
ending, no sentence that adds words without adding picture.

## Sentence shape

This governs `mnemonic_text`. Short sentences, one idea each — most under 18
words, none over 25. The learner reads this tired, on a phone, often in
English as a second language. Plain everyday words only.

**No idioms.** A figure of speech means something other than the sum of its
words, and a second-language reader has to decode it before they can see the
picture: *rakes off* → *takes*, *butts against* → *presses against*. Invented
compound nouns are the same trap. If a phrase would need its own dictionary
entry, use the plain words underneath it.

`image_prompt` is exempt — clause-stacked specification is a virtue in a
prompt for an illustrator.

## Look-alikes the learner will confuse this with

These are the reviewed confusables from our curriculum data. They are the only
ones you may mention — the list is exhaustive, and inventing a confusable
teaches a wrong contrast.

{{LOOK_ALIKES}}

## What to write

Call the `submit_radical_mnemonic` tool exactly once with:

1. **`image_prompt`** — the scene for the illustrator. For a combination,
   draw each part as the thing its meaning names, placed where that part sits
   in the character (heavy boxes on the left, a strong figure on the right).
   For a single shape, walk the strokes and let the picture grow out of them.
   Specify **one** image that can actually be drawn.

2. **`mnemonic_text`** — the same scene for the learner, in the pattern above.
   The meaning “{{MEANING}}” should be the last idea, so it is the last thing
   in their head, and it is wrapped in `<radical>...</radical>` — see
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

The app colours the words the learner is meant to connect, so you mark them
inline. Two tags, and nothing else:

- `<radical>` wraps the word the picture resolves to — the meaning
  “{{MEANING}}”, or whichever accepted answer you actually used. Exactly one
  per field, around the meaning word itself and nothing else.
- `<part>` wraps each part's meaning word in `mnemonic_text`, every time the
  text uses it, when this radical is a combination. The app renders parts in a
  different colour from the meaning, so the learner sees at a glance "these are
  pieces I know" and "this is the answer". A single-shape radical has no
  `<part>` tags.

In `mnemonic_text` every tag also **names the character it stands for**, in a
`form` attribute: `{{FORM}}` on the `<radical>` tag, and the part's own
character (from the list above) on each `<part>` tag.

    ...someone with <part form="力">power</part> trying to
    <radical form="動">move</radical> them.

reaches the learner as “…someone with power (力) trying to move (動) them.”
Write the character in the attribute and **never in the prose** — the
parentheses, the font and the colour are the app's, and a character typed into
the sentence would be read out by a screen reader in the middle of it.

`image_prompt` takes only the `<radical>` tag, with **no** `form`: it is the
illustrator's copy, and a character dropped into an art prompt is a thing the
picture might try to draw. The image pipeline strips the tag before drawing.

`<kanji>` and `<reading>` belong to the layers above; never use them here.
Tags and their characters do not count toward the length, and the
`description` carries no tags at all.

## Hard rules

- Plain prose only. No markdown, headings, lists, bold/italic, furigana, or
  romaji. Stored as plain strings. `<radical>` and `<part>` are the only
  exceptions.
- A combination names **every** part listed above, each in a `<part>` tag,
  and no other radical. A single shape names no other radical.
- The meaning “{{MEANING}}” (or one of its accepted answers) must be
  recognisable in `mnemonic_text`, inside the `<radical>` tag. That tag carries
  `form="{{FORM}}"`; the one in `image_prompt` carries no `form`. Never type the
  character into the prose itself.
- One concrete, drawable scene shared by both fields — not two competing
  images, not a menu of options. An illustrator reads `image_prompt` and draws
  exactly one picture; a learner reads `mnemonic_text` and recognises the same
  one.
- Description, when you write one: mention every look-alike listed above and
  **no other Japanese character**. Descriptions carry no furigana, so stray
  Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
