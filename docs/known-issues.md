# Known Issues

Confirmed defects found outside the scope of the story that discovered them, so they were not fixed
in that story's diff. These are **open work, not deferred decisions** — for things a review looked at
and consciously chose not to fix, see
[`_bmad-output/implementation-artifacts/deferred-work.md`](../_bmad-output/implementation-artifacts/deferred-work.md).

---

## Fixed

- **Executorch main vs Expo resource-fetcher nightly skew** (found 2026-07-21) — fixed 2026-10-27:
  moved to stable `react-native-executorch@0.10.7`, which has its own downloader, so the
  resource-fetcher package is gone. The July nightly asked the model host for `voices/F1.bin`;
  every later build asks for `voice_styles/F1.json` instead, so the `.bin` is very likely not
  served. On a Pixel 10 the size probe failed and the download never started. 0.10.7 needs
  `react-native-worklets` 0.10.x, which pulled `react-native-reanimated` up to 4.5.x.

- **`feedback-error` used but never defined** (found 2026-07-21) — fixed: no `feedback-error` usages remain in
  `mobile/src` (checked 2026-10-20). Full write-up is in git history.
