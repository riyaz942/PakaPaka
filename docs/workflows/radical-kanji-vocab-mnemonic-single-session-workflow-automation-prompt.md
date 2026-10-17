Task: Generate Radical/Kanji/Vocabulary Mnemonics — Single Session, No Subagents

Generate radical mnemonics, kanji mnemonics or vocabulary mnemonics **entirely
within the current session** — no subagents, no browser, no clipboard, no
API credentials. This is the single-session sibling of
`docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md`:
same auto-select, same context builder, same mechanical gate, same per-slug
repair budget — the only difference is who writes the prose. There, a fresh
subagent drafts each group. Here, THIS session drafts them directly, then the
session ends; you get the next batch of slugs by running this same prompt
again in a brand-new session. Use this shape when you want each unit of work
isolated in its own session (cost/context isolation) rather than orchestrated
by a long-running coordinator that spawns subagents.

This run is for ONE content type at a time and **auto-selects the next
<slug-count> not-yet-done slugs** for that type — you do NOT paste a slug
list.

Level (one JLPT level per run; change to `n4`, `n3`, … when ready):

<level = n4>

Content type (one of `radical`, `kanji` or `vocab`):

<type = vocab>

Number of slugs this session targets (this session drafts, ingests and
repairs exactly this many slugs, then stops — no more, no less unless the
auto-select prints fewer because the layer is nearly done):

<slug-count = 20>

Keep <slug-count> small — this is one session's entire attention span, not a
batch to delegate. 3–5 is the sweet spot: past that, the last item gets
noticeably less care and each successive reply re-bills earlier replies as
context, which erodes the isolation this shape is for. If you want a bigger
batch, run this prompt again in a new session rather than raising
<slug-count>.

Model/effort notes

- There is no subagent to configure — THIS session's own model does the
  writing. Use a strong reasoning model at high effort for actual content;
  this is the mnemonics themselves, the thing the app is actually for.
- Pass this session's model name as the ingest `--model` value (Step 4) so
  `_meta.generator_model` is honest.

---

Layer Ordering — read before starting

The three types are a chain, not three independent jobs:

- a **kanji** meaning mnemonic continues each component radical's established
  `mnemonic_text`
- a **vocabulary** meaning mnemonic hooks into its component kanji's
  `meaning_mnemonic`

So a layer must be finished, ingested, **and inlined by `generate.py`** before
the layer above it is generated. This is enforced, not advisory:
`webprompts --type kanji` raises

  ValueError: component radical hi-sun has no `mnemonic_text` yet. Generate the
  radical layer first (...)

if you try to skip ahead. Order for a level: **radicals → `generate.py
--level <level>` → kanji → `generate.py --level <level>` → vocab**. Finish
<level> fully before moving to the next level. If Step 2 raises that error,
stop and report it — the previous layer is not done.

---

Workflow

Work from:

curriculum/_build

Step 1: Select This Session's Slugs

Select automatically — do NOT hand-pick or paste a slug list. Pick the next
<slug-count> slugs of <type> (in curriculum sort order) that do not already
have a gate-passing draft **at the current `PROMPT_VERSION`**. Substitute
this run's <type> for KIND, <level> for LEVEL and <slug-count> for
BATCH_LIMIT, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import mnemonic_context as mc
from generate_content.generate_mnemonics import KIND_DIR, PROMPT_VERSION, sidecar_path
LEVEL, KIND, BATCH_LIMIT = '<level>', '<type>', <slug-count>   # KIND: 'radical', 'kanji' or 'vocab'
slugs = mc.all_slugs(LEVEL, KIND_DIR[KIND])
path = sidecar_path(KIND)
sidecar = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
done = {
    slug for slug in slugs
    if sidecar.get(slug, {}).get('_meta', {}).get('prompt_version') == str(PROMPT_VERSION[KIND])
}
todo = [s for s in slugs if s not in done][:BATCH_LIMIT]
print(f'{len(todo)} slug(s) selected (target={BATCH_LIMIT}, done={len(done)}):')
print(','.join(todo))
PY

Because "done" is read from the checked-in sidecar (keyed by slug, not by
which session wrote it), a previous single-session run's successfully
ingested slugs are already excluded here automatically — this is what makes
running this prompt repeatedly in fresh sessions seamless. If it prints 0
slugs, this level+type is already fully generated at the current prompt
version — stop and report that.

Step 2: Generate the Prompt Files

.venv/bin/python -m generate_content.generate_mnemonics webprompts --type <type> --level <level> --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.prompt.md

