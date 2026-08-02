# Design System v2 Redesign — Implementation Plan

Restyle the whole app to the **Japanese Learning Design System v2** created in Claude Design.
Spec: [`design-system-v2.html`](./design-system-v2.html) (open in a browser — sections: Color, Typography, Space/Radius/Elevation, Iconography, Components, 17 screen mockups). Original project: <https://claude.ai/design/p/cd7673db-8be6-4c1c-a5eb-3ed0e5385499>

**This is a restyle, not a rearchitecture.** Navigation (Home · Browse · Talk · Stats · Settings + full-screen Lesson/Review), data flow, SRS logic, and providers all stay as-is. Only visual layer changes: tokens, fonts, component styling, screen layout polish.

## How to use this plan

Work is split into **8 sessions**, each sized for one Claude Code (Opus/Fable, high effort) session. Run them in order — later sessions assume the tokens and shared kit from Sessions 1–2 exist. To start a session, prompt:

> Implement Session N of docs/design/redesign-v2/README.md. Read that file's "Global rules" and the Session N section fully before coding. Check off the session's checklist in the doc when done.

Each session ends green on: `cd mobile && npm run lint && npm run typecheck && npm test`, plus `npm run check-contrast` at repo root whenever tokens changed.

## Global rules (read every session)

- **Semantic tokens only.** All colors flow through NativeWind classes defined in `mobile/tailwind.config.js` + `mobile/src/global.css` (channel-triplet CSS vars — keep that format, see the comment at the top of `global.css`). No raw hex in components; when an API demands raw color (NativeTabs, SVG props), use `mobile/src/constants/design-tokens.js`.
- **Keep existing token *names* where they exist** (`background`, `surface`, `border`, `primary`, `secondary`, `muted`, `content-*`, `srs-*`, `feedback-*`) and change their *values*. Add new tokens following the same naming style. Don't rename tokens app-wide unless a session explicitly says so.
- **Dark mode is first-class.** Every session must verify its screens in light AND dark (`darkMode: 'media'`; dark values live in the `prefers-color-scheme: dark` block of `global.css`). The spec renders review/summary/Talk-conversation mockups in dark deliberately — treat them as the dark reference.
- **A11y:** ≥44px tap targets, lint a11y rules stay on, contrast CI must pass. The spec's `faint` (#A8A199) is caption/decoration only — never body text.
- **No emoji in UI.** v2 uses a single drawn line-icon set (1.75px stroke, round caps, 24px grid).
- Match existing file/test conventions; co-locate `*.test.tsx` updates with the screens you touch. Snapshot/test churn from restyling is expected — update tests, don't delete them.
- Don't touch `curriculum/`, `src/core/`, `src/data/` logic. Legacy `learn`/`read` routes keep working (`href: null` deep links).

## Token reference (source of truth for Session 1)

Extracted from the spec so later sessions never need to parse the HTML.

### Brand — Jade (same scale in light & dark)

| step | hex | | step | hex |
|---|---|---|---|---|
| 50 | `#EAF7F2` | | 500 ● primary | `#159E77` |
| 100 | `#CDEEE2` | | 600 | `#0E8163` |
| 200 | `#9FDFC9` | | 700 | `#0C654E` |
| 300 | `#66CBAB` | | 800 | `#0C503F` |
| 400 | `#34B48D` | | 900 | `#0B4133` |

### Neutrals (warm)

| token | light | dark |
|---|---|---|
| background | `#F7F5F2` | `#1B1917` |
| surface | `#FFFFFF` | `#24211E` |
| surface-elevated (spec "surf-2") | `#F2EFEA` | `#2D2A26` |
| border | `#E7E2DB` | `#3A362F` |
| primary / "ink" (headings) | `#23201C` | `#F6F3EE` |
| secondary / "text" (body) | `#46423B` | `#D8D3CA` |
| muted | `#7C766C` | `#A29C90` |
| faint (captions only) | `#A8A199` | `#726C61` |

### Content types — base / soft / deep

Usage: **base** = chips, glyphs, list-row edges; **soft** = hero-card fills, tints; **deep** = text on soft.

