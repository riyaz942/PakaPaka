# Known Issues

Confirmed defects found outside the scope of the story that discovered them, so they were not fixed
in that story's diff. These are **open work, not deferred decisions** — for things a review looked at
and consciously chose not to fix, see
[`_bmad-output/implementation-artifacts/deferred-work.md`](../_bmad-output/implementation-artifacts/deferred-work.md).

---

## Fixed

- **Executorch main vs Expo resource-fetcher nightly skew** (found 2026-07-21) — fixed 2026-10-27:
  moved to stable `react-native-executorch@0.10.7`, which has its own downloader, so the
  resource-fetcher package is gone. 0.10.7 needs
  `react-native-worklets` 0.10.x, which pulled `react-native-reanimated` up to 4.5.x.

- **Voice download prompt said "Could not reach the voice model download" on a working
  connection** (found 2026-10-27, Pixel 10) — fixed 2026-10-27. Every model file exists on Hugging
  Face. The size probe sent HEAD and followed the redirect to the signed CDN URL, then read the
  size from the CDN's answer, which is not reliable. The probe now stops at Hugging Face's redirect
  and reads `x-linked-size` there. A server error no longer tells the learner to check their
  connection.

- **`feedback-error` used but never defined** (found 2026-07-21) — fixed: no `feedback-error` usages remain in
  `mobile/src` (checked 2026-10-20). Full write-up is in git history.
