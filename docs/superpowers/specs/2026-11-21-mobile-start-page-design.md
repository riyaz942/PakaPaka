# Phone start page — design

Date: 2026-11-21. Status: approved in conversation (look A2 picked by the operator on 2026-11-21).

## Intent

The phone app needs a good first screen. Today a fresh install opens the onboarding welcome screen directly. The only sign-in there is a small grey "Sign in to restore your progress" button under three cards; the operator did not see it. The new start page gives each new or signed-out user one clear choice: log in, or start without logging in.

## Goals

- A fresh install (no starting level saved) opens the start page on Android and iOS.
- Sign-out ("Sign out and erase my data") opens the start page. This already happens (`leaveAfterErase` → `/start`).
- The start page shows the app's idea and has two buttons that stay at the bottom of the screen at all times.
- The onboarding welcome screen no longer has a sign-in button.

## Non-goals

- The web. Web has its own landing page (`mobile/public/landing/`) and `/auth/signin`. Web keeps its current flow: no starting level → `/onboarding/welcome`.
- Sign in with Apple. It is a known iOS release blocker (see `docs/working-history.md`) and this change does not fix it. The existing `/start` screen already shows "Log in" on iOS.
- New sign-in logic. The page calls the existing `useAccount().signIn()`; after a sign-in it hands over to the existing sync wait as `start.tsx` does now.

## Anti-goals

- Buttons that scroll away or hide behind content.
- A page that is wrong in dark mode or with reduced motion.
- Any change to the web flow.

## Approaches considered

- **A · Ink and paper** — serif headline, faint kanji in a practice square (same feel as the web landing page).
- **B · The chain** — radicals → kanji → word as the main content.
- **C · Mascot welcome** — Alpi, the name, three short facts.
- **A2 (picked)** — A as the top, plus Alpi above the headline, then the chain from B and the facts from C below. The page scrolls; the two buttons stay fixed at the bottom. Picked by the operator.

## The page (A2)

```
┌─────────────────────────────┐
│ PakaPaka              ┌───┐ │  faint 話 in a practice square,
│ (Alpi mascot)         │話 │ │  top right, behind the content
│ A FREE, OPEN-SOURCE   └───┘ │
│ JAPANESE COURSE             │
│ Every kanji is a story      │  serif headline;
│ you already know.           │  "you already know." italic, brand colour
│ Radicals build kanji. …     │
│                             │
│ One story, three steps      │
│ [士 samurai][冖 cover][儿 legs]  radical art cards
│            ↓                │
│ [売  sell  …]               │  kanji tile (kanji colour)
│            ↓                │
│ [売る to sell …]            │  vocabulary tile (vocabulary colour)
│                             │
│ Yours, with no strings      │
│ [Free and open source]      │
│ [Works offline. …]          │
│ [No account needed. …]      │
├─────────────────────────────┤  fixed, does not scroll
│ [ Start without logging in ]│  primary
│ [   Log in with Google    ] │  secondary
│  (sign-in error, if any)    │
└─────────────────────────────┘
```

### Exact copy

- Brand line: `PakaPaka`
- Kicker: `A FREE, OPEN-SOURCE JAPANESE COURSE`
- Headline: `Every kanji is a story ` + italic `you already know.`
- Lede: `Radicals build kanji. Kanji build words. Each step has a mnemonic made from the step before it.`
- Section 1 title: `One story, three steps`
  - Radicals: `士` `samurai`, `冖` `cover`, `儿` `legs`
  - Kanji tile: `売`, `sell`, `A proud samurai under a cover walks the road to sell.`
  - Vocabulary tile: `売る`, `to sell`, `The same samurai calls 「うる」 at every gate.`
- Section 2 title: `Yours, with no strings`
  - `Free` + ` and open source`
  - `Works offline.` + ` Progress stays on your phone.`
  - `No account needed.` + ` Log in only to sync.`
- Primary button: `Start without logging in`
- Secondary button: `Log in with Google`

### Behaviour (unchanged from today's `start.tsx`)

- "Start without logging in" → `router.replace('/onboarding/welcome')`.
- "Log in with Google" → `account.signIn()`; disabled unless `account.status === 'signed_out'`; `account.error` shows under the buttons.
- When `account.status` becomes `signed_in`, the page replaces itself with `/onboarding/welcome` once; the redirect hook then opens the dashboard if the synced progress has finished onboarding.

## Builder calls (made by Claude, not by the operator — check these)

1. **Serif font.** The app has no serif font. Add `@expo-google-fonts/fraunces` (500 regular and 500 italic only) as a bundled font, like the other three families. Without it the headline loses the look the operator picked.
2. **Faint kanji font.** Use the bundled Zen Kaku Gothic New bold (`font-jp-hero-bold`), not Shippori Mincho. A Mincho font is several MB for one decorative character.
3. **No paper grain.** React Native has no SVG noise filter; a grain image adds an asset for a very faint effect. Plain `bg-background`.
4. **No Google "G" logo on the button.** `Button` has no icon slot, and Google's logo has brand rules. Text only.
5. **Motion.** Sections enter with the existing `FadeSlideIn` (stagger by index). It already turns off with reduced motion. No fly-in animation for the chain.
6. **Fixed bar.** A solid `bg-background` bar with a top hairline (`border-border`), pinned to the bottom with the safe-area inset. The scroll content gets bottom padding equal to the bar's measured height. No gradient (would need a new dependency).
7. **Images.** Radical art comes from the bundled set through `getRadicalImage('radicals/samurai.webp' | 'radicals/wakanmuri.webp' | 'radicals/hitoashi.webp')`. Mascot is `assets/images/mascot/alpi-yay.png`. All images are decorative (`accessible={false}`); the text next to them carries the meaning.
8. **Tile colours.** The mockup put white text on solid kanji pink and vocabulary purple. White on `content-kanji` is below WCAG AA for small text, so the tiles use the soft fill with deep text (`bg-content-kanji-soft` + `text-content-kanji-deep`, same for vocabulary), with a left accent bar in the solid colour.
9. **Redirect.** In `useOnboardingRedirect`, the "no starting level" case goes to `/start` on native and stays `/onboarding/welcome` on web (`isWeb()`). All other cases are unchanged.
