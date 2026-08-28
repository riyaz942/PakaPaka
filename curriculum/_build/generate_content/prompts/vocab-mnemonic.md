# Write the mnemonics for one {{LEVEL}} vocabulary word

This is the last link in the chain: the learner already has an image for each
radical, and a story for each kanji built from those radicals. Now the kanji
combine into a *word*, and your job is to make that combination feel inevitable.
Follow the teaching voice above.

Two mnemonics — they serve two different quiz directions — and, only when this
word needs one, a description.

## How long

Aim for **roughly 180–330 characters** for the meaning mnemonic — two to four
sentences, the same size as the radical and kanji mnemonics the learner has been
reading all the way up the chain. That is the size that has actually worked:
long enough to carry a scene, short enough that a tired learner reads it instead
of skipping it. Treat it as the target, not a rule: going over to finish a scene
is fine, padding to reach a number is not. (The reading mnemonic follows the
reading section below — a derivation note stays one sentence no matter what.)

## Sentence shape

Short sentences. One idea per sentence — most under 18 words, none over 25.
The learner reads this tired, on a phone, often in English as a second
language, so the scene has to survive a skim. When a sentence wants a second
clause, a dash, or an "-ing" tail ("eyes streaming"), make it two sentences
instead. Concrete everyday words are always fine; a long winding sentence
never is.

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

## Highlighting

The app colours the pieces the learner is meant to connect, so you mark them
inline. Two tags, one per field, and nothing else:

- In `meaning_mnemonic`, wrap **every component kanji's meaning**, where the
  story uses it, in `<kanji>…</kanji>`. Tag the word doing the work in the
  sentence, not a label bolted on: `the <kanji>ground</kanji> splits`, never
  `the ground (<kanji>ground</kanji>) splits`.
- In `reading_mnemonic`, wrap the kana 「{{READING}}」 in `<reading>…</reading>`,
  **and** wrap the English word your scene uses to carry that sound — the
  phonetic hook — in the same tag. In a derivation note, tagging the reading
  itself is enough.

Don't tag anything else — a tag on an ordinary word teaches the learner that the
colour means nothing.

## What to write

Call the `submit_vocab_mnemonic` tool exactly once with:

1. **`meaning_mnemonic`** — a story that runs the component kanji's meanings
   together until they land on
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
   says to write a full story, write one of real depth in the 150–280 character
   band, cast-driven, with the reading in it verbatim.

3. **`description`** — **optional. Omit this key entirely unless this word
   actually needs it.** The two mnemonics are what the learner reads; a
   description that restates the gloss is noise they scroll past. Write one only
   when there is something the story cannot carry: a register that would get
   them in trouble (who says this to whom), a false friend, a sense that doesn't
   transfer from English, or a form the word almost always appears in. When you
   do write one: plain factual prose, no story, no highlight tags, and shorter
   than a mnemonic.

## Hard rules

- Plain prose only, apart from the two highlight tags. No markdown, no headings,
  no lists, no bold/italic, no furigana brackets, no romaji (write kana). Stored
  as plain strings.
- `<kanji>` appears only in the meaning mnemonic, `<reading>` only in the
  reading mnemonic, neither in the description. Every tag you open, close. Never
  nest them.
- Meaning mnemonic: reference every kanji listed above by its taught meaning,
  each wrapped in `<kanji>` where the story uses it. Never name a kanji that is
  not in that list.
- Reading mnemonic: 「{{READING}}」 must appear verbatim, inside a `<reading>` tag.
- Description, when you write one: no Japanese characters beyond this word and
  its own kanji. Descriptions carry no furigana, so stray Japanese renders
  unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
