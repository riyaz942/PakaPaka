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

**Ring tokens.** `ring-start/mid/end/complete` all resolved to **brand-600** `#0E8163` in both themes — one jade, no stops. Session 2 rebuilt `GoalRing` as a real arc with the ≥100% halo, and Session 4 collapsed the four names into the single `ring` token.

**Three-role colors.** Content types *and* feedback both read `base` / `-soft` / `-deep`:
`base` = glyphs, chips, 5px list edges, icons, 1.5px state borders · `-soft` = tinted fills · `-deep` = text sitting on that fill. Never set state or type *text* in the base hue on a plain surface — that pairing does not clear AA in light mode (see deviations 1–3).

**Jade roles.** `brand-500` is the accent/ring/border jade (non-text). Filled jade CTAs are **`bg-brand-600` + `text-on-primary`**. Jade *text* on background/surface uses **`text-brand-text`**, which flips 700→300 with the scheme; the fixed `brand-*` steps cannot.

**Fonts.** Weight comes from the utility, not `font-bold`: `font-ui` / `-medium` / `-semibold` / `-bold` / `-extrabold`, `font-jp` / `-medium` / `-bold` / `-black`, `font-jp-round` / `-bold` / `-black`. Static Google Fonts register one family per weight, so `font-ui font-bold` would silently render Regular.

**Type scale.** `display`, `title-lg`, `title` and `overline` were retuned to v2 and `label` (14/600) added. `body`, `body-sm`, `body-lg` and `furigana` were left alone — changing their default weight would embolden text across screens that have not been restyled yet. Screens adopt the rest of the scale in their own session.

## Session 2 — Shared UI kit + tab shell

**Goal:** every reusable primitive matches the spec's Components section, and the 5-tab shell wears the new look. Later sessions mostly *assemble* these.

Spec refs: Components section (buttons, chips, goal ring, answer inputs, chat bubbles, toggles, choice cards, session headers, list rows, tiles, banners) + Iconography section.

- [x] **Buttons** (`components/common/` or `ui/`): primary (jade fill, white text, CTA glow, r-md), secondary (surface + 1.5px jade border), tertiary (surface-elevated fill), ghost/text (muted), destructive (danger fill), disabled (surface-elevated + faint text — grey, *not* tinted).
- [x] **Pills & chips:** filter chip (active = jade fill white text with ×; inactive = surface + border), type badge (soft bg + deep text, uppercase 10–11px), SRS stage dot (colored 8–9px circle).
- [x] **List row with 5px color edge** (Browse rows, "still to learn" lists): left edge strip in content-type base color, glyph in Zen Maru at type base color, title + caption, trailing badge/dot.
- [x] **Goal ring:** conic jade fill on surface-elevated track, % in center; ≥100% state adds jade halo (`0 0 0 4px brand-100`) + "BEATEN" kicker. Single color — no gradient stops.
- [x] **Answer input states:** focus (1.5px jade border + 4px brand-50 halo), correct (success soft/border + check), incorrect (danger + ×), near-miss (warning soft + explanation line), wrong-script (info soft + hint line). JP text in `font-jp`.
- [x] **Toggle & stepper rows** (Settings/onboarding): 48×28 pill toggle (jade on), −/value/+ stepper in surface-elevated.
- [x] **Choice cards:** selected = 2px jade border + brand-50 fill (+ optional "Recommended" pill); unselected = surface + border.
- [x] **Session headers:** lesson variant (× · progress bar · "2/5") and review variant (mini ring · "4 of 6" · type badge · ×). **Lesson 3-section stepper** pills: INTRO/MNEMONIC/EXAMPLES, active pill = content-type base fill.
- [x] **Banner slot:** one-at-a-time info banner (brand-50 / warn-soft, icon + single line).
- [x] **Chat bubbles:** user = jade fill white `font-jp`, r-lg with 5px tail corner; AI = surface + border with furigana ruby support; "Look up words" link row.
- [x] **Icons:** port the spec's line set (1.75px stroke, round caps/joins, 24px grid — SVGs are all inline in the spec HTML) for: 5 tab icons, review bolt, lesson book, passage lines, weakness target, streak flame, days calendar, filter, mic, send, history, locked, correct, close, back, import. Replace emoji/mismatched icons wherever these primitives use them.
- [x] **Tab bar + nav headers:** active tab jade (icon + 10px label), inactive faint; surface bg with top border. Tab title style `font:800 27px font-ui` ink.
- [x] Verify kit renders in light + dark; lint/typecheck/test.