Regenerating a prompt is a safe no-op. If this command raises the "no
`mnemonic_text` yet" / "no `meaning_mnemonic` yet" ValueError, the layer
below is unfinished — see Layer Ordering above and stop.

Step 3: Draft Every Reply Yourself — No Subagent

Read each prompt file listed above, one per slug. In each file, everything
BELOW the HTML comment header (the block that opens with `<!--` and ends with
a line ending in `-->`) is the complete, self-contained task for that item:
the teaching-voice sheet, the item itself, its taught decomposition with each
component's established prose, the reading target, the reviewed look-alikes,
the cast block, the writing rules, and the JSON output contract. The header
itself is orchestration instructions for the caller — ignore it. Each header
names its own slug; do not let one file's header send you to another file's
reply path.

The teaching-voice sheet is identical in every file — read it once and apply
it to all of them. Everything from "The kanji" / "The radical" / "The word"
onward is per-item and must be obeyed per item.

If <type> = radical, apply this style calibration (radical mnemonics only —
kanji and vocab already carry their own cast/reading discipline):

  These are shape-to-meaning mnemonics, not gag scenes. Fuse the stroke
  description and the meaning into ONE single image — either the shape
  literally resembles the meaning, or the shape is compared to one real-world
  object/scenario that shares the meaning. Do NOT describe the shape correctly
  and then bolt on a second, unrelated scene (a stock animal or bystander
  character doing something silly) purely for a joke. Reviewed examples: 儿
  "Look at 儿 head-on and you're staring at someone standing with their feet
  planted apart, the two strokes sweeping down and out like a pair of sturdy
  human legs mid-stride." 工 "Picture a steel I-beam standing between two flat
  concrete slabs: the top and bottom strokes are the slabs, the line down the
  middle is the beam being lowered into place." Prefer the shorter-to-middle
  end of the length target (roughly 180–260 characters) unless an item
  genuinely needs the extra room.

Write the mnemonics for every item exactly as its own prompt body asks, then
write ONE reply file per item, each to its own path:

curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.reply.md

Do not write a combined file. Requirements:

