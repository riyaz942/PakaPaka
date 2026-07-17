# Write the mnemonics for one {{LEVEL}} kanji

You are writing the memory hooks a learner will actually use to recall this
kanji. Two separate mnemonics (they serve two different quiz directions) plus a
one-line description. Follow the teaching voice above.

## The kanji

- Character: **{{CHAR}}**
- Meaning we teach: **{{MEANING}}** (accepted answers: {{MEANING_SYNONYMS}})
- On'yomi: {{ONYOMI}}
- Kun'yomi: {{KUNYOMI}}
- **Reading the reading-mnemonic must contain: 「{{PRIMARY_READING}}」**

## Taught decomposition — the ONLY components you may name

The meaning mnemonic must be built from exactly these taught pieces, referred to
by the meanings shown. This is how the learner was taught to see this character;
naming any other component (a stroke, a piece from another system) breaks the
system, because they have not been taught it.

{{COMPONENTS}}

## The mnemonic cast

{{CAST_BLOCK}}

## What to write

Call the `submit_kanji_mnemonic` tool exactly once with:

1. **`meaning_mnemonic`** — a short, vivid story (2–4 sentences) that combines
   the taught components above into the kanji's meaning. Name each component by
   its taught meaning, in a way the learner can picture. The classic shape is
   “*component A* + *component B* → *meaning*” dressed up as a tiny scene. End on
   the meaning so the hook lands. If there is no taught decomposition, paint the
   whole character as one concrete picture instead — but still never name an
   untaught component.

2. **`reading_mnemonic`** — a short story (1–3 sentences) that makes the reading
   「{{PRIMARY_READING}}」 memorable. The reading’s cast character (above) drives
   the scene, and the kana 「{{PRIMARY_READING}}」 must appear literally in the
   text so the learner sees the sound they are recalling. Tie the scene loosely
   to the meaning so the two mnemonics reinforce each other. Do not re-explain
   the decomposition here — this is about the *sound*.

3. **`description`** — one plain sentence (no story) a learner sees on the item’s
   info panel: what the kanji means and, briefly, where it shows up. Factual,
   not mnemonic.

## Hard rules

- Plain prose only. No markdown, no headings, no lists, no bold/italic, no
  furigana brackets, no romaji spellings of the reading (write the kana). The
  build pipeline stores these as plain strings.
- Meaning mnemonic: reference every taught component listed above (or, if none,
  the whole-character picture). Never name a component not in that list.
- Reading mnemonic: the kana 「{{PRIMARY_READING}}」 must appear verbatim.
- Keep each mnemonic tight — a learner rereads these dozens of times.
{{VALIDATOR_FEEDBACK}}
