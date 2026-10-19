# Known Issues

Confirmed defects found outside the scope of the story that discovered them, so they were not fixed
in that story's diff. These are **open work, not deferred decisions** — for things a review looked at
and consciously chose not to fix, see
[`_bmad-output/implementation-artifacts/deferred-work.md`](../_bmad-output/implementation-artifacts/deferred-work.md).

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
