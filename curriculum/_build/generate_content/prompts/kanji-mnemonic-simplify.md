# Rewrite marked kanji mnemonics as short summaries

You are rewriting the learner-facing text of kanji mnemonics that triage
marked — for heavy prose, a broken component chain, or both. Each kanji has
two mnemonics serving two quiz directions; rewrite **only the fields the mark
list names**. You are simplifying and repairing prose, not reimagining scenes.

Unlike radicals, kanji mnemonics drive **no illustrations** — nothing outside
the text depends on the exact wording. Scene preservation still applies: the
imagery was human-reviewed, and the reading stories share a fixed cast across
kanji.

## Inputs

- The mark list: `curriculum/_build/reports/kanji-simplify-list.json`
  (produced by `kanji-mnemonic-triage.md`)
- The chain detail: `curriculum/_build/reports/kanji-chain-check.json` (same
  run — which components are `missing` or `untagged`, whether the `landing`
  word needs its `<kanji>` tag, and the primary reading, per slug)
- The sidecar: `curriculum/kanji/mnemonics.json` (every level)

## Rewriting rules — `meaning` field

1. **Same scene.** Keep the actor, the setting, the action and the object of
   the original. You may cut detail and drop clauses; you may not swap the
   imagery.
2. **The chain is law.** Every taught component's taught meaning word must
   appear in the story, wrapped in `<radical>…</radical>` — the chain-check
   report lists them per slug.
   - `untagged`: the word is already in the story — wrap it where the story
     uses it. Often that is the whole fix.
   - `missing`: weave the word into the existing scene in as few words as
     possible, where the shape it names actually sits in the character. Never
     bolt on a second scene to house it. If the scene genuinely cannot carry
     the component, stop and flag the slug for the maintainer — do not invent
     a new story.
   - The report's `landing` status covers a second, separate word: the
     kanji's **own** meaning, the word the story lands on. It follows the same
     `missing`/`untagged` fix — but wrap it in `<kanji>…</kanji>`, never
     `<radical>`. A component is a piece borrowed from below; the landing word
     is the thing this story is building toward, and the app renders the two
     in different colours. If the original wrapped the landing word in
     `<radical>` (the old, now-retired convention), change that tag to
     `<kanji>` rather than leaving it as-is.
3. **Short sentences.** One idea per sentence — most under 18 words, none over
   25. Split at dashes and conjunctions; no "-ing" tails.
4. **Direct resolution.** End on the kanji's meaning, plainly ("that's
   `<kanji>rain</kanji>`"). No wind-up, no "which is exactly the shape of".
   Never tag anything but component words (`<radical>`) and the landing word
   (`<kanji>`).
5. **Length:** aim ~140–260 characters; never longer than the original, and
   never under 140 (the gate floor).

## Rewriting rules — `reading` field

1. **Same scene, same cast character, same hook word.** The character is fixed
   per reading across every kanji that uses it (`prompts/cast-bible.md`) —
   recasting one story breaks the others.
2. **The kana stays verbatim**, inside `<reading>…</reading>` — the report's
   `primary_reading` is the required string. If the original also tagged an
   English hook word (`<reading>jits</reading>`), keep that word tagged.
3. **Short sentences**, as above.
4. **Length:** aim ~120–220 characters; never longer than the original, and
   never under 120 (the gate floor).

## All fields

Plain prose. No markdown, no emoji, no romaji — kana stays kana. Never name a
kanji or radical character that is not a taught component of this kanji.

## Worked example

The marked original (`tooth`, meaning — component 歯 “tooth” present but
untagged, no `<kanji>` landing tag, and two clause-stacked sentences):

> See the whole character as one wide gear-wheel rim, its edge cut into a ring
> of jagged points — as much a grinning mouthful of teeth as a machine part.
> At Grandma Kane's shrine, the temple cats keep gnawing the bell's toothed
> rim like a giant biscuit, filing their own teeth flat until the metal gleams
> like a jaw.

…becomes:

> See the whole character as a gear rim cut into jagged points — a grinning
> mouthful of teeth. At Grandma Kane's shrine, the temple cats gnaw the rim
> like a giant biscuit. Their own teeth file down flat, but the metal only
> gleams sharper. The whole rim is one hard <radical>tooth</radical>, which
> makes the gear a <kanji>cog</kanji>.

Same rim, same cats, same biscuit — each sentence carries one idea, and the
taught component is highlighted where the story lands on it. (Watch the exact
word: the taught meaning is "tooth", so `<radical>teeth</radical>` would not
satisfy the gate — the tagged span must contain the taught word itself. This
example passes the chain check, the Rev 4 readability gate, and the length
band, and is shorter than the original.)

`tooth` is the rare case where a taught component shares its meaning word
with the kanji's own meaning — 歯 is a whole-character pictograph whose only
"component" is itself, registered as a radical for later kanji that build on
it. Retagging the same word "tooth" a second time in `<kanji>` would be an
empty tag pair over the same span, not a second word — so the landing tag
uses the kanji's other listed meaning synonym, "cog", instead. Most kanji have
no such overlap: the component word and the landing word are simply
different, and each gets its own tag where it naturally falls in the story.

## Write back into the sidecar

For each **marked** slug, in the sidecar file:

- Replace only the fields listed in `fields`. An unlisted field stays
  byte-for-byte identical.
- `_meta.review_status`: set to `"draft"` — a human re-reviews every rewrite.
- Leave `description`, `_meta.generator_model` and `_meta.prompt_version`
  untouched.
- Do **not** add `image_prompt`. That field belongs to radicals, whose text
  drives the illustrations; kanji have no illustrations.

For every slug in `kept`: change nothing.

Then sync the local drafts, which drive any future rebuild
(`write_sidecar` reconstructs sidecars from them and would silently drop
sidecar-only edits): for each marked slug, if a draft exists at
`curriculum/_build/generate_content/drafts/mnemonics/*/kanji/<slug>.json`
(the level directory varies — the old JLPT folders `n5/` … and the ladder
folders `level-NN/`), apply the
same field changes to its `tool_input`. The drafts directory is gitignored, so
on a machine without it this step is a no-op — but then never run
`assemble`/`run` for kanji here.

## Verify

- Re-run the chain-check snippet from the triage: every slug you rewrote must
  come back absent from `kanji-chain-check.json`.
- Re-read each summary against the sentence rules. The mechanical gate
  (`validate_mnemonics.py`, Rev 4) re-checks sentence length plus the component
  and reading tags on freshly validated drafts; your summaries must pass it.
- Regenerate the shipped JSON: from `curriculum/_build` run
  `python generate.py`, then from the repo root
  `npm run validate-schema && npm run compile-curriculum`.
- Report: how many fields rewritten, and any slug you could not
  fix without changing the scene — list those; the maintainer decides.
