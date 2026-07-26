Task: Generate N5 Radical/Kanji/Vocabulary Mnemonics via Gemini Web

Use the existing logged-in Gemini session in my Chrome browser to generate Phase
2b/2d mnemonic prose for the following items. This run is for ONE content type at a
time and **auto-selects the next batch of not-yet-done slugs** for that type
(Step 1) — you do NOT paste a slug list.

Content type (one of `radical`, `kanji` or `vocab`):

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
prompt file, its own reply file, its own gate run, and its own 3-attempt budget —
**a failing slug is repaired alone, and its passing group-mates are never
regenerated** (Step 8).

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

if you try to skip ahead. Order for a level: **radicals → `generate.py --level
n5` → kanji → `generate.py --level n5` → vocab**. Do N5 fully before N4. If Step
1b raises that error, stop and report it — the previous layer is not done.

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
from generate_content.generate_mnemonics import KIND_DIR, PROMPT_VERSION
LEVEL, KIND, BATCH_LIMIT, GROUP_SIZE = 'n5', '<type>', <batch-size>, <group-size>   # KIND: 'radical', 'kanji' or 'vocab'
drafts_dir = f'generate_content/drafts/mnemonics/{LEVEL}/{KIND}'
done = set()
if os.path.isdir(drafts_dir):
    for name in os.listdir(drafts_dir):
        if not name.endswith('.json') or name == 'requests-preview.json':
            continue
        rec = json.load(open(os.path.join(drafts_dir, name)))
        if rec.get('status') == 'draft' and rec.get('prompt_version') == PROMPT_VERSION[KIND]:
            done.add(rec['slug'])
todo = [s for s in mc.all_slugs(LEVEL, KIND_DIR[KIND]) if s not in done][:BATCH_LIMIT]
# Shared-component data for grouping; radicals have no components, so they fall
# back to sequential chunks (curriculum order already clusters related radicals).
comps = {}
if KIND == 'kanji':
    comps = mc.decomposition_edges(LEVEL)
elif KIND == 'vocab':
    comps = mc.vocab_component_edges(LEVEL)
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
print(f'{len(todo)} slug(s) selected (BATCH_LIMIT={BATCH_LIMIT}, done={len(done)}) '
      f'in {len(groups)} group(s) of <= {GROUP_SIZE}:')
for i, g in enumerate(groups, 1):
    print(f'  group {i}: {",".join(g)}')
print()
print('ALL:', ','.join(todo))
PY

Note what "done" means here: a draft recorded under an **older** prompt version is
stale, not done, so a version bump correctly re-selects every out-of-date item for
regeneration. This mirrors the API path, whose `run` re-queues old-version drafts.
`PROMPT_VERSION` is keyed by type (`{"radical": 1, "kanji": 4, "vocab": 4}`),
because the three prompts move independently. Radicals sitting at 1 is deliberate:
Rev 3 reverted the radical contract to the original shape — a `mnemonic_text` of
~150–300 characters, description demoted to optional — so the reviewed N5 radicals
already match the current prompt and are correctly *not* re-selected.

The number records **conformance, not provenance**: it answers "does this draft
satisfy contract N", not "which prompt wrote it". The N5 kanji were generated
under 1 and 2 and then brought up to 4 in place — retagged mechanically, with the
description backlog cleared — so they are stamped 4. Stamping is only ever correct
after the item passes the gate under the new contract; a draft that merely
predates a bump is stale and must be regenerated, not renumbered.

If it prints 0 slugs, this level+type is already fully generated at the current
prompt version — stop and report that; do not open Gemini. Otherwise treat the
printed `ALL:` list as this run's slug set and the printed groups as this run's
generation units: every later step iterates over exactly these slugs, and no slug
outside this list is touched. Record the group composition — the final report
names it.

Grouping is a hint for the writer, not a constraint on the content: items in a
group share a Gemini chat, nothing else. Each still gets its own prompt file built
from its own context, and no item may reference another group-mate's components.