- Write EXACTLY one fenced ```json code block and nothing else in each reply
  file — no preamble, no commentary, nothing referring to the other items in
  this run. Use the prompt's exact key names verbatim, add no others.
- Treat each item's constraints as independent. An item may only name the
  components ITS OWN prompt lists, and may only mention the look-alikes ITS
  OWN prompt lists — even when another item in this run shares a component or
  is itself a look-alike.
- Return the keys for this type:
    radical → `mnemonic_text` **and** `image_prompt` (both required), plus
              `description` **only if this radical needs one**
    kanji   → `meaning_mnemonic`, `reading_mnemonic`, and `description` **only
              if this kanji needs one**
    vocab   → `meaning_mnemonic`, `reading_mnemonic`, and `description` **only
              if this word needs one**
- `description` is optional for all three types. Omit it entirely unless the
  prompt lists look-alikes (then required, for the visual contrast) or the
  item has a real nuance the mnemonics cannot carry. A description that only
  restates the meaning and counts strokes is noise; leave it out.
- Length, per field:
    radical `mnemonic_text`  roughly **100–180** characters
    radical `image_prompt`   roughly **150–300** characters
    kanji meaning            roughly **120–220** characters, two or three
                             sentences — hard ceiling 260 (but **50–150**,
                             hard ceiling 200, when the kanji just *is* a
                             taught radical — see below)
    vocab meaning            roughly **70–200** characters, one or two
                             sentences — hard ceiling 230 (but **40–200** when
                             the word just *is* its kanji — see below)
    kanji reading            roughly **90–200** characters, one sentence or
                             two short ones, continuing the meaning scene
    vocab reading            roughly **90–220** characters when it is a
                             story; **60–170**, one sentence, when it points
                             back at a word that already taught the reading;
                             **absent entirely** for a derivable reading — see
                             below
  Except for the kanji/vocab meaning ceilings, these are targets, not rules.
- **Kanji meaning mnemonics — the Rev 6 style.** Two or three sentences, most
  under 14 words, none over 20. No dash-joined second clauses, no "-ing"
  tails, no colon-joined reveal at the end. Plain English a ten-year-old
  would use. One causal chain — each sentence is caused by the one before it,
  the last one produces the meaning; if two sentences could swap places it is
  a list, not a story. Components enter as ordinary things the scene already
  needs, not their own staged mini-event.
- **When the kanji simply *is* a taught radical**, do not write a story — the
  prompt's "Is this kanji just a radical it already knows?" section says so
  outright (computed mechanically, not a judgement call). Write one or two
  sentences saying the radical and kanji are the same, e.g. "The
  `<radical>mountain</radical>` radical and the `<kanji>mountain</kanji>`
  kanji are the same." Both tags still go on, wrapping the same word on two
  spans. Band: 50–150 characters, hard ceiling 200. Where the kanji carries a
  sense the radical does not (工 "craft" over "construction"), add exactly
  one sentence tying the senses together if the prompt says so. The reading
  mnemonic is unaffected — full treatment as usual.
- **Vocab meaning mnemonics — the Rev 6 style.** At most two sentences in
  which the kanji *combine into* the word, not a scene they take turns acting
  in. "A `<kanji>mouth</kanji>` that you walk into is an
  `<vocabulary>entrance</vocabulary>`" is the target.
- **When the word simply *is* its kanji**, do not write a story — the
  prompt's "Is this word just its kanji?" section says so outright (computed
  mechanically). One or two sentences saying so, with both `<kanji>` and
  `<vocabulary>` wrapping the same word on two spans. Band: 40–200 characters.
- **Say what the word type teaches, and only that.** Each vocab prompt
  carries a word-type block (い/な adjective, godan/ichidan, transitivity…).
  Use it only where it explains a rule the learner can carry forward; stay
  silent otherwise.
- **Never name jukugo, on'yomi, kun'yomi, rendaku or gemination in a vocab
  mnemonic** — that is what the computed `reading_composition` field is for.
- **For vocab, obey the reading block exactly** — it decides whether there is
  a reading mnemonic at all, and it is computed, not a judgement call:
    - *Regular or kana-only*: omit `reading_mnemonic` entirely. A fresh draft
      that writes anything here fails the gate.
    - *Reading already taught by an earlier word*: one sentence, 60–170
      characters, naming that word, with the reading in a `<reading>` tag and
      this word's meaning in a `<vocabulary>` tag. No cast character, no
      scene. The gate requires the source word's written form to actually
      appear in the sentence.
    - *A lone kun'yomi nothing has taught yet, or a non-assembling reading*:
      the full story, as before.
- A **kanji** reading mnemonic is one sentence, or two short ones (roughly
  90–200 characters), in which the sound and the meaning are the same joke:
  the target reading verbatim in kana inside a `<reading>` tag, said by the
  cast character the prompt assigns; this kanji's taught meaning inside a
  `<kanji>` tag; a logical reason those two belong together; and a laugh.
- Highlight tags exactly as the prompt's "Highlighting" section describes:
  `<radical>…</radical>` in a kanji meaning mnemonic, `<kanji>…</kanji>` in a
  vocab one, and both the target reading kana and its English phonetic hook
  in `<reading>…</reading>` in the reading mnemonic. A kanji meaning mnemonic
  also tags its own resolved meaning in `<kanji>…</kanji>`; a kanji reading
  mnemonic carries that same tag once. A vocab mnemonic wraps the word's own
  meaning in `<vocabulary>…</vocabulary>`, once in each mnemonic where
  present. A radical's `mnemonic_text` wraps its own meaning in
  `<radical>…</radical>`. `<radical>` never appears in a reading mnemonic or
  anywhere in a vocab mnemonic; no nesting; every tag closed; none in a
  description.
- Every `<radical>`, `<kanji>` and `<vocabulary>` tag also names the character
  it stands for, in a `form` attribute: `<kanji form="少">few</kanji>`, which
  the app renders as "few (少)". Copy the character from the prompt exactly and
  never type it into the prose as well. `<reading>` carries no `form`, and
  neither does the tag in a radical's `image_prompt`.
- When you write a description, address **every** look-alike the prompt
  lists, spelling out the visual difference, and introduce no other Japanese
  character.
- Write all Japanese as plain text — no furigana brackets, no romaji, no
  markdown, no headings, no lists, no bold/italic, no emoji. Highlight tags
  are the only markup allowed.
- Do not set or add any `review_status` field.
- Do not modify any file other than this run's reply files. Do not edit any
  `.prompt.md`. Do not run tools to fetch external content.
- **Make every item feel different from the others in this run.** Do not
  reuse a scene shape, setting, animal, gag structure, or sentence rhythm
  across two items, and do not let two resolve the same way. Where items
  share a component, that component's established image must still be
  continued in each — doing something different each time. Give the last
  item the same effort as the first; if you find yourself writing to a
  template by the last item, stop and re-read that item's own decomposition.

Step 4: Ingest and Repair — one slug at a time, inline only

For each slug, run:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level <level> --slug <slug> --model <this session's model name>

If ingestion succeeds, the item is merged into the sidecar
(`curriculum/<radicals|kanji|vocabulary>/mnemonics.json`) — record it
as successful and move to the next slug.

If ingestion fails, the process rewrites `<slug>.prompt.md` with the
validation errors appended. Do not regenerate from scratch. Since this
session has no subagent to delegate a large repair to, **fix inline yourself
regardless of error count** — this is the one deliberate difference from the
subagent workflow's "7+ errors → subagent" rule:

  Read the validation errors appended to `<slug>.prompt.md`. Inspect the
  existing `<slug>.reply.md` and the output contract. Edit `<slug>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve the parts that already
    work. Do not rewrite a passing field to fix a failing one. Fix all
    reported errors, not only the first.
  - Edit only `<slug>.reply.md`; never `<slug>.prompt.md`, never a
    validator, ingestion code, the look-alike dataset, the cast bible, or
    curriculum source data.
  - "Too short" means the story lacks substance — add scene, not filler
    clauses. "Too long" means cut whole staged events and novel-register
    words, never drop a component to fit. A ceiling of ~200 on a kanji
    meaning, or ~200 on a vocab meaning, means the item is the
    is-just-a-radical / is-just-its-kanji case — delete the scene and say
    the two are the same, per Step 3, rather than trimming.
  - A "never wraps it in <radical>/<kanji>/<vocabulary>" or "does not
    highlight the reading" error means the words are there but untagged —
    add tags, don't rewrite. "Never says what this word means" means the
    meaning is genuinely absent — name it, then tag it.
  - "description is omitted, but this item has reviewed look-alikes" is the
    one case where you add a key; leave the mnemonic(s) unchanged.
  - Ensure valid JSON, no commentary outside the JSON block, no
    `review_status`.

