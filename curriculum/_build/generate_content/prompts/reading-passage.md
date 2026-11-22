# Write one {{LEVEL}} reading passage

You are writing a graded reader passage — a short, self-contained piece of
Japanese a learner reads end to end, with comprehension questions under it.
Follow the teaching voice above.

This passage is number {{POSITION}} of {{SEED_COUNT}} in the level, so the
learner has met exactly the vocabulary and grammar listed below and nothing
else.

## What this passage is about

{{TOPIC}}

{{TONE_DIRECTION}}

This is a sketch of a situation, not a specification, and **the vocabulary list
below outranks it**. Where a detail in the sketch needs a word the list does not
have — an object, an action, a number — drop that detail, or swap it for one the
list can carry, and keep the situation. Keeping every detail by bending a word is
the single failure this prompt gets back most often. A passage that keeps the
situation and loses one detail is the correct answer, not a compromise.

## Vocabulary you may use

Every content word in the passage — and in your questions — must come from this
list, plus particles, numbers, and everyday grammatical machinery. The learner
knows nothing else yet. If the scenario needs a word that is not here, change
the scenario, not the vocabulary — and see *Words have to mean what they mean*
below, which is what that rule means in practice and the rule this prompt most
often gets back wrong.

{{ALLOWED_VOCAB}}

{{EXTRA_ALLOWED_BLOCK}}

## Grammar you may use

These are the patterns the learner has been taught by this point. Build the
passage out of these; anything later is off limits, even if it would read more
naturally.

{{ALLOWED_GRAMMAR}}

{{REQUIRED_GRAMMAR_BLOCK}}

## What to write

{{TOOL_LINE}}:

- `title` — a short Japanese title, 2–20 characters. No punctuation.
- `body` — the passage itself, **{{WORD_LO}}–{{WORD_HI}} words** (counted by the
  tokenizer, punctuation excluded), written as a **single line**: sentences end
  with 。 and run on in one paragraph, with no line breaks.
- `english_translation` — natural English for the whole passage, one sentence
  per Japanese sentence, same order.
- `summary_ja` — one short Japanese sentence saying what happens (8–60
  characters), within the same vocabulary.
- `summary_en` — the same in one English sentence.
- `questions` — exactly {{QUESTION_COUNT}} comprehension questions. Each has a
  `prompt` (Japanese, 4–40 characters, ending in か。) and `accepted_answers`.

Rules the automated gate enforces, so getting them wrong costs a regeneration:

- **Answers must be readable off the page.** For every question, at least one
  entry in `accepted_answers` must appear in the body **exactly as written
  there**. Give the natural variants too — the kanji form, the kana form, the
  form with its particle — but include the literal one.
- Ask about facts the passage states: who, what, where, when, how many. Never
  ask for an opinion or for something the learner has to infer.
- **Plain Japanese only** — no furigana, no romaji, no markdown, no HTML. The
  build pipeline adds furigana with a tokenizer, and any bracket you write is a
  rejection.
- Keep one situation running through the whole passage. A passage that is five
  unrelated sentences is not a reading; it is an example-sentence list.

## How the sentences hold together

A graded reader is prose, not a list of example sentences. These five rules are
what makes the difference:

- **Name the subject once.** Say who it is in the first sentence, then leave it
  out of the sentences that follow until the subject changes. Japanese drops a
  subject the reader already has; restating 私 in every sentence does not.
- **Start each sentence from something already on the page.** Take a noun the
  previous sentence introduced and build the next one on it — 大学 → さくら大学
  の食堂 → 食堂の食べ物. A sentence that brings in a new topic and drops the old
  one reads as a list. そして, それから and でも open a sentence on the back of
  the one before it; use them where the link is real.
- **Open some sentences with a time or a place** instead of a subject: 毎朝,
  午後, 電車で, 公園の前に.
