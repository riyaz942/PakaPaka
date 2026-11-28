Task: Generate Radical/Kanji/Vocabulary Mnemonics via Gemini Web

Use the existing logged-in Gemini session in my Chrome browser to generate Phase
2b/2d mnemonic prose for the following items. This run is for ONE content type at a
time and **auto-selects the next batch of not-yet-done slugs** for that type
(Step 1) — you do NOT paste a slug list.

Level (one ladder level, 1–60, per run). Its folder below is `<level-dir>`:
`level-` and two digits, so level 6 is `level-06`:

<level = 6>

Content type (one of `radical`, `kanji`, `vocab` or `grammar`):

<type = vocab>

Batch size (how many slugs this run processes; used as BATCH_LIMIT in Step 1):

<batch-size = 12>

This is the browser-driven, no-API equivalent of the Message Batches driver in
`curriculum/_build/generate_content/generate_mnemonics.py`. Only the "call the
model" step moves to the browser; the context builder, the cast injection, and the
mechanical gate are identical to the API path. See
`docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow.md`.

This run processes up to <batch-size> slugs. The generation unit is a **group**
(see below): one fresh Gemini chat writes every item in the group, then each slug
is ingested and repaired on its own. Browser cost still scales with groups (fresh
chat, model/thinking verification, paste, completion polling, N downloads per
group), so keep <batch-size> modest. 10 is tuned for a lower-reasoning driver
model (e.g. Claude Code Sonnet "low"), where long sessions are the main quality
risk: as context fills, the driver starts skipping the paste-integrity and
stop-button checks and silently corrupts replies. If the driver is clearly
holding up, you can raise <batch-size> toward 15; treat ~20 as the ceiling before
session degradation gets real, and prefer running the automation twice over
pushing a single run past it. The auto-select makes stopping and resuming across
sessions seamless — the next run picks up exactly where you left off.

Group size (how many slugs one Gemini chat writes in a single pass; used as
GROUP_SIZE in Step 1):

<group-size = 4>

The run's slugs are split into groups of at most <group-size>, and each group is
written by ONE fresh Gemini chat that sees every item in the group. Why group at
all:

- **Cross-item consistency.** The gate proves an item is in-constraints; it does
  not prove the cast and scene shapes stay coherent across items generated
  independently. A chat writing three related kanji can see what it already used
  and deliberately vary — three independent chats cannot, and they drift toward
  the same handful of scene shapes.
- **Modest cost saving.** One chat's fixed overhead (model/thinking setup, paste,
  completion wait) instead of <group-size> of each. Real but not dramatic;
  thinking and prose output do not shrink, so do not group for cost alone.

Keep <group-size> small. At 3 the last item still gets real effort; past 4–5 two
things degrade — the model's attention thins out on the final item, and the
combined paste gets long enough that Gemini's input truncates more often. Set it
to 1 to get the old strictly-per-slug behaviour.

Grouping never changes the unit of ingestion or repair. Each slug keeps its own
prompt file, its own reply file, its own gate run, and its own attempt budget —
**a failing slug is repaired alone, and its passing group-mates are never
regenerated** (Step 8).

Repair subagent effort (reasoning effort every repair subagent in this run uses):

<repair-subagent-effort = high>

Generation is Gemini; only failed slugs are repaired by an in-session subagent
(Step 8). Pass <repair-subagent-effort> explicitly when launching each repair
subagent — do not silently drop lower. `high` is recommended; do not use `low`
for mnemonic repairs. (The *orchestrator* / browser driver running this prompt
may itself be on a cheaper / lower-effort model — that is fine.)

Browser Requirements

- Use Chrome, not Edge.
- If multiple browsers are connected:
  a. List all connected browsers.
  b. Determine which browser has an active Gemini session.
  c. Confirm you will use the logged-in Chrome instance before continuing.

---

Layer Ordering — read before starting

The three types are a chain, not three independent jobs:

- a **kanji** meaning mnemonic continues each component radical's established
  `mnemonic_text`
- a **vocabulary** meaning mnemonic hooks into its component kanji's
  `meaning_mnemonic`

So a layer must be finished, ingested, **and inlined by `generate.py`** before the
layer above it is generated. This is enforced, not advisory: `webprompts --type
kanji` raises

  ValueError: component radical hi-sun has no `mnemonic_text` yet. Generate the
  radical layer first (...)

