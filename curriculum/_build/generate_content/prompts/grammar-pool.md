# Write the review sentence pool for one {{LEVEL}} grammar point

These sentences are what a learner reviews this grammar with, for months. Each
review shows one sentence on a **Read** card (the learner types the meaning of
the highlighted grammar) and a different one on a **Build** card (the learner
sees the English and a list of the words, and types the whole Japanese
sentence). Follow the teaching voice above.

## The grammar point

- Form: **{{FORM}}** — {{MEANING}}
- Structure: {{STRUCTURE}}
- Accepted forms: {{ACCEPTED_FORMS}}
- Family: {{FAMILY}}

Same-family points (for "other grammar" answers below):

{{FAMILY_POINTS}}

## Current sentences

{{CURRENT_SENTENCES}}

Keep every sentence marked PASS unless the variety rules below force a change.
Replace or fix every sentence marked FAIL.

## Vocabulary you may use

Every content word must come from this list (particles and grammatical
endings are fine). Put the slug in [brackets] of **every** word you use —
pronouns (私, あなた) and この/その included — in that sentence's
`vocabulary_slugs`. The Build card lists exactly those words, so a word you
use but do not list is a word the learner cannot write.

{{ALLOWED_VOCAB}}

## Grammar you may use besides this point

{{EARLIER_GRAMMAR}}

## What to write

One JSON object:

- `accepted_meanings`: 3–6 short English answers a learner might type for this
  grammar's meaning, the clearest first ("because", "since", "so"). For a
  particle, name its job ("object marker").
- `sentences`: **8–10** sentences. For each:
  - `japanese`: plain Japanese, ≤ 30 characters, using **{{FORM}}** (one of
    the accepted forms) exactly once. No names of people or places, no
    numbers.
  - `english`: natural English.
  - `vocabulary_slugs`: every word used, from the list above.
  - `form` (only when the grammar's characters appear more than once in the
    sentence): the grammar with a little text in front, joined by `|`, e.g.
    `今日|は`.
  - `alternates`: other answers a learner could correctly type on the Build
    card, plain Japanese:
    - `"valid"` — same grammar, different but natural wording: another word
      order, without 私は/あなたは, another accepted form with the same
      meaning and politeness (じゃありません for ではありません — not でした
      for です, not だ for です).
    - `"other_grammar"` — the same sentence with a same-family point swapped
      in for this one (only swap the grammar; change nothing else).
    Give 0–3 alternates per sentence; only ones a learner would really type.
- Variety: no two sentences may use the same set of words, and the set must
  mix sentence types — at least two of: statement, question, negative, past.
- Short, everyday, concrete; a different situation in every sentence.
{{VALIDATOR_FEEDBACK}}