- **Join two clauses inside one sentence, in at least two sentences — when the
  grammar list above allows it.** The linkers are 〜から、, 〜ので、 and 〜て、.
  If none of them is in that list yet, keep every sentence to one clause; that
  is the correct shape this early, not a shortcoming.
- **Grow the noun phrases, not the verbs.** Stack の — 母の誕生日のプレゼント,
  さくら大学の英語の先生 — rather than reaching for a longer verb form.

Vary sentence length. A wall of identical 〜です sentences is what a graded
reader is trying not to be.

## Words have to mean what they mean

The vocabulary list is a permission, not a set of interchangeable parts. Each
word on it has one normal use, and a passage that stretches a word past that use
reads as **wrong** to a Japanese reader while still passing every automated
check the build runs. This is the failure this prompt gets back most often, and
it always arrives the same way: the scene needed a word that was not on the
list, and the passage kept the scene and bent a word that was.

**When the word you need is not on the list, the scene is what changes.** Every
rule below is that one rule, with the mistake already made once:

- **Do not substitute a near-miss.** Salty is しょっぱい, which this level does
  not contain, so a passage about salt in the tea cannot fall back on
  「お茶は辛いです」 — 辛い is *spicy*, and the sentence now says something else.
  Write a mix-up the words you have can describe.
- **A spoken line ends in と言いました.** 話す is *to talk with someone about
  something* — 友達と話しました, 先生に話しました. It does not carry a quotation.
  「明日も来ます」と話しました is not Japanese; 「明日も来ます」と言いました is.
- **Use the verb the noun takes.** 宿題をします, never 宿題を書きます. 薬を
  飲みます, never 薬を食べます. When you are unsure which verb a noun takes,
  write about something you are sure of.
- **An object is not a person.** 待つ, 聞く, 見る and 話す need a subject that
  can intend the action. 箱が待っています is not a sentence a Japanese writer
  puts on the page — a box does not wait. A thing that has sat somewhere since
  a time is said with ある: 箱は先月から角にあります. (置いてあります is what an
  adult would write, but 〜てある is not on your list unless the grammar list
  below names it.)
- **Do not count without the counter the object takes.** Pens take 本, books
  take 冊, animals take 匹. 〜つ is not a general-purpose counter: it counts
  small objects that have no counter of their own, and clothes (着) and shoes
  (足) each have one. Neither 着 nor 足 exists at this level, so coats and shoes
  get named, not numbered — コートと帽子と靴がありました, never コートが二つ.
  If the counter an object needs is not on your list, say that the thing is
  there and do not put a number on it.
- **A past time word takes a past sentence.** 昨日は楽しかったです or
  昨日はパンでした — never 昨日は楽しいです.
- **Every sentence has to be one a person could mean.** 猫は毎週その日曜日に
  座ります is made of allowed words and means nothing: 毎週 and その日曜日 fight
  each other, and the sentence names no Sunday a reader could point at. If you
  are short of the word count, put another detail into the scene; never another
  sentence about a fact you have already given.

## When someone speaks

- Put the spoken words in 「」 and close the sentence with と言いました — or
  と聞きました for a question. Narration and speech never run together
  unquoted.
- At most two speakers, and the reader must be able to tell who is talking from
  the sentence before. An exchange nobody is named in reads as noise.
- Speech stays in the same polite 〜です／〜ます register as the narration.
  君, おまえ and plain-form endings are a different register and do not belong
  in a passage written this way.

## How often to write 私

**At most twice in the whole passage**, and the first one is in the first
sentence. Japanese drops a subject the reader already has; a passage that opens
every other sentence with 私は reads as a translation from English, which is the
single most visible thing separating our drafts from the reference texts. After
you name yourself, carry the passage on times, places and the objects in the
scene — 毎朝, 午後, 台所で, かばんの中に — and let the verbs take you as read.

Do not write `grammar_slugs`, `word_count`, `vocabulary_slugs` or word spans —
the build pipeline derives all four from the body with the tokenizer.
{{VALIDATOR_FEEDBACK}}
