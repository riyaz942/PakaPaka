# Generating radical mnemonic art via Gemini web

Phase 3 Tier 2 of `docs/content/content-pipeline-plan.md`: the illustrated mnemonic
image each radical shows next to its `mnemonic_text`. **Radicals only** — kanji,
vocabulary and grammar get text mnemonics and no art.

## How to run this

**Generation is manual. The agent does the bookkeeping either side of it.** The browser is
not automated in this lane — you drive Gemini yourself, because hand-driving it turned out
to be more reliable than automating it and it puts you in front of every image as it
appears.

A run is two asks and one manual stretch:

| | Who | What |
| --- | --- | --- |
| **1. Build the batch** | Agent | *"Generate radical art prompts for the next `<batch-size>`."* It picks the radicals, writes one **self-contained prompt per radical** — style block and scene in a single copyable block — and saves them to a batch file. |
| **2. Generate** | You | One **fresh Gemini chat per radical**. Paste that radical's whole prompt as the only message, generate, download. Leave the downloads where they land. |
| **3. Install** | Agent | *"Images are downloaded, install them."* It collects them from `~/Downloads`, matches each to its radical, converts to WebP, installs, runs the gates, and reports. |
| **4. Judge** | You | Open the installed images. Reply "all good", or name the slugs to redo and why. |
| **5. Re-roll** | Agent | Revises just those prompts and hands them back for step 2. |

**One chat per radical, one message per chat.** That is why each prompt carries the style
block inside it — there is no separate style message to send first, and nothing depends on
chat history. Every image is generated under identical conditions, which is a cleaner
consistency story than the batched-chat approach it replaced.

**The agent does not judge the art.** It has to *look* at each image in step 3 to work out
which radical it belongs to, and it will flag anything factually broken it notices in
passing — visible text, a blank frame — but it does not rate images, rank them, or decide
what to re-roll. That's step 4, and it's yours.

This file is the whole lane: the pipeline, why the style rules exist, and the canonical
STYLE block.

## Scope and state

| | |
| --- | --- |
| `<batch-size>` | How many radicals one run covers. Each gets its own chat, so this is purely how much you want to paste in one sitting |
| Sessions | **One fresh Gemini chat per radical**, single message. No chat is reused, and chat history carries nothing |
| Levels | Counted by *band*, not by source dataset — run Step 0 for the live number. As of 2026-08-21: N5 122 radicals, 122 reviewed, 25 still need art · N4 40 radicals, 18 reviewed, 0 need art · N3 44/8/0 · N2 17/1/0 · N1 15/0/0 |
| Model | Gemini web, Pro with extended thinking. AI Studio was tried and rejected |
| Style carrier | The STYLE block, embedded in every prompt. **No reference image is attached** |
| Staging | `curriculum/_build/generate_content/web/radical-art/` (gitignored) |
| Committed | `mobile/assets/radicals/{level}/{slug}.webp` (Git LFS) + regenerated `mobile/src/utils/radicalImages.ts` |

Batch size is a comfort setting now, not a quality one. The old lane capped a session at 5
because a chat's grip on the style loosened after that; with one chat per radical there is
no such ceiling. Pick whatever you want to sit and paste.

**Text first, art second.** A radical's `mnemonic_text` must be `review_status: reviewed`
before its art is generated — the prose ships to the learner alongside the picture, so
the picture is drawn *from* the prose, never the other way round. N4 art is blocked on
N4 mnemonic review.

Prerequisites: `cwebp` on PATH (`brew install webp libtiff`).

---

## Step 0 — agent: pick the run's radicals

Radicals are **auto-selected**, never hand-picked: the next `<batch-size>` in curriculum
order that have no art yet and whose mnemonic is reviewed. From the repo root:

```bash
python3 - <<'PY'
import json, os
LEVEL, BATCH_SIZE = 'n5', 5
items = json.load(open(f'curriculum/radicals/{LEVEL}.json'))['items']
todo = [i for i in items
        if i.get('_meta', {}).get('review_status') == 'reviewed'
        and i.get('visual_mnemonic_url')
        and not os.path.exists(os.path.join('mobile/assets', i['visual_mnemonic_url']))]
print(f'{len(todo)} {LEVEL} radicals still need art\n')
for i in todo[:BATCH_SIZE]:
    print(f"--- {i['slug']}  {i['primary_form']}  ({i['meaning']})")
    print(f"    install to: mobile/assets/{i['visual_mnemonic_url']}")
    print(i['mnemonic_text'], '\n')
PY
```

