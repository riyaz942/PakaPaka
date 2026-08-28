# Write the mnemonics for one {{LEVEL}} kanji

You are writing the memory hooks a learner will actually use to recall this
kanji. Two mnemonics — they serve two different quiz directions — and, only when
this kanji needs one, a description. Follow the teaching voice above.

Depth matters here. These are not one-line hints — each mnemonic is a short
story the learner replays in their head at 7am on the fourth review of the week.
Funny, strange, concrete. A tidy sentence is forgotten; a scene with a smell and
a bad decision in it is not.

## How long

Aim for **roughly 180–330 characters** for the meaning mnemonic and **150–280**
for the reading mnemonic — two to four sentences each. That is the size that has
actually worked: long enough to carry a scene, short enough that a tired learner
reads it instead of skipping it. These are short on purpose; the depth comes
from how specific the picture is, not from how many sentences it takes.

Treat it as the target, not a rule. A kanji with four components may genuinely
need more, and going over to finish the job is fine. What is not fine is
padding: a second joke, a restated ending, or a sentence that adds words without
adding picture. If the scene is complete at 180 characters, stop there.

## Sentence shape

Short sentences. One idea per sentence — most under 18 words, none over 25.
The learner reads this tired, on a phone, often in English as a second
language, so the scene has to survive a skim. When a sentence wants a second
clause, a dash, or an "-ing" tail ("eyes streaming"), make it two sentences
instead. Concrete everyday words are always fine; a long winding sentence
never is.

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

## Highlighting

The app colours the pieces the learner is meant to connect, so you mark them
inline. Two tags, one per field, and nothing else:

- In `meaning_mnemonic`, wrap **every taught component's meaning**, where the
  story uses it, in `<radical>…</radical>`. Tag the word doing the work in the
  sentence, not a label bolted on: `the <radical>ground</radical> cracks open`,
  never `the ground (<radical>ground</radical>) cracks open`.
- In `reading_mnemonic`, wrap the kana 「{{PRIMARY_READING}}」 in
  `<reading>…</reading>`, **and** wrap the English word your scene uses to carry
  that sound — the phonetic hook — in the same tag: `a hiker called
  <reading>Itchy</reading> groans <reading>{{PRIMARY_READING}}</reading> with
  every scratch`.

Tag the component the first time the story really uses it, and again later if
the story returns to it. Don't tag anything else — a tag on an ordinary word
teaches the learner that the colour means nothing.

## What to write

Call the `submit_kanji_mnemonic` tool exactly once with:

1. **`meaning_mnemonic`** — a story that puts the taught components above into
   one scene and lets that scene become the kanji's meaning. Pick each component
   up *as the image it already is* and give it something to do; the components
   meeting is what produces the meaning. Let it get absurd — that is the point —
   but keep it one continuous scene the learner can replay, not a string of
   jokes. End on the meaning, so the last thing in their head is the answer. If
   there is no taught decomposition, paint the whole character as one concrete
   picture instead — but still never name an untaught component.

2. **`reading_mnemonic`** — a story of the same depth that makes the reading
   「{{PRIMARY_READING}}」 stick, and may run shorter than the meaning mnemonic
   since it carries one idea. The reading's cast character (above) drives the
   scene, and the kana 「{{PRIMARY_READING}}」 must appear literally in the text
   so the learner sees the sound they are recalling. Tie the scene to the
   meaning story — same place, same aftermath — so the two mnemonics reinforce
   each other rather than competing for the same memory. Don't re-explain the
   decomposition here; this is about the *sound*.

3. **`description`** — **optional. Omit this key entirely unless this kanji
   actually needs it.** The two mnemonics are what the learner reads; a
   description that restates the meaning and recites the strokes is noise they
   scroll past. Write one only when there is something the story cannot carry:

   - **look-alikes are listed above** — then it is required, and this is the
     whole job: name each one and spell out the exact visual difference (which
     stroke is longer, which corner closes, what is missing). Be specific — “the
     top stroke crosses in one and stops short in the other”, not “they look
     similar”.
   - a real usage nuance a one-word gloss loses — a register the learner would
     get wrong, a common sense that isn't the gloss, something it almost always
     attaches to.
   - a piece of history or a shape trap that genuinely explains the character.

   When you do write one: plain factual prose, no story, no cast, no highlight
   tags, and shorter than a mnemonic. If all you can think of to say is “this
   means X and is written in N strokes”, that is the signal to omit it.

## Hard rules

- Plain prose only, apart from the two highlight tags. No markdown, no headings,
  no lists, no bold/italic, no furigana brackets, no romaji spellings of the
  reading (write the kana). The build pipeline stores these as plain strings.
- `<radical>` appears only in the meaning mnemonic, `<reading>` only in the
  reading mnemonic, neither in the description. Every tag you open, close. Never
  nest them.
- Meaning mnemonic: reference every taught component listed above, each wrapped
  in `<radical>` where the story uses it (or, if there are none, the
  whole-character picture). Never name a component not in that list.
- Reading mnemonic: the kana 「{{PRIMARY_READING}}」 must appear verbatim, inside
  a `<reading>` tag.
- Description, when you write one: mention every look-alike listed above and
  **no other Japanese character** beyond this kanji and its taught components.
  Descriptions carry no furigana, so stray Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
