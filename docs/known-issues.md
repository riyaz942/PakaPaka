# Known Issues

Confirmed defects found outside the scope of the story that discovered them, so they were not fixed
in that story's diff. These are **open work, not deferred decisions** — for things a review looked at
and consciously chose not to fix, see
[`_bmad-output/implementation-artifacts/deferred-work.md`](../_bmad-output/implementation-artifacts/deferred-work.md).

---

## Web hand-off lost the owner tab's session once

**Found:** 2026-11-21, during the two-tab browser check of the browse-only second tab
(branch `web-second-tab-browse`, plan `docs/superpowers/plans/2026-11-21-web-second-tab-browse.md`).
**Status:** open — not reproduced.
**Severity:** high if real — progress loss is the plan's main anti-goal.

### What happened

Tab A (owner, local dev server) did onboarding, a lesson and two review answers. Tab B
(browse-only) showed that progress. Tab B pressed **Use here** in the banner. Tab B then
opened `user.db` without any of tab A's session: no onboarding preferences, no lesson, no
answers. The OPFS `user.db` file was exactly the size it had before tab A's session
(Task 1 copy + the 4 KB pool header), and four pool slots were empty. This fits a
transaction in tab A that was never committed and was rolled back when tab B opened the
file, or tab A writing to some other file. Tab A was a page reloaded from an older dev build.

### What did not reproduce it

Same dev server, after the run: each write reached the OPFS file at once, also after the
owner served snapshots (before a lesson, and in the middle of a review), and after a Fast
Refresh. Three more hand-offs (modal **Use here**, banner **Use here** after two deep-link
reloads, **Use here** on the moved screen) kept every answer.

### Next step

Before merge: repeat the two-tab check on a fresh profile, and check the OPFS `user.db`
(file hash / `starting_jlpt_level`) in the owner tab before the hand-off, not only after.

---

## Executorch main vs Expo resource-fetcher nightly skew

**Found:** 2026-07-21, during Story 5.2 code review (Chunk A).
**Status:** accepted risk (not a defect to "fix" in-app) — revisit when upstream changes.
**Severity:** medium — download/load path depends on two packages from different publish dates.

### What is going on

Story 5.2 pins:

- `react-native-executorch@0.10.0-nightly-a0bf85b-20260721` — required for Supertonic Japanese TTS (`'ja'`)
- `react-native-executorch-expo-resource-fetcher@0.10.0-nightly-0a8fe7e-20260527` — tip of that package's
  `executorch-nightly` tag; lockfile marks the package deprecated (“use latest stable”)

There is no July (or later) fetcher nightly. The same-hash May main package
(`…0a8fe7e-20260527`) has Kokoro only — no Supertonic / no `'ja'` — so matching pins would break AC4.

### Decision

Keep the July main + May fetcher pair. Re-check pins when upstream publishes a matching fetcher
nightly or a stable release that still includes Japanese TTS.

---

## Fixed

- **`feedback-error` used but never defined** (found 2026-07-21) — fixed: no `feedback-error` usages remain in
  `mobile/src` (checked 2026-10-20). Full write-up is in git history.