**A radical's art does not necessarily live under the level it is taught at.** A level is a
*band* (`curriculum/_build/bands.json`) and a band mixes source datasets, so an N4-authored
radical can be taught at N5 while its art stays at `radicals/n4/{slug}.webp` — the path the
item's own `visual_mnemonic_url` names. Select on that field and on whether the file it
names exists, never on `ls mobile/assets/radicals/{level}/`: listing the level directory
reports every banded-elsewhere radical as missing art, and following it regenerates and
overwrites art that already shipped.

If it selects nothing, that level's mnemonics aren't reviewed yet — stop and say so. If it
selects fewer than `<batch-size>`, the level is running out; use what it found.

Auto-selection is what makes stopping and resuming free: the next run picks up exactly
where the last one left off, with no list to keep.

## Step 1 — agent: write the scene prompts

One scene prompt per radical, written from its `mnemonic_text`. Keep them in the pilot's
shape, because that is what produced the set that shipped: **a heading line naming the
radical, then one short prose paragraph.**

**The heading line** — slug, the radical's character (`primary_form`), and its meaning:

    Scene — `sanzui` 氵 (water, left-side form)

The character earns its place there. Prompts that described the strokes in words alone
came back looking like nothing in particular for the abstract radicals — a lid, a single
drop, a hook; there is no wording that pins those down. Seeing the shape fixes it. It
lives in the heading rather than in an instruction so it reads as *which radical this
is*, not as something to draw.

**The paragraph** — four to six sentences carrying the strokes and the scene together:
how many strokes and how they sit relative to each other, then the situation from
`mnemonic_text` that carries them, then the one thing that most needs to survive at
thumbnail size. Stay faithful to the prose; the learner reads both.

**Work out the shape before writing the scene.** Read `primary_form` and note its
skeleton first — how many strokes, which are long and which short, vertical, horizontal
or diagonal, where they touch and where they deliberately don't. Then bend the scene so
the subject's own lines land on that skeleton: pose the figure, tilt the object, re-stack
the props, swap in a different member of the same family. Bending is expected, not a
liberty — the mnemonic prose decides *what* is in the picture, the radical's shape decides
*how it is arranged*, and when the two pull against each other the arrangement wins.
Absurd is fine and always was; a charming scene that doesn't trace the shape is a failed
image, however good it looks.

Hard rules for writing scene prompts:

- **Keep it short. Don't over-specify.** This is the rule that gets broken, and breaking
  it is what produced the bad batch. A prompt stacked with clauses about exact angles,
  framing, what to omit and what to keep crisp comes back *worse* than a loose one — the
  model spends its attention satisfying constraints instead of drawing. Under-specifying
  is the safer failure. If a scene prompt is longer than the worked example below, cut it.
- **Describe objects, not symbols.** Outside the heading the shape has to arrive through
  what the objects *are* — a striding figure's legs, a tree's roots — not through a drawn
  sign. Don't say "the character", "kanji", "Japanese", or "strokes" as writing.
- **Say where things sit** wherever the position *is* the shape — "three drops stacked
  down the left edge, none touching", "one long horizontal arm with two short strokes
  hanging under it". That is the stroke layout and it has to be stated. Framing that
  isn't carrying a stroke — camera angle, lighting, what's in the background — leave
  alone.
- One subject. Name at most two supporting props, and say they're drawn smaller.

A pictograph like 木 legitimately ends up looking close to its character — that is the
shape doing its job, not a violation. The STYLE block already bans text in the finished
image; a scene prompt does not need to repeat it.

Worked example — `sanzui`, whose mnemonic is about droplets flicking off a brush. This is
the pilot's own scene, and it is a good calibration for length:

> Scene — `sanzui` 氵 (water, left-side form)
>
> Three small separate droplets stacked down the LEFT edge of the square, none of them
> touching each other or anything else — top two slanting the same way, the bottom one
> flicking upward. They have just come off a wet paintbrush held at the upper left. At the
> bottom right, a small puddle they're heading for. The three unconnected drops on the
> left are the subject; the brush and puddle are supporting props, drawn smaller.

### Assembling the batch file

Each radical gets **one self-contained prompt** — the STYLE block, then its scene — so it
can be pasted into a fresh chat as a single message with nothing sent before it.

Extract the STYLE block from this file's appendix rather than retyping it; retyping is how
rules go missing. Then write
`curriculum/_build/generate_content/web/radical-art/<level>-batch.md` with one section per
radical:

    ## sanzui

    ```
    <STYLE block, verbatim>

    Now generate this image:

    Scene — `sanzui` 氵 (water, left-side form)

    Three small separate droplets stacked down the LEFT edge of the square, …
    ```

The fenced block is the copy unit — everything inside it goes into Gemini, nothing else.
Keep the `## <slug>` heading outside the fence so it names the file to expect but never
reaches the model.

