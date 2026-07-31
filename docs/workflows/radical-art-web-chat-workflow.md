# Generating radical mnemonic art via Gemini web

Phase 3 Tier 2 of `docs/content/content-pipeline-plan.md`: the illustrated mnemonic
image each radical shows next to its `mnemonic_text`. **Radicals only** — kanji,
vocabulary and grammar get text mnemonics and no art.

## How to run this

**To actually run the lane, hand an agent
[`radical-art-web-chat-workflow-automation-prompt.md`](./radical-art-web-chat-workflow-automation-prompt.md).**
That is the executable version, tuned for a Sonnet driver at low reasoning effort, and
**the agent drives Chrome itself** — it opens the Gemini chat, pastes the style message,
sends each scene, waits for the image, and downloads it. Nothing is copy-pasted into
Gemini by hand, exactly as in the mnemonic and example-sentence lanes. The only human
interaction is granting permission before the first download.

This file is the maintainer reference: what the pipeline is, why the style rules exist,
and the canonical STYLE block the automation pastes. Read it when changing the lane;
run the automation prompt when producing art.

## Scope and state

| | |
| --- | --- |
| `<images-per-session>` | **5** radicals per Gemini session — one fresh chat, one style message, five scenes |
| `<session-count>` | How many sessions one run creates. A run covers `images-per-session × session-count` radicals |
| Ordering | **Sequential.** One browser, one chat at a time; downloads carry no slug, so parallel sessions would scramble which image is which |
| Levels | N5 (76 radicals, all mnemonics reviewed — ready) · N4 (33 radicals, **0 reviewed — not ready**) |
| Model | Gemini web, Pro with extended thinking. AI Studio was tried and rejected |
| Style carrier | The STYLE message alone. **No reference image is attached** |
| Staging | `curriculum/_build/generate_content/web/radical-art/` (gitignored) |
| Committed | `mobile/assets/radicals/{level}/{slug}.webp` (Git LFS) + regenerated `mobile/src/utils/radicalImages.ts` |

Keep `<images-per-session>` at 5: past that a chat's grip on the style loosens and later
images drift; below it you pay the fixed setup cost too often. Cover more radicals by
raising `<session-count>`, not the session size.

**Text first, art second.** A radical's `mnemonic_text` must be `review_status: reviewed`
before its art is generated — the prose ships to the learner alongside the picture, so
the picture is drawn *from* the prose, never the other way round. N4 art is blocked on
N4 mnemonic review.

Prerequisites: `cwebp` on PATH (`brew install webp libtiff`).

---

## Step 0 — pick the run's radicals

A run selects `<images-per-session> × <session-count>` radicals and splits them into
sessions. The selector below shows one session's worth; the automation prompt's Step 1
is the same query generalised over both variables.

From the repo root:

```bash
python3 - <<'PY'
import json, os
level = 'n5'
items = json.load(open(f'curriculum/radicals/{level}.json'))['items']
have = {f[:-5] for f in os.listdir(f'mobile/assets/radicals/{level}') if f.endswith('.webp')}
todo = [i for i in items if i['slug'] not in have
        and i.get('_meta', {}).get('review_status') == 'reviewed']
print(f'{len(todo)} {level} radicals still need art\n')
for i in todo[:5]:
    print(f"--- {i['slug']}  {i['primary_form']}  ({i['meaning']})")
    print(i['mnemonic_text'], '\n')
PY
```

That prints the next five in curriculum order with their reviewed mnemonic prose. Work
in that order — don't cherry-pick.

## Step 1 — write the scene prompts

One scene prompt per radical, written from its `mnemonic_text`. Each is a shape-reference
line followed by three short paragraphs.

**Line 1 — the shape reference.** The radical's character (`primary_form`), on its own
line, framed as a target to trace rather than something to draw:

    Target shape — trace this with the objects in the scene. It is a reference for the
    composition only: do NOT draw this character, and do not render it as text or as a
    written glyph anywhere in the image. 氵

Then:

1. **The strokes.** How many strokes and how they sit relative to each other — direction,
   angle, which touch and which don't. This paragraph is the whole point of the image.
2. **The scene.** The situation from `mnemonic_text`, restated as something drawable.
   Stay faithful to the prose; the learner reads both.
3. **The constraint.** What must stay crisp at thumbnail size, and what to leave out.

Hard rules for writing scene prompts:

