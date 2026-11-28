# Rewrite marked radical mnemonics as short summaries

You are rewriting the learner-facing text of radical mnemonics that triage
marked as too heavy. Each radical's illustration **already exists** and was
drawn from the current text — so the scene cannot change. You are simplifying
the prose, not reimagining the picture.

## Inputs

- The mark list: `curriculum/_build/reports/radical-simplify-list.json`
  (produced by `radical-mnemonic-triage.md`)
- The sidecar: `curriculum/radicals/mnemonics.json` (every level)

## Rewriting rules, in order

For every slug in `marked`, rewrite its `mnemonic_text`:

1. **Same scene.** Keep the actor, the setting, the action and the object of
   the original — the illustration shows exactly that. You may cut detail and
   drop clauses; you may not swap the imagery.
2. **One shape clause.** Keep a single short phrase that ties the shape to the
   image ("curls shut", "split apart"). One, not two.
3. **Short sentences.** One idea per sentence — most under 18 words, none over
   25. Split at dashes and conjunctions; no "-ing" tails.
4. **Direct resolution.** End on the meaning, plainly ("that's a lid"). No
   wind-up, no "What comes away … is", no "your marker for".
5. **The meaning word must appear**, wrapped in exactly one `<radical>` tag.
   The word inside the original's `<radical>` tag is the meaning — keep that
   exact word tagged in your summary. (An accepted answer from the shipped
   item in `curriculum/radicals/*.json` is also legal.) Never tag anything
   else, and never drop the word.
6. **Length:** aim ~100–180 characters; never longer than the original.
7. Plain prose. No markdown, no emoji, no romaji. The radical's form (三) may
   appear where the original used it.

Worked example — the marked original:

> Picture a little pot: the short dash on top is the tiny knob you grab, and
> the wide horizontal stroke beneath it is the flat disc resting snugly over
> the rim. Together they snap down into place as the <radical>lid</radical>.

…becomes:

> Picture a little pot. The dash on top is the knob you grab. The wide stroke
> under it is the disc that covers the rim. Together they snap into place as
> the <radical>lid</radical>.

Same pot, same knob, same disc — the detail is trimmed and each sentence
carries one idea.

## Write back into the sidecar

For each **marked** slug, in the sidecar file:

- `image_prompt`: the **original** `mnemonic_text`, copied verbatim. This is
  what the existing illustration was drawn from — do not paraphrase it.
- `mnemonic_text`: your new summary.
- `_meta.review_status`: set to `"draft"` — a human re-reviews every summary.
- Leave `description`, `_meta.generator_model` and `_meta.prompt_version`
  untouched.

For every slug in `kept` (not marked):

- Add `image_prompt` with the **same value** as its current `mnemonic_text` —
  identical text, so every radical carries both fields and the format stays
  uniform. Change nothing else, including `_meta`.

Then sync the local drafts, which drive any future rebuild
(`write_sidecar` reconstructs sidecars from them and would silently drop
sidecar-only edits): for each marked slug, if
`curriculum/_build/generate_content/drafts/mnemonics/*/radical/<slug>.json`
exists (the old JLPT folders `n5/` … or the ladder folders `level-NN/`), apply the same `mnemonic_text` / `image_prompt` change to its
`tool_input`. The drafts directory is gitignored, so on a machine without it
this step is a no-op — but then never run `assemble`/`run` for radicals here.

## Verify

- Re-read each summary against rules 3–5. The mechanical gate
  (`validate_mnemonics.py`, Rev 4) re-checks sentence length and the tag on
  freshly validated drafts; your summaries must pass it.
- Regenerate the shipped JSON: from `curriculum/_build` run
  `python generate.py`, then from the repo root
  `npm run validate-schema && npm run compile-curriculum`.
- Report: how many rewritten, how many duplicated, and any slug you could not
  simplify without changing the scene — list those; the maintainer decides.