Yes, this repeats the style block once per radical. That is the point: it removes chat
history as a dependency, so no image can inherit a truncated paste or a drifted chat from
another.

## Step 2 — you: generate the images

For each section in the batch file:

1. Open a **brand new** Gemini chat. Never reuse one, not even for the next radical in the
   batch.
2. Set the model to **Pro** and enable **extended thinking**.
3. Paste the whole fenced block as the only message. Send.
4. Download the image.

Leave the downloads in `~/Downloads` under whatever name Gemini gives them — the agent
identifies them in Step 3, so there's no renaming to do. Do not clear out unrelated
`Gemini_Generated_Image_*.png` files from an earlier run first; tell the agent if any are
left over.

Order matters slightly: generating in batch-file order gives the agent a download-time
ordering to check its identification against. It isn't required, but say so if you jump
around.

Generate the whole batch before handing back. Don't stop to re-roll — if one looks wrong,
note it and keep going; re-rolls are Step 5, after everything is installed and you can see
them at real size.

## Step 3 — agent: identify the downloads and stage them

Gemini names every download `Gemini_Generated_Image_<random>.png`. Nothing in the filename
says which radical it is, so the agent has to work that out — and it has to be **right**,
because a mis-assigned image ships a picture of a tree on the radical for "power".

List the candidates newest-last:

```bash
ls -t -r ~/Downloads/Gemini_Generated_Image_*.png
```

Then, for each file **open it and look at it**, and match it against the scenes in the
batch file. This is identification, not review: "three droplets off a brush" versus "a
flexed arm" is unambiguous at a glance, and a batch of distinct scenes makes it reliable.
Download order gives you an expected mapping to check against — it should agree.

**If the picture and the expected order disagree, or any image is ambiguous, stop and
ask.** Do not guess, do not fall back to ordering alone, and do not quietly reassign the
rest to make a set fit. Naming the two candidates and asking costs one message; a silently
mis-assigned image is invisible until a learner sees it.

Stage each one under its curriculum slug — from `curriculum/radicals/{level}.json`, not
from memory of the radical's name (`sanzui`, not `sansui`):

```bash
mv ~/Downloads/Gemini_Generated_Image_<random>.png \
   curriculum/_build/generate_content/web/radical-art/<slug>.png
```

Report the mapping — `file → slug` — as part of the install summary, so a wrong guess is
visible to a human before it becomes a commit.

## Step 4 — agent: install

Once the whole batch is staged. From the repo root:

Each image goes where **its own `visual_mnemonic_url` says**, which for a banded-elsewhere
radical is not the level directory you selected from. Step 0 printed the destination per
slug; this derives it again rather than trusting a single `DEST`:

```bash
STAGE=curriculum/_build/generate_content/web/radical-art
python3 - <<'PY'
import json, os, subprocess
STAGE = 'curriculum/_build/generate_content/web/radical-art'
urls = {}
for lvl in ('n5', 'n4', 'n3', 'n2', 'n1'):
    p = f'curriculum/radicals/{lvl}.json'
    if os.path.exists(p):
        for i in json.load(open(p))['items']:
            if i.get('visual_mnemonic_url'):
                urls[i['slug']] = i['visual_mnemonic_url']
for f in sorted(os.listdir(STAGE)):
    if not f.endswith('.png'):
        continue
    slug = f[:-4]
    if slug not in urls:
        raise SystemExit(f'{slug}: no radical carries a visual_mnemonic_url for this slug')
    dest = os.path.join('mobile/assets', urls[slug])
    subprocess.run(['cwebp', '-quiet', '-resize', '640', '0', '-q', '80',
                    os.path.join(STAGE, f), '-o', dest], check=True)
    print(f'{os.path.getsize(dest):>7} bytes  {dest}')
PY
cd mobile && npm run generate-radical-assets && npm run typecheck && cd -
```

640 px at q80 is the standard: the app displays these at 144 pt (`MnemonicImage` is
`h-36`), so 640 covers 3× density with headroom, and flat art lands at **4–20 KB** —
far inside the 80 KB budget in `docs/content/radical-mnemonic-images.md`.

`generate-radical-assets` is the gate. It fails on anything not named
`{n1-n5}/{slug}.webp` and on anything over 80 KB. If it fails on size, the image isn't
flat — re-roll it rather than dropping quality, because grain is a style failure, not a
compression problem.

## Step 5 — you: review each image

The gate checks bytes and filenames. Nothing checks whether a picture is any *good* —
deliberately. **The agent does not review the art and does not decide what to re-roll.**
It installs the batch, reports the file list and the `file → slug` mapping, and stops.