**Files:** `components/common/`, `components/ui/`, `components/engagement/` (goal ring), `(tabs)/_layout.tsx` (+ `.web`), icon assets/module.

### Session 2 decisions (carry into later sessions)

**The kit lives in `components/common/`.** New: `Icon`, `ContentListRow`, `LinkedItemTile`, `ChoiceCard`, `ToggleRow`, `StepperRow`, `SectionStepper`, `LessonSessionHeader`, `ScreenTitle`. Restyled in place: `Button`, `Banner`, `ContentTypeBadge`, `SRSStageIndicator` (+ new `SRSStageDot`), `SectionHeading`, `ScreenHeader`, `Disclosure`, `engagement/GoalRing`, `browse/FilterPill`, `browse/SearchField`, `review/SessionHeader`, `review/WanaKanaInput`, `converse/ChatBubble`. Where a feature component *is* the primitive, it was restyled rather than duplicated into `common/` — Sessions 5/7/8 assemble those screens around the same component.

**Icons.** `react-native-svg` was added. `Icon` takes a NativeWind colour class, not a hex: the class sets the SVG's `color` through `cssInterop` and every stroke reads `currentColor`. Icons are hidden from assistive tech (`accessibilityElementsHidden`), so they must always sit inside a labelled control — and RNTL queries for them need `{ includeHiddenElements: true }`. Stroke is 1.75 on the 24 grid; pass `strokeWidth={2}`–`2.4` for small emphatic marks, as the spec does.

**Two new palette tokens.** `brand-soft` / `brand-soft-strong` are the *scheme-aware* jade fills (jade at 18% / 30% over the dark surface). Use these — not `brand-50`/`brand-100` — for anything filled: banners, selected choice cards, the goal-ring halo, the focus halo, the Home review card. The fixed brand steps are near-whites and glare in dark mode. Text on them is `text-brand-text`. `feedback-incorrect-fill` is the destructive button fill (non-flipping, like `brand-600`).

**Goal ring.** Now a real arc: `react-native-svg` circle on a `surface-elevated` track, jade fill, no stops. `ringBandClasses` and the `+N%` badge are gone; ≥100% draws a jade halo (`goal-ring-halo`) and a BEATEN kicker (`large`/`hero` only). The four `ring-*` tokens became the single `ring` token in Session 4.

**SVG colour, two ways.** `Icon` needs arbitrary tokens (`content-*`, `feedback-*`), so it uses the `cssInterop` `currentColor` route. `GoalRing` needs only `surfaceElevated` and `brand`, which `design-tokens.js` already mirrors, so it passes those hexes to `stroke` — the documented raw-colour exception. Prefer the `design-tokens.js` route when the colour is in that file; `cssInterop` otherwise.

**Focus and halo rings.** React Native shadows have no spread, so the spec's `0 0 0 4px` rings are drawn as an absolutely positioned `-inset-1 border-4` sibling. `Button` keeps `shadow-cta-glow`, which is a real offset shadow.

**Answer input.** `WanaKanaInput` grew `state` (`idle` · `correct` · `incorrect` · `near-miss` · `wrong-script`) and `hint`, and now renders its own field chrome — it is the answer input, so no parallel one was added to `common/`. Kana mode sets the value in `font-jp-medium`. Session 7 wires the states to the evaluator.

### Session 2 deviations

11. **Active stepper pills use soft/deep, not white on the base hue.** The spec fills the lesson section pill with `--kan` and sets the label white. No content hue clears AA against white in both themes (light: blue 3.94, kanji 3.75, gold 3.36, vocab 4.66; dark: every hue below 3.0). `SectionStepper` therefore uses the same soft-fill / deep-text pairing as `ContentTypeBadge`. Filled *type-coloured* surfaces elsewhere should follow the same rule.
12. **Destructive buttons use `feedback-incorrect-fill` `#BD3C33`.** White on the spec's `--danger` `#E1483D` is 4.04:1 — short of AA for a 15px label. Like `brand-600`, the fill step does not flip with the scheme, because `feedback-incorrect-deep` goes light in dark mode and would take white with it.
13. **Filter chips fill with `brand-600`, not `brand-500`.** Same white-label reason as the primary button (deviation 5).
14. **`Banner` became the inline v2 slot.** It was a full-bleed top toast; it is now the spec's soft-fill / icon / one-line banner, and the root `CurriculumUpdateBannerHost` owns the safe-area placement instead.

## Session 3 — Onboarding + Settings