if you try to skip ahead. Order for a level: **radicals → `generate.py` → kanji → `generate.py` → vocab**. Finish <level> fully before moving to the next level. If Step
1b raises that error, stop and report it — the previous layer is not done.

**Grammar** sits outside the radical → kanji → vocab chain: its prompt uses no
other layer's prose, so it can run at any time. One condition instead:
`curriculum/_build/grammar_origins.json` must cover every grammar slug and
carry `"review_status": "reviewed"` (every command with `--type grammar` stops
with an error otherwise — report it, do not edit the file yourself). The gate rules are in
`validate_mnemonics.validate_grammar`: one or two story sentences plus a
Japanese example ending in 。, `<reading>` on the English sound-alike and on the
form's kana, `<grammar>` on the meaning, example words and kanji at or below
the level, and the origin's keyword in the story (or no origin claim at all).
After ingesting grammar, run `generate.py`.

---

Workflow

Process one **group** at a time, each with its own fresh Gemini chat (no shared
context between groups). Within a group Gemini writes every item in one pass,
then each slug is ingested and, if it fails, repaired individually. Do NOT mix
content types in one run — all slugs in this run share the same <type>.

Step 1: Select Slugs and Generate Prompts

Work from:

curriculum/_build

1a. Select this run's slugs automatically and split them into groups. Do NOT
hand-pick or paste a slug list. Pick the next <batch-size> slugs of <type> (in
curriculum sort order) that do not already have a gate-passing draft **at the
current `PROMPT_VERSION`**, then chunk them into groups of at most <group-size>,
preferring to put items that **share a taught component** in the same group.
Substitute this run's <type> for KIND, <batch-size> for BATCH_LIMIT and
<group-size> for GROUP_SIZE, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import mnemonic_context as mc
from generate_content.generate_mnemonics import KIND_DIR, default_slugs
LEVEL, KIND, BATCH_LIMIT, GROUP_SIZE = <level>, '<type>', <batch-size>, <group-size>   # KIND: 'radical', 'kanji', 'vocab' or 'grammar'
# The level's items with no entry in the sidecar yet, in curriculum order.
left = default_slugs(KIND, [LEVEL])
todo = left[:BATCH_LIMIT]
done = len(mc.all_slugs(KIND_DIR[KIND], LEVEL)) - len(left)
# Shared-component data for grouping; radicals have no components, so they fall
# back to sequential chunks (curriculum order already clusters related radicals).
comps = {}
if KIND == 'kanji':
    comps = mc.decomposition_edges()
elif KIND == 'vocab':
    comps = mc.vocab_component_edges()
remaining, groups = list(todo), []
while remaining:
    head = remaining.pop(0)
    group, shared = [head], set(comps.get(head, []))
    for cand in list(remaining):          # pull in later slugs sharing a component
        if len(group) >= GROUP_SIZE:
            break
        if shared & set(comps.get(cand, [])):
            group.append(cand); shared |= set(comps.get(cand, []))
            remaining.remove(cand)
    while remaining and len(group) < GROUP_SIZE:   # top up in curriculum order
        group.append(remaining.pop(0))
    groups.append(group)
print(f'{len(todo)} slug(s) selected (BATCH_LIMIT={BATCH_LIMIT}, done={done}) '
      f'in {len(groups)} group(s) of <= {GROUP_SIZE}:')
for i, g in enumerate(groups, 1):
    print(f'  group {i}: {",".join(g)}')
print()
print('ALL:', ','.join(todo))
PY

Note what "done" means here: an item is done once its entry in the kind's
sidecar (`curriculum/<kind>/mnemonics.json`) has a non-empty mnemonic. An empty
`{}` placeholder counts as not done. An
item with a mnemonic is never selected again, so reviewed prose is never
regenerated by a run; a prompt-version bump does not re-select anything either.
This mirrors the API path, whose `run --level` takes the same items.
`PROMPT_VERSION` is keyed by type (`{"radical": 1, "kanji": 4, "vocab": 6, "grammar": 1}`),
because the four prompts move independently. Radicals sitting at 1 is deliberate:
Rev 3 reverted the radical contract to the original shape — a `mnemonic_text` of
~150–300 characters, description demoted to optional — so the first reviewed radicals
already match the current prompt and are correctly *not* re-selected.

