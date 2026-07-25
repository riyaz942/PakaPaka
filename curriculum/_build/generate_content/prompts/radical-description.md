# Write the description for one {{LEVEL}} radical

Radicals are the building blocks the learner combines into kanji. A radical gets
**no mnemonic** — it gets a `description`: one strange, funny, concrete scene
that turns this shape into its meaning, written so vividly that the learner can
see it. Follow the teaching voice above.

That one description does two jobs at once, which is why it has to be a single
picture and not a list of possibilities:

1. It is what the learner reads beside the radical's illustration.
2. It is the prompt that illustration is generated from — so it must describe
   **one** image that can actually be drawn.

Every kanji built from this radical will later reuse *this exact image* in its
own story, so the picture you choose here is permanent. Make it worth reusing.

## The radical

- Form: **{{FORM}}**
- Meaning we teach: **{{MEANING}}** (accepted answers: {{MEANING_SYNONYMS}})

## Look-alikes the learner will confuse this with

These are the reviewed confusables from our curriculum data. They are the only
ones you may mention — the list is exhaustive, and inventing a confusable
teaches a wrong contrast.

{{LOOK_ALIKES}}

## What to write

Call the `submit_radical_description` tool exactly once with:

- **`description`** — a short paragraph (roughly three to five sentences) that
  turns the shape **{{FORM}}** into a single concrete scene landing on the
  meaning “{{MEANING}}”. Walk the strokes — say what *that* line and *that* hook
  look like — and let the scene grow out of them, so the shape and the meaning
  are glued together. Strange and funny beats tasteful: the picture you can't
  unsee is the one that survives a week of reviews. End on the meaning.

  Then, **only if look-alikes are listed above**, close with a sentence or two
  naming each of them and pointing at the exact visual difference — which stroke
  is shorter, which way it leans, what is missing. Write the look-alike character
  itself; don't describe it in words alone.

## Hard rules

- Plain prose only. No markdown, headings, lists, bold/italic, furigana, or
  romaji. Stored as a plain string.
- The meaning “{{MEANING}}” (or one of its accepted answers) must be recognisable
  in the image.
- One concrete, drawable scene — not two competing images, not a menu of options.
  An illustrator reads this and draws exactly one picture.
- Mention every look-alike listed above, and **no other Japanese character**.
  Descriptions carry no furigana, so stray Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