The one thing it may say about an image is factual and noticed in passing while
identifying it — "this one has Japanese text in it", "this one came out blank". It does
not rate images, rank them, call them weak, or pre-emptively redo any.

That split exists because "is this a good mnemonic image" is a taste judgement about
content that ships to learners, and an agent asked to make it will quietly re-roll
acceptable images and keep bad ones. A re-roll round costs one chat; a wrong image ships.

The checklist is yours:

- [ ] **Is the stroke shape actually readable in the picture?** Not "is it a nice
      drawing" — can you trace the radical's shape in the subject's main lines?
- [ ] **Does it match the `mnemonic_text`?** The learner reads both. A picture that
      contradicts the prose is worse than no picture.
- [ ] **Does it belong to the set?** Same line weight, same solid fills, same palette,
      same off-white background, no drawn frame, off-white visible on all four sides.
- [ ] **Shrink it to 140 px.** Still legible? Any detail that vanishes should have been
      left out.
- [ ] **Any text?** No kanji, kana, letters, numbers, or signage. Re-roll; this is
      usually fixed on the second try.
- [ ] **Is the composition balanced?** No conspicuously empty corner or lopsided gap.
- [ ] Nothing offensive, no brands, no celebrities, no stereotypes.

Hand back the failing slugs with a one-line reason each — the reason becomes the scene
prompt revision, so "the drop reads as a leaf" is useful and "looks off" is not. A
radical can also be left with no art: it falls back to its mnemonic text (NFR20), which
is safe. A wrong image is not. Do not "fix it in post" — there is no post.

Gemini stamps a pale sparkle in the bottom-right of every image. The off-white margin
required on all four sides is enough to make it inconspicuous, so **nothing in this lane
reserves that corner.** An earlier version of the STYLE block asked for the bottom-right
eighth to be left bare and the model over-obeyed, cutting a visible bite out of the
composition. If you find that instruction anywhere, delete it.

## Step 6 — re-roll round (only for the slugs you name)

Only runs when you've named specific radicals. The agent never starts one on its own.

1. It revises those scene prompts using your reason, keeping the Step 1 format — heading
   line plus one short paragraph. **Fixing a bad image by adding clauses makes the next one
   worse**; change the description, don't pile constraints onto it.
2. It rebuilds the batch file with just those radicals, style block embedded as usual.
3. You generate them in fresh chats (Step 2) — a re-roll is a new chat, never a follow-up
   message in the chat that produced the bad image.
4. Agent reinstalls (Steps 3–4); the new PNG overwrites the old one for that slug.
5. Back to Step 5.

As many rounds as you want. A radical you give up on simply ships without art.

## Step 7 — commit

```bash
git add mobile/assets/radicals mobile/src/utils/radicalImages.ts
git status --short && git lfs status
```

Confirm every `.webp` shows under **LFS** in `git lfs status`, not as a plain Git blob.
`.gitattributes` tracks `mobile/assets/radicals/**/*.webp`; if a file slipped through as
a Git blob it means the pattern didn't match — fix the path rather than committing it.

No curriculum JSON changes are needed. `generate.py` already writes a
`visual_mnemonic_url` for every radical that has `mnemonic_text`, so the ref exists before
the art does and simply resolves to text until the file lands. A radical with no mnemonic
text carries no ref at all — that is why Step 0 filters on the field being present rather
than assuming it.

---

## Known failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| One image is wildly off-style from the rest | Its prompt was pasted incomplete — the style block is long and a partial paste is easy to miss | Re-paste the whole fenced block into a new chat; check it starts with "You are generating illustrations" |
| Images drift between one batch and a later one | Style block was retyped or edited between batches | Always extract it from this doc's appendix; it is the only style carrier |
| An image is installed under the wrong radical | Downloads were identified by order alone after generating out of order | Re-check by opening the files; the agent must confirm by picture, not position |
| Thin outline drawing, no fills | Model reverted to "minimal line art" | Re-roll with "thick solid shapes with bold outlines" |
| Colour runs to the edge of the square | Full-bleed ban ignored | Re-roll; the off-white margin is what makes the set cohere |
| A corner is conspicuously empty, composition lopsided | A prompt asked to keep the bottom-right clear — the model over-obeys and cuts a bite out | Remove that instruction; nothing in this lane reserves a corner |
| Whole batch is stiff, cluttered or off-mnemonic | Scene prompts over-specified — too many clauses about angles, framing and omissions | Rewrite shorter, one paragraph, and re-roll |
| Subject looks like nothing in particular | Heading line missing the radical's character — words alone can't pin an abstract radical down | Put `primary_form` back in the heading and re-roll |
| Good drawing, but you can't trace the radical in it | Scene was written straight from the mnemonic prose and never bent onto the stroke skeleton | Rewrite the scene around the shape — repose, tilt or re-stack the subject — and re-roll |
| Shape is right but the subject changed — water became pipes, a tree became scaffolding | Asked to match the shape, the model swapped in an object that bends more easily instead of reposing the one it was given | Re-roll in a **fresh** chat with the scene rewritten so the named subject itself lands on the shape; never ask a chat to "fix the shape" of an image it already drew |
| The character is drawn as a glyph or label | Character moved out of the heading into the prose as an instruction | Return it to the heading; naming it inline reads as "draw this" |
| WebP over 80 KB | Grain in nominally flat fills | Re-roll for flatter art; don't lower quality |
| Props that aren't in the mnemonic | Model embellished | Re-roll with "draw only what is described, no extra objects" |

