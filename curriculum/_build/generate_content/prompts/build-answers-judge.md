# Judge accepted answers for {{LEVEL}} {{FORM}}

A learner reviews **{{FORM}}** ({{MEANING}}) on a Build card: they see the
English sentence and type the whole Japanese sentence. Each sentence below
has candidate answers that differ from it. Judge every candidate:

- `"valid"` — natural Japanese, uses {{FORM}} the same way, and means what the
  English says. A teacher would mark it fully correct
  (本を図書館で読みます for 図書館で本を読みます; 散歩をします for 散歩します).
- `"contrast"` — natural Japanese, but it adds a meaning the English does not
  have: contrastive は ("at least X", "X, unlike the others")
  (宿題は先にやった for 宿題を先にやった).
- `"wrong"` — unnatural or ungrammatical, breaks a fixed pattern (方はいい for
  方がいい), puts は inside a subordinate clause where it cannot go, uses
  another grammar point instead of {{FORM}}, or changes the tense, the
  politeness, or who does what (弟は寝ている間に、本を読んだ makes the
  brother the one who reads).

If you are unsure, do not choose `"valid"`: an accepted wrong answer teaches
the mistake, and the learner can still save their own answer in the app.

## Sentences and candidates

{{CANDIDATES}}
{{VALIDATOR_FEEDBACK}}
## Reply

One JSON object with one verdict per candidate, the candidate copied exactly:

{"verdicts": [{"candidate": "…", "verdict": "valid", "reason": "one short line"}]}
