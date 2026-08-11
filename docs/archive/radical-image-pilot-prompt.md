# Radical mnemonic art — 5-image pilot prompt (round 2)

> **Superseded.** Round 2 passed and its five images shipped. The production process is
> [`docs/workflows/radical-art-web-chat-workflow.md`](../workflows/radical-art-web-chat-workflow.md);
> this file is kept as the record of how the style block was arrived at.

Round 1 (Gemini web, Pro extended thinking) got **stroke fidelity mostly right** — the
failure mode I expected didn't happen. What it got wrong was consistency: the five came
back in three different treatments (bold filled cartoon, hairline monoline, full-bleed
poster). This round changes three things and re-runs the *same five* radicals, so the
only variable is the prompt.

What changed:

1. **No drawn frame or border.** Round 1 varied between a rounded card and a square
   rule. `MnemonicImage` already renders inside its own `h-36 bg-surface` container, so
   a drawn border doubles up.
2. **No full-bleed colour.** The off-white card must show on all four sides.
3. **`hito` 人 goes first and becomes the style reference.** Attach the approved 人
   image to every subsequent scene message. The style block alone did not hold across
   turns — that is what actually drifted.

## How to run it

Use **one fresh chat**. Paste the STYLE block first, then the scenes in order, one
message at a time.

After scene 1 (`hito` 人) comes back good, **attach that image to every following scene
message** with the line: *"Match this image's line weight, fill style, palette and
background exactly. Same set."* Re-roll scene 1 until it's right before moving on —
everything downstream inherits from it.

---

## STYLE (paste once, first message)

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

## Scene 1 — `hito` 人 (person) — **generate first, this becomes the reference**

Two strokes meeting at a single peak at the top and splaying apart at the bottom,
like a walking figure's legs mid-stride: one leg planted, one swinging forward. Draw
a person from behind, striding, whose two legs form exactly that inverted-V — the
legs joined at one clean point, no crossbar, nothing joining them lower down. Legs
dominate the composition; the upper body is small.

> Round 1 nailed this one. Re-roll until you have it again with no drawn frame and
> clear off-white on all four sides, then attach it to every scene below.

## Scene 2 — `ki` 木 (tree)

A tree built from four strokes: one vertical trunk running top to bottom, one
horizontal branch crossing it near the top, and two legs sweeping down and outward
from the trunk as exposed roots gripping soil. Keep the branch a single straight
horizontal, keep the roots symmetrical, and keep the trunk perfectly vertical. Bare —
no leaves, no canopy blob obscuring the branch line.

Draw the trunk, branch and roots as **thick solid shapes with the same bold outline
and flat fill as the reference image** — not thin lines. The trunk must stay clearly
visible when the image is shrunk to thumbnail size. Nothing on or around the tree
except the soil it grows from.

## Scene 3 — `sanzui` 氵 (water, left-side form)

Three small separate droplets stacked down the LEFT edge of the square, none of them
touching each other or anything else — top two slanting the same way, the bottom one
flicking upward. They have just come off a wet paintbrush held at the upper left. At
the bottom right, a small puddle they're heading for. The three unconnected drops on
the left are the subject; the brush and puddle are supporting props, drawn smaller.

Push the three drops hard against the **left third** of the square — this radical's
whole identity is that it lives on the left-hand side of a character, so they must not
drift toward the centre. The bottom drop's tail must clearly flick **up and to the
right**. Keep the brush and puddle small and out of the way; the puddle stays well
clear of the bottom-right corner.

## Scene 4 — `chikara` 力 (power)

A flexed arm read as two strokes: one long stroke sweeping down and hooking sharply
left at the bottom like a bent elbow, and one short stroke crossing near the top as
the bulging muscle. Draw a straining, cartoonishly over-flexed arm whose silhouette
follows exactly that hooked-line shape. The hook at the bottom must be crisp and
obvious.

Keep the silhouette simple and bold — no veins, no sweat drops, no individual fingers,
no surface detail. Someone glancing at a thumbnail should read the hooked stroke shape
before they read "arm".

## Scene 5 — `ichi` 一 (ground / one)

One single horizontal line, edge to edge, dividing the square. Below it, flat solid
earth; above it, empty sky. A tiny figure stands on that line, dead centre, looking
out. Nothing else in the frame — no hills, no clouds, no sun. The one unbroken
horizontal stroke is the entire subject.

The line must be an actual **drawn stroke** — a thick dark bar, unbroken from one side
to the other, passing behind the figure without stopping at it. The sky and earth are
gentle tinted bands that stay well inside the off-white margin and never reach the edge
of the square; the horizontal bar, not the colour boundary between them, is what the
learner is meant to see. Keep the figure small.

---

## Judging the five

- Is the stroke shape actually readable in the picture, or did the model draw a nice
  scene that has nothing to do with the shape? (This was mostly fine in round 1.)
- **Do the five look like one set?** This is what round 1 failed. Same line weight,
  same fill style, same palette, same margin.
- No drawn frame on any of them? Off-white visible on all four sides?
- Squint / shrink to 140 px — still legible?
- Any letters or kanji sneak in? (Common; usually fixable by re-rolling.)
- Bottom-right corner clear, so the Gemini sparkle lands on flat off-white?

## Known post-processing needs

Round-1 output was **270–320 KB as PNG at 512 px** — roughly 20× what a genuinely flat
5-colour illustration should cost. Gemini renders fine grain into nominally solid fills,
and grain is exactly what a lossy codec spends bytes on.

So the pipeline needs a quantise step before encoding: reduce to ≤8 colours, then encode
WebP. That hits the ≤80 KB budget in `docs/content/radical-mnemonic-images.md` and
enforces the palette rule the prompt asks for and doesn't reliably get. Requires
`brew install webp imagemagick` — neither is currently installed.

## On the Gemini watermark

Gemini web stamps a pale four-point sparkle in the bottom-right of every image. Keeping
that corner as bare off-white makes it effectively invisible, which is why the style
block reserves it. Note this makes the mark *inconspicuous, not absent* — the invisible
SynthID watermark is in every Gemini image regardless and is not removed. That's fine;
it has no effect on the art.

---

Scenes are taken verbatim from the reviewed `mnemonic_text` in
`curriculum/radicals/n5.json` — the prose ships to the learner alongside the image, so
the picture has to match the words, not the other way round.