- **Always include the shape reference.** This was learned the hard way: prompts that
  described the strokes in words alone produced images that looked like nothing in
  particular for the abstract radicals — a lid, a single drop, a hook. There is no
  wording that pins those down. Give the model the target and let the scene trace it.
- **Describe objects, not symbols.** Outside the reference line the shape has to arrive
  through what the objects *are* — a striding figure's legs, a tree's roots — not through
  a drawn sign. Don't say "the character", "kanji", "Japanese", or "strokes" as writing.
- **Say where things sit in the frame**, especially "left third", "centred", "small, at
  the top". The model does not infer composition from the mnemonic.
- **Always end with:** *"Leave the bottom-right eighth of the square completely clear —
  bare background, nothing drawn in it."*
- One subject. Name at most two supporting props, and say they're drawn smaller.

The reference line and the "no text" rule are not in conflict. The character is an input
describing the target shape; the rule governs the output, where nothing may appear as
writing. A pictograph like 木 legitimately ends up looking close to its character — that
is the shape doing its job. A drawn glyph sitting on the card as a label is not.

Worked example — `sanzui` 氵, whose mnemonic is about droplets flicking off a brush:

> Target shape — trace this with the objects in the scene. It is a reference for the
> composition only: do NOT draw this character, and do not render it as text or as a
> written glyph anywhere in the image. 氵
>
> Three small separate droplets stacked down the left third of the square, none of them
> touching each other or anything else — the top two slanting the same way, the bottom one
> flicking up and to the right.
>
> They have just come off a wet paintbrush held at the upper left. At the bottom of the
> frame, a small puddle they're heading for. The brush and puddle are supporting props,
> drawn smaller.
>
> The three unconnected drops on the left are the subject; keep them clearly separate at
> thumbnail size. Leave the bottom-right eighth of the square completely clear — bare
> background, nothing drawn in it.

Write every scene prompt for the run before opening the browser. Save them to
`curriculum/_build/generate_content/web/radical-art/<level>-scenes.md`, one `## <slug>`
heading each, so a re-roll doesn't mean rewriting them.

## Step 2 — run the Gemini session

One **fresh** Gemini chat per session of five. Fresh matters: a long chat drifts.

**Message 1** — the STYLE block from the appendix below, verbatim, nothing else. Wait
for it to acknowledge.

**Messages 2–6** — one scene prompt each, sent alone. **No image is attached to any
message**, and no "match this reference" line is added. The style block already fixes
the palette, line weight and background, and the generated set holds that style without
an anchor image.

That makes the STYLE message the single point of failure for the whole session: paste it
complete, and verify it before sending. A truncated style message costs every image in
the chat.

Scenes go one at a time — send, wait for the image, download it, then send the next.
Re-roll a scene immediately if it comes back wrong rather than moving on; a bad image
early in a chat pollutes the ones after it. Three attempts per radical, then skip it —
a skipped radical falls back to its mnemonic text (NFR20), which is safe. A wrong image
is not.

## Step 3 — download and stage

Download each image and name it after the **curriculum slug**, `.png`, into the staging
directory:

```
curriculum/_build/generate_content/web/radical-art/{slug}.png
```

Slugs come from `curriculum/radicals/{level}.json`, not from your memory of the radical's
name. `sanzui`, not `sansui`.

## Step 4 — install

Once, after every session in the run has finished staging. From the repo root:

```bash
STAGE=curriculum/_build/generate_content/web/radical-art
DEST=mobile/assets/radicals/n5
for f in "$STAGE"/*.png; do
  cwebp -quiet -resize 640 0 -q 80 "$f" -o "$DEST/$(basename "$f" .png).webp"
done
stat -f "%z bytes  %N" "$DEST"/*.webp
cd mobile && npm run generate-radical-assets && npm run typecheck && cd -
```

640 px at q80 is the standard: the app displays these at 144 pt (`MnemonicImage` is
`h-36`), so 640 covers 3× density with headroom, and flat art lands at **4–20 KB** —
far inside the 80 KB budget in `docs/content/radical-mnemonic-images.md`.

`generate-radical-assets` is the gate. It fails on anything not named
`{n1-n5}/{slug}.webp` and on anything over 80 KB. If it fails on size, the image isn't
flat — re-roll it rather than dropping quality, because grain is a style failure, not a
compression problem.

## Step 5 — review each image

