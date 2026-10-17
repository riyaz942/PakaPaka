# Grammar content — mnemonics

**Date:** 2026-10-17
**Status:** Design approved; plan not written
**Scope:** N5 + N4 grammar (161 points). Sub-project B of two; sub-project A (linked words, PR #5) is merged into `main`.

---

## 1. Problem and intent

Radicals, kanji and vocabulary each ship a story mnemonic. Grammar ships none: the 161 skeleton entries in `curriculum/_build/n5_grammar.py` / `n4_grammar.py` carry a one-line `"mnemonic"` seed (`"を tags the thing the verb acts on."`), but nothing reads it, and it is a meaning summary, not a memory hook.

Content pipeline Revision 1 (July 2026, `docs/content/content-pipeline-plan.md`) removed grammar mnemonics on purpose: "grammar has full lessons now; a one-line mnemonic is noise". This feature reverses that decision with a different kind of mnemonic — a short story hook, not a one-line summary.

The mnemonic has two jobs, in this order:

1. **Meaning (main job):** you see `ておく` and you remember what it means. The sound of the form is linked to its meaning.
2. **Position (small job):** you remember where the form goes in a sentence.

Telling similar points apart (は vs が) is not a job of the mnemonic; the lesson's Contrast section does it.

## 2. Decisions (locked in brainstorm)

| Question | Decision |
| --- | --- |
| Style | The kanji/vocabulary reading-mnemonic style: a short story in which a character says an English sound-alike of the form while doing its meaning. The sound hook and the meaning are one joke. |
| True origins | Used where one exists (おく = 置く "put down"): the story's action is the origin. Origins come only from a reviewed table, never from the model. |
| Position | The text ends on a very short Japanese example with the form in place. |
| Field | One field, `mnemonic_text`. Grammar has no reading quiz, so there is no meaning/reading split. |
| Storage | Sidecar `curriculum/grammar/mnemonics.json` → `generate.py` → `curriculum/grammar/<level>.json` → existing `items.mnemonic_text` column. No new column, no `user.db` migration. |
| Pipeline | Extend `generate_mnemonics.py` with a fourth `--type grammar`; all three lanes (web chat, subagent, single session). |
| App | Grammar detail page and lesson step 2. Not on review cards (same as kanji and vocabulary). |
| Highlight | `<reading>` (gold, existing) marks the sound; a new `<grammar>` tag marks the meaning, in bold primary text — the grammar accent is the same gold as `<reading>`. |
| Seeds | Removed from both skeleton files. |
| Delivery | One PR with tooling, app, origin table and all 161 reviewed mnemonics. |

## 3. Content contract

**Shape.** A story of one or two English sentences, then one Japanese example sentence. 120–240 characters in total, tags stripped. The existing readability check applies (no sentence over 35 words).

1. **Story:** a concrete scene, optionally with a cast character (`prompts/cast-bible.md`) as the actor. A character says or does the English sound-alike of the form, and that action *is* the meaning. For a long form the hook uses the part that carries the meaning (しまう in てしまう, not て). If the point has an origin, the story's action is the origin's meaning.
2. **Example:** the last sentence, Japanese only, ending in `。`. The form is attached to at least one word. Every word is at or below the point's level.

Cast characters are actors only. The cast bible's "one reading, one character" rule is for kanji readings; grammar forms do not get a fixed character.

**Examples (the brainstorm's reference set):**

> **ておく** (origin 置く "put down"): The night before the picnic, Koichi buys the drinks, puts them down by the door and nods "<reading>OK</reading>": all set <grammar>for later</grammar>. 買っ<reading>ておく</reading>。

> **てしまう**: Little Shima eats the whole birthday cake, every last crumb, then whispers "<reading>shh, Ma!</reading>", because it is <grammar>all gone, and oops</grammar>. 食べ<reading>てしまう</reading>。

> **を**: At the market, Grandma Kane jabs a finger at one fish and cries "<reading>Oh!</reading> That one!", so the seller knows <grammar>exactly what</grammar> she will buy. 魚<reading>を</reading>買う。

> **は**: Sei stands up in class and asks "<reading>Wha</reading>t about me?", and now everyone knows <grammar>the topic</grammar> of her next sentence. 私<reading>は</reading>学生です。

**Tags.** Only `<reading>` and `<grammar>` are allowed.

- `<reading>` — the sound. At least one tag holds the English sound-alike (Latin letters); at least one holds kana that is a substring of one of the point's `accepted_forms` / `primary_form` (normally the form inside the example).
- `<grammar>` — the meaning, in English. At least one.

## 4. Origin table — `curriculum/_build/grammar_origins.json`

```json
{
  "review_status": "draft",
  "origins": {
    "teoku": { "word": "置く", "gloss": "to put down", "keywords": ["put", "set"] },
    "wo": null
  }
}
```

- **Every one of the 161 slugs has an entry**: an origin object or `null`. `null` is a recorded decision ("no useful origin"), never a gap. A missing or unknown slug is an error in the generator and in its test.
- `keywords` are the English words that show the origin's action in a story (case-insensitive whole-word match).
- I write the first draft; the maintainer reviews it and sets `"review_status": "reviewed"`. The generator refuses `--type grammar` while the file is not `reviewed`.
- The file is build input only. It does not ship and the app never reads it.

## 5. Generator — `curriculum/_build/generate_content/`

- **`prompts/grammar-mnemonic.md`** — the contract in §3, the four reference examples, `persona.md`, and the cast bible injected as for the other types.
- **`mnemonic_context.py`** — a grammar context builder. Per point: `slug`, `primary_form`, `accepted_forms`, `meaning`, `structure`, `family`, level, the lesson's opening text (the part before its first `## ` heading), the origin entry (or the explicit "no origin: do not state any origin" note), and the vocabulary allowed in the example (at or below the point's level).
- **`generate_mnemonics.py`** — `grammar` added to `--type` for `requests`, `run`, `collect`, `assemble`, `webprompts`, `ingest`. Drafts go under `drafts/mnemonics/` in the same layout as the other types. `PROMPT_VERSION["grammar"] = 1`. Failed drafts are requeued with the gate errors, capped at `MAX_ATTEMPTS`, then `flagged_for_rewrite` — unchanged behaviour.
- **`validate_mnemonics.py`** — the grammar gate. A draft fails if:
  1. the length (tags stripped) is outside 120–240, the story has more than two sentences, or a sentence is over the readability limit;
  2. it has a tag other than `<reading>` / `<grammar>`, or broken markup;
  3. no `<reading>` holds Latin letters, or no `<reading>` holds kana from the point's forms;
  4. it has no `<grammar>` tag;
  5. the last sentence is not Japanese-only ending in `。`, or holds no accepted form attached to another word;
  6. a Japanese word in it is above the point's level (`level_check.find_violations`, the point's own forms and the origin word allowed);
  7. the point has an origin and none of its `keywords` is in the story;
  8. the point has no origin and the story has an origin phrase (`really is`, `comes from`, `originally`, `derived from`, `short for`).
