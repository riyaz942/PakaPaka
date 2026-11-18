# Landing page: scroll storytelling for three scenes

Date: 2026-11-17. Status: design approved by the operator 2026-11-18. Not built.

Page: `mobile/public/landing/index.html` (see
[the landing page design](./2026-11-14-landing-page-design.md)).

## Intent

The operator likes the page, its look, its background and its animations. He wants the
scroll to tell the story, as on an Apple product page: the visitor scrolls, and the scroll
position moves the animation.

Today the page starts each animation when a block comes on screen, and then a timer plays
it. The visitor does not control it, and it plays one time only.

## Goals

- Three scenes follow the scroll position, forward and back:
  1. **The mnemonic chain** (`#fusion`): 儿 冖 士 → 売 → 売る.
  2. **Grammar typing** (`.gram` in `#grammar`): the two review answers type themselves.
  3. **Three apps become one** (`.merge` and `.facts` in `#all`).
- When a scene fits in the window, it stays in place (pinned) while the scroll plays it.
- The look does not change: same text, layout, colours, fonts and background.

## Non-goals

- Changes to the hero graph, the large faint kanji, the fade-in of the other blocks, or Alpi.
- Grammar as step 4 of the chain (売る → 売ったことがある). A 4-column row does not fit a
  laptop screen; the operator chose grammar as its own scene on 2026-11-18.
- New text, new images or new font characters.
- A deploy. This branch (`part3-sync`) holds sync code that is not deployed.

## Anti-goals

- No scroll hijack. The page scrolls at the visitor's speed; the script only reads the
  scroll position.
- With reduced motion or with no script, the page must be complete and static, as today.
- No library and no second script file.

## Constraints found

- The page is one HTML file with two inline scripts. The CSP in `mobile/public/_headers`
  permits them by hash, and `mobile/__tests__/webHeaders.test.ts` computes the hashes. A
  change to the main script needs the new hash in `_headers`.
- All animation start states are under the `anim` class on `<html>`, which is not set for
  reduced motion.
- Measured in headless Chrome (nav = 65 px):

  | Window | Chain row (`#fusion`) | Grammar row (`.gram`) | `.merge` + gap + `.facts` |
  | --- | --- | --- | --- |
  | 1280 px wide and more | 578 px | 422 px | 384 px |
  | 1024 px wide | 663 px | 444 px | 375 px |
  | 500 px wide (stacked) | 1,488 px (steps 381 / 505 / 482) | 869 px (review cards 397) | 795 px |

  Thus the chain row with its section heading (295 px) does not fit in a laptop window. Only
  the row can be pinned, and it needs a window of about 675 px or more. The grammar row needs
  about 540 px.

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | Hand-written: `position: sticky` for the pin, one scroll listener that gives each scene a progress number from 0 to 1, and one draw function for each scene. | About 150 lines in the same file. Works in all browsers. No dependency. |
| B | CSS scroll-driven animations (`animation-timeline`). | No script for simple moves, but not in all browsers, and the tiles that fly between two measured positions need script in any case. |
| C | GSAP ScrollTrigger. | Pinning is done for us, but it is a third-party file to host for two scenes, and the page has no library today. |

