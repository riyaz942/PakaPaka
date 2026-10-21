# Check the {{LEVEL}} grammar sentences for {{FORM}}

These sentences teach **{{FORM}}** ({{MEANING}}) on a Build card: the learner
sees the English and types the whole Japanese sentence. A wrong sentence
teaches the mistake and marks a learner wrong for the correct answer.

Structure: {{STRUCTURE}}

What the lesson teaches about this point:

{{CAUTION_NOTES}}

For every sentence, decide:

- `"ok"` — correct, natural Japanese that uses {{FORM}} the way the lesson
  teaches and says what the English says.
- `"fix"` — it breaks a rule above, is unnatural, or does not say what the
  English says. Give the smallest corrected sentence in `"fixed"`. Keep
  every listed word, the register (plain/polite) and the English. Write
  plain Japanese, no furigana brackets.
  Example (間・間に): 勉強している間、猫が窓から出た。 → 勉強している間に、猫が
  窓から出た。 (going out is one event inside the stretch, so it takes 間に).
- `"unfixable"` — no correct sentence says the English with the listed
  words and {{FORM}}.

Do not fix style you merely prefer. If you are unsure, choose `"ok"`.

## Sentences

{{SENTENCES}}
{{VALIDATOR_FEEDBACK}}
## Reply

One JSON object with one entry per sentence, the sentence copied exactly:

{"sentences": [{"japanese": "…", "verdict": "ok", "reason": "one short line"},
               {"japanese": "…", "verdict": "fix", "fixed": "…", "reason": "one short line"}]}
