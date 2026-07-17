# Write the mnemonic for one {{LEVEL}} radical

Radicals are the building blocks the learner combines into kanji, so a radical
mnemonic is **one vivid, concrete image** — a single picture they can drop into
any kanji story later. This image is also what a later illustration is drawn
from, so make it drawable. Follow the teaching voice above.

## The radical

- Form: **{{FORM}}**
- Meaning we teach: **{{MEANING}}** (accepted answers: {{MEANING_SYNONYMS}})

## What to write

Call the `submit_radical_mnemonic` tool exactly once with:

- **`mnemonic_text`** — one or two sentences turning the shape **{{FORM}}** into a
  single concrete image that lands on the meaning “{{MEANING}}”. Describe what
  the strokes *look like* becoming that thing, so the shape and the meaning are
  glued together. One dominant image — not a list of possibilities.

## Hard rules

- Plain prose only. No markdown, headings, lists, bold/italic, furigana, or
  romaji. Stored as a plain string.
- The meaning “{{MEANING}}” (or one of its accepted answers) must be recognisable
  in the image — end on it.
- One concrete, drawable image. Keep it tight.
{{VALIDATOR_FEEDBACK}}
