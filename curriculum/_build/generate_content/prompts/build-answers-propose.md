# Propose accepted answers for {{LEVEL}} {{FORM}}

A learner reviews **{{FORM}}** ({{MEANING}}) on a Build card: they see the
English sentence and type the whole Japanese sentence. The app accepts only
the sentence and its listed alternates, so every other correct answer must
be listed, or a correct learner is marked wrong.

Structure: {{STRUCTURE}}

For every sentence, list the other answers a teacher would mark fully
correct for that English:

- Same listed words, same grammar point ({{FORM}}), same register
  (plain/polite), same meaning, tense and who does what.
- Look for: particle choices (本は for 本が), optional particles (を on a
  する verb: 散歩をします for 散歩します), word order (本を図書館で読みます for
  図書館で本を読みます), a dropped or added personal pronoun, and
  combinations of these in one sentence.
- Most likely learner answers first; at most 10 per sentence; none is fine.
- Do not vary only punctuation, spacing or kana/kanji spelling — the app
  already accepts those.
- Do not swap in another grammar point (ので for から).
- Plain Japanese only, no furigana brackets.

## Sentences

{{SENTENCES}}
{{VALIDATOR_FEEDBACK}}
## Reply

One JSON object with one entry per sentence, the sentence copied exactly:

{"answers": [{"japanese": "…", "candidates": ["…", "…"]}]}
