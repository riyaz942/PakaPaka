Task: Generate Radical Mnemonic Art via Gemini Web

Use the existing logged-in Gemini session in my Chrome browser to generate Phase 3
Tier 2 radical art. **You drive the browser yourself** — you open the chat, paste the
style message, send each scene, wait for the image, and download it. Do not ask me to
copy-paste anything into Gemini or to download anything by hand. The only thing you
need from me is permission before the first download of the session.

This run **auto-selects** the next radicals that have no art yet (Step 1) — you do NOT
paste a slug list.

Level:

<level = n5>

Images per Gemini session (how many radicals one fresh chat draws; used as
IMAGES_PER_SESSION in Step 1):

<images-per-session = 4>

Number of Gemini sessions this run creates (used as SESSION_COUNT in Step 1):

<session-count = 1>

This run therefore covers **<images-per-session> × <session-count>** radicals — that many
images, spread over <session-count> separate chats.

**Sessions run sequentially, never in parallel.** There is one browser and one Gemini
account; two chats generating at once would interleave downloads in `~/Downloads` with
no reliable way to tell which image belongs to which scene, and image files carry no
slug in their name. Finish a session completely — all its images sent, downloaded,
renamed and staged — before opening the next chat. Within a session the scenes are also
sequential: send one, wait for the image, download it, then send the next.

Keep <images-per-session> at 5. Past that the chat's grip on the style loosens and later
images drift; below that you pay the fixed setup cost (fresh chat, model verification,
style paste) too often. Raise <session-count> to cover more radicals in one run instead.
The auto-select makes stopping and resuming seamless — the next run picks up exactly
where you left off.

The maintainer reference for this lane, including the asset spec and the reasoning
behind the style rules, is
`docs/workflows/radical-art-web-chat-workflow.md`.

Browser Requirements

- Use Chrome, not Edge.
- If multiple browsers are connected:
  a. List all connected browsers.
  b. Determine which browser has an active Gemini session.
  c. Confirm you will use the logged-in Chrome instance before continuing.

---

Prerequisites — check before opening the browser

1. `cwebp` is on PATH (`brew install webp libtiff` if not). Without it the images
   cannot be installed and the run is wasted.
2. The radicals selected in Step 1 have `_meta.review_status: reviewed`. The selector
   below already filters on this. **Art is drawn from reviewed prose, never before it** —
   the mnemonic text ships to the learner next to the picture. If Step 1 selects nothing
   for a level, that level's mnemonics are not reviewed yet; stop and report it.

---

Workflow

Step 1: Select This Run's Radicals and Split Them into Sessions

Do NOT hand-pick radicals. From the repository root, substituting <level>,
<images-per-session> and <session-count>:

python3 - <<'PY'
import json, os
LEVEL, IMAGES_PER_SESSION, SESSION_COUNT = '<level>', <images-per-session>, <session-count>
items = json.load(open(f'curriculum/radicals/{LEVEL}.json'))['items']
art_dir = f'mobile/assets/radicals/{LEVEL}'
have = {f[:-5] for f in os.listdir(art_dir) if f.endswith('.webp')}
todo = [i for i in items
        if i['slug'] not in have
        and i.get('_meta', {}).get('review_status') == 'reviewed']
total = IMAGES_PER_SESSION * SESSION_COUNT
selected = todo[:total]
sessions = [selected[i:i + IMAGES_PER_SESSION]
            for i in range(0, len(selected), IMAGES_PER_SESSION)]
print(f'{len(todo)} {LEVEL} radicals still need art; taking {len(selected)} '
      f'in {len(sessions)} session(s) of <= {IMAGES_PER_SESSION}\n')
for n, s in enumerate(sessions, 1):
    print(f'=== SESSION {n}: {",".join(i["slug"] for i in s)}')
    for i in s:
        print(f'\n--- {i["slug"]}  {i["primary_form"]}  ({i["meaning"]})')
        print(i['mnemonic_text'])
    print()
PY

That prints, in curriculum order, each session's radicals with their reviewed mnemonic
prose. Work sessions in the printed order and radicals in the printed order within each
session — do not cherry-pick.

If it prints 0 radicals needing art, this level is complete — stop and report that; do
not open Gemini. If it selects fewer than <images-per-session> × <session-count>, that
is the level running out; process what was selected and say so in the final report.

Record the session composition — the final report names it.

Step 2: Write the Scene Prompts

Before opening the browser, write one scene prompt per selected radical, from its
`mnemonic_text`. Each scene prompt is a shape-reference line followed by three short
paragraphs:

**Line 1 — the shape reference.** Open every scene prompt with the radical's character,
on its own line, in exactly this form (substituting the radical's `primary_form` from
Step 1's output):

    Target shape — trace this with the objects in the scene. It is a reference for the
    composition only: do NOT draw this character, and do not render it as text or as a
    written glyph anywhere in the image. 亠

Then:

1. **The strokes.** How many strokes and how they sit relative to each other —
   direction, angle, which touch and which do not. This paragraph is the point of the
   image.
2. **The scene.** The situation from `mnemonic_text`, restated as something drawable.
   Stay faithful to the prose; the learner reads both.
3. **The constraint.** What must stay crisp at thumbnail size and what to leave out.

Hard rules:

- **Always include the shape reference line.** Words alone cannot pin down an abstract
  radical — a lid, a single drop, a hook — and that is precisely where the drawing comes
  back looking like nothing in particular. Give Gemini the target and let the objects
  trace it.
- **Describe objects, not symbols.** The character is the shape the scene traces, never
  something drawn. Outside the reference line, don't say "the character", "kanji",
  "Japanese", or "strokes" as writing — say "two shapes meeting at a peak". Pictographs
  will legitimately end up close to the character; that is the shape doing its job, not
  a violation.
- **State where things sit in the frame** — "left third", "centred", "small, at the top".
  Gemini does not infer composition from the mnemonic.
- **Always end each scene with:** *"Leave the bottom-right eighth of the square
  completely clear — bare background, nothing drawn in it."*
- One subject; at most two supporting props, described as drawn smaller.

Save all of this run's scene prompts to
`curriculum/_build/generate_content/web/radical-art/<level>-scenes.md`, one `## <slug>`
heading per radical, before opening the browser. A re-roll must not mean rewriting the
prompt. (That directory is gitignored.)

Step 3: Create a Fresh Gemini Chat

Open a brand new Gemini conversation for **this session's** radicals.

Never reuse a chat across sessions, and never reuse a chat from a previous run.

Step 4: Configure Gemini

Before sending anything:

- Select the Pro model.
- Enable Extended thinking.

Verify both are actually enabled. Gemini's UI sometimes ignores clicks:

- Take a screenshot or otherwise verify the UI.
- If the settings are wrong, click again.
- Repeat until the UI confirms Pro model and Extended thinking.

Do not continue until this is verified.

Step 5: Paste the Style Message

The first message of every session is the STYLE block, verbatim, from the appendix of
`docs/workflows/radical-art-web-chat-workflow.md`. Nothing else in that message.

**The style message is the only thing carrying the house style.** No reference image is
attached — not in this message and not in any scene message. Every image in the set is
produced from this text alone, so paste it exactly and completely; a truncated style
message is the single most damaging failure in this lane, because every image in the
session inherits it.

Do not inject text using JavaScript.

Never use:

- execCommand("insertText")
- DOM manipulation
- JavaScript text insertion

These silently truncate long prompts.

Instead:

1. Copy the style block to the clipboard. Extract it from the workflow doc rather than
   retyping it — retyping is how rules go missing:

   python3 - <<'PY'
   import re
   doc = open('docs/workflows/radical-art-web-chat-workflow.md').read()
   block = doc.split('## Appendix — STYLE block (paste verbatim as message 1)', 1)[1]
   block = block.split('\n---\n', 1)[0].strip()
   open('/tmp/radical-style.txt', 'w').write(block + '\n')
   print(f'{len(block)} chars; starts: {block[:60]!r}')
   PY

   pbcopy < /tmp/radical-style.txt

2. Focus the Gemini input.
3. Paste with a real keyboard shortcut: Cmd + V.

Verify before sending: the pasted text starts with "You are generating illustrations"
and ends with 'Reply "ready" and I\'ll send the first scene.' If it is truncated, clear
the input and paste again. Do not send a partial style message.

Wait for Gemini to acknowledge before sending the first scene.

Step 6: Send Each Scene and Download Its Image

For each radical in this session, **in order, one at a time**:

1. Copy that radical's scene prompt from `<level>-scenes.md` to the clipboard and paste
   it with Cmd + V, same rules as Step 5. Send it.

   Send the scene text alone. Do not attach any image, and do not add a "match this
   reference" line — this lane deliberately does not use a reference image.

2. Wait for generation to finish. Do not infer completion from the tab title changing,
   and do not poll the page for a rendered image and treat the first sighting as done —
   Gemini shows a placeholder and progressively resolves the image, so an early read
   catches a partial render.

   Use the stop-generating button as the authoritative signal:

   - While Gemini is generating, a square stop icon replaces the mic/send button.
   - Poll for the square stop button to disappear.
   - Confirm the mic/send button has reappeared.
   - Only then treat the image as finished.

   Do not click download until the stop button is gone.

3. Download the image using Gemini's download control on the generated image (hover the
   image to reveal it). Ask for explicit permission before the first download of the run.

   The file lands in `~/Downloads` with a generated name such as
   `Gemini_Generated_Image_<random>.png` — it carries no slug, which is exactly why
   sessions and scenes must stay sequential.

4. Immediately move and rename it into the staging directory, before sending the next
   scene:

   mv ~/Downloads/Gemini_Generated_Image_*.png curriculum/_build/generate_content/web/radical-art/<slug>.png

   The slug comes from Step 1's output, not from your memory of the radical's name
   (`sanzui`, not `sansui`). Verify exactly one file matched the glob before moving; if
   more than one matched, an earlier download was not cleaned up — resolve that first.