1b. Generate the prompt files for the selected slugs in one call — all groups at
once, since each slug gets its own prompt file exactly as before. `--slugs` is a
single comma-separated string with NO spaces after the commas (use the `ALL:`
list):

.venv/bin/python -m generate_content.generate_mnemonics webprompts --type <type> --level n5 --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md

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
KIND, LEVEL = '<type>', 'n5'
GROUP_SLUGS = '<slug1,slug2,slug3>'.split(',')   # this group's slugs, no spaces
base = f'generate_content/web/mnemonics/{LEVEL}/{KIND}'
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

   pbcopy < curriculum/_build/generate_content/web/mnemonics/n5/<type>/_group-<first-slug>.paste.md

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

curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.reply.md

4. Delete the original downloaded file from Downloads after it has been moved into
   place.

   Do not leave stray downloaded files behind.

Save Gemini's initial response for each slug without modifying its content.

If Gemini produced only some of the group's code blocks, write reply files for the
ones that exist and treat each missing slug as a failed attempt 1 (repaired by the
per-slug repair subagent in Step 8). Do not open another Gemini chat to fill gaps —
and do not regenerate the whole group.

If ingestion later fails, the repair subagent described in Step 8 may make targeted
changes to that slug's reply file.

---

Step 8: Ingest and Repair — one slug at a time

Grouping stops at the end of Step 7. From here every slug is handled entirely on
its own: its own ingest, its own gate result, its own repair subagent, its own
3-attempt budget. Ingest each slug in the group in turn.

**A failure never invalidates its group-mates.** If one slug in a group of three
fails the gate, repair that slug alone — the other two are already ingested and
must not be regenerated, re-ingested, or touched. Never reopen Gemini for the
group to fix one item: that would rewrite passing content, cost three items'
generation to fix one, and lose drafts that already passed. The repair subagent
below sees only the failing slug's own prompt and reply files.

For each slug in the group, run:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level n5 --slug <slug> --model gemini-web

(The `--model` value is recorded in the sidecar entry's `_meta.generator_model`;
`gemini-web` is the honest provenance for this lane.)

If ingestion succeeds:

The item is merged into the per-level sidecar:

- radical → curriculum/radicals/mnemonics/n5.json
- kanji   → curriculum/kanji/mnemonics/n5.json
- vocab   → curriculum/vocabulary/mnemonics/n5.json

Record the slug as successful and proceed to the next slug.

If ingestion fails:

The ingestion process rewrites:

curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md

with validation errors appended.

Do not return to Gemini.

Do not open another Gemini chat.

Do not regenerate the entire mnemonic or the group.

Instead, use a subagent to repair the existing reply.

Repair Procedure

1. Launch a general-purpose subagent.
   - Prefer the latest available Opus model with high reasoning.
   - If an Opus model is unavailable, use the strongest suitable reasoning or coding model available.
   - Run the subagent in the foreground because ingestion must wait for the repair to finish.

2. Give the subagent these files — this slug's only, never a group-mate's:

   - curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md
   - curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.reply.md

3. Give the subagent the following instructions:

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
     targets are roughly radical ~150–300, meaning ~180–330, reading ~150–280.
   - A "never wraps it in <radical>…" or "does not highlight the reading" error
     means the words are there but untagged — add the tags around the words the
     story already uses, do not rewrite the story. Highlight tags: each taught
     component's meaning is wrapped where the story uses it — `<radical>` in a
     kanji meaning mnemonic, `<kanji>` in a vocab one — and the reading kana plus
     the English phonetic hook are wrapped in `<reading>` in the reading mnemonic.
     A radical borrows nothing, so its `mnemonic_text` wraps its own meaning — the
     word the picture resolves to — in `<radical>`. One kind of tag per field,
     every tag closed, none nested, and none in a description.
   - A "description is omitted, but this item has reviewed look-alikes" error is
     the one case where you *add* a key. Add only the description; leave the
     mnemonic(s) exactly as they are.
   - For kanji: the meaning_mnemonic must reference every taught component listed
     in the prompt's "Taught decomposition" section, and must not name any
     component that is not listed there.
   - For kanji: the reading_mnemonic must contain the target reading kana shown in
     the prompt, verbatim, inside a `<reading>` tag.
   - For vocab: the meaning_mnemonic must reference every kanji listed in the
     prompt's "The kanji in this word" section; the reading_mnemonic must contain
     the word's reading verbatim and must follow the prompt's "The reading"
     section — a one-line derivation note when it says the reading is regular or
     kana-only, a full story when it says otherwise.
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