The number records **conformance, not provenance**: it answers "does this draft
satisfy contract N", not "which prompt wrote it". The first kanji were generated
under 1 and 2 and then brought up to 4 in place — retagged mechanically, with the
description backlog cleared — so they are stamped 4. Stamping is only ever correct
after the item passes the gate under the new contract; a draft that merely
predates a bump is stale and must be regenerated, not renumbered.

If it prints 0 slugs, every item of this level+type already has a mnemonic —
stop and report that; do not open Gemini. Otherwise treat the
printed `ALL:` list as this run's slug set and the printed groups as this run's
generation units: every later step iterates over exactly these slugs, and no slug
outside this list is touched. Record the group composition — the final report
names it.

For grammar, the select also picks a mnemonic whose Japanese example uses a word
above the point's level (`grammar_mnemonics_above_level` in the ladder work
list, from the same check).

A run that fixes existing vocabulary mnemonics takes its slugs from the work
list, not from this select: `vocab_mnemonics_pending` (`--type vocab`) in
`curriculum/_build/reports/ladder-worklist.json`. See "Ladder work list" in
`docs/workflows/README.md`. Use that list as the slug set; the select above skips
items that already have a mnemonic.

Grouping is a hint for the writer, not a constraint on the content: items in a
group share a Gemini chat, nothing else. Each still gets its own prompt file built
from its own context, and no item may reference another group-mate's components.

1b. Generate the prompt files for the selected slugs in one call — all groups at
once, since each slug gets its own prompt file exactly as before. `--slugs` is a
single comma-separated string with NO spaces after the commas (use the `ALL:`
list):

.venv/bin/python -m generate_content.generate_mnemonics webprompts --type <type> --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/mnemonics/<level-dir>/<type>/<slug>.prompt.md

Regenerating a prompt is a safe no-op — `webprompts` overwrites deterministically,
and any appended gate errors from an earlier failure are dropped, which is correct
for a fresh attempt.

If this command raises the "no `mnemonic_text` yet" / "no `meaning_mnemonic` yet"
ValueError, the layer below is unfinished — see Layer Ordering above and stop.

---

Step 2: Create a Fresh Gemini Chat

Open a brand new Gemini conversation for this **group**.

Never reuse an existing conversation across groups.

---

Step 3: Configure Gemini

Before sending anything:

- Select the Pro model.
- Enable Extended thinking.

Verify both settings are actually enabled.

Because Gemini's UI sometimes ignores clicks:

- Take a screenshot or otherwise verify the UI.
- If the settings are incorrect, click again.
- Repeat until the UI confirms:
  - Pro model
  - Extended thinking enabled

Do not continue until this is verified.

---

Step 4: Assemble and Paste the Group Prompt

Each slug still has its own `.prompt.md`. For the current group, assemble ONE
combined paste: a short group preamble (variety + output contract) followed by
each item's prompt body with the HTML header stripped. Do not paste raw headers —
they are orchestration instructions for YOU.

Do not inject text using JavaScript.

Never use:

- execCommand("insertText")
- DOM manipulation
- JavaScript text insertion

These methods silently truncate long prompts.

Instead, build the combined paste and copy it to the clipboard. Substitute this
group's comma-separated slug list for GROUP_SLUGS and the content type for KIND,
then run from `curriculum/_build`:

.venv/bin/python - <<'PY'
import os, sys
KIND, LEVEL_DIR = '<type>', '<level-dir>'
GROUP_SLUGS = '<slug1,slug2,slug3>'.split(',')   # this group's slugs, no spaces
base = f'generate_content/web/mnemonics/{LEVEL_DIR}/{KIND}'
parts = []
parts.append(
    f'# Group of {len(GROUP_SLUGS)} {KIND} mnemonics — write all of them in this reply\n\n'
    'You will receive several items below. The teaching-voice sheet is identical in\n'
    'every item — read it once and apply it to all of them. Everything from\n'
    '"The kanji" / "The radical" / "The word" onward is per-item and must be\n'
    'obeyed per item.\n\n'
    '**Make the group\'s items feel different from each other.** This is the whole\n'
    'reason you were given them together. Do not reuse a scene shape, setting,\n'
    'animal, gag structure, or sentence rhythm across two items in the group, and\n'
    'do not let two items resolve the same way. Where a group shares a component,\n'
    'that component\'s established image must still be continued in each item — but\n'
    'it should be *doing something different* each time. Give the last item the\n'
    'same effort as the first.\n\n'
    'Treat each item\'s constraints as independent. An item may only name the\n'
    'components ITS OWN section lists, and may only mention the look-alikes ITS\n'
    'OWN section lists — even when a group-mate shares a component or is itself a\n'
    'look-alike. Seeing the sibling items is for varying your writing, never for\n'
    'widening what an item is allowed to reference.\n\n'
    'Output EXACTLY one fenced ```json code block **per item**, in the same order\n'
    'as the items below. Immediately before each code block, write a single line\n'
    '`### <slug>` naming that item\'s slug. Nothing else outside the code blocks —\n'
    'no combined object, no commentary, no preamble after the item sections.\n'
    'Each JSON object uses only that item\'s required keys.\n'
)
if KIND == 'radical':
    parts.append(
        '\nStyle calibration for radical mnemonics (not gag scenes): fuse the\n'
        'stroke description and the meaning into ONE single image — either the\n'
        'shape literally resembles the meaning, or the shape is compared to one\n'
        'real-world object/scenario that shares the meaning. Do NOT describe the\n'
        'shape correctly and then bolt on a second, unrelated scene (a stock\n'
        'animal or bystander character doing something silly) purely for a\n'
        'joke — that produces two competing images, which the hard rules below\n'
        'already forbid, and reads as needlessly long. If there is humor, it\n'
        'should be in how the shape itself is described, not in an unrelated\n'
        'character\'s antics. Reviewed examples of the target style: 儿 "Look at\n'
        '儿 head-on and you\'re staring at someone standing with their feet\n'
        'planted apart, the two strokes sweeping down and out like a pair of\n'
        'sturdy human legs mid-stride." (legs — the shape literally resembles\n'
        'the meaning). 工 "Picture a steel I-beam standing between two flat\n'
        'concrete slabs: the top and bottom strokes are the slabs, the line\n'
        'down the middle is the beam being lowered into place. That single\n'
        'girder holding the whole thing up is the heart of any construction\n'
        'site." (construction — the shape is compared to one real-world object\n'
        'that shares the meaning). Prefer the shorter-to-middle end of the\n'
        'length target (roughly 180-260 characters) unless an item genuinely\n'
        'needs the extra room to land the image clearly.\n'
    )
for i, slug in enumerate(GROUP_SLUGS, 1):
    path = os.path.join(base, f'{slug}.prompt.md')
    text = open(path).read()
    if '-->' not in text:
        sys.exit(f'missing HTML header in {path}')
    body = text.split('-->', 1)[1].lstrip('\n')
    if not body.startswith('# Teaching voice'):
        sys.exit(f'unexpected body start in {path}: {body[:40]!r}')
    parts.append(f'\n\n---\n\n## Item {i}: {slug}\n\n{body}')
combined = ''.join(parts)
out = os.path.join(base, f'_group-{GROUP_SLUGS[0]}.paste.md')
open(out, 'w').write(combined)
print(f'wrote {out} ({len(combined)} chars, {len(GROUP_SLUGS)} items)')
print(combined[:80].replace('\\n', ' '), '...')
PY

Then:

1. Copy that paste file to the clipboard:

   pbcopy < curriculum/_build/generate_content/web/mnemonics/<level-dir>/<type>/_group-<first-slug>.paste.md

   (Verify the copied text starts with `# Group of`.)

2. Focus the Gemini input.
3. Paste using a real keyboard shortcut:

   Cmd + V

Delete the `_group-*.paste.md` scratch file after a successful paste (optional
hygiene — do not commit it).

---

Step 5: Verify Paste Integrity

Before sending:

- Compare the pasted content length with the assembled paste file.
- Confirm the paste starts with `# Group of` and includes every `## Item N: <slug>`
  heading for this group.
- If truncated, clear the input and paste again. Group pastes are longer than
  single-item ones — truncation is more likely; do not send a partial paste.

Do not submit an incomplete prompt.

---

Step 6: Determine When the Response Has Finished

Do not infer completion from the tab title changing.

Do not poll the response text length and treat two stable-looking reads as completion.

Both are indirect signals that can be sampled mid-stream. A title can appear before
generation finishes, and a length check can falsely report completion if the polling
interval lands between token bursts.

This has previously caused mid-stream responses to be mistaken for short but complete
responses.

Instead, use the stop-generating button as the authoritative signal:

- While Gemini is generating, a square stop icon is shown in place of the mic/send button.
- Poll for the square stop button to disappear.
- Confirm that the mic/send button has reappeared.
- Only treat the response as finished once the stop button is gone.