| type | light base | light soft | light deep | dark base | dark soft | dark deep |
|---|---|---|---|---|---|---|
| radical | `#2F84D0` | `#E6F0FB` | `#1E5C97` | `#5AA0DE` | `rgba(47,132,208,.18)` | `#A9CDEF` |
| kanji | `#E14D86` | `#FCE6EE` | `#A82D5E` | `#EC6E9E` | `rgba(225,77,134,.18)` | `#F5A9C4` |
| vocabulary | `#8B5AD4` | `#EFE8FB` | `#5E3A9E` | `#A585E0` | `rgba(139,90,212,.18)` | `#CDB6F0` |
| grammar | `#CE912C` | `#FBF0DC` | `#8F5F16` | `#DFA94E` | `rgba(206,145,44,.18)` | `#EAC489` |
| passage (NEW) | `#5C6B99` | `#EAECF5` | `#3D4A73` | `#8E9CC4` | `rgba(92,107,153,.22)` | `#C3CCE4` |

⚠️ Big shifts from current palette: **vocabulary green → purple**, **grammar purple → gold**, **reading gold → new slate "passage"** type. Audit every use of `content-vocabulary` / `content-grammar` / `content-reading` — meanings move, not just shades.

### Semantic & SRS

| token | value (light) | soft (light) | soft (dark) |
|---|---|---|---|
| success / correct | `#1FA971` | `#E4F6EE` | `rgba(31,169,113,.20)` |
| warning / near-miss | `#E58A1E` | `#FBEEDA` | `rgba(229,138,30,.20)` |
| danger / incorrect | `#E1483D` | `#FCE7E4` | `rgba(225,72,61,.20)` |
| info / hints, wrong-script | `#2F84D0` | `#E6F0FB` | `rgba(47,132,208,.20)` |

SRS stages (both themes): apprentice `#E14D86` · guru `#8B5AD4` · master `#2F84D0` · enlightened `#17A2C4` · burned `#57534B`. (Guru unlocks passages; matches vocab purple by design.)

### Type, space, radius, elevation

- **Fonts:** `Plus Jakarta Sans` (all UI text; 400–800) · `Zen Maru Gothic` (heroed JP characters; 500/700/900) · `Noto Sans JP` (readings, furigana, passages, chat; 400/500/700/900). Tailwind families: `font-ui`, `font-jp-round`, `font-jp`.
- **Type scale:** Display 40/800 · Title 28/800 · Heading 20/700 · Body 16/400 · Label 14/600 · Kicker 12/700 uppercase tracked · Caption 12/500. Hero glyphs up to 132px Zen Maru 900.
- **Space:** 4pt grid; 16 = screen gutter.
- **Radius:** sm 10 (chips/inputs) · md 14 (buttons/tiles) · lg 18 (cards/chat bubbles) · xl 24 (goal/hero cards) · full 999 (pills).
- **Elevation:** e1 resting `0 1px 2px rgba(31,29,26,.06), 0 1px 3px rgba(31,29,26,.05)` · e2 raised `0 2px 8px …, 0 10px 28px …(.06)` · e3 overlay `0 10px 40px rgba(31,29,26,.14)`. Dark: `0 1px 2px rgba(0,0,0,.4)` / `0 6px 24px rgba(0,0,0,.5)` / `0 12px 44px rgba(0,0,0,.6)`. Primary CTA glow: `0 8px 20px rgba(21,158,119,.3)`.

---

## Session 1 — Foundations: tokens, fonts, radii, elevation

**Goal:** the whole token layer speaks v2. App may look half-baked afterwards (old layouts, new colors) — that's expected; screens are restyled in later sessions.