4. Wait for the subagent to finish updating the reply file.

5. Run ingestion again:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level n5 --slug <slug> --model gemini-web

6. If ingestion fails again:
   - Read the newly appended validation errors from the rewritten prompt file.
   - Launch a new repair subagent using the updated prompt and reply files.
   - Repeat the targeted repair procedure.
   - Run ingestion again.
   - Do not return to Gemini.

Retry Limit

The budget is **per slug, not per group**. Allow at most three ingestion attempts
for each slug, including the initial attempt:

- Attempt 1: the group's Gemini reply (Step 7)
- Attempt 2: this slug's first repair subagent
- Attempt 3: this slug's second repair subagent

Attempt 1 is shared — one Gemini chat produces the first attempt for every slug
in the group — but attempts 2 and 3 are always single-slug. Each slug's counter is
independent: one slug burning all three attempts has no effect on its group-mates'
budgets, and a group of three that fails on one item costs at most two extra repair
subagents, not a second group chat.

Use a fresh repair subagent for each attempt. If the third ingestion attempt fails:

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
between layers so the next layer's prompts read the new prose. Do N5 fully before
N4. On the first run of a fresh type, read the assembled output in the app before
launching more runs — the batch size is already pilot-sized, so one run doubles as
the pilot. Read a whole group's items side by side when you do: that is the only
way to see whether grouping is buying the variety it is meant to buy, and whether
the last item in each group is as strong as the first. If it is visibly thinner,
drop <group-size>.

---

Final Build

After every selected slug has been successfully ingested or skipped, run the
project's normal generation pipeline from the repository root.

Check the current invocation under:

curriculum/_build/generate_content/

Then run:

generate.py --level n5

Followed by:

npm run validate-schema

And:

npm run compile-curriculum

`generate.py` inlines the mnemonic sidecars into the shipped radical/kanji/vocab
JSON (radicals get a `mnemonic_text`; kanji and vocab get the two mnemonics; all
three get a `description` only on the items that needed one), each carrying
`_meta.review_status: draft`. Use the current
project-specific `generate.py` invocation and flags found under
`curriculum/_build/`. Do not guess if the documented invocation has changed.

This step is not optional between layers — the next layer's prompts read the
inlined prose, not the sidecar.

---

Final Report

Provide a summary containing:

- The content type, <batch-size>, <group-size>, and the exact auto-selected slug set for this run (with the count vs. <batch-size>)
- The groups as generated, listing each group's slugs, so a reviewer can read a group's items together and judge cross-item variety
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs — call these out as blockers for the layer above
- ❌ Failed slugs
- The number of subagent repair attempts used for each affected slug, and which group it came from — a group whose items mostly needed repair is a signal that <group-size> is too high
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
- Grouping affects only who writes the first draft. Ingestion, the gate, the repair
  subagent and the 3-attempt budget are per slug, always.
- Never regenerate a whole group to fix one slug, and never let a repair subagent
  see or edit a group-mate's files.
- Gemini is used only to produce the first reply for each group's slugs.
- Never return to Gemini after an ingestion failure.
- Repair failed replies using an Opus-preferred subagent.
- Always rerun ingestion after a subagent updates a reply.
- Use a fresh repair subagent for each failed repair attempt.
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
  same `webprompts`/`ingest` commands and gate, the same per-slug 3-attempt
  repair cap, the same per-level keyed-by-slug sidecar, the same layer ordering
  (including `generate.py` between layers), and the same draft/`review_status`
  discipline.