Do not click "Copy code" or "Download code" until the stop button has disappeared.

As a secondary sanity check after the stop button is gone, verify that the response
contains one JSON code block per group slug (look for the `### <slug>` markers) and
that each block parses as JSON.

This catches edge cases where the button state and content state are momentarily out
of sync. However, the stop-button check is the primary completion signal, not
text-length polling.

---

Step 7: Extract the Response — Download, Rename, and Move

Gemini's code-block viewer is DOM-virtualized. Reading innerText or clicking "Copy
code" on a long response can silently return only a partial snippet, even though the
full response exists.

Do not rely on copy-to-clipboard or page-text extraction for the response content.

Instead, for **each** slug in the group, in order:

1. Once the response has finished according to Step 6, find the JSON code block that
   follows that slug's `### <slug>` marker (or, if markers are missing, the Nth JSON
   code block matching the group's order). Click the "Download code" button on that
   block.

   This saves the full response as a file, such as:

   gemini-code-<timestamp>.json

   The file will normally be saved to the Downloads folder.

   Ask for explicit permission before the first download of the session.

2. Verify the downloaded file:
   - Confirm it parses as valid JSON.
   - Confirm it contains all expected keys for this content type:
     - For <type> = kanji:
       - meaning_mnemonic
       - reading_mnemonic
       - description (optional — present only when the item has look-alikes to
         contrast or a nuance the mnemonics cannot carry)
     - For <type> = radical:
       - mnemonic_text
       - description (optional, same rule as kanji)
     - For <type> = vocab:
       - meaning_mnemonic
       - reading_mnemonic
       - description (optional, same rule as kanji)
   - Confirm it is NOT a combined multi-slug object — one slug's keys only.

3. Move and rename the file into place:
   - Read the downloaded JSON.
   - Rewrite it as the required fenced ```json ... ``` reply file at:

curriculum/_build/generate_content/web/mnemonics/<level-dir>/<type>/<slug>.reply.md

4. Delete the original downloaded file from Downloads after it has been moved into
   place.

   Do not leave stray downloaded files behind.

Save Gemini's initial response for each slug without modifying its content.

If Gemini produced only some of the group's code blocks, write reply files for the
ones that exist and treat each missing slug as a failed attempt 1 (repaired per
slug in Step 8). Do not open another Gemini chat to fill gaps —
and do not regenerate the whole group.

If ingestion later fails, the repair described in Step 8 (inline fix or
subagent) may make targeted changes to that slug's reply file.

---

Step 8: Ingest and Repair — one slug at a time

Grouping stops at the end of Step 7. From here every slug is handled entirely on
its own: its own ingest, its own gate result, its own repairs, its own
attempt budget. Ingest each slug in the group in turn.

**A failure never invalidates its group-mates.** If one slug in a group of three
fails the gate, repair that slug alone — the other two are already ingested and
must not be regenerated, re-ingested, or touched. Never reopen Gemini for the
group to fix one item: that would rewrite passing content, cost three items'
generation to fix one, and lose drafts that already passed. The repair below —
inline fix or subagent — sees only the failing slug's own prompt and reply
files.

For each slug in the group, run:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --slug <slug> --model gemini-web

(The `--model` value is recorded in the sidecar entry's `_meta.generator_model`;
`gemini-web` is the honest provenance for this lane.)

If ingestion succeeds:

The item is merged into the sidecar (one file for every level):

- radical → curriculum/radicals/mnemonics.json
- kanji   → curriculum/kanji/mnemonics.json
- vocab   → curriculum/vocabulary/mnemonics.json

Record the slug as successful and proceed to the next slug.

If ingestion fails:

The ingestion process rewrites:

curriculum/_build/generate_content/web/mnemonics/<level-dir>/<type>/<slug>.prompt.md

with validation errors appended.

Do not return to Gemini.

Do not open another Gemini chat.

Do not regenerate the entire mnemonic or the group.

Instead, repair the existing reply locally. Count the validation errors
appended to the prompt file and choose the repair method:

- **Fewer than 7 errors — inline fix.** Edit `<slug>.reply.md` yourself, in
  this session, following the repair instructions below. A small fix does not
  need a subagent.
- **7 or more errors — repair subagent.** Launch a general-purpose subagent
  with the files and instructions below.

Repair Procedure