The generator checks bytes and filenames. It cannot check whether the picture is any
good. Every image needs a human (or agent) pass on all of these:

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
- [ ] **Bottom-right corner clear?** The Gemini sparkle watermark lands there. On bare
      off-white it's invisible; on a colour field it shows. This rule gets ignored
      roughly a third of the time — check it, and re-roll with an explicit reminder.
- [ ] Nothing offensive, no brands, no celebrities, no stereotypes.

Re-roll anything that fails. Do not "fix it in post" — there is no post.

## Step 6 — commit

```bash
git add mobile/assets/radicals mobile/src/utils/radicalImages.ts
git status --short && git lfs status
```

Confirm every `.webp` shows under **LFS** in `git lfs status`, not as a plain Git blob.
`.gitattributes` tracks `mobile/assets/radicals/**/*.webp`; if a file slipped through as
a Git blob it means the pattern didn't match — fix the path rather than committing it.

No curriculum JSON changes are needed. `generate.py` already writes
`visual_mnemonic_url: radicals/{level}/{slug}.webp` for every radical, so the ref exists
before the art does and simply resolves to text until the file lands.

---

## Known failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Image five looks nothing like image one | Style message truncated on paste, or session too long | Verify the paste before sending; keep `<images-per-session>` at 5 |
| A late session's images don't match an early session's | Style message differs between sessions | Always extract it from this doc's appendix rather than retyping |
| Thin outline drawing, no fills | Model reverted to "minimal line art" | Re-roll with "thick solid shapes with bold outlines" |
| Colour runs to the edge of the square | Full-bleed ban ignored | Re-roll; the off-white margin is what makes the set cohere |
| Sparkle watermark clearly visible | Something drawn in the bottom-right | Re-roll with the corner rule repeated as its own sentence |
| Subject looks like nothing in particular | Shape reference line missing — words alone can't pin an abstract radical down | Add the `primary_form` target-shape line and re-roll |
| The character is drawn as a glyph or label | Reference line reworded, or its "do NOT draw this character" clause dropped | Restore the exact wording; the target-shape framing is what keeps it an input |
| WebP over 80 KB | Grain in nominally flat fills | Re-roll for flatter art; don't lower quality |
| Props that aren't in the mnemonic | Model embellished | Re-roll with "draw only what is described, no extra objects" |

## Appendix — STYLE block (paste verbatim as message 1)

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
- **Keep the bottom-right corner clear.** Leave roughly the bottom-right eighth of the
  square as bare off-white with nothing drawn in it — no subject, no prop, no shadow,
  no colour field.
- **Composition:** one subject, centred, large, generous margin. It must be readable
  at 140 pixels tall on a phone. If a detail disappears at thumbnail size, remove it.
- **Nothing that isn't asked for.** Draw only what the scene describes. No extra props,
  no decorative objects, no incidental details.
- **The shape is the point:** the subject's main lines must trace the stroke shape
  described in each prompt, at roughly the same angles and proportions. The shape must
  be carried by the *drawn strokes* of the subject itself — never by the boundary
  between two colour fields. Get the shape right first, then make the scene charming.
- **No text of any kind in the finished image.** No Japanese characters, no kanji, no
  kana, no letters, no numbers, no signage, no watermark. If a scene seems to want a
  label, leave it blank. A scene may show you a character as a **target shape** — that is
  a reference for the composition to trace with objects, never something to draw. The
  character itself must not appear in the image.
- **Tone:** deadpan and a bit absurd. Mild slapstick and undignified animals are good.
  No celebrities, brands, gore, or stereotypes.

Reply "ready" and I'll send the first scene.

---

## Related

- [`radical-art-web-chat-workflow-automation-prompt.md`](./radical-art-web-chat-workflow-automation-prompt.md) — **the executable version; hand this to the agent**
- [`docs/content/radical-mnemonic-images.md`](../content/radical-mnemonic-images.md) — asset spec, paths, LFS, app wiring
- [`docs/content/content-pipeline-plan.md`](../content/content-pipeline-plan.md) — Phase 3, Tier 1 vs Tier 2
- [`docs/radical-image-pilot-prompt.md`](../radical-image-pilot-prompt.md) — the pilot this workflow came out of
- [`radical-kanji-vocab-mnemonic-web-chat-workflow.md`](./radical-kanji-vocab-mnemonic-web-chat-workflow.md) — the text lane that must run first