- Output after the gate: **`curriculum/grammar/mnemonics.json`**, `{slug: {"mnemonic_text": ..., "_meta": {generator_model, prompt_version, review_status: "draft"}}}`, the same shape as the other sidecars.

## 6. Build and compile

- **`generate.py`** — `GRAMMAR_MNEMONICS_PATH`; `_build_grammar_level` sets `item["mnemonic_text"]` from the sidecar and merges the sidecar `_meta` into the lesson's with `_merge_sidecar_meta` (least reviewed status wins). A draft mnemonic therefore keeps the point behind the existing unreviewed-content warning (and `--fail-on-draft`).
- **Skeletons** — the `"mnemonic"` key is removed from all 161 entries in `n5_grammar.py` / `n4_grammar.py`, and from the field list in their docstrings.
- **Schema** — `grammarItem.properties.mnemonic_text`: `{"type": "string", "minLength": 1}`.
- **`scripts/compile-curriculum.ts`** — the grammar insert writes `item.mnemonic_text ?? null` (today a literal `null`); `GrammarItem` type gains the field.
- **Seed** — rebuild the bundled `curriculum.db` the same way as PR #5.

## 7. App — `mobile/`

- **`AnnotatedText`** — tag union gains `grammar`; style `font-ui-bold text-primary` (a family, not `font-bold`; see redesign-v2 notes).
- **`GrammarDetail`** — a "Mnemonic" block directly under `AcceptedAnswersDisclosure`, before the lesson body: `AnnotatedText` with `MNEMONIC_PROSE`. No `mnemonicText` → "Mnemonic coming soon" placeholder, the same as vocabulary. The query already selects `mnemonic_text`.
- **`LessonItemSections`** — grammar step 2 shows the mnemonic block first, then the "How it works" rules, then `PersonalMnemonicEditor`. `GRAMMAR_SECTION_STEPS` stays `['Intro', 'Usage', 'Examples']`; the "Grammar carries no mnemonic" comments are corrected.
- **Browse** — the "No mnemonic" pill applies to grammar too (the grammar exemption is removed).
- **Review cards** — no change.