Spec refs: screens 1–3 (pick a path, daily pace, ready) + screen 8 (Settings); Components → choice cards, toggle rows.

- [x] `onboarding/welcome.tsx`: progress dots (jade active), Display title "Learn Japanese for real", three path cards ("Most popular" pill on new-learner; import card shows WaniKani API / Bunpro / Anki pills, selected state = 2px jade + brand-50), full-width primary CTA. Disabled CTA until a path is chosen (grey disabled style).
- [x] `onboarding/intensity.tsx`: Relaxed/Intense choice cards ("Recommended for new learners" chip), "Today's lesson at this pace: **5 new items**" callout, jade info banner ("Reviews grow as you learn…").
- [x] `onboarding/complete.tsx`: "You're ready" + three value-prop rows with soft-tinted icon squares (rad-soft book, kan-soft target, brand-100 device — drawn icons, no emoji), primary "Start your first lesson" + secondary "Explore on my own".
- [x] `onboarding/placement.tsx`, `import.tsx`, `import-summary.tsx`: restyle with the same kit (choice cards, inputs, banners) — no flow changes.
- [x] `(tabs)/settings.tsx`: kicker section headers (SESSION / REVIEW QUEUE / APPEARANCE…), pace choice cards, Daily goal stepper row ("load units · no upper limit"), toggle rows (Bias toward weak points, Lightning Mode, Vacation mode), Theme segmented pill (Light/Dark/Auto), destructive actions in danger style.
- [x] Update co-located tests; lint/typecheck/test; light + dark pass.

### Session 3 decisions (carry into later sessions)

**One new primitive: `common/SegmentedPill`.** A surface-elevated track holding one jade-filled segment, for short mutually exclusive sets that read better inline than as stacked cards. Two call sites: Settings → Theme, and the import-source selector. Longer option sets (furigana display, reminder times) stay as `ChoiceCard` grids — a 4-way pill is unreadable at 44px segments.

**Onboarding path cards stay buttons.** `LevelPathCard` was restyled in place rather than folded into `ChoiceCard`: two of the three paths navigate on press, so `accessibilityRole="radio"` would lie. It now draws exactly like a selected `ChoiceCard` when `selected` *or* `accentBorder` is set. `SessionIntensityPicker` *is* a real radiogroup and now composes two `ChoiceCard`s — its options report `{ selected, checked }` rather than `{ selected }`.

**Settings groups rows behind one card.** Related toggles sit in a single bordered `surface` card with `border-b` dividers (spec, Settings screen), not as separate labelled blocks. "Session intensity" / "Review pacing" / "Vacation mode" collapsed into SESSION and REVIEW QUEUE accordingly.

**Platform `Switch` is gone from Settings.** Every switch is now `ToggleRow`, including the two in `ByokSettingsSection` (which renders inside Settings and would otherwise have been the only platform-styled control on the screen). Tests must press the row and read `accessibilityState.checked` — `props.value` and `fireEvent(…, 'valueChange', …)` no longer apply, and a disabled `ToggleRow` genuinely swallows the press where a disabled `Switch` did not.

**`cn` knew nothing about `text-label`.** Session 1 added the token to the type scale but not to `FONT_SIZE_TOKENS` in `src/utils/cn.ts`, so `cn('text-label', 'text-primary')` collapsed to one class and dropped the colour. Fixed here; any future `fontSize` token must be registered in both places.

### Session 3 deviations

15. **Daily goal is a stepper, and that costs direct entry.** The spec draws −/30/+ and the plan asks for the stepper row, so the unbounded `TextInput` is gone. Step is 5 load units with a floor of 5 and no ceiling, which keeps FR57's "no upper limit" and makes a non-positive goal unreachable rather than an error state — but moving 200 → 30 is now 34 presses. If large jumps turn out to matter, the row needs a tap-the-value-to-type affordance, not a max.
16. **Segments are 44px tall, not the spec's 26px.** `SegmentedPill` and the theme row are taller than drawn because each segment has to clear the tap-target floor.
17. **Onboarding progress dots use `brand-500`.** Decoration, so the 3:1 non-text rule does not apply to the dot itself; the active/inactive pair is also carried by `accessibilityLabel="Step N of M"` rather than colour alone.

## Session 4 — Home + Stats

Spec refs: screens 4–5 (Home, Home scrolled) + screen 7 (Stats).

