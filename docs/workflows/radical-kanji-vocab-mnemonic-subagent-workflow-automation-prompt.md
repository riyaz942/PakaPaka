Task: Generate Radical/Kanji/Vocabulary Mnemonics via Subagents

Generate radical mnemonics, kanji mnemonics or vocabulary mnemonics using
in-session subagents (model configurable below; a
strong reasoning model is recommended) — no API credentials and no browser. This
is the no-API, no-browser sibling of the Gemini automation prompt: only the "call
the model" step differs. Here replies are produced by fresh subagents — one
subagent per small **group** of related items (see <group-size> below) — instead
of a web chat or the Message Batches API; the context builder (the taught
decomposition, the established component prose, the reading target, the reviewed
look-alikes, the cast injection) and the mechanical gate are identical to every
other lane. See `docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow.md` for
the shared pipeline background.

This run is for ONE content type at a time and **auto-selects the next batch of
not-yet-done slugs** for that type (Step 1) — you do NOT paste a slug list.

Level (one JLPT level per run; change to `n4`, `n3`, … when ready):

<level = n4>

Content type (one of `radical`, `kanji` or `vocab`):

<type = kanji>

Subagent model (which model every subagent in this run uses):

<subagent-model = sonnet-5>

Subagent effort (reasoning effort every subagent in this run uses):

<subagent-effort = high>

Model and effort notes

- Both values above are used for BOTH the generation subagent (Step 2) and every
  repair subagent (Step 3). Pass them explicitly when launching each subagent —
  do not silently drop to a lower effort.
- A strong reasoning model at **high** effort is recommended — these are the
  mnemonics themselves, the thing the app is actually for. `medium` is an
  acceptable cost tradeoff if you are calibrating; do not use `low` for
  generation or repair. (The *orchestrator* running this prompt may itself be
  on a cheaper / lower-effort model — that is fine; only the subagents write
  the prose.)
- Give the model as your environment names it. If the requested model or effort
  is unavailable, stop and say so rather than silently substituting — then
  re-run with a combination you actually have.
- Record the model and effort actually used in the final report, and pass the
  model as the ingest `--model` provenance value (Step 3) so
  `_meta.generator_model` is honest.

Batch size (how many slugs this run processes; used as BATCH_LIMIT in Step 1):

<batch-size = 32>

This run processes up to <batch-size> slugs. A text-only subagent is far lighter
than the browser lane (no screenshots), but strong reasoning models still cost
usage. Consider starting smaller (~5–8) and calibrating: run one small batch, see
how much usage it consumed, and size later runs from that. The auto-select makes
stopping and resuming across sessions seamless — the next run picks up exactly
where you left off.

Group size (how many slugs one subagent writes in a single pass; used as
GROUP_SIZE in Step 1):

<group-size = 4>

The run's slugs are split into groups of at most <group-size>, and each group is
written by ONE subagent that sees every item in the group. Why group at all:

- **Cross-item consistency.** The gate proves an item is in-constraints; it does
  not prove the cast and scene shapes stay coherent across items generated
  independently. A subagent writing three related kanji can see what it already
  used and deliberately vary — three independent subagents cannot, and they drift
  toward the same handful of scene shapes.
- **Modest cost saving.** One subagent's fixed overhead and one read of the shared
  teaching-voice sheet instead of <group-size> of each. Real but not dramatic;
  thinking and prose output do not shrink, so do not group for cost alone.

Keep <group-size> small. At 3 the last item still gets real effort; past 4–5 two
things degrade — the subagent's attention thins out on the final item, and each
successive reply it writes re-bills the earlier replies as context, which eats the
saving. Set it to 1 to get the old strictly-per-slug behaviour.

Grouping never changes the unit of ingestion or repair. Each slug keeps its own
prompt file, its own reply file, its own gate run, and its own attempt budget —
**a failing slug is repaired alone, and its passing group-mates are never
regenerated** (Step 3).

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

if you try to skip ahead. Order for a level: **radicals → `generate.py --level <level>` → kanji → `generate.py --level <level>` → vocab**. Finish <level> fully before moving to the next level. If Step
1b raises that error, stop and report it — the previous layer is not done.

---

Workflow