Then run ingestion again. Retry budget, per slug: attempt 1 (Step 3's draft),
attempt 2 (first inline repair), attempt 3 (second inline repair). If attempt
3 still fails, make ONE last-resort inline fix and run ingestion a fourth and
final time. If that also fails, stop retrying this slug, record it as
skipped, preserve its latest validation errors for the final report, and move
to the next slug — a failure never touches another slug's already-passed
files.

Step 5: Run `generate.py`, Then Stop — Do Not Run the Rest of the Final Build

As soon as Step 4 finishes (all slugs attempted, whether passed or skipped),
run `generate.py` for this run's `<level>` automatically, in this same
session — do not wait for a later session or for the user to ask:

cd curriculum/_build && .venv/bin/python generate.py --level <level>

`generate.py` is **not** at the repository root and is **not** on `PATH`. It
lives at `curriculum/_build/generate.py` and needs that directory's venv
interpreter, so it must be invoked explicitly as shown above — never shortened
to a bare `generate.py --level <level>`, which fails with `command not found`.

`generate.py` is the step that copies the sidecar drafts into the shipped
`curriculum/<type>/<level>.json`, and it is what the Layer Ordering section
above means by "inlined": the layer above (kanji reading a radical's
`mnemonic_text`, vocab reading a kanji's `meaning_mnemonic`) reads the shipped
file, not the sidecar, so running this promptly after each session keeps a
same-level, cross-type chain (radical → kanji → vocab) unblocked without
needing a separate coordinating session. If the inlining step worked,
`curriculum/<type>/<level>.json` is newer than
`curriculum/<type>/mnemonics.json`; if the sidecar is the newer file,
`generate.py` did not run.

Still do NOT run `npm run validate-schema` or `npm run compile-curriculum` in
this session — those remain a separate, later step, run once from the
repository root after every session covering this batch has finished:

npm run validate-schema
npm run compile-curriculum

Nothing downstream but `generate.py` reads the sidecar: `compile-curriculum`
builds `curriculum.db` from the shipped JSON that `generate.py` just updated,
and the studio serves that same shipped JSON. Running `generate.py` every
session is cheap and keeps the shipped files current; running
`compile-curriculum` every session is not, which is why only that half stays
batched.

Whoever runs the Final Build: if the curriculum studio's `web/server` is
already running, its curriculum index is an in-memory cache loaded once at
startup (`web/server/curriculum/loader.ts`) and reads straight from
`curriculum/<type>/<level>.json` — not from the mnemonics sidecar. It has no
file watcher, so it keeps serving pre-Final-Build content (including a stale
`meaning_mnemonic`/`reading_mnemonic` and any older `_meta.prompt_version`)
until something calls `reload()`. After the Final Build, hit `POST
/api/reload` (the studio header's Reload button) or restart the server before
checking the result in the studio — otherwise a correctly generated mnemonic
can look wrong (e.g. a missing highlight) when the real cause is stale cache,
not the content.

---

Final Report (for this session)

- The content type, <level>, <slug-count>, and the exact auto-selected slug
  set for this session (with the count vs. <slug-count>)
- The model used for drafting and for `--model` provenance
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs — call these out as blockers for the layer above
- ❌ Failed slugs
- Repair attempts used per affected slug (all inline in this shape)
- Validation errors remaining after the final allowed attempt
- Roughly how many slugs of this type remain not-yet-done for the level
  (re-run Step 1 to get the count) — this tells you whether another session
  is needed before running the rest of the Final Build
- Confirmation that `generate.py --level <level>` was run for this session's
  slugs, and that `npm run validate-schema` / `npm run compile-curriculum`
  were NOT run in this session

Do not modify or set `review_status` to `reviewed` — that is a manual human
Phase 5 step this automation must never perform.

---

Important Constraints

- No subagents. This session drafts every reply itself.
- Auto-select only — never hand-pick or paste a slug list.
- Ingestion, the gate, repairs and the attempt budget are per slug, always.
- A failure in one slug never invalidates another slug's already-ingested
  work in this session.
- Do not bypass or weaken validation. Do not modify validator or ingestion
  code, the look-alike dataset, the cast bible, the prompt templates, or
  curriculum source data to make invalid content pass.
- Never invent a look-alike pair or a component the prompt did not list.
- Do run `generate.py --level <level>` at the end of this session (Step 5) —
  it is no longer deferred. Do not run `npm run validate-schema` or
  `npm run compile-curriculum` from this session — those stay a separate,
  later step run once per batch, after all its sessions finish.
- No browser, no clipboard, no downloads.

---

Reading-link fix — stored N5 + N4 readings that do not continue the meaning scene

A separate, one-off lane. It does not generate new items; it rewrites only
the `reading_mnemonic` of stored items whose reading scene is unrelated to the
meaning scene. Spec:
`docs/superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md`.
All commands run from `curriculum/_build`.

1. Select. `.venv/bin/python -m generate_content.reading_link select` writes
   `reports/reading-link-candidates.json` (reviewed N5 + N4 kanji; N5 + N4
   vocabulary with a story reading).
2. Calibrate. Follow `generate_content/prompts/reading-link-triage.md` for the
   five calibration items only and write `reports/reading-link-calibration.json`.
   Expected: keep polish, goods, research; mark happiness, special. If not,
   fix the triage prompt and calibrate again. Do not start step 3 until it
   matches.
3. Triage. Follow `reading-link-triage.md` for every candidate, writing
   `reports/reading-link-list.json`, then run
   `.venv/bin/python -m generate_content.reading_link check-list` until it
   prints `list OK`. **Stop.** The maintainer reviews the list and may move
   rows between `marked` and `kept`.
4. Pilot. Follow `generate_content/prompts/reading-link-rewrite.md` for
   kanji `happiness` and `special` only; `apply --dry-run`, then `apply`.
   **Stop.** The maintainer approves both new readings.
5. Rewrite the rest of `marked`, in chunks of about 25: append to
   `reports/reading-link-rewrites.json`, `apply --model <model> --dry-run`,
   repair (at most 2 attempts per item), then `apply --model <model>`.
6. Verify and build:
   `.venv/bin/python -m generate_content.reading_link verify --base <sha before step 4>`
   (must print `verify OK`), then `.venv/bin/python generate.py --level n5`,
   `.venv/bin/python generate.py --level n4`, and from the repo root
   `npm run validate-schema && npm run compile-curriculum`.
7. Every rewritten item is now `review_status: draft`. The maintainer
   reviews them in Studio.

---

Notes on differences from the subagent workflow

- No subagent is spawned at any point; this session both drafts and ingests.
  There is no group concept — <slug-count> IS this session's whole unit of
  work, and there is exactly one "draft" pass, done by the session itself.
- Because there is no subagent to hand a large repair to, every repair in
  this shape is inline, regardless of error count — the subagent workflow's
  "7+ errors → repair subagent" branch does not apply here.
- `generate.py` runs at the end of every session (Step 5), so the shipped
  `curriculum/<type>/<level>.json` stays current after each batch of
  <slug-count> slugs. Only `validate-schema` and `compile-curriculum` are
  deferred: run this prompt in as many fresh sessions as needed to clear a
  batch, then run those two once, in any session, after the last one
  finishes.
- Everything else is identical: the same auto-select (Step 1, reading "done"
  from the checked-in sidecar), the same `webprompts`/`ingest` commands and
  gate, the same per-slug repair rules and retry budget, the same
  sidecar, the same layer ordering, and the same draft/`review_status`
  discipline.