1. If the repair needs a subagent, launch a general-purpose one. (An inline fix
   skips this step — you are the repairer.)
   - Prefer the latest available Opus model at <repair-subagent-effort>
     effort.
   - If an Opus model is unavailable, use the strongest suitable reasoning or
     coding model available — still at <repair-subagent-effort>.
   - Pass the effort explicitly when launching; do not silently drop to a lower
     effort.
   - Run the subagent in the foreground because ingestion must wait for the repair to finish.

2. The repair works from these files, whichever method is used — this slug's
   only, never a group-mate's:

   - curriculum/_build/generate_content/web/mnemonics/<level-dir>/<type>/<slug>.prompt.md
   - curriculum/_build/generate_content/web/mnemonics/<level-dir>/<type>/<slug>.reply.md

3. Apply the following instructions — they govern an inline fix exactly as they
   govern a repair subagent:

   Read the validation errors appended to `<slug>.prompt.md`. Inspect the existing
   `<slug>.reply.md` and the complete output contract in the prompt. Edit
   `<slug>.reply.md` to resolve every reported ingestion error.

   - Make the smallest changes necessary; preserve the parts that already work.
   - Do not rewrite a passing field to fix a failing one.
   - Fix all reported errors, not only the first.
   - Edit only `<slug>.reply.md`; do not edit `<slug>.prompt.md`.
   - Do not modify validators, ingestion code, curriculum source data, the
     look-alike dataset, the cast bible, or the assembled sidecar.
   - Preserve the reply-file format (a single fenced ```json block) and the exact
     key names for this type (kanji and vocab: meaning_mnemonic and
     reading_mnemonic; radical: mnemonic_text; all three: description only when
     the item needs one). Do not add a `description` the earlier draft omitted
     unless an error asks for one.
   - A "too short" error means the story lacks substance — add scene, not filler
     clauses. A "too long" error means cut, not compress into one dense sentence;
     targets are roughly radical ~150–300, kanji meaning ~70–170 (one sentence),
     kanji reading ~90–200 (one sentence, or two short ones), vocab meaning
     ~70–200 (one sentence, or two short ones), vocab reading ~90–220 when it is
     a story. A `keep <= 200` ceiling on a vocab meaning means this word *is* its
     kanji: delete the scene and say the two are the same, rather than trimming.
   - A "never wraps it in <radical>…" or "does not highlight the reading" error
     means the words are there but untagged — add the tags around the words the
     story already uses, do not rewrite the story. Highlight tags: each taught
     component's meaning is wrapped where the story uses it — `<radical>` in a
     kanji meaning mnemonic, `<kanji>` in a vocab one — and the reading kana plus
     the English phonetic hook are wrapped in `<reading>` in the reading mnemonic.
     A kanji mnemonic also wraps the kanji's own taught meaning in `<kanji>`,
     once, in **both** its meaning and its reading mnemonic; a vocab mnemonic
     does the same one layer up, wrapping the word's own taught meaning in
     `<vocabulary>`, once, in both of its mnemonics. A radical borrows
     nothing, so its `mnemonic_text` wraps its own meaning — the word the picture
     resolves to — in `<radical>`. `<radical>` never appears in a reading
     mnemonic or in a vocab mnemonic at all, every tag closed, none nested, and
     none in a description.
   - A "with no character on it" error means the tag is right and its `form`
     attribute is missing: every `<radical>`, `<kanji>` and `<vocabulary>` names
     the character it stands for — `<kanji form="少">few</kanji>`, which the app
     renders as "few (少)". Copy the character from the prompt exactly and never
     type it into the prose as well. `<reading>` carries no `form`, and neither
     does the tag in a radical's `image_prompt`.
   - A "never says what this kanji means" error on a kanji `reading_mnemonic` is
     the Rev 9 rule: the sound and the meaning have to be the same joke. Name the
     kanji's taught meaning in the sentence, wrap it in `<kanji>`, and make the
     phonetic hook and that meaning explain each other — do not bolt "…and that
     is why it means X" onto the end of the existing scene. "never says what
     this word means" on a **vocab** mnemonic is the same rule at the word layer
     (Rev 6), and it applies to the meaning mnemonic as well as the reading one:
     name the word's taught meaning and wrap it in `<vocabulary>`.
   - A "description is omitted, but this item has reviewed look-alikes" error is
     the one case where you *add* a key. Add only the description; leave the
     mnemonic(s) exactly as they are.
   - For kanji: the meaning_mnemonic must reference every taught component listed
     in the prompt's "Taught decomposition" section, and must not name any
     component that is not listed there.
   - For kanji: the reading_mnemonic must contain the target reading kana shown in
     the prompt, verbatim, inside a `<reading>` tag, and this kanji's taught
     meaning inside a `<kanji>` tag, in at most two sentences.
   - For grammar: the sound-alike and the meaning are one joke — a character says the English sound-alike while doing the meaning; the story acts out the origin when the prompt gives one, and never states an origin when it says there is none.
   - For vocab: the meaning_mnemonic must reference every kanji listed in the
     prompt's "The kanji in this word" section, in at most two sentences, and
     must name the word's own taught meaning inside a `<vocabulary>` tag.
     When the prompt's "Is this word just its kanji?" section says it is, the
     meaning mnemonic says so in a line instead of telling a story.
   - For vocab, the prompt's "The reading" section decides whether there is a
     `reading_mnemonic` **at all**, and it is computed, not advisory:
     - *no reading mnemonic* — drop the key from the JSON entirely. The reading
       is what the word's kanji already say, and the computed
       `reading_composition` field on the page states it. A short note written
       here anyway is a gate failure.
     - *the reading is already taught by an earlier word* — one sentence naming
       that word, with the reading verbatim in a `<reading>` tag and this word's
       meaning in a `<vocabulary>` tag. The gate requires the earlier word's
       written form to appear in the sentence.
     - *a full story* — the reading verbatim in a `<reading>` tag and the word's
       meaning in a `<vocabulary>` tag, in at most two sentences.
     Never name jukugo, on'yomi, kun'yomi, rendaku or gemination in either
     mnemonic: that is the `reading_composition` field's job, and it already
     does it more precisely than prose can.
   - For radical and kanji: when a description is present it must name every
     look-alike listed in the prompt and no other Japanese character; an item
     whose prompt lists look-alikes must have one.
   - Keep every field plain prose apart from the highlight tags (no
     markdown/brackets/romaji/emoji), keep the reading verbatim, keep every listed
     component referenced and tagged, keep every listed look-alike addressed, and
     introduce no Japanese character the prompt did not list.
   - Ensure valid JSON. Add no commentary outside the JSON block. Do not set
     review_status.
   - Edit only this slug's reply file. Other slugs generated alongside it have
     already passed the gate and are none of this task's business.

4. If a subagent is doing the repair, wait for it to finish updating the reply
   file.

5. Run ingestion again:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --slug <slug> --model gemini-web

6. If ingestion fails again:
   - Read the newly appended validation errors from the rewritten prompt file.
   - Re-apply the repair-method rule: fewer than 7 errors → another inline fix;
     7 or more → a fresh repair subagent with the updated prompt and reply
     files.
   - Run ingestion again.
   - Do not return to Gemini.

Retry Limit

The budget is **per slug, not per group**. Allow at most three ingestion attempts
for each slug, including the initial attempt:

- Attempt 1: the group's Gemini reply (Step 7)
- Attempt 2: this slug's first repair — an inline fix if the failure reported
  fewer than 7 errors, otherwise a repair subagent
- Attempt 3: this slug's second repair — same rule

Attempt 1 is shared — one Gemini chat produces the first attempt for every slug
in the group — but attempts 2 and 3 are always single-slug. Each slug's counter is
independent: one slug burning its whole budget has no effect on its group-mates'
budgets, and a group of three that fails on one item costs at most two extra repair
subagents, not a second group chat.

Use a fresh repair subagent for each repair that needs one. If the third
ingestion attempt fails, the repair retry threshold is reached: make ONE
last-resort inline fix — edit the reply file yourself, no subagent, whatever
the error count — and run ingestion a fourth and final time.

If the fourth ingestion attempt fails:

- Stop retrying the slug.
- Record it as failed or skipped.
- Preserve the latest validation errors for the final report.
- Proceed to the next slug — finish the rest of the group before moving on.

Do not waste additional Gemini turns.

A skipped slug matters more here than in the example-sentences lane: a radical
with no mnemonic blocks every kanji built on it, and a kanji with no meaning
mnemonic blocks every word built on it. Report skips prominently — they must be
cleared before the next layer runs.

---

Ordering Note

Each run is a single content type and covers only its auto-selected <batch-size>
slugs, so finishing a whole layer takes several runs, and a level is three layers.
Do radicals fully (all runs), then kanji, then vocab, re-running `generate.py`
between layers so the next layer's prompts read the new prose. Finish <level> fully before
the next level. On the first run of a fresh type, read the assembled output in the app before
launching more runs — the batch size is already pilot-sized, so one run doubles as
the pilot. Read a whole group's items side by side when you do: that is the only
way to see whether grouping is buying the variety it is meant to buy, and whether
the last item in each group is as strong as the first. If it is visibly thinner,
drop <group-size>.

---

Final Build

After every selected slug has been successfully ingested or skipped, run the
project's normal generation pipeline.

Check `generate.py --help` under `curriculum/_build` for the current invocation.
`generate.py` builds every level and takes no level flag. From `curriculum/_build`, run:

.venv/bin/python generate.py

Then, from the repository root, run:

npm run validate-schema

And:

npm run compile-curriculum

`generate.py` inlines the mnemonic sidecars into the shipped radical/kanji/vocab
JSON (radicals get a `mnemonic_text`; kanji and vocab get the two mnemonics; all
three get a `description` only on the items that needed one), each carrying
`_meta.review_status: draft`. Do not guess if `--help` shows a different invocation.

This step is not optional between layers — the next layer's prompts read the
inlined prose, not the sidecar.

---

Final Report

Provide a summary containing:

- The content type, <batch-size>, <group-size>, <repair-subagent-effort>, and the exact auto-selected slug set for this run (with the count vs. <batch-size>)
- The groups as generated, listing each group's slugs, so a reviewer can read a group's items together and judge cross-item variety
- The repair-subagent model and effort actually used (confirm effort matches <repair-subagent-effort>, or call out any forced substitute)
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs — call these out as blockers for the layer above
- ❌ Failed slugs
- The number of repair attempts used for each affected slug, split into inline fixes and subagent repairs, and which group it came from — a group whose items mostly needed repair is a signal that <group-size> is too high
- Validation or ingestion issues encountered
- Validation errors remaining after the final allowed attempt
- Roughly how many slugs of this type remain not-yet-done for the level (re-run Step 1a to get the count), so it's clear whether another run is needed
- Final build, schema-validation, and compilation results
- Any manual follow-up required

Do not modify or set review_status to reviewed.

That is a manual human-review step (Phase 5) that automation must not perform. The
gate proves an item is in-constraints; it does not prove the story is good, or that
the cast stays consistent across independently generated items. Phase 5 includes a
cross-batch cast-coherence pass that automation must not perform.

---

Important Constraints

- Each group's replies are produced by a fresh Gemini chat; never share chat
  context across groups.
- Grouping affects only who writes the first draft. Ingestion, the gate, repairs
  and the attempt budget are per slug, always.
- Never regenerate a whole group to fix one slug, and never let a repair —
  inline fix or subagent — see or edit a group-mate's files.
- Gemini is used only to produce the first reply for each group's slugs.
- Never return to Gemini after an ingestion failure.
- Repair failed replies locally: an inline fix when the failure reports fewer
  than 7 errors, an Opus-preferred subagent at <repair-subagent-effort>
  (default `high`; do not use `low`) at 7 or more.
- Always rerun ingestion after a reply is repaired.
- Use a fresh repair subagent for each subagent repair attempt.
- Do not bypass or weaken validation.
- Do not modify validator or ingestion code, the look-alike dataset
  (`_build/visually_similar.py`), the cast bible, the prompt templates, or
  curriculum source data to make invalid content pass.
- Never invent a look-alike pair or a component the prompt did not list — both
  lists are reviewed data, and the gate rejects additions.
- Do not manually mark generated mnemonics as reviewed.

---

Notes on differences from the subagent automation prompt

- The model is called via a Gemini web chat (Steps 2–7), not an in-session
  subagent, so this lane has browser-setup, combined-paste assembly,
  paste-integrity, completion-polling, and per-slug download/rename steps the
  subagent lane does not.
- The generation unit is the same: a group of up to <group-size> related items in
  one writer pass, with per-slug ingest and repair afterward.
- Everything else is identical: the same auto-select + grouping (Step 1a), the
  same `webprompts`/`ingest` commands and gate, the same per-slug repair rules
  (inline fix under 7 errors, 3-attempt cap plus one last-resort inline fix),
  the same keyed-by-slug sidecar, the same layer ordering
  (including `generate.py` between layers), and the same draft/`review_status`
  discipline.
