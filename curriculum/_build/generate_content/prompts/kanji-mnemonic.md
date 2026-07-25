# Write the mnemonics for one {{LEVEL}} kanji

You are writing the memory hooks a learner will actually use to recall this
kanji. Two separate mnemonics (they serve two different quiz directions) plus a
description block. Follow the teaching voice above.

Depth matters here. These are not one-line hints — each mnemonic is a short
story paragraph the learner replays in their head at 7am on the fourth review of
the week. Funny, strange, concrete. A tidy sentence is forgotten; a scene with a
smell and a bad decision in it is not.

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

Each component already has an **established image** the learner has read and
seen illustrated. Your story must *continue that image* — the same object doing
something new — not merely name the component. That continuity is the whole
chain: radical → kanji → vocabulary.

{{COMPONENTS}}

## Look-alikes the learner will confuse this with

These are the reviewed confusables from our curriculum data. They are the only
ones you may mention — the list is exhaustive, and inventing a confusable
teaches a wrong contrast.

{{LOOK_ALIKES}}

## The mnemonic cast

{{CAST_BLOCK}}

## What to write

Call the `submit_kanji_mnemonic` tool exactly once with:

1. **`meaning_mnemonic`** — a story paragraph (roughly four to seven sentences)
   that puts the taught components above into one scene and lets that scene
   become the kanji's meaning. Pick each component up *as the image it already
   is* and give it something to do; the components meeting is what produces the
   meaning. Let it get absurd — that is the point — but keep it one continuous
   scene the learner can replay, not a string of jokes. End on the meaning, so
   the last thing in their head is the answer. If there is no taught
   decomposition, paint the whole character as one concrete picture instead —
   but still never name an untaught component.

2. **`reading_mnemonic`** — a story of the same depth (roughly three to five
   sentences) that makes the reading 「{{PRIMARY_READING}}」 stick. The reading's
   cast character (above) drives the scene, and the kana 「{{PRIMARY_READING}}」
   must appear literally in the text so the learner sees the sound they are
   recalling. Tie the scene to the meaning story — same place, same aftermath —
   so the two mnemonics reinforce each other rather than competing for the same
   memory. Don't re-explain the decomposition here; this is about the *sound*.

3. **`description`** — the reference block on the item's info panel. No story, no
   cast, plain factual prose, in this order:
   - what the kanji means and how it is actually used (the nuance a one-word
     gloss loses — register, which senses are common, what it tends to attach to)
   - a plain description of the glyph: what is on the left, what is on top, how
     many strokes it feels like — how you'd tell someone to write it
   - **if look-alikes are listed above:** each of them, with the subtle visual
     difference spelled out (which stroke is longer, which corner closes, what is
     missing). This is the part that saves reviews, so be specific: “the top
     stroke crosses in one and stops short in the other”, not “they look
     similar”.

## Hard rules

- Plain prose only. No markdown, no headings, no lists, no bold/italic, no
  furigana brackets, no romaji spellings of the reading (write the kana). The
  build pipeline stores these as plain strings.
- Meaning mnemonic: reference every taught component listed above (or, if none,
  the whole-character picture). Never name a component not in that list.
- Reading mnemonic: the kana 「{{PRIMARY_READING}}」 must appear verbatim.
- Description: mention every look-alike listed above and **no other Japanese
  character** beyond this kanji and its taught components. Descriptions carry no
  furigana, so stray Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
