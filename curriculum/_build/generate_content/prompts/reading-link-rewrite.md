# Rewrite marked reading mnemonics so they continue the meaning scene

Triage marked these items because their reading mnemonic builds a scene
unrelated to the meaning mnemonic. Rewrite **only `reading_mnemonic`**.
The meaning mnemonic and the description stay exactly as they are — the
rewrite is built on them.

## Inputs

- `curriculum/_build/reports/reading-link-list.json` — `marked` is your work
  list; the maintainer has reviewed it. Rewrite nothing outside it.
- `curriculum/_build/reports/reading-link-candidates.json` — per item: `form`,
  `meaning`, `reading`, `cast`, the stored `meaning_mnemonic` and the old
  `reading_mnemonic`.
- The rule and its examples: section "Continue the meaning scene" in
  `curriculum/_build/generate_content/prompts/kanji-mnemonic.md`, and the
  full-story bullet of "What to write" in `prompts/vocab-mnemonic.md`. Read
  both before the first rewrite.

## Rules for the new `reading_mnemonic`

1. **Continue the meaning scene.** Reuse its object, place or action. The
   cast character walks into that scene. If the meaning mnemonic only
   points back ("the kanji and the radical are the same"), continue the
   story it points to — see `reading-link-triage.md`.
2. **Cast.** Use the cast character listed in `cast` for this item's
   `reading`. If none is listed for that reading, invent a character whose
   name carries the sound. Keep what the old reading did right — its sound
   hook is often fine; it is the scene that changes.
3. **The sound.** The kana of `reading` appears verbatim inside
   `<reading>…</reading>`, and the English sound-alike hook is also inside
   `<reading>…</reading>`.
4. **The meaning.** Name the item's `meaning` once, tagged with its character:
   `<kanji form="研">polish</kanji>` for kanji,
   `<vocabulary form="危ない">dangerous</vocabulary>` for vocabulary. Write
   the character only in the `form` attribute, never in the prose.
5. **Shape.** One sentence or two short ones, about 90–200 characters for
   kanji and 90–220 for vocabulary (the gate's hard ceiling is 240 for both). No `<radical>` tags in a reading
   mnemonic; for vocabulary, no `<kanji>` tags either.
6. **Check:** cover the meaning mnemonic. Does the reading still point back
   to it? If not, it is not finished.

## Output

Write `curriculum/_build/reports/reading-link-rewrites.json` — one row per
item you rewrote, appending to rows already there:

```json
[
  { "kind": "kanji", "slug": "special",
    "reading_mnemonic": "The temple monk <reading>Took</reading> chants 「<reading>とく</reading>」 over the one cow nobody may eat, which is exactly what makes it <kanji form=\"特\">special</kanji>." }
]
```

Then gate without writing:

    cd curriculum/_build && .venv/bin/python -m generate_content.reading_link apply --model <your-model-id> --dry-run

For every `FAIL`, fix that row using the printed errors and run the dry run
again — at most 2 repair attempts per item. An item still failing after that
is removed from the rewrites file and reported to the maintainer. When the dry
run shows 0 failing, apply for real (same command without `--dry-run`).
