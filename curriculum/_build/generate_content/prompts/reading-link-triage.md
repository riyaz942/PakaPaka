# Triage reading mnemonics — mark the ones whose scene does not connect

You are auditing the reading mnemonics of a Japanese-learning app. Each kanji
and each vocabulary word has a meaning mnemonic (a scene that explains the
meaning) and a reading mnemonic (a scene that carries the sound). Many reading
mnemonics start a new scene that has nothing to do with the meaning scene, so
the learner holds two unrelated images and nothing joins the sound to the
meaning. Your job is to find those. You are **marking only** — do not rewrite
anything.

## File to read

`curriculum/_build/reports/reading-link-candidates.json` — a list of
candidates. Each has `kind` (`kanji` / `vocab`), `slug`, `form`, `meaning`,
`reading`, `cast`, `meaning_mnemonic` and `reading_mnemonic`. Write it first
if it is missing:

    cd curriculum/_build && .venv/bin/python -m generate_content.reading_link select

Read it in chunks of about 50 candidates. Judge every candidate.

## The one question

**Does the reading scene continue the meaning scene?** It continues it when it
reuses the meaning scene's object, place or action — the same sword, the same
crates, the same cave, the same mountain trail.

- **Keep** when the scene continues, even if the reading never names the
  meaning word. Naming the meaning is not this audit's business.
- **Mark** when the reading builds a new scene — a new place, new objects, a
  new event — that would make as much sense next to any other meaning
  mnemonic.
- A cast character's name is not a scene. Ken the dog appearing is not a
  link; Ken polishing *the sword* is.
- A reused element must be more than the meaning word itself. A crow
  singeing "a bloom" does not continue a meaning scene of grass turning
  colour; Ken polishing "the sword" does continue the sword scene.
- Some meaning mnemonics only point back ("the kanji and the radical are
  the same", "the kanji and the word are the same") and build no scene.
  Judge those against the story they point to: the radical's image for a
  kanji (`kanji_context(...)["identical_radical"]["image"]`), the kanji's
  meaning mnemonic for a word (`vocab_context(...)["identical_kanji"]`),
  following the chain down to the radical if that kanji also only points.
- Do not judge length, humour, tags or style. One question only.

## Calibration — these five are settled

| Item | Verdict | Why |
|---|---|---|
| kanji `polish` 研 | keep | Ken polishes the sword from the meaning scene |
| kanji `goods` 品 | keep | inspector stamps the crates from the meaning scene |
| kanji `research` 究 | keep | the queue forms at the cave from the meaning scene |
| kanji `happiness` 幸 | mark | shop intercom; meaning scene is a stalk in earth |
| kanji `special` 特 | mark | konbini intercom; meaning scene is the temple cow |

## Output

Write `curriculum/_build/reports/reading-link-list.json`:

```json
{
  "marked": [
    { "kind": "kanji", "slug": "happiness",
      "reason": "shop intercom scene; meaning scene is a sprouting stalk" }
  ],
  "kept": [ { "kind": "kanji", "slug": "polish" } ],
  "stats": { "total": 737, "marked": 1, "kept": 736 }
}
```

- Every candidate appears exactly once, in `marked` or `kept`.
- `reason`: 12 words or fewer, naming both scenes.
- `stats.total` = number of candidates; `stats.marked` = rows in `marked`;
  `stats.kept` = rows in `kept`.

When you are calibrating (the workflow will say so), judge only the five items
above and write `curriculum/_build/reports/reading-link-calibration.json` in
the same shape, with `stats.total` 5.

Then check the full list mechanically:

    cd curriculum/_build && .venv/bin/python -m generate_content.reading_link check-list

Fix every error it prints. Then stop: the maintainer reviews the list before
any rewrite.