5. Confirm the staged file exists and is non-empty, then send the next scene.

If a scene comes back visibly wrong against the Step 8 checklist — wrong style, drawn
frame, full-bleed colour, visible text — re-roll it in the same chat immediately rather
than moving on. A bad image early in a chat pollutes the ones after it. Allow at most
**three attempts per radical**; if the third fails, leave that radical without art,
record it as skipped, and continue with the next one. A radical with no art falls back
to its mnemonic text in the app, so a skip is safe — a wrong image is not.

Step 7: Close the Session and Repeat

When every radical in the session has a staged PNG, close out that chat and return to
Step 3 for the next session. Do not carry the chat over.

Step 8: Install All Staged Images — once, after every session

Only after all <session-count> sessions are done, from the repository root:

STAGE=curriculum/_build/generate_content/web/radical-art
DEST=mobile/assets/radicals/<level>
for f in "$STAGE"/*.png; do
  cwebp -quiet -resize 640 0 -q 80 "$f" -o "$DEST/$(basename "$f" .png).webp"
done
stat -f "%z bytes  %N" "$DEST"/*.webp
cd mobile && npm run generate-radical-assets && npm run typecheck && npm run lint && cd -

640 px at q80 is the standard — the app displays these at 144 pt, so 640 covers 3×
density with headroom, and flat art lands at 4–20 KB against an 80 KB budget.

`generate-radical-assets` is the mechanical gate. It fails on any file not named
`{n1-n5}/{slug}.webp` and on any file over 80 KB. If it fails on size, the image is not
flat enough — re-roll that radical rather than lowering quality, because grain is a
style failure, not a compression problem.

No curriculum JSON changes are needed. `generate.py` already writes
`visual_mnemonic_url: radicals/{level}/{slug}.webp` for every radical, so the ref exists
before the art does and resolves to text until the file lands.

Step 9: Review Every Image

The gate checks bytes and filenames. It cannot tell whether the picture is any good.
Open each generated image and check all of:

- Is the radical's stroke shape actually traceable in the subject's main lines? Not "is
  it a nice drawing".
- Does it match that radical's `mnemonic_text`? The learner reads both; a picture that
  contradicts the prose is worse than no picture.
- Does it belong to the set — same line weight, solid fills, same palette, off-white
  background, no drawn frame, off-white visible on all four sides?
- Legible shrunk to 140 px?
- Any kanji, kana, letters, numbers or signage? Re-roll.
- Bottom-right corner clear, so Gemini's sparkle watermark lands on bare background?
- Nothing offensive, no brands, no celebrities, no stereotypes.

Because no reference image is used, cross-session consistency rests entirely on the
style message. Compare an image from the last session against one from the first before
finishing — that comparison is what would catch drift, and nothing upstream checks it.

Re-roll anything that fails, then re-run Step 8. Do not attempt to edit an image;
there is no post-processing step in this lane.

Step 10: Stage for Commit

git add mobile/assets/radicals mobile/src/utils/radicalImages.ts
git status --short && git lfs status

Confirm every `.webp` appears under LFS in `git lfs status`, not as a plain Git blob.
`.gitattributes` tracks `mobile/assets/radicals/**/*.webp`.

Leave the changes staged. Do not commit — that is mine.

---

Final Report

Provide a summary containing:

- <level>, <images-per-session>, <session-count>, and the exact auto-selected slug set
  for this run (count vs. the <images-per-session> × <session-count> target)
- The sessions as run, listing each session's slugs, so a reviewer can compare a late
  session's images against an early one and judge style drift
- ✅ Radicals that got art, with each file's final WebP size
- ⚠️ Radicals skipped after three failed attempts, and what was wrong with each
- Re-roll counts per radical — a session needing many re-rolls is a signal the style
  message was truncated or <images-per-session> is too high
- Gate results: `generate-radical-assets`, `typecheck`, `lint`
- Confirmation that every `.webp` is LFS-tracked
- Roughly how many radicals of this level still need art (re-run Step 1 to get the
  count), so it is clear whether another run is needed
- Any manual follow-up required

---

Important Constraints

- **You drive the browser.** Never ask the user to paste a prompt into Gemini or to
  download an image manually. The only user interaction is permission before the first
  download.
- Sessions are sequential, never parallel. Scenes within a session are sequential.
- Each session is a fresh Gemini chat; never share chat context across sessions.
- **Never attach a reference image.** The style message is the sole style carrier.
- Every scene prompt opens with the radical's `primary_form` as a target-shape reference,
  using the exact wording in Step 2. Outside that line, don't name the character, kanji,
  or Japanese in the prose.
- Rename and stage each download immediately, before sending the next scene — the
  downloaded filename carries no slug.
- Never generate art for a radical whose `mnemonic_text` is not `reviewed`.
- At most three attempts per radical; skipping is safe, a wrong image is not.
- Do not lower WebP quality to pass the size gate; re-roll for flatter art.
- Do not edit `generate-radical-asset-map.js`, the schema, or curriculum source data to
  make an asset pass.
- Do not commit. Stage only.
