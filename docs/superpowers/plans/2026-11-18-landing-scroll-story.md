# Landing Page Scroll Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three sections of the landing page (mnemonic chain, grammar typing, three apps become one) play their animation from the scroll position, forward and back, pinned when they fit in the window.

**Architecture:** All code stays in `mobile/public/landing/index.html`. A block of pure functions (marked `// <story-math>` … `// </story-math>`) turns a scroll progress `p` (0 to 1) into a scene state; Jest extracts that block from the HTML and tests it. A small scene runner gives each scene its `p` (pinned with `position: sticky`, or in flow) and calls one draw function for each scene on each animation frame.

**Tech Stack:** Plain HTML, CSS and JavaScript (no library); Jest (`jest-expo` preset) in `mobile/`; Chrome through the claude-in-chrome tools for the browser checks.

**Spec:** `docs/superpowers/specs/2026-11-17-landing-scroll-story-design.md`

**Not committed:** the operator asked (2026-11-18) not to commit this plan. Do not `git add` the plan or the spec. The code commits in the tasks are fine.

## Global Constraints

- One file: `mobile/public/landing/index.html`. No library, no second script file, no new fonts, no new text or images.
- The page keeps exactly two inline scripts. After each change to the main script, put its new hash in `mobile/public/_headers` (second `'sha256-…'` value). Get the hashes with:
  `cd mobile && node -e "const h=require('fs').readFileSync('public/landing/index.html','utf8');const re=/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;let m;while((m=re.exec(h)))console.log(require('crypto').createHash('sha256').update(m[1]).digest('base64'))"`
  and check with `npx jest __tests__/webHeaders.test.ts` (PASS).
- All motion code runs only when `ANIM` is true (`anim` class on `<html>`; not set for reduced motion). With no `anim` class: no added height, no pin, all content visible, as today.
- No scroll hijack: the script only reads the scroll position.
- `draw` functions set only `transform`, `opacity`, `textContent`/`innerHTML` of the typed answers, and classes. Each draw depends only on `p` and the current layout, never on the previous frame.
- Do not change: hero graph and tour, `[data-reveal]` fade-in of other blocks, large kanji drift (it moves into the shared frame loop, same formula), Alpi, nav.
- Scroll lengths: chain 1.5 window heights, grammar 1, merge 1 (start values; Task 5 may tune them).
- Section elements have `overflow: clip`. Keep it: `clip` does not stop `position: sticky`; `hidden` would.
- Copy: none. Commit messages: `feat(landing): …`.

## Review Focus

1. **Jump instead of scroll** (nav link, End key, reload in the middle of the page, fast trackpad flick): the scene shows the correct state for that position at once. Pinned by the full-state tests at `p = 1` and mid values (Task 1) and the jump check (Task 5, Step 3).
2. **Scroll back to the top**: every scene returns to its exact start state (faint glyphs, empty answers, numbers at 0). Pinned by the `p = 0` and "non-decreasing" tests (Task 1) and the scroll-up checks in Tasks 2 to 4.
3. **Window size change across the fit limit or the 941 px breakpoint** with no reload: pin turns on or off, added height follows, no token stays on screen. Pinned by Task 5, Step 2.
4. **Fonts load after the first layout** (scene heights change): pin top and fit are measured again on `document.fonts.ready`. Pinned by Task 2, Step 6 (hard reload with cache off).
5. **Reduced motion**: static page, no gap under the scenes, answers fully typed, numbers final. Pinned by Task 5, Step 4.

---

### Task 1: Story math (pure functions and tests)

**Files:**
- Modify: `mobile/public/landing/index.html` (main script, directly after `onceVisible`)
- Modify: `mobile/public/_headers` (second hash)
- Test: `mobile/__tests__/landingStory.test.ts` (new)

