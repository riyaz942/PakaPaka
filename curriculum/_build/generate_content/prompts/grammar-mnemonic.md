# Write the mnemonic for one {{LEVEL}} grammar point

The learner meets 「{{FORM}}」 in a sentence and has to remember what it means.
Your mnemonic gives them a hook: a tiny story in which someone says an English
word that **sounds like** the form, and saying it **is** the meaning. Then a very
short Japanese example shows where the form goes. Follow the teaching voice above.

## The point

- Form: {{FORM}} (accepted forms: {{ACCEPTED_FORMS}})
- Meaning: {{MEANING}}
- Structure: {{STRUCTURE}}
- Family: {{FAMILY}}

How the lesson opens (for the meaning only — do not repeat it):

{{LESSON_OPENING}}

## Origin

{{ORIGIN}}

## What to write

One `mnemonic_text`: a story of **one sentence, or two short ones**, then **one
Japanese example sentence ending in 。**. 100–240 characters in total, tags not
counted. Most sentences under 18 words, none over 25.

1. **Sound + meaning, one joke.** A character in a concrete scene says or does an
   English sound-alike of the form, and that is the meaning. For a long form,
   hook the part that carries the meaning (しまう in てしまう, not て).
2. **The example.** The last sentence: Japanese only, the form attached to a
   word, ending in 。. Use only words from the allowed list below, and only kanji
   those words contain — the learner sees no furigana here.

Tags — only these two:

- `<reading>` around the English sound-alike, and around the form's kana inside
  the example: `"<reading>OK</reading>"` … `買っ<reading>ておく</reading>。`
- `<grammar>` around the English words that state the meaning:
  `<grammar>ready for later</grammar>`.

These are the target:

> The night before the picnic, Koichi buys the drinks, puts them down by the door
> and nods "<reading>OK</reading>": all set <grammar>for later</grammar>. 買っ<reading>ておく</reading>。

> Little Shima eats the whole birthday cake, every last crumb, then whispers
> "<reading>shh, Ma!</reading>", because it is <grammar>all gone, and oops</grammar>. 食べ<reading>てしまう</reading>。

> At the market, Grandma Kane jabs a finger at one fish and cries "<reading>Oh!</reading>
> That one!", so the seller knows <grammar>exactly what</grammar> she will buy. 魚<reading>を</reading>買う。

> Sei stands up in class and asks "<reading>Wha</reading>t about me?", and now everyone
> knows <grammar>the topic</grammar> of her next sentence. 私<reading>は</reading>学生です。

Never explain grammar terms, never compare with other points, never invent a
history for the form.

## Cast

{{CAST_BLOCK}}

## Words allowed in the example

{{ALLOWED_VOCAB}}
{{VALIDATOR_FEEDBACK}}

Call the `submit_grammar_mnemonic` tool exactly once with:

- `mnemonic_text`: the story and the example, with the tags.