- [x] **Home** (`(tabs)/index.tsx` + `components/engagement/`): JP greeting hero (`font-jp-round` 900 27px "おかえり！" + muted JP sentence line); goal-ring card (r-xl, e2) with "Today's goal" + "Something to beat…" caption; **Review card** = 2px jade border + brand-50 fill, jade glyph square 復, "N items ready"; **Lesson card** = plain surface, 学 glyph square; **N5 Progress card** with jade progress bar + per-type dot legend (kanji/grammar/vocab counts); **This week forecast** bar chart (today = jade solid, future = brand-200, empty = surface-elevated); **READING nudge card** (pas-soft fill, deep text, "X items away" + progress bar); **AT RISK card** (danger-soft, target icon, slipping item glyph chips on surface). One banner max. No streak anywhere on Home.
- [x] **Stats** (`(tabs)/stats.tsx` + `components/stats/`): two stat cards (Days studied / Items in review — no streak, see deviation 18); SRS stage rows (stage dot + tracked uppercase label in stage-tinted text + mini bar + count); Weak patterns rows (danger-soft / warn-soft with target icon).
- [x] Goal ring / forecast use only jade family (see Session 1 ring-token decision).
- [x] Tests, lint, typecheck, light + dark.

### Session 4 decisions (carry into later sessions)

**Ring tokens are now one token.** `ring-start/mid/end/complete` collapsed into `ring` (jade `#0E8163`, same value in both themes). It is still not read by `GoalRing` — the arc draws from `design-tokens.js` — but it stays in the palette and in the contrast manifest as the named goal-ring colour.

**`srs-enlightened-deep` added.** Stats sets each stage name in its own hue. Apprentice, guru and master *are* the kanji, vocabulary and radical hues, so their labels borrow those `-deep` steps; enlightened is the one stage with no content twin and needed its own deep step to clear AA at 12px. Burned uses `muted`, as the spec does. Any future stage-coloured text follows the same mapping.

**One new stats primitive: `stats/StatTile`.** The two-up headline card (big value, label, quiet caption, optional drawn icon). `DaysStudiedStat` now composes it and keeps its own testID and a11y label; Session 7's summary tiles can reuse it if the shape fits.

**Charts scale to their own peak.** Both the forecast columns and the SRS stage bars size against the busiest bucket rather than an absolute maximum, so a quiet week and a heavy one both have shape. Empty buckets still draw a `surface-elevated` stub so the row reads as a full set.

**Two hooks gained a display-only field.** `useReadingReadiness` now returns `coverage` (already computed by `computePassageUnlock`) and `useAtRiskItems` returns `itemType` (already read from the curriculum row). Neither changes selection logic — they only let the readiness bar and the at-risk glyph chips render without a second query.

**No streaks — confirmed.** Decision R2 stands: loss-aversion streaks stay out of the product. Spec screen 7's "Day streak" card is replaced by **Items in review** (SRS total already on the screen). The mockup in `design-system-v2.html` is updated to match. Do not reintroduce consecutive-day streak UI or data in later sessions; the flame icon may remain in the kit unused.

### Session 4 deviations

18. **Stats' second headline card is items-in-review, not the spec's Day streak.** *(Accepted 2026-08-02.)* The streak was removed from the product outright by decision R2 (loss aversion rejected as a churn driver); Home has no streak and `days_studied` is the deliberate replacement. Building the spec's flame card would mean reintroducing a rejected mechanic *and* new consecutive-day data. The two-up layout is kept with the SRS total — already loaded on the screen — in the second slot, and the "not a streak" framing moved onto the days-studied caption. Spec screen 7 mockup updated to match.
19. **The at-risk and reading cards keep their controls.** The spec draws both as passive cards; the app's versions carry a "Do a small revision" CTA (FR59) and a tap-through to the passage (FR60). Both kept — the card is the entry point to the thing it describes.
20. **Forecast day labels are 12px, not the spec's 10px.** 10px sits below the app's smallest UI step (`caption`); the only 9px token is `furigana`, which is ruby, not a label.

## Session 5 — Browse + passage screens

Spec refs: screen 6 (Browse), 16–17 (passage locked/unlocked); Components → search & filter chips, list rows.