**Interfaces:**
- Produces (all in the `// <story-math>` block, plain function declarations):
  - `span(p, a, b) -> number` — `(p - a) / (b - a)` clamped to [0, 1].
  - `pinProgress(top, pinTop, len) -> number` — `(pinTop - top) / len` clamped.
  - `flowProgress(top, height, vh) -> number` — `(0.8 * vh - top) / (height + 0.2 * vh)` clamped.
  - `fits(sceneH, navH, vh) -> boolean` — `sceneH + navH + 32 <= vh`.
  - `pinOffset(sceneH, navH, vh) -> number` — `navH + Math.max(16, (vh - navH - sceneH) / 2)`.
  - `tokenLook(t) -> { visible, opacity, scale }` — `visible = t > 0 && t < 1`; `opacity = Math.min(span(t, 0, .18), 1 - span(t, .88, 1))`; `scale = t < .18 ? .6 + span(t, 0, .18) * .6 : 1.2 - .4 * span(t, .18, .88) - .5 * span(t, .88, 1)` (same curve as today's `fly` keyframes).
  - `chainState(p) -> { rows: [n, n, n], col2, col3, radTokens: [n, n, n], kanjiToken, kLit, vLit }` — `rows[i] = span(p, .06i, .06i + .08)`; `col2 = span(p, .20, .28)`; `radTokens[i] = span(p, .20 + .07i, .36 + .07i)`; `kLit = p >= .50`; `col3 = span(p, .60, .68)`; `kanjiToken = span(p, .60, .82)`; `vLit = p >= .82`.
  - `relay(srcY, dstY, mid) -> { state: 'before' | 'carry' | 'arrived', t }` — `srcY > mid` → before, t 0; `dstY <= mid` → arrived, t 1; else carry, `t = (mid - srcY) / (dstY - srcY)`.
  - `grammarState(p, readLen, buildLen) -> { cards, readChars, readDone, buildChars, buildDone, hint }` — `cards = span(p, 0, .10)`; `readChars = Math.round(span(p, .10, .40) * readLen)`; `readDone = p >= .42`; `buildChars = Math.round(span(p, .50, .80) * buildLen)`; `buildDone = p >= .82`; `hint = p >= .87`.
  - `mergeState(p) -> { apps: [n, n, n], arrow, gather, one, oneLit, count }` — `apps[i] = span(p, .04i, .04i + .05)`; `arrow = span(p, .15, .30)`; `gather = span(p, .15, .55)`; `one = span(p, .55, .70)`; `oneLit = p >= .70`; `count = span(p, .70, 1)`.
  - `countValue(end, c) -> number` — `Math.round(end * (1 - (1 - c) ** 3))`.

- [ ] **Step 1: Write the failing test** `mobile/__tests__/landingStory.test.ts`

Load the block the same way `webHeaders.test.ts` reads the file:

```ts
const html = readFileSync(join(__dirname, '..', 'public', 'landing', 'index.html'), 'utf8');
const block = /\/\/ <story-math>([\s\S]*?)\/\/ <\/story-math>/.exec(html)?.[1] ?? '';
const S = new Function(`${block}; return { span, pinProgress, flowProgress, fits, pinOffset, tokenLook, chainState, relay, grammarState, mergeState, countValue };`)();
```

Tests (use `toBeCloseTo` for fractions):
- `span`: `(0.5, 0, 1) → 0.5`, `(-1, 0, 1) → 0`, `(2, 0, 1) → 1`.
- `pinProgress(-300, 100, 800) → 0.5`; `pinProgress(200, 100, 800) → 0`; `pinProgress(-900, 100, 800) → 1`.
- `flowProgress(800, 600, 1000) → 0`; `(400, 600, 1000) → 0.5`; `(0, 600, 1000) → 1`.
- `fits(578, 65, 675) → true`; `fits(578, 65, 674) → false`.
- `pinOffset(578, 65, 900) → 193.5`; `pinOffset(578, 65, 660) → 81`.
- `tokenLook(0).visible → false`; `tokenLook(1).visible → false`; `tokenLook(0.09) → { visible: true, opacity: 0.5, scale: 0.9 }`; `tokenLook(0.94) → opacity 0.5, scale 0.55`.
- `chainState(0)`: all numbers 0, `kLit` and `vLit` false.
- `chainState(0.27)`: `radTokens[0] ≈ 0.4375`, `radTokens[1] = 0`, `col2 ≈ 0.875`.
- `chainState(0.5)`: `radTokens = [1, 1, 1]`, `kLit` true, `col3 = 0`.
- `chainState(0.71)`: `kanjiToken ≈ 0.5`, `col3 = 1`, `vLit` false.
- `chainState(1)`: all numbers 1, `kLit` and `vLit` true.
- `relay(500, 700, 400) → before, 0`; `relay(300, 500, 400) → carry, 0.5`; `relay(100, 350, 400) → arrived, 1`.
- `grammarState(p, 16, 15)` (16 = `"have done before"`, 15 = code points in `夜は一人で歩くない暗いもんです`): `p 0` → all 0/false; `p 0.25` → `readChars 8`; `p 0.42` → `readChars 16, readDone true`; `p 0.65` → `buildChars 8`; `p 0.82` → `buildChars 15, buildDone true, hint false`; `p 0.87` → `hint true`.
- `mergeState(0.35)`: `gather 0.5`, `arrow 1`, `one 0`, `oneLit false`; `mergeState(1)`: all 1, `oneLit true`.
- `countValue(9749, 0) → 0`; `countValue(9749, 1) → 9749`; `countValue(2000, 0.5) → 1750`.
- **Non-decreasing:** for `p` from 0 to 1 in steps of 0.01, every number (and `true` as 1) in `chainState`, `grammarState(p, 16, 15)` and `mergeState` is ≥ its value at the previous `p`.

- [ ] **Step 2: Run the test to see it fail**

Run: `cd mobile && npx jest __tests__/landingStory.test.ts`
Expected: FAIL (`span is not defined` or similar: the block is empty).

- [ ] **Step 3: Add the `// <story-math>` block** to the main script directly after `onceVisible`, with the functions and values from Interfaces. Outside any `if (ANIM)`. Nothing calls them yet.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd mobile && npx jest __tests__/landingStory.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the hash and run the header test**

Put the new main-script hash in `_headers` (see Global Constraints). Run: `cd mobile && npx jest __tests__/webHeaders.test.ts __tests__/landingStory.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/public/landing/index.html mobile/public/_headers mobile/__tests__/landingStory.test.ts
git commit -m "feat(landing): scroll story math with tests"
```

---

### Task 2: Scene runner and scene 1 (mnemonic chain)

**Files:**
- Modify: `mobile/public/landing/index.html` (CSS, `#chain` markup, main script)
- Modify: `mobile/public/_headers`

**Interfaces:**
- Consumes: Task 1 functions.
- Produces (main script, inside `if (ANIM)`):
  - `addScene(wrapId: string, lenVh: number, draw: (p: number, scene) => void)`; scene object `{ wrap, pin, lenVh, draw, pinned: boolean }`.
  - `layoutScenes()` — for each scene: `navH` = `nav` height; `pinned = fits(pin.offsetHeight, navH, innerHeight)`; toggles class `pinned` on `wrap`; sets `--story-len` (`lenVh * innerHeight` px) and `--pin-top` (`pinOffset(...)` px) on `wrap`. Runs at start, on `resize`, and on `document.fonts.ready`.
  - `frame()` — one `requestAnimationFrame` loop started by one passive `scroll` listener and by `layoutScenes`; runs the kanji drift (moved from its own listener, same formula), then for each scene `p = pinned ? pinProgress(wrap top, pinTop, len) : flowProgress(pin top, pin height, innerHeight)` and `draw(p, scene)`.

- [ ] **Step 1: Markup.** Wrap `#fusion` in `<div class="story" id="story-chain"><div class="story-pin"> … </div></div>`. Remove `data-reveal` and `style="--d:…"` from the three `.step` elements.

- [ ] **Step 2: CSS** (next to the motion rules):
  - `.anim .story.pinned { padding-bottom: var(--story-len); }`
  - `.anim .story.pinned > .story-pin { position: sticky; top: var(--pin-top); }`
  - `.token`: `position: fixed`, `opacity: 0`, and no animation (the script sets `transform` and `opacity`).

- [ ] **Step 3: Script.** Delete the "mnemonic chain" block (`fly`, the timed sequence and the stacked branch) and the separate drift listener. Add `addScene`, `layoutScenes`, `frame`, and the chain scene (`lenVh` 1.5):
  - Create four `.token` divs once: three `radical` (text from each `.rad-glyph`), one `kanji` (`売`).
  - **Row layout** (`matchMedia('(min-width: 941px)')`): from `chainState(p)` set opacity of each `.rad-row` (`rows[i]`, with `translateY((1 - rows[i]) * 20px)`), of step 2 and the first `.arrow` (`col2`), of step 3 and the second `.arrow` (`col3`). Each token: `tokenLook(t)`; place it at `lerp(source centre, target centre, t)` from live `getBoundingClientRect()` values (fixed position, so no `scrollX/scrollY`). Toggle `wait`/`lit` on `#k-tile` by `kLit` and on `#v-tile` by `vLit` (toggle only on change, so the stamp and ring play once for each change).
  - **Stacked layout** (below 941 px; never pinned, as 1,488 px does not fit): `mid = innerHeight / 2`. Step opacity: `span(innerHeight - stepTop, 0, innerHeight * .25)`. Radical token `i`: `relay(source centreY, 売 centreY, mid)`; while `carry`, draw it at y = `mid`, x = `lerp(srcX, dstX, t) + (i - 1) * 52 * (1 - t)`, look `tokenLook(t)`. `#k-tile` lit when all three are `arrived`. Kanji token: `relay(売 centreY, 売る centreY, mid)`, `#v-tile` lit when `arrived`.
  - When the layout changes between row and stacked, hide all tokens before the next draw.

- [ ] **Step 4: Hash and tests.** Update `_headers`. Run `cd mobile && npx jest __tests__/webHeaders.test.ts __tests__/landingStory.test.ts`. Expected: PASS.

- [ ] **Step 5: Browser setup (used again in Tasks 3 to 5).** Outside the repo (`mktemp -d`), write a small Node static server for `mobile/public` on port 48770: `/` serves `/landing/index.html`, and each response has the `Content-Security-Policy` value from `_headers`. Run it in the background. Load the claude-in-chrome tools, open a new tab at `http://localhost:48770/`, window 1440 × 900.

- [ ] **Step 6: Browser check of scene 1.**
  - Scroll down through `#chain` in small steps: radical rows come in, the three tokens move one by one to 売, 売 becomes sharp with the ring, short stop, 売 moves to 売る, 売る becomes sharp, then the row scrolls away. The row stays in place during this (pinned).
  - Scroll up through the same part: the order plays back; 売 and 売る become faint again.
  - Hard reload with the cache off, then scroll: pin top is still centred (fonts loaded late).
  - Window 390 × 844: stacked; each token stays at the middle of the window while you scroll from its radical to 売; 売る lights when its token arrives.
  - `read_console_messages`: no CSP message, no error.

- [ ] **Step 7: Commit**

```bash
git add mobile/public/landing/index.html mobile/public/_headers
git commit -m "feat(landing): mnemonic chain follows the scroll"
```

---

### Task 3: Scene 2 (grammar typing)

**Files:**
- Modify: `mobile/public/landing/index.html` (`#grammar` markup, main script)
- Modify: `mobile/public/_headers`

**Interfaces:**
- Consumes: `addScene` (Task 2), `grammarState`, `span` (Task 1).

- [ ] **Step 1: Markup.** Wrap `.gram` in `<div class="story" id="story-grammar"><div class="story-pin"> … </div></div>`. Remove `data-reveal` (and its `--d`) from `.gram > .card` and `#typing`.

- [ ] **Step 2: Script.** Delete the "grammar cards" block. Add the grammar scene (`lenVh` 1). Keep the final text and HTML of each answer as today (`readFinal`, `buildFinal`, `buildFinalHtml`); split the strings with `Array.from` (code points). From `grammarState(p, readChars.length, buildChars.length)`:
  - opacity of the lesson card and `#typing` = `cards`;
  - `.typed` of `#a-read` = first `readChars` characters; class `pending` on `#a-read` while `!readDone`;
  - `.typed` of `#a-build` = `buildFinalHtml` when `buildDone`, otherwise the first `buildChars` characters as text; `pending` on `#a-build` while `!buildDone`;
  - class `in` on `#a-hint` = `hint`.
  - Write `textContent`/`innerHTML` only when the value changes (the `.mark` stamp plays once for each change).
  - In flow (window too short, or phones), `p` comes from the runner as for the other scenes; no extra code.

- [ ] **Step 3: Hash and tests.** Update `_headers`. Run `cd mobile && npx jest __tests__/webHeaders.test.ts __tests__/landingStory.test.ts`. Expected: PASS.

- [ ] **Step 4: Browser check** (server and tab from Task 2, Step 5). At 1440 × 900: the grammar row stays in place; "have done before" types with the scroll and turns green with ✓; the Japanese answer types, turns red with ✕, 歩く gets its red mark, then the hint shows. Scroll up: characters go away, colours and hint go back. At 390 × 844: the same order while `#typing` passes through the window. Console clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/public/landing/index.html mobile/public/_headers
git commit -m "feat(landing): grammar answers type with the scroll"
```

---

### Task 4: Scene 3 (three apps become one)

**Files:**
- Modify: `mobile/public/landing/index.html` (CSS, `#all` markup, main script)
- Modify: `mobile/public/_headers`

**Interfaces:**
- Consumes: `addScene` (Task 2), `mergeState`, `countValue` (Task 1).

- [ ] **Step 1: Markup.** Wrap `.merge` and `.facts` together in `<div class="story" id="story-merge"><div class="story-pin"> … </div></div>`. Remove `data-reveal` (and `--d`) from the three `.app`, `.one` and `.facts`.

- [ ] **Step 2: CSS.** `.one { --ring: var(--brand); }` and `.anim .one.lit { animation: ring .9s ease-out; }` (reuses the `ring` keyframes).

- [ ] **Step 3: Script.** Delete the `[data-count]` count-up from the "scroll reveal + count-up" block (keep the reveal line). Add the merge scene (`lenVh` 1). From `mergeState(p)`:
  - app `i`: vector `(dx, dy)` from its centre to the `.merge > .arrow` centre. Measure it in `layoutScenes` (clear the app transforms, read both `getBoundingClientRect()` centres, store the vector), not in each frame; `opacity = apps[i] * (1 - gather)`, `transform = translate(dx * gather, dy * gather) scale(1 - .4 * gather)`. The same vector works for the side-by-side and the stacked layout.
  - `.merge > .arrow` opacity = `arrow`.
  - `.one`: `opacity = one`, `transform = scale(.85 + .15 * one)`; class `lit` = `oneLit` (toggle on change).
  - each `[data-count]`: `textContent = countValue(end, count).toLocaleString('en-US')`.

- [ ] **Step 4: Hash and tests.** Update `_headers`. Run `cd mobile && npx jest __tests__/webHeaders.test.ts __tests__/landingStory.test.ts`. Expected: PASS.

- [ ] **Step 5: Browser check.** At 1440 × 900: the block stays in place; the three dashed cards show, move into the arrow and fade; the green card grows with a ring; the five numbers count to 817 / 2,000 / 9,749 / 160 / 60. Scroll up: numbers count down to 0, cards come back. At 390 × 844: cards move down toward the arrow. Console clean.

- [ ] **Step 6: Commit**

```bash
git add mobile/public/landing/index.html mobile/public/_headers
git commit -m "feat(landing): three apps merge into one with the scroll"
```

---

### Task 5: Whole-page checks, tuning and status

**Files:**
- Modify: `mobile/public/landing/index.html` (only if tuning changes `lenVh` values)
- Modify: `mobile/public/_headers` (only if the script changed)
- Modify: `docs/working-history.md` (landing page row, line 77)

- [ ] **Step 1: Sizes and themes.** Check all three scenes, down and up, at 1440 × 900 (all pinned), 1366 × 768 (chain in flow, grammar and merge pinned), 390 × 844 (all in flow), in light and dark theme (`prefers-color-scheme` emulation). If a scene feels too fast or too slow, change only its `lenVh`.

- [ ] **Step 2: Resize with no reload** (Review Focus 3). In the middle of each scene, resize between 1440 × 900, 1440 × 600 and 800 × 900. Expected: pin turns on or off, no empty gap below an unpinned scene, no token left on screen, the scene shows the state for its position.

- [ ] **Step 3: Jumps** (Review Focus 1). Click each nav link, press End, press Home, and reload with the page scrolled into the middle of each scene. Expected: correct state at once; at the bottom of the page every scene is complete.

- [ ] **Step 4: Reduced motion** (Review Focus 5). Emulate `prefers-reduced-motion: reduce` and reload. Expected: no gap below the scenes, no pin, 売 and 売る sharp, both answers complete with ✓/✕ and the hint, numbers final, console clean.

- [ ] **Step 5: Tests and lint.** Run `cd mobile && npx jest __tests__/webHeaders.test.ts __tests__/landingStory.test.ts && npm run lint`. Expected: PASS, no new lint errors.

- [ ] **Step 6: Stop the server and remove its temp folder.** Close the tab.

- [ ] **Step 7: Status.** In `docs/working-history.md`, landing page row: add "Scroll story 2026-11-18 (not deployed): the mnemonic chain, the grammar typing and "three apps become one" follow the scroll (pinned when they fit, in flow on phones and short windows); pure step math in a `// <story-math>` block, tested by `landingStory.test.ts`. Checked in Chrome: <sizes>, light and dark, reduced motion, resize, jumps. Safari and Firefox not checked." Write the real list of what you checked.

- [ ] **Step 8: Commit** (not the plan, not the spec)

```bash
git add mobile/public/landing/index.html mobile/public/_headers docs/working-history.md
git commit -m "feat(landing): scroll story checks and status"
```
