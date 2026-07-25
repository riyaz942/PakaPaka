# Write the mnemonics for one {{LEVEL}} vocabulary word

This is the last link in the chain: the learner already has an image for each
radical, and a story for each kanji built from those radicals. Now the kanji
combine into a *word*, and your job is to make that combination feel inevitable.
Follow the teaching voice above.

Two mnemonics (they serve two different quiz directions) plus a description.

## The word

- Written form: **{{FORM}}**
- Reading: **{{READING}}**
- Meaning we teach: **{{MEANING}}** (accepted answers: {{MEANING_SYNONYMS}})

## The kanji in this word

Each one already has a meaning story the learner has read. **Hook into those
stories** — reuse their imagery instead of inventing a fresh scene that competes
with what they already remember. These are the only kanji you may name.

{{COMPONENTS}}

## The reading

{{REGULARITY}}

## The mnemonic cast

{{CAST_BLOCK}}

## What to write

Call the `submit_vocab_mnemonic` tool exactly once with:

1. **`meaning_mnemonic`** — a story paragraph (roughly three to six sentences)
   that runs the component kanji's meanings together until they land on
   “{{MEANING}}”. Start from the imagery those kanji already carry, put them in
   one scene, and let the word's meaning fall out of what happens. Strange and
   funny is what survives reviews. End on the meaning. If no kanji are listed
   above — a kana word, or one whose kanji the learner hasn't met — write a
   standalone story that glues the sound to the meaning instead, and name no
   kanji at all.

2. **`reading_mnemonic`** — follow the reading section above exactly. When it
   says to write a derivation note, write **one sentence** that points at the
   readings the learner already knows and moves on; padding a regular reading
   into a story teaches them to distrust the ones that *are* stories. When it
   says to write a full story, write one of real depth (three to five sentences),
   cast-driven, with the reading in it verbatim.

3. **`description`** — the reference block on the item's info panel. No story:
   what the word actually means beyond the gloss, its register (casual or formal,
   spoken or written, who says it to whom), and anything that trips people up —
   a false friend, a sense that doesn't transfer from English, a form it usually
   appears in.

## Hard rules

- Plain prose only. No markdown, no headings, no lists, no bold/italic, no
  furigana brackets, no romaji (write kana). Stored as plain strings.
- Meaning mnemonic: reference every kanji listed above by its taught meaning.
  Never name a kanji that is not in that list.
- Reading mnemonic: 「{{READING}}」 must appear verbatim.
- Description: no Japanese characters beyond this word and its own kanji.
  Descriptions carry no furigana, so stray Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