- [x] **Browse index** (`(tabs)/browse/index.tsx`, `components/browse/`): pill search field ("Search anything"), horizontal filter chips (active jade), "1,744 results" count line, unified result list using the 5px-edge rows — radical/kanji/vocab/grammar with Zen Maru glyph, name + reading caption, SRS dot; passage rows show JP title in passage-deep + synopsis + "9 to go" gold pill.
- [x] **Passage locked** (`browse/passage/…` and legacy `read/[id]`): pas-soft hero card (JP title, JP+EN synopsis, lock icon, "9 to go … to Guru" pill, progress bar, "Get these to Guru and this passage opens up"), "Still to learn" 5px-edge list.
- [x] **Passage unlocked:** OPEN success pill in header, passage body in `font-jp` 17/2.35 with furigana ruby + vocab underline links (voc-deep + 1.5px voc underline), comprehension question card (JP question, answer input, Submit), "you learned this yesterday" voc-soft callout *(reworded — deviation 23)*.
- [x] Reading/passage surfaces switch from old gold `content-reading` to new slate passage tokens.
- [x] Tests, lint, typecheck, light + dark.

### Session 5 decisions (carry into later sessions)

**`ContentListRow` is now the only Browse-style row.** `BrowseRow`, `PassageBrowseRow` and the locked passage's "Still to learn" rows all compose it, and the row grew the props those three needed: `captionSecondary` (the English half of FR66's bilingual summary), `trailingTextClassName` / `trailingTestID`, and `showTypeBadge`. **The type badge is now opt-in** — Browse names the type in the caption instead, so a badge would repeat it; the locked to-do list has no caption room and keeps the badge.

**The glyph steps down with the form's length** (`text-title` ≤2 chars · `text-body-lg` ≤4 · `text-body` beyond). Japanese forms in this curriculum run to seven characters, and a fixed 21px glyph column either truncates はじめまして or pushes the title off the row. Any later surface that heroes a list glyph should reuse `ContentListRow` rather than re-solve this.

**`ScreenHeader` takes `children`.** The bar renders them in place of the title, which is how the spec's detail headers carry a type kicker and a status pill. Session 6's item headers (back arrow + type badge + SRS stage pill) should use the same slot rather than a second header component.

**`content-reading` is gone.** The alias was deleted from `global.css`, `tailwind.config.js` and the contrast manifest. `components/read/PassageListRow.tsx` was orphaned when the Read tab folded into Browse and was deleted with it. `ReviewCard`'s one use was never about passages — it colours the *reading prompt* kicker — and now points at `content-passage` directly, holding its old value until Session 7 retunes that kicker.

**Two display-only data fields.** `BrowseItemRow.reading` (a correlated `accepted_answers` lookup, so multi-reading items cannot fan the row set out) backs the "Kanji · いち" caption; `usePassageDetail().recentWord` reads the SRS rows already loaded for unlock. Neither participates in filtering, ordering or unlock — same rule as Session 4's hook fields.

### Session 5 deviations

21. **Browse item captions carry a reading only where one is authored.** The spec draws "Kanji · いち" on every row; radicals have no reading answer and grammar points rarely do, so those rows caption as just "Radical" / "Grammar". The reading comes from the item's primary `accepted_answers` row of type `reading` — the same string the review screen grades against — so it can never disagree with what the app asks for.
22. **Passage body leading is ~1.75, not the spec's 2.35.** In CSS the 2.35 exists to make room for ruby *inside* the line box. `FuriganaText` stacks readings in their own view above the text and separates wrapped lines with its own gap, so copying 2.35 would double-count the ruby space and leave the paragraph looking broken up. Size is the spec's 17px, set through `FuriganaText`'s documented `style` escape hatch (there is no 17px type token).
23. **"You learned this yesterday" became "you reviewed this earlier today / yesterday".** *(Accepted 2026-08-02.)* Nothing records when a specific item was *learned*: `item_study_status.updated_at` also moves on later transitions, and `daily_lesson_log` stores counts, not item ids — so the spec's sentence would be a claim the data cannot back. `srs_states.last_reviewed_at` (migration 010) is already loaded for the unlock check and says exactly what it means. Stage was the other candidate and is unusable here: unlock needs ≥90% of linked items at Guru+, which for any passage with fewer than ten links means *every* linked item is Guru+, so an "apprentice" callout would almost never fire.
24. **Comprehension cards are numbered "1 of N" rather than a section heading.** The spec's card kicker reads "COMPREHENSION · 1 OF 2" and there is no separate "Comprehension" heading above the set, so the old heading was dropped instead of being kept alongside it.
25. **The Browse result card frames the list only when it has rows.** The spec draws every result inside one bordered card. An empty or errored list would otherwise render an empty box around "No matches", so the frame is dropped in those states. The card also carries no elevation — a shadow and `overflow-hidden` on the same view do not compose on Android.

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