The operator chose the scope on 2026-11-17 (pinned scenes for the chain and "three apps
become one"; the other sections keep the fade-in) and added grammar as a third scene on
2026-11-18. Approach A is the builder's call: the operator gave the outcome, not the method.

## Design

### One rule for the three scenes

Each scene has a progress number `p` from 0 to 1 and a draw function `draw(p)`. `draw` sets
only `transform`, `opacity` and classes. Scroll down increases `p`; scroll up decreases it,
and the scene goes back.

`p` comes from the scroll position in one of two ways:

- **Pinned** (the scene fits: scene height + nav + 32 px ≤ window height). The scene gets a
  tall wrapper and `position: sticky` below the nav. `p` is how far the visitor scrolled
  through the wrapper.
- **In flow** (the scene does not fit: phones, short laptop windows). No added height. `p` is
  how far the scene moved through the window.

The script chooses when the page loads and when the window size changes. The draw function
is the same for the two; only the source of `p` is different.

Inside the three scenes, `draw(p)` controls each block. The `data-reveal` attributes on those
blocks (the three `.step`, `.gram > .card`, `#typing`, the three `.app`, `.one`, `.facts`) are
removed, so the fade-in observer does not touch them.

### Scene 1: the mnemonic chain

Pinned for about 1.5 window heights of scroll. The section heading scrolls away first; the
row of three columns stays.

```
p 0.00–0.20   column 1 shows: the three radical rows come in, one by one
p 0.20–0.50   儿 冖 士 leave their rows as small tiles and move to the kanji tile,
              one after the other; column 2 shows; at arrival 売 becomes sharp (stamp + ring)
p 0.50–0.60   nothing moves (time to read)
p 0.60–0.85   売 moves as a tile to the word tile; column 3 shows; 売る becomes sharp
p 0.85–1.00   nothing moves; then the row scrolls away
```

- Columns 2 and 3 and the two arrows are hidden at `p = 0` and fade in at their step.
- The moving tiles are the `.token` tiles of today. Four tiles stay in the page and
  `draw(p)` puts them on the line between source and target.
- Scroll back: a sharp glyph becomes faint again and the tile moves back.
- **Stacked layout (below 941 px):** the columns are one below the other, so the scene is
  always in flow. A moving tile stays at the middle of the window from the time its source
  passes the middle until its target reaches the middle. Then the target glyph becomes
  sharp. Each column fades in when it comes on screen.

This replaces the timed sequence and the stacked-layout branch in the "mnemonic chain" block
of the script.

### Scene 2: grammar typing

Pinned for about 1 window height of scroll, with the lesson card on the left and the two
review cards on the right. The section heading scrolls away first.

```
p 0.00–0.10   the lesson card and the two empty review cards show
p 0.10–0.40   "have done before" types, one character for each scroll step
p 0.40–0.45   the answer becomes green with ✓
p 0.50–0.80   夜は一人で歩くない暗いもんです types
p 0.80–0.85   the answer becomes red with ✕; 歩く gets its red mark
p 0.85–0.95   the hint "You wrote 歩く …" shows
p 0.95–1.00   nothing moves; then the row scrolls away
```

- The number of typed characters follows `p`, so scroll back removes characters, and the
  green, red, mark and hint go back to their start state.
- The cursor blinks only while an answer is not complete (today's `.pending` style).
- In flow (phones): the same steps, with `p` from the position of `#typing` in the window.
  The lesson card fades in when it comes on screen.

This replaces the "grammar cards" block of the script.

### Scene 3: three apps become one

Pinned for about 1 window height of scroll, with `.merge` and `.facts` in the middle of the
window.

```
p 0.00–0.15   the three dashed cards show, one by one
p 0.15–0.55   the cards move to the arrow, get smaller and fade; the arrow shows
p 0.55–0.70   the green PakaPaka card grows to full size (stamp + ring)
p 0.70–1.00   the five numbers count from 0 to their values
```

- The numbers follow `p` (scroll back counts down). This replaces the timed count-up.
- In flow (phones): same steps, and the cards move down to the green card, not sideways.

### What stays as it is

`[data-reveal]` fade-in for all other blocks, the hero graph and its tour, the large kanji
drift, Alpi, the nav links, and the page with reduced motion or no script
(no wrapper height, no pin, all content visible).

## Left to the builder

- The exact scroll lengths (1.5, 1 and 1 window heights are start values) and easing; tune
  them in the browser.
- The exact formula for `p` in flow.
- One shared scroll listener with `requestAnimationFrame`, together with the kanji drift.

## Checks

- `npm test -- webHeaders` in `mobile/` passes with the new hash.
- In Chrome on a local static server with the `_headers` CSP: no console message.
- Each scene, scroll down and up, at 1440 × 900 (all pinned), 1366 × 768 (chain in flow,
  grammar and merge pinned), 390 × 844 (all in flow). Light and dark theme.
- Window size change between pinned and in flow, with no reload.
- Reduced motion: static page, no added height.
- Safari and Firefox: the operator, or a note that they are not checked.
- `docs/working-history.md`: update the landing page row.
