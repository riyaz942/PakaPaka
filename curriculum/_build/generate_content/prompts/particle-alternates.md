# Judge particle-swap answers for one {{LEVEL}} grammar point

A learner reviews **{{FORM}}** ({{MEANING}}) on a Build card: they see the
English sentence and type the whole Japanese sentence. The app accepts only
the sentence and its listed alternates. Each sentence below has candidate
answers that change one particle. Judge every candidate:

- `"valid"` — natural Japanese, uses {{FORM}} the same way, and means what the
  English says. A teacher would mark it fully correct
  (お茶は熱いうちに飲んだ方がいいですよ for お茶が熱いうちに飲んだ方がいいですよ).
- `"contrast"` — natural Japanese, but the particle adds a meaning the English
  does not have: contrastive は ("at least X", "X, unlike the others")
  (忘れないうちに名前は書いた for 忘れないうちに名前を書いた).
- `"wrong"` — unnatural or ungrammatical, breaks a fixed pattern (方はいい for
  方がいい), puts は inside a subordinate clause where it cannot go, or changes
  who does what (子供は寝ているうちに、ご飯を食べた makes the child the one who
  eats).

If you are unsure, do not choose `"valid"`: an accepted wrong answer teaches
the mistake, and the learner can still save their own answer in the app.

## Sentences and candidates

{{CANDIDATES}}
{{VALIDATOR_FEEDBACK}}
## Reply

One JSON object with one verdict per candidate, the candidate copied exactly:

{"verdicts": [{"candidate": "…", "verdict": "valid", "reason": "one short line"}]}