- [x] Replace palette values in `mobile/src/global.css` (light `:root` + dark media block) with the tables above. Keep channel-triplet format. Keep existing token names; add: `content-*-soft`, `content-*-deep` (all 5 types), `content-passage` (+soft/deep), `feedback-*-soft`, brand scale (`brand-50` … `brand-900`), `surface-elevated` remap to spec surf-2.
- [x] Mirror in `mobile/tailwind.config.js` (colors, `borderRadius` sm/md/lg/xl, `boxShadow`/elevation utilities, `fontFamily`) and `mobile/src/constants/design-tokens.js` (raw-hex mirror for NativeTabs/SVG APIs — update the sync comment).
- [x] Decide + document (in this file) the fate of ring gradient tokens `ring-start/mid/end/complete`: v2 goal ring is **single jade fill** with a jade halo past 100%. Keep the token names pointing at jade values or remove uses — no orange/gold ring stops remain.
- [x] Fonts: add `@expo-google-fonts/plus-jakarta-sans`, `@expo-google-fonts/noto-sans-jp`, `@expo-google-fonts/zen-maru-gothic`; load in `mobile/src/app/_layout.tsx` (block splash until loaded — offline-first, fonts must be bundled, never fetched at runtime). Add `font-ui` / `font-jp` / `font-jp-round` families to Tailwind. Don't sweep the app applying them yet — that happens per-screen; just make the utilities work and set `font-ui` as the sensible default where a root text style exists.
- [x] Run `npm run check-contrast` (repo root) and fix the token config it validates so CI passes with the new palette. If a spec color genuinely fails AA for its documented role, darken minimally and note the deviation in this doc.
- [x] `mobile`: lint, typecheck, test — fix fallout (theme/token tests like `semantic-colors.test.ts`, `tailwind-palette.test.ts` will need updating to v2 values).

**Files:** `global.css`, `tailwind.config.js`, `design-tokens.js`, `semantic-colors.ts`, `theme.ts` (verify nothing re-exports deprecated `Colors`), `_layout.tsx`, `package.json`, contrast script config, token tests.

### Session 1 decisions (carry into later sessions)