## 8. Studio — `web/`

- `sidecar.ts` `MNEMONIC_FIELDS.grammar = ['mnemonic_text']`; `editSchema.ts` grammar gains an editable `mnemonic_text` textarea, so an edit writes back to `curriculum/grammar/mnemonics.json`.
- `mnemonicTags.tsx` renders `<grammar>`; the Studio grammar page shows the mnemonic.
- A separate **"Mnemonic status"** control on the grammar page writes only the sidecar's `_meta.review_status`. The lesson's status control keeps writing only the lesson frontmatter, so marking a mnemonic never changes a reviewed lesson.
- The Guide lists `grammar` in the mnemonic stage with its gap count.

## 9. Workflow docs — `docs/workflows/`

The three `radical-kanji-vocab-mnemonic-*-automation-prompt.md` files and `radical-kanji-vocab-mnemonic-web-chat-workflow.md` accept `grammar` as a type, with its step notes (origin table must be reviewed first; the grammar gate). The README table row covers grammar. The web-chat lane keeps the known Gemini rules (clipboard + Cmd/V; wait for the stop button to go).

## 10. Testing

- **Python:** one test per gate rule in §5 (pass and fail); the origin table covers exactly the 161 slugs; the generator refuses an unreviewed table; the context builder (origin vs `null` note, lesson opening text); `generate.py` inlines `mnemonic_text` and merges `_meta`; no skeleton entry has `"mnemonic"`.
- **Curriculum:** `npm run validate-schema`, `npm run compile-curriculum` (grammar rows carry `mnemonic_text`), `compile-curriculum.test.ts` case.
- **Mobile:** `<grammar>` tag style; `GrammarDetail` block and placeholder; lesson step 2 order; Browse pill for grammar. `npm test`, `npm run lint`.
- **Root:** `npm run check-contrast`.
- **Studio:** mnemonic edit and "Mnemonic status" write only to the sidecar.

## 11. Rollout (branch `grammar-mnemonics` in the main checkout, from `origin/main` a3c6c8e)

1. Tooling, build, app and Studio code, with tests.
2. Draft `grammar_origins.json` → **maintainer review** → `reviewed`.
3. **Pilot** (10 points, both levels, particles to patterns): `wa-topic`, `wo`, `ga`, `desu`, `masu`, `mashou`, `te-iru`, `tai`, `kara-because` (N5), `teoku` (N4) → **maintainer review in Studio** → adjust the prompt or the gate if necessary (a prompt change before the full run needs no version bump: nothing is reviewed yet).
4. The other 151 points in small batches through one lane → maintainer review.
5. Rebuild the seed; update `docs/working-history.md` and add a note to `docs/content/content-pipeline-plan.md` that grammar now has a mnemonic (reverses Revision 1's "grammar: none").
6. One PR. It merges only when all 161 mnemonics are `reviewed`.

**Not in scope:** N3+ grammar, mnemonics on review cards, mnemonic images, changes to reviewed lessons or to existing radical/kanji/vocabulary mnemonics.
