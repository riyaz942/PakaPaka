# Customizable Home screen plan

Let the learner choose which Home sections appear and in what order, from a dedicated
customization screen reached from Settings. Review and Today's lesson are locked in place as
sections — they can be reordered but never removed. Every other Home section can be moved or
hidden.

The customization screen shows a **live preview tile per section**, not a list of labels: the
learner drags the actual UI around.

Last checked against the codebase: **2026-08-14**

---

## 1 — What exists today

`mobile/src/app/(tabs)/index.tsx` renders one fixed sequence, with hardcoded `FadeSlideIn`
indices 0–7:

| Order | Block | Component |
| --- | --- | --- |
| 0 | Greeting (`おかえり！` + comprehensible sentence) | inline |
| 1 | Goal ring hero, or the vacation card in its place | `GoalRing` / inline |
| — | Guidance card notice, goal rise/reduction prompts | `GuidanceCardNotice`, `GoalRisePrompt`, `GoalReductionPrompt` |
| — | Single conditional banner slot | `WelcomeBackCard` / curriculum-updated / `BackupNudgeCard` / `ImportNudgeCard` / `ShadowModeSwitchPrompt` |
| 2 | Review CTA | inline `ActionCard` |
| 3 | Today's lesson CTA | inline `ActionCard` |
| 4 | Level progress | `LevelProgressBar` |
| 5 | Review forecast | `ReviewForecast` |
| 6 | Reading readiness | `ReadingReadiness` |
| 7 | At-risk items | `AtRiskSection` |

Relevant existing infrastructure:

| Piece | Where |
| --- | --- |
| Key/value preferences (`get/setPreference`, `PREFERENCE_KEYS`) | `mobile/src/data/user/preferencesRepository.ts` |
| Engagement components + barrel | `mobile/src/components/engagement/` |
| Nested tab stack convention (`_layout` + `index` + sub-routes) | `mobile/src/app/(tabs)/browse/`, `converse/` |
| Gesture + animation primitives | `react-native-gesture-handler` 2.30, `react-native-reanimated` 4.2.1 |

`ActionCard` is defined inline in `(tabs)/index.tsx` and is not exported.

---

## 2 — Section catalog

Seven customizable sections:

| id | Required | Renders |
| --- | --- | --- |
| `review-cta` | **yes** | Review `ActionCard` |
| `lesson-cta` | **yes** | Today's lesson `ActionCard` |
| `goal-ring` | no | Goal ring hero card |
| `level-progress` | no | `LevelProgressBar` |
| `review-forecast` | no | `ReviewForecast` |
| `reading-readiness` | no | `ReadingReadiness` |
| `at-risk` | no | `AtRiskSection` |

Default order is the current Home order: `goal-ring`, `review-cta`, `lesson-cta`,
`level-progress`, `review-forecast`, `reading-readiness`, `at-risk`.

**Required** means reorderable but not hideable. The hide control is replaced by a lock chip.

### Pinned — deliberately not customizable

The greeting header, the vacation card, the goal rise/reduction prompts, and the single
conditional banner slot stay where they are and are not part of the layout.

These are transient and priority-ranked — one slot, at most one winner, usually nothing. Making
them draggable would mean asking the learner to arrange things they normally cannot see, and
would leave the banner priority order (welcome-back > curriculum-updated > backup nudge > import
nudge > shadow prompt) with two competing sources of truth.

The vacation card is pinned rather than tied to `goal-ring`: it carries the "turn off vacation
mode" link, so it must still appear for a learner who hid the ring. One rule — when vacation is
active, the vacation card renders above the section list and the `goal-ring` section does not
render at all.

---

## 3 — Storage

One `user_preferences` row. The table already exists, so **no migration**.

```
key:   home_layout
value: {"v":1,"sections":[{"id":"goal-ring","visible":true}, …]}
```

Reads go through a pure reconciler in `mobile/src/core/engagement/homeLayout.ts`, which takes the
stored value and the catalog and returns a valid layout:

| Input condition | Result |
| --- | --- |
| No row, unparseable JSON, or wrong `v` | Default order, all visible |
| Stored id not in the catalog | Dropped |
| Catalog id missing from the stored list | Appended at its default-order position |
| Required id missing or `visible: false` | Forced present and visible |

The "catalog id missing → append" rule is what lets a future app version add a Home section
without it silently vanishing for everyone who has already customized their layout.

Falling back to the default order on a missing or corrupt value is the documented default state,
not a silent degradation — a learner who has never opened the customizer has no layout, and the
default order is exactly what they see today.

Repository surface, matching the plain-value style of the rest of `preferencesRepository.ts`
(getters return values, setters return void — `Result` is not introduced here):

```ts
getHomeLayout(userDb): HomeSectionEntry[]   // always reconciled, never throws
setHomeLayout(userDb, entries): void
```

---

## 4 — Customization screen

### Route

`(tabs)/settings.tsx` becomes a folder, matching `browse/` and `converse/`:

