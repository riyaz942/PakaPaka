# Generating radical mnemonic art via Gemini web

Phase 3 Tier 2 of `docs/content/content-pipeline-plan.md`: the illustrated mnemonic
image each radical shows next to its `mnemonic_text`. **Radicals only** — kanji,
vocabulary and grammar get text mnemonics and no art.

This doc is written to be **executed by a Sonnet agent at low reasoning effort**. Every
judgement call is reduced to a rule, a verbatim block to paste, or a checklist item. If
something is genuinely ambiguous, stop and ask rather than improvising — a wrong image
is worse than a missing one, because a missing one falls back to text (NFR20).

The only manual part is the browser: Gemini web generates the images, a human downloads
them. Everything either side of that is commands.

## Scope and state

| | |
| --- | --- |
| Batch size | **5 radicals per Gemini session** — one session, six messages |
| Levels | N5 (76 radicals, all mnemonics reviewed — ready) · N4 (33 radicals, **0 reviewed — not ready**) |
| Model | Gemini web, Pro with extended thinking. AI Studio was tried and rejected |
| Style anchor | `mobile/assets/radicals/n5/hito.webp` — attached to every scene message, forever |
| Staging | `curriculum/_build/generate_content/web/radical-art/` (gitignored) |
| Committed | `mobile/assets/radicals/{level}/{slug}.webp` (Git LFS) + regenerated `mobile/src/utils/radicalImages.ts` |

**Text first, art second.** A radical's `mnemonic_text` must be `review_status: reviewed`
before its art is generated — the prose ships to the learner alongside the picture, so
the picture is drawn *from* the prose, never the other way round. N4 art is blocked on
N4 mnemonic review.

Prerequisites: `cwebp` on PATH (`brew install webp libtiff`).

---

## Step 0 — pick the batch

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

## Step 1 — write the five scene prompts

One scene prompt per radical, written from its `mnemonic_text`. Structure each as three
short paragraphs, in this order:

1. **The strokes.** How many strokes and how they sit relative to each other — direction,
   angle, which touch and which don't. This paragraph is the whole point of the image.
2. **The scene.** The situation from `mnemonic_text`, restated as something drawable.
   Stay faithful to the prose; the learner reads both.
3. **The constraint.** What must stay crisp at thumbnail size, and what to leave out.

Hard rules for writing scene prompts:

- **Never name the radical, the character, Japanese, kanji, or strokes-as-writing.** Say
  "two shapes meeting at a peak", not "the character 人". Naming the character makes the
  model draw the glyph, and the style block forbids text.
- **Describe objects, not symbols.** The shape has to arrive through what the objects
  *are* — a striding figure's legs, a tree's roots — not through a drawn sign.
  (Pictographs like 木 will legitimately end up looking close to the character. That's
  fine. Getting there by asking for the character is not.)
- **Say where things sit in the frame**, especially "left third", "centred", "small, at
  the top". The model does not infer composition from the mnemonic.
- **Always end with:** *"Leave the bottom-right eighth of the square completely clear —
  bare background, nothing drawn in it."*
- One subject. Name at most two supporting props, and say they're drawn smaller.

Worked example — `sanzui` 氵, whose mnemonic is about droplets flicking off a brush:

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

Write all five before opening the browser. Save them to
`curriculum/_build/generate_content/web/radical-art/<batch>.md` so a re-roll doesn't mean
rewriting them.

## Step 2 — run the Gemini session

One **fresh** Gemini chat per batch of five. Fresh matters: a long chat drifts.

**Message 1** — paste the STYLE block from the appendix below, verbatim, nothing else.
Wait for it to acknowledge.

**Messages 2–6** — one scene prompt each, and with every single one:

- **attach `mobile/assets/radicals/n5/hito.webp`**, and
- add the line: *"Match this image's line weight, fill style, palette and background
  exactly. Same set."*

Attaching the reference on every message is not optional and not redundant. The style
block alone does not survive across turns — that is the failure this workflow exists to
prevent, and `hito.webp` is the canonical anchor for the entire 150-image set, not just
for its own batch.

Re-roll a scene immediately if it comes back wrong rather than moving on; a bad image
early in a chat pollutes the ones after it.

## Step 3 — download and stage

Download each image and name it after the **curriculum slug**, `.png`, into the staging
directory:

```
curriculum/_build/generate_content/web/radical-art/{slug}.png
```

Slugs come from `curriculum/radicals/{level}.json`, not from your memory of the radical's
name. `sanzui`, not `sansui`.

## Step 4 — install

From the repo root, per batch:

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
| Image five looks nothing like image one | Reference not attached to every message | Re-attach `hito.webp` and re-roll; never trust the style block alone |
| Thin outline drawing, no fills | Model reverted to "minimal line art" | Re-roll with "thick solid shapes with bold outlines, like the reference" |
| Colour runs to the edge of the square | Full-bleed ban ignored | Re-roll; the off-white margin is what makes the set cohere |
| Sparkle watermark clearly visible | Something drawn in the bottom-right | Re-roll with the corner rule repeated as its own sentence |
| Actual kanji or letters appear | Scene prompt named the character or Japanese | Rewrite the prompt to describe objects only |
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
- **No text of any kind.** No Japanese characters, no kanji, no kana, no letters, no
  numbers, no signage, no watermark. If a scene seems to want a label, leave it blank.
- **Tone:** deadpan and a bit absurd. Mild slapstick and undignified animals are good.
  No celebrities, brands, gore, or stereotypes.

Reply "ready" and I'll send the first scene.

---

## Related

- [`docs/content/radical-mnemonic-images.md`](../content/radical-mnemonic-images.md) — asset spec, paths, LFS, app wiring
- [`docs/content/content-pipeline-plan.md`](../content/content-pipeline-plan.md) — Phase 3, Tier 1 vs Tier 2
- [`docs/radical-image-pilot-prompt.md`](../radical-image-pilot-prompt.md) — the pilot this workflow came out of
- [`radical-kanji-vocab-mnemonic-web-chat-workflow.md`](./radical-kanji-vocab-mnemonic-web-chat-workflow.md) — the text lane that must run first