## Appendix — STYLE block (embedded verbatim at the top of every prompt)

You are generating illustrations for a Japanese-learning app. They are mnemonic
images for *radicals* — the shape-components kanji are built from. Each image has
one job: make the learner remember a specific written shape by seeing a scene whose
composition traces that shape.

Hold this style fixed for every image in this conversation:

- **Format:** square, 1:1.
- **Medium:** flat vector illustration. Every shape has a bold, even dark outline of
  the same weight and a solid flat fill. No hairline or monoline drawing, no unfilled
  outlines, no gradients, no texture, no grain, no shading beyond a single flat
  shadow tone.
- **Palette:** at most 5 flat colours, and only 5 — no blends or intermediate tones
  between them. One warm off-white background (#F7F3EC), one dark outline colour
  (#2B2B2B), and up to three accent colours reused across the whole set.
- **Background:** always the flat off-white card. Never transparent, never pure white,
  never a detailed environment. **Never full-bleed colour** — no colour field may run
  to the edge of the square. The off-white must be visible as a clear margin on all
  four sides, and the subject sits on it as an object, not in a scene.
- **No frame.** Do not draw a border, outline, rounded card, or rule around the image.
  The illustration bleeds into the off-white background with nothing enclosing it.
- **Composition:** one subject, centred, large, generous margin. It must be readable
  at 140 pixels tall on a phone. If a detail disappears at thumbnail size, remove it.
- **Nothing that isn't asked for.** Draw only what the scene describes. No extra props,
  no decorative objects, no incidental details.
- **The shape is the point:** the subject's main lines must trace the stroke shape
  described in each prompt, at roughly the same angles and proportions, including which
  strokes touch and which stay separate. Squinted at, the finished image should read as
  the character shown in the scene's heading — same skeleton, same proportions — drawn
  out of the scene's own objects. The shape must be carried by the *drawn strokes*
  of the subject itself — never by the boundary between two colour fields. If the scene as
  written won't sit on that shape, change the pose, tilt or arrangement until it does —
  the shape is fixed, the staging is not. An odd or absurd pose in service of the shape is
  correct; a natural pose that loses the shape is wrong. Get the shape right first, then
  make the scene charming.
- **Keep the subject the scene names.** Reposing, tilting or re-stacking it onto the shape
  is expected; substituting a different object or material because it bends more easily is
  not. If the scene says water, the shape has to be traced in water — not in pipework that
  happens to have the right silhouette.
- **No text of any kind in the finished image.** No Japanese characters, no kanji, no
  kana, no letters, no numbers, no signage, no watermark. If a scene seems to want a
  label, leave it blank. A scene's heading shows you the radical's character — that
  identifies the **shape to trace with objects**, never something to draw. The character
  itself must not appear in the image.
- **Tone:** deadpan and a bit absurd. Mild slapstick and undignified animals are good.
  No celebrities, brands, gore, or stereotypes.

---

## Related

- [`radical-art-web-chat-workflow-automation-prompt.md`](./radical-art-web-chat-workflow-automation-prompt.md) — **superseded**; the old browser-automated lane, kept for its Gemini automation notes
- [`docs/content/radical-mnemonic-images.md`](../content/radical-mnemonic-images.md) — asset spec, paths, LFS, app wiring
- [`docs/content/content-pipeline-plan.md`](../content/content-pipeline-plan.md) — Phase 3, Tier 1 vs Tier 2
- [`docs/archive/radical-image-pilot-prompt.md`](../archive/radical-image-pilot-prompt.md) — the pilot this workflow came out of
- [`radical-kanji-vocab-mnemonic-web-chat-workflow.md`](./radical-kanji-vocab-mnemonic-web-chat-workflow.md) — the text lane that must run first
