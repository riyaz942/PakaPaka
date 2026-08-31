# Write the mnemonics for one {{LEVEL}} kanji

You are writing the memory hooks a learner will actually use to recall this
kanji. Two mnemonics — they serve two different quiz directions — and, only when
this kanji needs one, a description. Follow the teaching voice above.

Tight matters here. These are not literary set pieces — the meaning mnemonic is
two or three short sentences the learner replays in their head at 7am on the
fourth review of the week. One picture, plainly told, landing on the meaning.
Funny, strange, concrete. A long scene gets skipped; a short absurd one that
makes sense does not.

## How long

**Meaning mnemonic: roughly 120–220 characters — two or three sentences.** That
is the whole budget, and finishing at the low end is a success, not a shortfall.
A four-component kanji fits inside it. Needing more is nearly always the sign
that the scene is staging each component as its own little event instead of
putting them all in one picture.

Reading mnemonic: roughly 150–280 characters — two to four sentences.

The depth comes from how specific and how *connected* the picture is, never from
how many sentences it takes. Cut anything that adds words without adding
picture: a second joke, a restated ending, a decorative clause.

## Sentence shape and word choice

Short sentences. One idea per sentence — most under 14 words, none over 20. When
a sentence wants a second clause, a dash, or an "-ing" tail ("drooping under its
own weight"), delete it or make it its own sentence.

**Plain English only.** The learner reads this tired, on a phone, often in
English as a second language. Use the word a ten-year-old would use: *tied* not
*lashed*, *bundle* not *sheaf*, *caught* not *snagged*, *tips over* not
*lurches*, *splits* not *cleaves*. No literary verbs, no stacked participles, no
colon-joined reveal at the end. If a sentence sounds like a novel, it is wrong.

## One causal chain

The meaning mnemonic is a chain of cause and effect, not a tour of the
character's parts. Each sentence is *caused* by the one before it, and the last
link produces the meaning. If two sentences could swap places without breaking
the scene, you have written a list, not a story — rewrite it.

Components come in as ordinary things the scene already needs — a count, an
object, a place — not as separate staged events. `eight <radical>sheep</radical>
by the water` does the job in three words that a whole sentence about an axe
splitting a log into eight does not.

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
seen illustrated. Reuse the object itself — the sheep, the water, the stick —
so the chain radical → kanji → vocabulary holds. You do **not** have to restage
that component's own scene: naming its word where your scene actually uses it is
enough, and is what keeps the mnemonic inside its budget.

{{COMPONENTS}}

## Is this kanji just a radical it already knows?

Some kanji are a radical the learner has already been taught, unchanged — same
character, same meaning. 山 the radical and 山 the kanji are one and the same.

{{IDENTITY_NOTE}}

## Look-alikes the learner will confuse this with

These are the reviewed confusables from our curriculum data. They are the only
ones you may mention — the list is exhaustive, and inventing a confusable
teaches a wrong contrast.

{{LOOK_ALIKES}}

## The mnemonic cast

{{CAST_BLOCK}}

## Highlighting

The app colours the pieces the learner is meant to connect, so you mark them
inline. Three tags, and nothing else:

- In `meaning_mnemonic`, wrap **every taught component's meaning**, where the
  story uses it, in `<radical>…</radical>`. Tag the word doing the work in the
  sentence, not a label bolted on: `the <radical>ground</radical> cracks open`,
  never `the ground (<radical>ground</radical>) cracks open`.
- In `meaning_mnemonic`, also wrap **this kanji's own meaning** — the word the
  story lands on — in `<kanji>…</kanji>`: `and you <kanji>ride</kanji> it
  downhill`. A component is a piece borrowed from below; the landing word is
  what the story is building toward, and the app renders the two in different
  colours. **Land on the meaning we teach — the word at the top of this
  prompt — not on one of its accepted answers.** That taught meaning is what
  the learner is quizzed on, so it is the word the story has to end on: landing
  米 on “USA” or 鳥 on “chicken” is wrong even though the quiz would mark both
  right. When a taught component's word *is* this kanji's meaning word, tag that
  same word twice, on two different spans — `<radical>` where the component
  enters, `<kanji>` where the story lands. That is correct and expected; do not
  reach for a synonym to keep the two spans different.
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

1. **`meaning_mnemonic`** — two or three plain sentences that put the taught
   components into one scene and let that scene *cause* the kanji's meaning. Set
   the picture up, let one thing go wrong, land on the meaning. Let it get absurd
   — that is the point — but the absurdity has to be the mechanism, not a joke
   parked next to it. End on the meaning, tagged in `<kanji>`, so the last thing
   in their head is the answer. If there is no taught decomposition, paint the
   whole character as one concrete picture instead — but still never name an
   untaught component. If the section “Is this kanji just a radical it already
   knows?” says this one *is* a taught radical, ignore this bullet and follow
   that section instead.

   **This is the target:**

   > A <radical>stick</radical> planted in the <radical>ground</radical> holds a
   > heavy bundle of <radical>grain</radical>. Suddenly it snaps into
   > <radical>eight</radical> pieces. You leap onto the falling grain and
   > <kanji>ride</kanji> it down the hill like a sled.

   > Imagine <radical>eight</radical> <radical>sheep</radical> standing by the
   > <radical>water</radical>. The water rises and spreads until the sheep and
   > the fence are gone under it. It keeps going, flat and endless, until it is
   > one giant <kanji>ocean</kanji>.

   Four components in 160 characters. Every sentence is caused by the one before
   it, every word is a word a child would use, and the meaning is the last thing
   said.

   **This is what to avoid** — the same kanji, written the wrong way:

   > A line of <radical>ground</radical> lies flat on the floor. A
   > <radical>stick</radical> stands planted straight into it, and lashed to its
   > top is a heavy sheaf of <radical>grain</radical>, drooping under its own
   > weight. An axe strikes the base and splits it apart in
   > <radical>eight</radical>, like a cracking log. The rig lurches, and you leap
   > onto the toppling grain, riding it downhill.

   Twice as long for the same picture. "Lashed", "sheaf", "drooping under its own
   weight" and "lurches" are novel words, not learner words. The axe arrives from
   nowhere to justify "eight" and then leaves — a staged event, not a link in the
   chain. And the ending trails off in an "-ing" tail instead of landing.

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
- `<radical>` and `<kanji>` appear only in the meaning mnemonic, `<reading>`
  only in the reading mnemonic, none of them in the description. Every tag you
  open, close. Never nest them.
- Meaning mnemonic: reference every taught component listed above, each wrapped
  in `<radical>` where the story uses it (or, if there are none, the
  whole-character picture). Never name a component not in that list. Wrap this
  kanji's own meaning, once, in `<kanji>`.
- Meaning mnemonic: stay under 220 characters, tags not counted — or under 200
  if the section above says this kanji simply *is* a taught radical. Going over
  is a rewrite, not a rounding error — cut words, never cut a component.
- Reading mnemonic: the kana 「{{PRIMARY_READING}}」 must appear verbatim, inside
  a `<reading>` tag.
- Description, when you write one: mention every look-alike listed above and
  **no other Japanese character** beyond this kanji and its taught components.
  Descriptions carry no furigana, so stray Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