```
(tabs)/settings/_layout.tsx      Stack, headerShown: false
(tabs)/settings/index.tsx        today's settings screen, moved verbatim
(tabs)/settings/index.test.tsx   moved verbatim
(tabs)/settings/home-layout.tsx  new
```

Existing `router.push('/settings')` callers (Home's vacation link, adjust-goal, the nudge cards)
keep resolving to `settings/index`.

Settings gets a new **Home screen** section with a single row, "Customize Home", above
"How this works".

### Layout and interaction

A vertical list of preview tiles at a **uniform fixed height** (~140pt). Each tile renders the
real component with sample props, wrapped in `pointerEvents="none"`, scaled to ~0.6 and clipped
by an `overflow-hidden` container.

Uniform height is the load-bearing simplification: the drop index is
`clamp(round(dy / ROW_HEIGHT))`, which is roughly 80 lines of reanimated plus gesture-handler and
**no new dependency**.

**The tradeoff, stated plainly:** the tall goal-ring hero shows scaled and cropped rather than
whole. The alternatives are variable-height drag maths (roughly double the code, and it has to
re-measure on every content change) or adding `react-native-reorderable-list` as a dependency.
For a screen most learners open once, cropped previews are the right trade. If the crop turns out
to read badly for the ring specifically, the cheap fix is a shorter purpose-built preview variant
for that one section, not variable-height drag.

Per tile:

- **Left** — grip handle, the drag target.
- **Centre** — the scaled preview.
- **Right** — eye toggle (optional sections) or lock chip (`review-cta`, `lesson-cta`).
- Hidden sections stay in place, dimmed, with a "Hidden" badge — no separate hidden bin.
- A caption states when conditional sections appear, e.g. "Appears when items are slipping"
  for `at-risk`, "Appears once a passage is nearly in reach" for `reading-readiness`.

Bottom of the screen: **Reset to default**.

Changes save immediately, matching "Changes save immediately" in the rest of Settings.

### Accessibility

Drag-only reorder is unusable with a screen reader, and the repo's a11y lint rules block merge.
Every tile carries `accessibilityActions` for **move up**, **move down**, and **show/hide**, with
the tile's `accessibilityLabel` announcing its position ("Goal ring, position 1 of 7").

### Preview data

Previews use static fixtures in `mobile/src/components/engagement/homeLayoutPreviewData.ts`, not
the live hooks. A learner with no at-risk items and no reading target still has to be able to see
and place those sections, and the customizer must not fire six data hooks to draw a settings
screen.

---

## 5 — Rewiring Home

`ActionCard` moves out of `(tabs)/index.tsx` into
`mobile/src/components/engagement/ActionCard.tsx` (exported from the barrel) so Home and the
preview tiles share one component. Extraction only — no behaviour change.

Home keeps all of its existing hooks and focus-effect reads, and gains a
`renderHomeSection(id, ctx)` switch. The fixed JSX sequence becomes a map over the ordered
visible entries, with `FadeSlideIn index={i}` taking the array index instead of a hardcoded one.

The layout is re-read in the existing `useFocusEffect`, so returning from the customizer shows
the new order without a remount.

Existing per-section conditions are unchanged and still win — hiding is a user preference on top
of them, not a replacement. `at-risk` still needs `atRiskCount > 0`, `level-progress` still needs
a level, `review-forecast` and `at-risk` are still suppressed on vacation.

---

## 6 — Steps

1. **Route restructure** — `settings.tsx` → `settings/_layout.tsx` + `settings/index.tsx`; move
   `settings.test.tsx` alongside.
   → *verify:* existing settings tests pass unchanged; `/settings` deep links and pushes resolve.
2. **Catalog + reconciler** (`core/engagement/homeLayout.ts`) and `get/setHomeLayout` in
   `preferencesRepository.ts`.
   → *verify:* unit tests for default order, unknown-id pruning, catalog-new append position,
   required-always-visible, corrupt JSON, wrong `v`.
3. **Extract `ActionCard`** into `components/engagement/`, export from the barrel.
   → *verify:* Home tests pass untouched.
4. **Rewire Home** to render from the stored layout.
   → *verify:* new test asserting a stored non-default order renders in that order, a hidden
   section is absent, and required sections render even if the stored value tries to drop them.
5. **Build the customizer screen** plus preview fixtures.
   → *verify:* tests for drag reorder persisting, hide toggle absent on required sections, a11y
   move actions reordering, reset restoring defaults.
6. **Settings entry row** under a new "Home screen" heading.
   → *verify:* tap navigates to the customizer.
7. `npm run lint && npm run typecheck && npm test` in `mobile/`, then flip this plan's status in
   [working-history.md](../working-history.md).

## 7 — Scope

Roughly 10 files. **No new dependencies. No schema migration.**

Out of scope: making the banner slot or greeting customizable, per-section settings (e.g. how
many days the forecast covers), multiple saved layouts, and syncing the layout across devices —
the layout rides along in backup/restore for free, since it is a `user_preferences` row.