Process one **group** at a time, each with its own fresh subagent (no shared
context between groups — a fresh subagent per group is the equivalent of the
browser lane's "fresh chat"). Within a group the subagent writes every item in one
pass, then each slug is ingested and, if it fails, repaired individually. Do NOT
mix content types in one run — all slugs in this run share the same <type>.
Everything is local files plus subagents: no browser, no clipboard, no downloads.

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
from generate_content.generate_mnemonics import (
    KIND_DIR, PROMPT_VERSION, BANDED_KINDS, _source_map, sidecar_path,
)
LEVEL, KIND, BATCH_LIMIT, GROUP_SIZE = '<level>', '<type>', <batch-size>, <group-size>   # KIND: 'radical', 'kanji' or 'vocab'
# Read "done" from the checked-in sidecar, not from drafts/. A draft is filed
# under the level an item had when it was WRITTEN; a banded kind (radical,
# kanji) can be re-filed to a different level by a reband, so drafts_dir keyed
# by the current LEVEL silently misses every drafted item that moved. The
# sidecar has no such drift: it is keyed by slug within a file named for the
# item's SOURCE dataset (band-stable), not its level, and write_sidecar()
# keeps it band-aware already. Vocabulary is unbanded, so its own sidecar
# stays keyed by level.
slugs = mc.all_slugs(LEVEL, KIND_DIR[KIND])
source_by_slug = _source_map(KIND) if KIND in BANDED_KINDS else {}
sidecar_cache = {}
done = set()
for slug in slugs:
    source = source_by_slug.get(slug, LEVEL)
    if source not in sidecar_cache:
        path = sidecar_path(source, KIND)
        sidecar_cache[source] = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    entry = sidecar_cache[source].get(slug)
    if entry and entry.get('_meta', {}).get('prompt_version') == str(PROMPT_VERSION[KIND]):
        done.add(slug)
todo = [s for s in slugs if s not in done][:BATCH_LIMIT]
# Shared-component data for grouping; radicals have no components, so they fall
# back to sequential chunks (curriculum order already clusters related radicals).
comps = {}
if KIND == 'kanji':
    comps = mc.decomposition_edges()  # all levels; callers filter per slug
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
prompt version — stop and report that. Otherwise treat the printed `ALL:` list as
this run's slug set and the printed groups as this run's generation units: every
later step iterates over exactly these slugs, and no slug outside this list is
touched. Record the group composition — the final report names it.

Grouping is a hint for the writer, not a constraint on the content: items in a
group share a subagent, nothing else. Each still gets its own prompt file built
from its own context, and no item may reference another group-mate's components.

1b. Generate the prompt files for the selected slugs in one call — all groups at
once, since each slug gets its own prompt file exactly as before. `--slugs` is a
single comma-separated string with NO spaces after the commas (use the `ALL:`
list):

.venv/bin/python -m generate_content.generate_mnemonics webprompts --type <type> --level <level> --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.prompt.md

Regenerating a prompt is a safe no-op — `webprompts` overwrites deterministically,
and any appended gate errors from an earlier failure are dropped, which is correct
for a fresh attempt.

If this command raises the "no `mnemonic_text` yet" / "no `meaning_mnemonic` yet"
ValueError, the layer below is unfinished — see Layer Ordering above and stop.

---

Step 2: Generate the Group's Replies with One Subagent

For the current group, launch ONE general-purpose subagent (using
<subagent-model> at <subagent-effort> effort) in the foreground — ingestion must wait for it to
finish. List every prompt file path in the group explicitly — one line per slug,
resolved, not a template:

curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.prompt.md

Give the subagent these instructions:

  Read each of the prompt files listed above — one per item, N items in this group.
  In each file, everything BELOW the HTML comment header (the block that opens with
  `<!--` and ends with a line ending in `-->`) is the complete, self-contained task
  for that item: the teaching-voice sheet, the item itself, its taught
  decomposition with each component's established prose, the reading target, the
  reviewed look-alikes, the cast block, the writing rules, and the JSON output
  contract. The header itself is orchestration instructions for the caller — ignore
  it. Each header names its own slug; do not let one file's header send you to
  another file's reply path.

  The teaching-voice sheet is identical in every file — read it once and apply it
  to all of them. Everything from "The kanji" / "The radical" / "The word" onward
  is per-item and must be obeyed per item.

  If <type> = radical, add this style calibration before the item sections below
  (radical mnemonics only — kanji and vocab already carry their own cast/reading
  discipline and don't need this note):

    These are shape-to-meaning mnemonics, not gag scenes. Fuse the stroke
    description and the meaning into ONE single image — either the shape
    literally resembles the meaning, or the shape is compared to one real-world
    object/scenario that shares the meaning. Do NOT describe the shape correctly
    and then bolt on a second, unrelated scene (a stock animal or bystander
    character doing something silly) purely for a joke — that produces two
    competing images, which the prompt's own hard rules already forbid, and
    reads as needlessly long. If there's humor, it should be in how the shape
    itself is described, not in an unrelated character's antics. Reviewed
    examples of the target style: 儿 "Look at 儿 head-on and you're staring at
    someone standing with their feet planted apart, the two strokes sweeping
    down and out like a pair of sturdy human legs mid-stride." (legs — the
    shape literally resembles the meaning). 工 "Picture a steel I-beam standing
    between two flat concrete slabs: the top and bottom strokes are the slabs,
    the line down the middle is the beam being lowered into place. That single
    girder holding the whole thing up is the heart of any construction site."
    (construction — the shape is compared to one real-world object that shares
    the meaning). Prefer the shorter-to-middle end of the length target
    (roughly 180–260 characters) unless an item genuinely needs the extra room
    to land the image clearly.

  Write the mnemonics for every item exactly as its own prompt body asks, then
  write ONE reply file per item, each to its own path:

  curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.reply.md

  Do not write a combined file, and do not put two items in one file — each slug's
  reply file must contain only that slug's JSON.

  Requirements:

  - Write EXACTLY one fenced ```json code block and nothing else in each reply file
    — no preamble, no commentary before or after, and nothing that refers to the
    other items in the group. The prompt shows the exact key names; use them
    verbatim and add no others.
  - Treat each item's constraints as independent. An item may only name the
    components ITS OWN prompt lists, and may only mention the look-alikes ITS OWN
    prompt lists — even when a group-mate shares a component or is itself a
    look-alike. Seeing the sibling items is for varying your writing, never for
    widening what an item is allowed to reference.
  - Return the keys for this type:
      radical → `mnemonic_text` **and** `image_prompt` (both required — the
                first is the short learner-facing summary, the second the
                stroke-walked scene the illustration is drawn from), plus
                `description` **only if this radical needs one** (see below)
      kanji   → `meaning_mnemonic`, `reading_mnemonic`, and `description` **only
                if this kanji needs one**
      vocab   → `meaning_mnemonic`, `reading_mnemonic`, and `description` **only
                if this word needs one**
  - `description` is optional for **all three** types. Omit the key entirely
    unless the prompt lists look-alikes (then it is required, and its job is the
    visual contrast) or the item has a real nuance the mnemonics cannot carry —
    an odd register, a false friend, a usage trap, a piece of history that
    explains the character. A description that only restates the meaning and
    counts strokes is noise; leave it out.
  - Length, per field:
      radical `mnemonic_text`  roughly **100–180** characters — the short
                               learner-facing summary of the image, and lean
                               funny; at this length the image is the joke
      radical `image_prompt`   roughly **150–300** characters — the same scene
                               walked stroke by stroke, written for the
                               illustrator
      kanji meaning            roughly **120–220** characters, two or three
                               sentences — a hard ceiling, see below (but
                               **50–150** when the kanji just *is* a taught
                               radical — see below)
      vocab meaning            roughly **180–330** characters
      kanji/vocab reading      roughly **150–280** characters (a vocab derivation
                               note stays at one sentence — see below)
    Except for the kanji meaning ceiling, these are targets, not rules:
    overrunning to finish a scene the item genuinely needs is fine, padding to
    reach one is not. They are short on purpose — the depth comes from how
    specific the picture is, not from how many sentences it takes.
  - **Kanji meaning mnemonics only — the Rev 6 style.** This one field is held
    much tighter than the rest, and the gate enforces it at 260 characters:
      - Two or three sentences, most under 14 words, none over 20. No dash-joined
        second clauses, no "-ing" tails, no colon-joined reveal at the end.
      - Plain English a ten-year-old would use. *tied* not *lashed*, *bundle* not
        *sheaf*, *caught* not *snagged*, *tips over* not *lurches*. If it sounds
        like a novel, it is wrong.
      - **One causal chain.** Each sentence is caused by the one before it and
        the last one produces the meaning. If two sentences could swap places
        without breaking the scene, it is a list, not a story.
      - Components enter as ordinary things the scene already needs — a count, an
        object, a place — not as their own staged mini-event. "eight
        `<radical>sheep</radical>` by the water" beats a whole sentence about an
        axe splitting a log into eight.
      The target, in full: "A `<radical>stick</radical>` planted in the
      `<radical>ground</radical>` holds up a heavy bundle of
      `<radical>grain</radical>`. Suddenly it snaps into
      `<radical>eight</radical>` pieces. You leap onto the falling grain and
      `<kanji>ride</kanji>` it down the hill like a sled." Four components, 160
      characters, every word a learner word.
  - **When the kanji simply *is* a taught radical, do not write a story at all.**
    Some kanji are a radical the learner already met, unchanged in shape and in
    meaning — 山 the radical and 山 the kanji. The prompt's "Is this kanji just a
    radical it already knows?" section tells you which ones outright; it is
    computed mechanically (`mnemonic_context.identical_radical`), so it is not a
    judgement call you make. For those items the whole meaning mnemonic is one or
    two sentences saying so:
      - "The `<radical>mountain</radical>` radical and the
        `<kanji>mountain</kanji>` kanji are the same."
      - "The radical and the kanji for `<radical>direction</radical>` /
        `<kanji>direction</kanji>` are the same! Huzzah!"
    Both tags still go on, wrapping the same word on two different spans — that
    is correct here, and it is what lets the app colour both ends of the chain.
    The band is **50–150 characters, hard ceiling 200**, not 120–220; the gate
    switches to it automatically for these items, so a full invented scene now
    *fails* rather than merely being unwanted. Where we teach the kanji a sense
    the radical does not carry (工 "craft" over the "construction" radical), add
    exactly one sentence tying the two senses together — the prompt says so when
    it applies. The **reading** mnemonic is unaffected: the reading is not
    derivable from the radical, so it gets the usual full treatment.
  - Build the story from the components the prompt lists, reusing the object each
    component already carries — do not invent a fresh scene that competes with
    what the learner has already read. Reference every listed component by its
    taught meaning. Never name a component, radical or kanji that is not in that
    list. (For kanji meanings, reusing the object is enough; restaging that
    component's own illustrated scene is what blows the length budget.)
  - **Make the group's items feel different from each other.** This is the whole
    reason you were given them together. Do not reuse a scene shape, setting,
    animal, gag structure, or sentence rhythm across two items in the group, and do
    not let two items resolve the same way. Where a group shares a component, that
    component's established image must still be continued in each item — but it
    should be *doing something different* each time, not replaying the same beat.
    Items in a group are also likely to be items the learner reviews near each
    other, so collisions here are exactly the ones that cost them.
  - Give the last item in the group the same effort as the first. If you find
    yourself writing to a template by item three, stop and re-read that item's own
    decomposition before continuing.
  - Highlight tags, exactly as the prompt's "Highlighting" section describes:
    wrap each taught component's meaning where the story uses it —
    `<radical>…</radical>` in a kanji meaning mnemonic, `<kanji>…</kanji>` in a
    vocab one — and wrap both the target reading kana and the English phonetic
    hook in `<reading>…</reading>` in the reading mnemonic. A **kanji** meaning
    mnemonic carries a second tag as well: the kanji's own meaning — the word the
    story lands on, distinct from any borrowed component — goes in
    `<kanji>…</kanji>`, because the app renders "a piece I already know" and "the
    thing this story is building toward" in different colours. A radical borrows
    nothing, so its `mnemonic_text` wraps **its own meaning** — the word the
    picture resolves to — in `<radical>…</radical>`; that is the same word a kanji
    story will later pull upward, so both ends of the chain highlight the same
    thing. One kind of tag per field — the kanji meaning mnemonic's pair above is
    the only exception — no nesting, every tag closed, and none at all in a
    description.
  - The reading mnemonic must contain the target reading verbatim, in kana, inside
    a `<reading>` tag, and should use the cast character the prompt assigns for
    that reading.
  - For vocab, obey the reading-regularity block exactly: when it says the reading
    is regular or kana-only, write **one sentence** of derivation and stop —
    padding a regular reading into a story is a gate failure, not a stylistic
    preference. When it says irregular or not-derivable, write the full story.
  - When you write a description, it must address **every** look-alike the prompt
    lists, spelling out the visual difference, and must not introduce any other
    Japanese character. Descriptions carry no furigana, so stray Japanese renders
    unreadable.
  - Write all Japanese as plain text — no furigana brackets, no romaji (write
    kana), no markdown, no headings, no lists, no bold/italic, no emoji. The
    highlight tags above are the only markup allowed; everything else is stored as
    a plain string and rendered as prose.
  - Aim for real depth inside that length band; the gate enforces minimum lengths
    because thin stories do not survive reviews, and maximums because a learner
    rereads these dozens of times.
  - Do not set or add any review_status field.
  - Do not modify any file other than this group's reply files. In particular do
    not edit any `.prompt.md`. Do not run tools to fetch external content.

Use a fresh subagent for each group; never reuse a subagent's context across
groups. If the subagent finishes having written only some of the group's reply
files, do not relaunch it for the whole group — ingest the files it did write
(Step 3) and treat each missing slug as a failed attempt 1, repaired by the
per-slug repair subagent below.

---

Step 3: Ingest and Repair — one slug at a time

Grouping stops at the end of Step 2. From here every slug is handled entirely on
its own: its own ingest, its own gate result, its own repairs, its own
attempt budget. Ingest each slug in the group in turn.

**A failure never invalidates its group-mates.** If one slug in a group of three
fails the gate, repair that slug alone — the other two are already ingested and
must not be regenerated, re-ingested, or touched. Never relaunch the group's
generation subagent to fix one item: that would rewrite passing content, cost three
items' generation to fix one, and lose drafts that already passed. The repair
below — inline fix or subagent — sees only the failing slug's own prompt and
reply files.

For each slug in the group, run:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level <level> --slug <slug> --model <subagent-model>

(The `--model` value is recorded in the sidecar entry's `_meta.generator_model`;
pass the same `<subagent-model>` you generated with so provenance is honest.)

If ingestion succeeds:

The item is merged into the per-level sidecar:

- radical → curriculum/radicals/mnemonics/<level>.json
- kanji   → curriculum/kanji/mnemonics/<level>.json
- vocab   → curriculum/vocabulary/mnemonics/<level>.json

Record the slug as successful and proceed to the next slug.

If ingestion fails:

The ingestion process rewrites:

curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.prompt.md

with the validation errors appended.

Do not regenerate from scratch, and do not regenerate the group. Count the
validation errors appended to the prompt file and choose the repair method:

- **Fewer than 7 errors — inline fix.** Edit `<slug>.reply.md` yourself, in
  this session. A small fix does not need a subagent.
- **7 or more errors — repair subagent.** Launch a FRESH general-purpose
  subagent (<subagent-model> at <subagent-effort> effort, foreground) to repair
  this one slug's existing reply.

Whichever method repairs the reply, it works from these files — this slug's
only, never a group-mate's:

- curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.prompt.md
- curriculum/_build/generate_content/web/mnemonics/<level>/<type>/<slug>.reply.md

The repair instructions are the same for both methods (an inline fix follows
them exactly as a repair subagent would):

  Read the validation errors appended to `<slug>.prompt.md`. Inspect the existing
  `<slug>.reply.md` and the output contract in the prompt. Edit `<slug>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve the parts that already work.
  - Do not rewrite a passing field to fix a failing one.
  - Fix all reported errors, not only the first.
  - Edit only `<slug>.reply.md`; do not edit `<slug>.prompt.md`.
  - Do not modify validators, ingestion code, curriculum source data, the
    look-alike dataset, the cast bible, or the assembled sidecar.
  - Preserve the reply-file format (a single fenced ```json block) and the exact
    key names for this type. Do not add a `description` the earlier draft omitted
    unless an error asks for one.
  - A "too short" error means the story lacks substance — add scene, not filler
    clauses. A "too long" error means cut, not compress into one dense sentence;
    the targets are in Step 2 (radical text ~100–180, radical image_prompt
    ~150–300, kanji meaning ~120–220, vocab
    meaning ~180–330, reading ~150–280). On a long **kanji meaning**, cut whole
    staged events and novel-register words before you touch anything else — that
    is nearly always where the excess is; never drop a component to fit.
    A `keep <= 200` ceiling on a kanji meaning means this kanji *is* a taught
    radical: the fix is not to trim the scene but to delete it and say the two
    are the same, per Step 2. Likewise a "too short" error there does **not**
    mean add scene — the floor is 40, so the item is genuinely near-empty.
  - A "never wraps it in <radical>…" or "does not highlight the reading" error
    means the words are there but untagged — add the tags around the words the
    story already uses, do not rewrite the story.
  - A "description is omitted, but this item has reviewed look-alikes" error is
    the one case where you *add* a key. Add only the description; leave the
    mnemonic(s) exactly as they are.
  - Keep every field plain prose apart from the highlight tags (no
    markdown/brackets/romaji/emoji), keep the reading verbatim, keep every listed
    component referenced and tagged, keep every listed look-alike addressed, and
    introduce no Japanese character the prompt did not list.
  - Ensure valid JSON. Add no commentary outside the JSON block. Do not set
    review_status.
  - Edit only this slug's reply file. Other slugs generated alongside it have
    already passed the gate and are none of this task's business.

Then run ingestion again:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level <level> --slug <slug> --model <subagent-model>

Retry Limit

The budget is **per slug, not per group**. Allow at most three ingestion attempts
for each slug, including the initial attempt:

- Attempt 1: the group's generation subagent (Step 2)
- Attempt 2: this slug's first repair — an inline fix if the failure reported
  fewer than 7 errors, otherwise a repair subagent
- Attempt 3: this slug's second repair — same rule

Attempt 1 is shared — one group subagent produces the first attempt for every slug
in the group — but attempts 2 and 3 are always single-slug. Each slug's counter is
independent: one slug burning its whole budget has no effect on its group-mates'
budgets, and a group of three that fails on one item costs at most two extra repair
subagents, not a second group pass.

Use a fresh subagent for each repair that needs one. If the third ingestion
attempt fails, the repair retry threshold is reached: make ONE last-resort
inline fix — edit the reply file yourself, no subagent, whatever the error
count — and run ingestion a fourth and final time.

If the fourth ingestion attempt fails:

- Stop retrying the slug.
- Record it as failed or skipped.
- Preserve the latest validation errors for the final report.
- Proceed to the next slug — finish the rest of the group before moving on.

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
project's normal generation pipeline from the repository root.

Check the current invocation under:

curriculum/_build/generate_content/

Then run:

generate.py --level <level>

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

- The content type, <batch-size>, <group-size>, <subagent-model>, <subagent-effort>, and the exact auto-selected slug set for this run (with the count vs. <batch-size>)
- The groups as generated, listing each group's slugs, so a reviewer can read a group's items together and judge cross-item variety
- The model and effort actually used for generation and repair (confirm they match <subagent-model> / <subagent-effort>, or call out any forced substitute)
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
the cast stays consistent across independently generated items.

---

Important Constraints

- Each group's replies are produced by a fresh <subagent-model> subagent at
  <subagent-effort> effort; never
  share subagent context across groups.
- Grouping affects only who writes the first draft. Ingestion, the gate, repairs
  and the attempt budget are per slug, always.
- Never regenerate a whole group to fix one slug, and never let a repair —
  inline fix or subagent — see or edit a group-mate's files.
- Do not bypass or weaken validation.
- Do not modify validator or ingestion code, the look-alike dataset
  (`_build/visually_similar.py`), the cast bible, the prompt templates, or
  curriculum source data to make invalid content pass.
- Never invent a look-alike pair or a component the prompt did not list — both
  lists are reviewed data, and the gate rejects additions.
- Do not manually mark generated mnemonics as reviewed.
- No browser, no clipboard, no downloads — this lane is entirely local files plus
  subagents.

---

Notes on differences from the Gemini web-chat automation prompt

- The model is called via an in-session subagent (Step 2), not a browser chat,
  so there are no browser-setup, paste-integrity, completion-polling, or
  download/rename steps. The generation subagent writes the reply files directly.
- The generation unit is a group of up to <group-size> related items rather than a
  single item, because one subagent can be told to keep a group's scenes distinct
  in a way N independent single-item chats cannot. The Gemini lane groups the same
  way — one fresh chat per group with a combined paste — rather than one chat per
  slug.
- Everything else is identical: the same auto-select + grouping (Step 1a), the
  same `webprompts`/`ingest` commands and gate, the same per-slug repair rules
  (inline fix under 7 errors, 3-attempt cap plus one last-resort inline fix),
  the same per-level keyed-by-slug sidecar, the same layer ordering, and the
  same draft/`review_status` discipline.