**Ring tokens.** `ring-start/mid/end/complete` all now resolve to **brand-600** `#0E8163` in both themes — one jade, no stops, and the one place that puts white text on the ring color (`GoalRing`'s overshoot badge) clears AA. `GoalRing`'s band logic still compiles but is a visual no-op; **Session 4 collapses the four tokens into one** and adds the ≥100% jade halo.

**Three-role colors.** Content types *and* feedback both read `base` / `-soft` / `-deep`:
`base` = glyphs, chips, 5px list edges, icons, 1.5px state borders · `-soft` = tinted fills · `-deep` = text sitting on that fill. Never set state or type *text* in the base hue on a plain surface — that pairing does not clear AA in light mode (see deviations 1–3).

**Jade roles.** `brand-500` is the accent/ring/border jade (non-text). Filled jade CTAs are **`bg-brand-600` + `text-on-primary`**. Jade *text* on background/surface uses **`text-brand-text`**, which flips 700→300 with the scheme; the fixed `brand-*` steps cannot.

**Fonts.** Weight comes from the utility, not `font-bold`: `font-ui` / `-medium` / `-semibold` / `-bold` / `-extrabold`, `font-jp` / `-medium` / `-bold` / `-black`, `font-jp-round` / `-bold` / `-black`. Static Google Fonts register one family per weight, so `font-ui font-bold` would silently render Regular.

**Type scale.** `display`, `title-lg`, `title` and `overline` were retuned to v2 and `label` (14/600) added. `body`, `body-sm`, `body-lg` and `furigana` were left alone — changing their default weight would embolden text across screens that have not been restyled yet. Screens adopt the rest of the scale in their own session.

## Session 2 — Shared UI kit + tab shell

**Goal:** every reusable primitive matches the spec's Components section, and the 5-tab shell wears the new look. Later sessions mostly *assemble* these.

Spec refs: Components section (buttons, chips, goal ring, answer inputs, chat bubbles, toggles, choice cards, session headers, list rows, tiles, banners) + Iconography section.

- [ ] **Buttons** (`components/common/` or `ui/`): primary (jade fill, white text, CTA glow, r-md), secondary (surface + 1.5px jade border), tertiary (surface-elevated fill), ghost/text (muted), destructive (danger fill), disabled (surface-elevated + faint text — grey, *not* tinted).
- [ ] **Pills & chips:** filter chip (active = jade fill white text with ×; inactive = surface + border), type badge (soft bg + deep text, uppercase 10–11px), SRS stage dot (colored 8–9px circle).
- [ ] **List row with 5px color edge** (Browse rows, "still to learn" lists): left edge strip in content-type base color, glyph in Zen Maru at type base color, title + caption, trailing badge/dot.
- [ ] **Goal ring:** conic jade fill on surface-elevated track, % in center; ≥100% state adds jade halo (`0 0 0 4px brand-100`) + "BEATEN" kicker. Single color — no gradient stops.
- [ ] **Answer input states:** focus (1.5px jade border + 4px brand-50 halo), correct (success soft/border + check), incorrect (danger + ×), near-miss (warning soft + explanation line), wrong-script (info soft + hint line). JP text in `font-jp`.
- [ ] **Toggle & stepper rows** (Settings/onboarding): 48×28 pill toggle (jade on), −/value/+ stepper in surface-elevated.
- [ ] **Choice cards:** selected = 2px jade border + brand-50 fill (+ optional "Recommended" pill); unselected = surface + border.
- [ ] **Session headers:** lesson variant (× · progress bar · "2/5") and review variant (mini ring · "4 of 6" · type badge · ×). **Lesson 3-section stepper** pills: INTRO/MNEMONIC/EXAMPLES, active pill = content-type base fill.
- [ ] **Banner slot:** one-at-a-time info banner (brand-50 / warn-soft, icon + single line).
- [ ] **Chat bubbles:** user = jade fill white `font-jp`, r-lg with 5px tail corner; AI = surface + border with furigana ruby support; "Look up words" link row.
- [ ] **Icons:** port the spec's line set (1.75px stroke, round caps/joins, 24px grid — SVGs are all inline in the spec HTML) for: 5 tab icons, review bolt, lesson book, passage lines, weakness target, streak flame, days calendar, filter, mic, send, history, locked, correct, close, back, import. Replace emoji/mismatched icons wherever these primitives use them.
- [ ] **Tab bar + nav headers:** active tab jade (icon + 10px label), inactive faint; surface bg with top border. Tab title style `font:800 27px font-ui` ink.
- [ ] Verify kit renders in light + dark; lint/typecheck/test.

**Files:** `components/common/`, `components/ui/`, `components/engagement/` (goal ring), `(tabs)/_layout.tsx` (+ `.web`), icon assets/module.

## Session 3 — Onboarding + Settings

Spec refs: screens 1–3 (pick a path, daily pace, ready) + screen 8 (Settings); Components → choice cards, toggle rows.

- [ ] `onboarding/welcome.tsx`: progress dots (jade active), Display title "Learn Japanese for real", three path cards ("Most popular" pill on new-learner; import card shows WaniKani API / Bunpro / Anki pills, selected state = 2px jade + brand-50), full-width primary CTA. Disabled CTA until a path is chosen (grey disabled style).
- [ ] `onboarding/intensity.tsx`: Relaxed/Intense choice cards ("Recommended for new learners" chip), "Today's lesson at this pace: **5 new items**" callout, jade info banner ("Reviews grow as you learn…").
- [ ] `onboarding/complete.tsx`: "You're ready" + three value-prop rows with soft-tinted icon squares (rad-soft book, kan-soft target, brand-100 device — drawn icons, no emoji), primary "Start your first lesson" + secondary "Explore on my own".
- [ ] `onboarding/placement.tsx`, `import.tsx`, `import-summary.tsx`: restyle with the same kit (choice cards, inputs, banners) — no flow changes.
- [ ] `(tabs)/settings.tsx`: kicker section headers (SESSION / REVIEW QUEUE / APPEARANCE…), pace choice cards, Daily goal stepper row ("load units · no upper limit"), toggle rows (Bias toward weak points, Lightning Mode, Vacation mode), Theme segmented pill (Light/Dark/Auto), destructive actions in danger style.
- [ ] Update co-located tests; lint/typecheck/test; light + dark pass.

## Session 4 — Home + Stats

Spec refs: screens 4–5 (Home, Home scrolled) + screen 7 (Stats).

- [ ] **Home** (`(tabs)/index.tsx` + `components/engagement/`): JP greeting hero (`font-jp-round` 900 27px "おかえり！" + muted JP sentence line); goal-ring card (r-xl, e2) with "Today's goal" + "Something to beat…" caption; **Review card** = 2px jade border + brand-50 fill, jade glyph square 復, "N items ready"; **Lesson card** = plain surface, 学 glyph square; **N5 Progress card** with jade progress bar + per-type dot legend (kanji/grammar/vocab counts); **This week forecast** bar chart (today = jade solid, future = brand-200, empty = surface-elevated); **READING nudge card** (pas-soft fill, deep text, "X items away" + progress bar); **AT RISK card** (danger-soft, target icon, slipping item glyph chips on surface). One banner max. No streak anywhere on Home.
- [ ] **Stats** (`(tabs)/stats.tsx` + `components/stats/`): two stat cards (Days studied / Day streak with drawn flame icon, "calm, not a nag" caption); SRS stage rows (stage dot + tracked uppercase label in stage-tinted text + mini bar + count); Weak patterns rows (danger-soft / warn-soft with target icon).
- [ ] Goal ring / forecast use only jade family (see Session 1 ring-token decision).
- [ ] Tests, lint, typecheck, light + dark.

## Session 5 — Browse + passage screens

Spec refs: screen 6 (Browse), 16–17 (passage locked/unlocked); Components → search & filter chips, list rows.

- [ ] **Browse index** (`(tabs)/browse/index.tsx`, `components/browse/`): pill search field ("Search anything"), horizontal filter chips (active jade), "1,744 results" count line, unified result list using the 5px-edge rows — radical/kanji/vocab/grammar with Zen Maru glyph, name + reading caption, SRS dot; passage rows show JP title in passage-deep + synopsis + "9 to go" gold pill.
- [ ] **Passage locked** (`browse/passage/…` and legacy `read/[id]`): pas-soft hero card (JP title, JP+EN synopsis, lock icon, "9 to go … to Guru" pill, progress bar, "Get these to Guru and this passage opens up"), "Still to learn" 5px-edge list.
- [ ] **Passage unlocked:** OPEN success pill in header, passage body in `font-jp` 17/2.35 with furigana ruby + vocab underline links (voc-deep + 1.5px voc underline), comprehension question card (JP question, answer input, Submit), "you learned this yesterday" voc-soft callout.
- [ ] Reading/passage surfaces switch from old gold `content-reading` to new slate passage tokens.
- [ ] Tests, lint, typecheck, light + dark.

## Session 6 — Item detail pages (radical · kanji · vocab · grammar)

Spec refs: screens 14–15 (kanji & vocab detail) — radical/grammar follow the same template in their own hue. Routes live under `(tabs)/browse/item/` and legacy `(tabs)/learn/item/` (`components/learn/` holds the detail components — biggest component folder, budget time for it).

- [ ] Shared detail template: back-arrow header with type badge + SRS stage pill (stage-colored dot + soft bg); hero card (type-soft fill, r-xl, Zen Maru 900 glyph 66–76px in type-deep, meaning below).
- [ ] **Kanji:** ON'YOMI / KUN'YOMI cards side-by-side (`font-jp` 21px); MEANING MNEMONIC prose (radical name highlighted in rad base color); BUILT FROM radical tile (rad-soft); VOCABULARY USING THIS KANJI tiles (surface, JP in voc base).
- [ ] **Vocab:** reading above glyph in hero; FURIGANA FOR THIS WORD segmented pills (Follow progress / Always show / Hide — persists to user.db as today); EXAMPLES with furigana ruby + voc underline on target word + EN translation; GRAMMAR USING THIS WORD gra-soft card with particle chips.
- [ ] **Radical / Grammar:** same template — radical: mnemonic + "used in these kanji" tiles; grammar: explanation, example sentences with ruby, linked vocab tiles.
- [ ] All section headers = 10px kicker style (tracked uppercase faint). Update tests; lint/typecheck; light + dark.

## Session 7 — Lesson + Review sessions (full-screen stacks)

Spec refs: screens 11 (lesson mnemonic), 12 (review quiz, dark), 13 (session summary, dark); Components → session headers, answer inputs. Uses Session 2's headers/inputs — this session is wiring + screen layout.

- [ ] **Lesson** (`app/lesson/`, `components/lesson/`): lesson session header (× / progress bar in *content-type* color / "1/5"); INTRO → MNEMONIC → EXAMPLES stepper pills (active = type base fill); hero card (type-soft, RADICAL kicker pill on translucent white, Zen Maru glyph, meaning); mnemonic prose with type-colored keyword highlights; mnemonic-image slot (dashed border placeholder when absent); Back (96px) + Continue footer.
- [ ] **Review** (`app/review/`, `components/review/`): review header (mini ring % · "4 of 6" · type badge · ×); prompt kicker ("Meaning" in rad blue / reading prompts per existing two-card logic); giant glyph (Zen Maru 900 132px ink); SRS stage kicker under glyph; centered answer input (all 5 states from the kit); "Don't know" ghost button; full-width Submit. Keep Return-to-advance and Lightning Mode behavior untouched.
- [ ] **Session summary** (`review/summary.tsx`, `lesson/complete.tsx`): jade check disc (e-glow), "Session complete" + "6 reviews · 4 min"; first-try accuracy ring card; **GOAL CONTRIBUTION jade card** ("+18% → 51% of today" + white progress bar); per-type count tiles (kan/voc/gra soft); "slipped again — queued sooner" danger-soft callout; Done CTA.
- [ ] `review/compare.tsx` + exit-guard sheets: restyle with e3 overlay elevation.
- [ ] These screens are the spec's **dark showcase** — verify dark theme especially. Tests, lint, typecheck.

## Session 8 — Talk + final sweep

Spec refs: screens 9–10 (Talk start, Talk conversation dark); Components → chat bubbles.

- [ ] **Talk start** (`(tabs)/converse/index.tsx`, `components/converse/`): header with history icon; "Start a conversation" title + "Nothing is corrected while you talk…" sub; starter cards — "Practise recent grammar" highlighted with 2px gra border + gra-soft glyph square, then Choose grammar / Role-play / Surprise me; BYOK footnote row with lock icon ("Only online feature — key in secure storage, transcripts on-device").
- [ ] **Conversation** (`converse/session/`): sub-header (back, "Conversation", grammar-point caption in gra); chat bubbles from kit (AI ruby furigana); "Look up words" links; centered "End conversation" pill; composer (JP placeholder pill input, mic circle, jade send circle).
- [ ] **History + summary** (`converse/history.tsx`, `converse/summary/`): same kit; summary reuses Session 7 summary patterns where sensible.
- [ ] **Final sweep (whole app):**
  - [ ] grep for raw hex / old palette remnants (old green vocab `188a50`-era values, old ring golds, `Colors` from `theme.ts`) — migrate stragglers (import/*, hint-row, external-link, web-badge, animated-icon, error/empty states);
  - [ ] every screen quick-passed in light + dark; e3 on all modals/sheets;
  - [ ] delete any tokens/components the redesign orphaned (only if truly unused);
  - [ ] `npm run check-contrast`, lint, typecheck, full test suite;
  - [ ] update `docs/app-overview.md` screenshots/wording if it references old colors, and mark this plan done in `docs/README.md`.

---

## Deviations log

Record any place implementation has to diverge from the spec (contrast fixes, data/platform constraints), so the design project can be updated to match.

### Session 1

Contrast figures below are WCAG 2.1 ratios; the gate is `npm run check-contrast` (124 pairs, both themes).

1. **Feedback base darkened in light mode.** `success #1FA971 → #1D9F6A` and `warn #E58A1E → #CA791A`. As drawn, both sit at 2.6–3.0:1 against `bg`/`surface`, and they carry the 1.5px state border on answer inputs — meaningful non-text UI, which WCAG 1.4.11 puts at 3:1. Dark keeps the spec hexes. `danger` and `info` were already clear.
2. **Feedback gained a `-deep` step** (light `#177D54` `#BD3C33` `#995C14` `#276FAF`; dark `#3CB483` `#E97B73` `#E7912C` `#61A2DB`). The spec sets state *text* in the base hue (`color:var(--success)` on `--success-soft`), which tops out at ~3.4:1 — no minimal darkening reaches 4.5:1 without turning the whole feedback family muddy. Splitting the role keeps the spec's fills, icons and borders exactly as drawn and gives the copy an AA-clean shade, matching how the content types already work.
3. **`content-grammar` darkened in light mode**, `#CE912C → #BA8125` (2.72 → 3.36:1 on surface). Gold is the one content hue too light to carry a glyph. Soft/deep are unchanged; dark keeps `#DFA94E`.
4. **SRS stage nudges.** `enlightened` light `#17A2C4 → #1698B8` (2.999 → 3.38:1 — the spec value misses 3:1 by a rounding error). `burned` dark `#57534B → #706D65` (2.09 → 3.10:1); the spec reuses one burned grey for both themes, but on `#24211E` it disappears.
5. **White-on-jade needs brand-600.** White on `brand-500 #159E77` is 3.39:1 — under AA for a 16px button label. Filled jade CTAs therefore use `brand-600 #0E8163` (4.84:1); `brand-500` stays the accent/ring/border jade. Added `brand-text` (700 light / 300 dark) for jade text, since the fixed brand steps cannot flip per scheme — `brand-700` is 2.3:1 on dark surface.
6. **Dark `-soft` tints are flattened, not alpha.** RN palette tokens are channel triplets with no alpha channel, so each spec `rgba(...,.18/.20/.22)` was composited over dark surface `#24211E`. Anything placed on a *non*-surface dark background needs the alpha form (`bg-content-kanji/18`) instead.
7. **Elevation is single-layer.** NativeWind maps a `shadow-*` utility to React Native's one shadow, so `e1`–`e3` merge the spec's two CSS layers into the one that carries the depth, plus an `elevation` value for Android. Dark shadows are *not* theme-flipped — on dark surfaces the spec's own mockups separate cards with `border` + `surface-elevated`, which is what Sessions 2+ should lean on.
8. **`content-reading` kept as an alias** of `content-passage` so passage surfaces read slate immediately. Session 5 renames the call sites (`contentType.ts`, `PassageListRow`, `ReviewCard`) and deletes the token.
9. **`on-primary` is now white in both themes** (was near-black in dark, for the old bright-blue fill). The three buttons that used `bg-feedback-info` + `text-on-primary` (`PersonalMnemonicEditor`, `UserSynonymEditor`, `PassageQuestion`) moved to `bg-brand-600` in this session rather than shipping white-on-blue at 3.94:1 for six sessions — they become proper primary buttons in Session 2 anyway.
10. **No root text style exists.** React Native does not cascade text styles, and the app has no shared `Text` wrapper in use (`themed-text.tsx` is legacy template code still on deprecated `Colors`). So `font-ui` gets applied per component from Session 2, and `theme.ts`'s `Colors`/`Fonts` survive until the Session 8 sweep.

### Font bundle size — accepted

All 12 faces the spec documents ship bundled, as offline-first requires: Plus Jakarta Sans 400/500/600/700/800, Noto Sans JP 400/500/700/900, Zen Maru Gothic 500/700/900. That is **~32 MB** of the binary — Plus Jakarta Sans is 96 KB/weight, but Noto Sans JP runs 5.2 MB/weight and Zen Maru Gothic 3.6 MB/weight.

**Decision (2026-08-02): accepted, no trimming.** Later sessions should use any weight in this list freely rather than working around the size. Subsetting the JP faces to the curriculum's character set would recover roughly 90% of it via a build step (fonttools/pyftsubset in the curriculum pipeline) — worth revisiting only if store limits force it, not as a design constraint.
