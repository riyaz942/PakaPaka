# Write the mnemonics for one {{LEVEL}} kanji

You are writing the memory hooks a learner will actually use to recall this
kanji. Two mnemonics — they serve two different quiz directions — and, only when
this kanji needs one, a description. Follow the teaching voice above.

Tight matters here. These are not literary set pieces — the meaning mnemonic is
**one sentence** the learner replays in their head at 7am on the fourth review
of the week. Funny, strange, concrete, and above all *logical*: the components
have to add up to the meaning.

## How long

**Meaning mnemonic: ONE sentence, roughly 70–170 characters.** Not two. Not
"two or three". One. Finishing at 80 is a success, not a shortfall.

Reading mnemonic: roughly 150–280 characters — two to four sentences.

One sentence is a hard rule because of what the extra sentences were being used
for. Given three, the model gives each component its own little event and bolts
the meaning onto the end — a squirrel runs up the tree, the bells ring, and
*then*, unrelatedly, "music". Given one, there is nowhere to stage anything: the
only way to fit four components into a single sentence is to make each of them
do grammatical work inside the same claim. That constraint is the whole point.

## The sentence has to be a reason, not a scene

Write the sentence so that it *explains* the meaning out of its parts. A reader
should be able to see why those components imply that meaning. Compare:

**Wrong** — a scene the components take turns acting in:

> A badge shaped like an open mouth swings above a fat purse of money. The
> gatekeeper will not sell you a drink until he stamps it. Once your name is in
> his ledger you are an employee.

**Right** — the components combining into a claim:

> An <kanji>employee</kanji> is just one more <radical>mouth</radical> the
> company has to feed with its own <radical>money</radical>.

The second one is 74 characters, names both components, and gives a *reason* the
two of them mean "employee". The first is three times as long and the mouth and
the money never actually explain anything — a gatekeeper who was not in the
decomposition does all the work.

More of the target, all one sentence:

> To construct a basic <kanji>building</kanji> you just need a
> <radical>roof</radical> propped up by a <radical>stick</radical>, and a place
> to <radical>eat</radical> for every hungry <radical>mouth</radical>.

> Wind rustling the frozen <radical>white</radical> branches of a
> <radical>tree</radical> sealed in <radical>ice</radical> makes nature's most
> soothing <kanji>music</kanji>.

> When the <radical>sun</radical> sits at the exact <radical>center</radical> of
> the sky, the water below throws back its clearest <kanji>reflect</kanji>ion.

## Sentence shape and word choice

One idea, one sentence, under 30 words. Commas and a subordinate clause are fine
— that is how four components fit — but no semicolons, no dash-joined
afterthought, no colon-joined reveal at the end.

**Plain English only.** The learner reads this tired, on a phone, often in
English as a second language. Use the word a ten-year-old would use: *tied* not
*lashed*, *bundle* not *sheaf*, *caught* not *snagged*, *tips over* not
*lurches*, *splits* not *cleaves*. If it sounds like a novel, it is wrong.

## Components do grammatical work

Every component must be load-bearing in the sentence — a subject, an object, a
count, a place, a reason. If you can delete a component's clause and the
sentence still makes the same point, you staged it instead of using it.

Never invent a character to carry the logic. The gatekeeper, the squirrel and
the hiker in the old drafts were all doing the work the components should have
been doing. If your sentence needs somebody who is not in the decomposition,
the decomposition is not what your sentence is about.

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
- In `meaning_mnemonic`, also wrap **this kanji's own meaning** in
  `<kanji>…</kanji>`, exactly once. **It may sit anywhere in the sentence** —
  first word, middle, or last. "An <kanji>employee</kanji> is just one more
  mouth…" opens on it and is correct. Put it where the sentence reads best and
  do not contort the wording to push it to the end. A component is a piece
  borrowed from below; this is the kanji's own word, and the app renders the two
  in different colours. **Use the meaning we teach — the word at the top of this
  prompt — not one of its accepted answers.** That taught meaning is what
  the learner is quizzed on, so it is the word that has to appear: using
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

1. **`meaning_mnemonic`** — **one** plain sentence in which the taught
   components combine into the kanji's meaning. Make it absurd if the logic
   lets you — the absurdity has to be the mechanism, never a joke parked next to
   it. If there is no taught decomposition, describe the whole character as one
   concrete picture instead, still naming no untaught component. If the section
   “Is this kanji just a radical it already knows?” says this one *is* a taught
   radical, ignore this bullet and follow that section instead.

   **This is the target:**

   > A <radical>person</radical> who can <radical>renew</radical> anything for
   > you without leaving the counter is selling pure
   > <kanji>convenience</kanji>.

   > Strapping a <radical>dugout canoe</radical> onto a <radical>vehicle</radical>
   > is a ridiculous way to <kanji>transport</kanji> a boat, and it works.

   > <radical>Every</radical> river's <radical>water</radical> ends up in the
   > same place eventually, and that place is the <kanji>sea</kanji>.

   Every component is doing a job in the sentence, the sentence gives a reason,
   and the whole thing is under 110 characters.

   **This is what to avoid** — the same kanji, written the wrong way:

   > A tired <radical>person</radical> finds a portable toilet by the vending
   > machine. A <radical>stick</radical> props the door open where gravel
   > spilled in. A lantern lights the checkered floor: pure
   > <kanji>convenience</kanji>.

   Three sentences that could be shuffled without loss, because none of them
   causes the next. The components take turns appearing instead of combining,
   the meaning is bolted on after a colon, and nothing in it explains why those
   parts should mean "convenience".

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
- Meaning mnemonic: **exactly one sentence**, one terminal full stop and no
  more. The gate rejects two. Stay under 200 characters, tags not counted.
  Going over is a rewrite, not a rounding error — cut words, never cut a
  component.
- Reading mnemonic: the kana 「{{PRIMARY_READING}}」 must appear verbatim, inside
  a `<reading>` tag.
- Description, when you write one: mention every look-alike listed above and
  **no other Japanese character** beyond this kanji and its taught components.
  Descriptions carry no furigana, so stray Japanese renders unreadable.
- No emoji.
{{VALIDATOR_FEEDBACK}}
