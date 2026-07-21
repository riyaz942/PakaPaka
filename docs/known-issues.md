# Known Issues

Confirmed defects found outside the scope of the story that discovered them, so they were not fixed
in that story's diff. These are **open work, not deferred decisions** — for things a review looked at
and consciously chose not to fix, see
[`_bmad-output/implementation-artifacts/deferred-work.md`](../_bmad-output/implementation-artifacts/deferred-work.md).

---

## `feedback-error` is used but never defined — 6 usages render unstyled

**Found:** 2026-07-21, during Story 5.2 (push-to-talk voice). Not caused by it.
**Status:** open
**Severity:** medium — one user-visible instance is plausibly unreadable.

### What is wrong

`bg-feedback-error` / `text-feedback-error` are used in six places, but `feedback-error` is not
defined as a colour token anywhere: it is absent from `mobile/tailwind.config.js` and no
`--color-feedback-error` variable exists in `mobile/src/global.css`. Tailwind emits nothing for an
undefined colour, so every one of these renders with no colour applied.

UX-DR2 defines exactly four feedback colours — `correct`, `incorrect`, `warning`, `info`. There is
no `error` in the design system, so these six usages appear to be a naming slip rather than a
missing token.

### Where

| File | Line | Usage |
| --- | --- | --- |
| `mobile/src/components/common/Button.tsx` | 38 | `destructive` variant: `bg-feedback-error` |
| `mobile/src/app/(tabs)/converse/session/[id].tsx` | 241 | error text |
| `mobile/src/components/converse/ByokSettingsSection.tsx` | 87 | error text |
| `mobile/src/components/converse/ByokSettingsSection.tsx` | 115 | "Remove" key action |
| `mobile/src/components/converse/WordLookupSheet.tsx` | 139 | error text |
| `mobile/src/components/converse/ConversationSummary.tsx` | 50 | error text |

### Why the Button case matters most

`Button`'s `destructive` variant pairs `bg-feedback-error` with `text-white`. With the background
resolving to nothing, that is **white text on whatever surface is behind it**. The one live usage is
the "End session" button in `mobile/src/components/review/SessionExitSheet.tsx:24`, which sits on a
light surface — so the label is likely low-contrast or invisible rather than merely unstyled.

### Why CI did not catch it

`npm run check-contrast` validates *defined* token pairs. `feedback-error` is not a token, so it is
not in the checked set: the script passes while the rendered UI is wrong. Any fix should leave the
palette in a state the checker actually covers.

### Suggested fix

Preferred: replace all six usages with the defined `feedback-incorrect` token. This keeps the
palette to UX-DR2's four feedback colours and is already contrast-checked in both themes.

Alternative, if a distinct system-error colour is genuinely wanted: add `--color-feedback-error` to
both the dark and light blocks of `global.css`, map `'feedback-error'` in `tailwind.config.js`, and
confirm `npm run check-contrast` covers the new pair.

Either way, verify the "End session" button in the review exit sheet renders with a visible
background afterwards.

### Note for whoever fixes this

New code in Story 5.2 deliberately uses `feedback-incorrect`, so `PttOverlay.tsx`,
`VoiceModelDownloadPrompt.tsx` and the voice error text in `session/[id].tsx` are already correct
and need no change — which is why that file appears in both this list and the 5.2 diff.
