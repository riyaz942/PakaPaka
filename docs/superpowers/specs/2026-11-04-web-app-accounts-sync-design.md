# Web app, optional accounts, and progress sync — design

Date: 2026-11-04 · Branch: `webapp` · Status: design, not started

## Why

The operator wants to study on a laptop with the **same progress as the phone**. Today all progress
lives in `user.db` on one device, with no accounts and no server, so this is impossible.

This project adds three things:

1. A web build of the existing Expo app (same code, not a new product).
2. A small server for optional **Sign in with Google / Apple** and progress sync.
3. Curriculum updates downloaded from the server, for web and mobile.

Success: the operator studies on the phone in the morning, opens the laptop in the evening, sees
the same progress, does a review, and the phone then has that review too — with no manual step.

## This changes product rules

- `CLAUDE.md` says "no accounts". `docs/design/backup-and-web-plan.md` §A3 puts "cloud sync,
  accounts, or a server of any kind" out of scope, and §B3.6/§B4 plan an offline PWA with no
  curriculum OTA on web. This design replaces those points. Update all three documents and
  `docs/working-history.md` as part of the work.
- **Sign-in stays optional, on mobile and web.** The app must stay complete with no account. A
  user who never signs in sees no change except a "Sign in to sync" entry in Settings. The app
  never pushes the user to sign in.

## Goals

- Web app with the core loop: **lessons, reviews (SRS), Browse, Stats, Settings**.
- Optional Google / Apple sign-in on iOS, Android and web.
- Automatic sync of progress between all signed-in devices.
- A conflict dialog only when the same item changed on two devices.
- Curriculum updates from the server for web and mobile.
- Cost as near to $0 as possible; the operator pays. Backend and web code are public (MIT).

## Non-goals

- Talk (AI Conversation), voice, and notifications on web. Hide them on web (absent, not broken).
- Offline web / PWA service worker. The web app may need a network connection. (It still keeps
  data locally in the browser — see Part 1.)
- Desktop packaging (Electron/Tauri).
- Email/password login, Facebook login.
- Review-event replay or a server-side change log (rejected — see Part 3).

## Anti-goals (a failure even if it technically works)

- Sync silently loses reviews or other progress.
- Sign-in becomes required, or the app feels degraded without it.
- BYOK keys, tokens, or AI conversations reach the server.
- The operator gets a surprise bill.
- The mobile app gets slower or freezes because of sync work.

## Existing work to build on

| Thing | Where | Notes |
| --- | --- | --- |
| Backup format (gzipped JSON, rows keyed by `{itemType, slug}`) | `mobile/src/core/backup/` | The sync file **is** this format. `BackupData` lists every synced table. |
| Export / restore | `mobile/src/data/user/exportBackup.ts`, `restoreBackup.ts` | Fully synchronous today (`getAllSync`, `withTransactionSync`, `pako` on the JS thread). A large export freezes the UI. Restore **skips** rows whose slug is not in this device's curriculum. |
| Web plan, Part B | `docs/design/backup-and-web-plan.md` §B | Verified constraints: COOP/COEP headers, `importDatabaseFromAssetAsync` missing on web, `ATTACH` works on web, the `expo-sqlite` sync-bridge bug (§B1.4, §B5). Talk hidden on web (open question 2). |
| ATTACH proof on web | `docs/design/web-sqlite-attach-findings.md` | |
| Web tab layout | `mobile/src/app/(tabs)/_layout.web.tsx` | Exists. Has a Talk trigger to remove. |
| Web-only backup nudge | `mobile/src/app/(tabs)/index.tsx:148` | Keep for signed-out web users. |
| Curriculum OTA | `mobile/src/data/curriculum/curriculumUpdate.ts`, `curriculumConfig.ts` | Manifest URL is a placeholder (`https://example.invalid/...`). |
| FSRS grading | `mobile/src/core/srs/fsrsScheduler.ts` | Pure; not changed by this work. |

Measured backup size (synthetic data from `backup.types.ts`): about **160 KB gzipped** for a typical
user (1,500 items), about **1.3 MB gzipped / 9.5 MB raw** worst case (all 12,700 items). There is
no review-log table, so the size is bounded by the curriculum. The seed `curriculum.db` is now
**12 MB** (`mobile/assets/curriculum-seed/`), not the 1.9 MB in the old plan.

## Order of work

Four parts. Each is useful alone. Each needs the one before, except Part 4 (needs only Part 2's
hosting).

1. Web app works, no server.
2. Server and sign-in.
3. Sync.
4. Curriculum updates from R2.

---

## Part 1 — Web app works, no server

Follow `backup-and-web-plan.md` §B3 with these changes:

- **Sync-bridge bug first** (§B3.1b). Decided per §B5's lean: `patch-package` the one-line upstream
  fix (expo/expo#44148). Verify a query returning >256 bytes round-trips intact.
- Seed `curriculum.db` on web by `fetch` from the same origin + `deserializeAsync` or OPFS write
  (§B1.2), in a `database.web.ts`. Native `database.ts` stays unchanged. Show a one-time loading
  screen (12 MB).
- Data stays in the browser (expo-sqlite on OPFS). Call `navigator.storage.persist()` on first run.
  A signed-out web user's progress lives only in this browser; keep the backup nudge and backup /
  restore in Settings.
- Hide on web: Talk tab and its routes, voice, notification settings, anything that needs
  `expo-secure-store` except the Part 2 session (web uses a cookie instead). Use an explicit
  platform capability check, not try/catch.
- **Not** in scope from §B3.6: service worker, offline shell, install prompt, Lighthouse PWA.
- Host: Cloudflare Workers with static assets (one origin for app + `/api/*`, needed for the
  Part 2 cookie), on the operator's **own domain** (decided; ~$10/year). Buy and connect it before
  the first deploy — never ship on `*.workers.dev`, because browser storage, OAuth redirect URIs,
  and the API / manifest URLs in mobile builds all bind to the origin. COOP/COEP via the asset headers config. Check `crossOriginIsolated === true`.
- Walk every core screen in Chrome and Safari: onboarding, lesson, review (typed answers, Return to
  advance), Browse, Stats, Settings.

Done when: full onboarding → lesson → review → Browse → Stats loop works in Chrome and Safari on
the deployed site, and native tests are unchanged and green.

## Part 2 — Server and sign-in

### Services (Cloudflare free plan)

| Service | Use |
| --- | --- |
| Workers (+ static assets) | Web app files and the API at `/api/*` on the same origin |
| D1 | `users`, `identities`, `sync_state`, `refresh_tokens` (hashed) |
| R2 | Progress files `progress/{user_id}/…`; curriculum files + manifest (Part 4) |
| Worker secrets | Session signing key, HMAC key, Apple `.p8` key (the manifest signing key is **not** here — see Part 4) |
| Rate limiting + Turnstile | `/api/auth/*` per IP, uploads per user; Turnstile on web sign-in |

Free limits checked 2026-11-03: Workers 100k requests/day, 10 ms CPU each; D1 5 GB, 5M reads/day,
100k writes/day; R2 10 GB, 1M writes + 10M reads/month, downloads free. Paid is $5/month per
account. The free plan fails closed (no card on file, so no surprise bill). Check how much rate
limiting the free plan includes before depending on it. The custom domain (~$10/year) is required
(see Part 1).

Supabase was rejected (pauses after 1 week idle, 5 GB egress, $25/month next step).

### Open to all users from the first release (decided)

Any user can sign in from the first release, so Part 2 must include:

- Per-user limits (uploads per hour, file size) and per-IP limits on `/api/auth/*`.
- A usage watch for the operator (Workers / D1 / R2 against the free limits; builder picks the
  mechanism, e.g. Cloudflare notifications or a Cron Trigger).
- When a shared free limit is used up, the app shows a plain message ("Sync is paused until
  tomorrow — your progress is safe on this device") instead of an endless error. Local study is
  never blocked.

### D1 tables (starting point)

- `users(user_id, created_at)`
- `identities(provider, sub, user_id, created_at)` — PK `(provider, sub)`
- `sync_state(user_id, revision, updated_at, last_device_id)`
- `refresh_tokens(token_hash, user_id, device_id, device_label, created_at, last_used_at, revoked_at)`

### Sign-in flow

- **Mobile:** native Google sign-in (Credential Manager on Android) and `expo-apple-authentication`
  on iOS, with a nonce → `POST /api/auth/exchange` → the Worker checks the ID token with `jose`:
  JWKS signature, `iss`, `aud` = our own client ID, `exp`, `nonce` → returns an access token
  (15 min) and a refresh token (60–90 days, hashed in D1, one per device, rotated on every use;
  reuse of an old refresh token revokes that device). Store tokens in `expo-secure-store`.
  Apple on Android uses Apple's web flow (builder picks the mechanism). New native modules need
  a dev-client rebuild.
- **Web:** authorization code + PKCE with a full-page redirect (a popup can break under
  `COOP: same-origin`). Session in an `HttpOnly; Secure; SameSite=Lax` cookie on the same origin.
  Never `localStorage`. Strict CSP.
- Identify users by `(provider, sub)`, never by email. Link a second provider only while signed in
  and after its token is checked. Never auto-link by email.

### Account settings

- Settings shows: signed-in provider, "Sync now", last sync time / last error, device list with
  remove, "Sign out everywhere", **Delete account**.
- **Delete account** removes the user's D1 rows and R2 objects and revokes the Apple token
  (Apple 5.1.1(v), Google Play). Local progress on the device stays.
- **Sign out** keeps local progress, stops sync, and deletes the tokens and the sync base copy.

### Security

- Never log tokens. Limit uploads to ~2 MB.
- *My call:* the free plan gives 10 ms CPU per request, and unzipping + parsing a full file can
  take longer. So the server checks only size, the gzip header, and the small envelope (format,
  version). The full shape check is `backupValidator` on the client, for every upload and every
  download. If real use hits free limits, move to the $5 plan; do not split the file.
- Repo hardening: `SECURITY.md`; `.gitignore` for `.env*` and `.dev.vars`; `permissions:
  contents: read` in workflows; actions pinned by SHA; CODEOWNERS for the backend folder; turn on
  secret scanning, push protection, private vulnerability reporting.

## Part 3 — Sync

### Model: one full file + three-way compare on the device

The server keeps **one current progress file per user** (the backup format, no AI conversations)
and a revision number. Each device keeps a **base copy**: the last file it synced and its revision.

**Push:** `PUT /api/sync` with the file and `base_revision`. The server does compare-and-swap:
if `base_revision` ≠ current revision → `409`. Otherwise store the file, increment the revision.
Keep the previous 3 files in R2 for recovery.

**Pull:** `GET /api/sync` returns the revision and the file (or "not modified" if the device has
the current revision).

**Merge on the device**, row by row, for each table in `BackupData`, comparing **base**, **local**
(this device now), and **remote** (server now). Rows are matched by a per-table key:

| Local vs base | Remote vs base | Result |
| --- | --- | --- |
| same | different | take remote |
| different | same | keep local |
| different | different, and local = remote | no conflict |
| different | different, and local ≠ remote | **conflict** |

A row present in base but missing on one side was deleted on that side (no tombstones needed).
Decisions use row **content**, never `updatedAt` (device clocks differ). `updatedAt` may be shown
in the dialog ("changed 2 hours ago").

Row rules by kind (exact keys are the builder's to settle from `backup.types.ts`):

- **Per-item rows** (`srsStates`, `itemStudyStatus`, `weaknessStats`, `personalMnemonics`,
  `furiganaOverrides`, `relatedItemBoosts`, `userSynonyms`, `grammarAnswers`,
  `grammarSentenceHistory`): conflicts are grouped **by item**. If any row of an item conflicts,
  the whole item is one entry in the dialog, and all that item's rows follow the user's choice.
- **Append-only rows** (`passagePracticeResults`, `cardSeen`, `importMetadata`): union of both
  sides. Never a conflict.
- **Per-day counters** (`dailyLessonLog`, `cognitiveLoadHistory`): *my call* — combine both
  sides' increments over base (`base + (local − base) + (remote − base)`), never a conflict.
  Builder confirms this is right for each field.
- **Singletons** (`streaks`, `goalRingState`): *my call* — recompute from merged data if that is
  possible; otherwise treat as one row with the normal rule.
- **Preferences:** per key, normal rule. Device-local keys are **never synced**. Starting list
  (*my call*, builder confirms): `installed_curriculum_version`, `installed_curriculum_content_hash`,
  `curriculum_update_source`, `last_backed_up_at`, `ai_*`, `cloud_stt_opt_in`,
  `word_translate_opt_in`, `notifications_enabled`, `notification_reminder_time`, `reduced_motion`,
  `theme_mode`.

**Rows for items this device does not know** (the other device has a newer curriculum): keep them
in the merged file and push them unchanged. Never drop them. (Restore today skips them — sync must
not.)

**Backup restore while signed in** (*my call*): restore keeps its meaning — replace **all**
progress. With a clear warning ("This replaces the progress on all your signed-in devices"), the
restored data is applied locally and pushed as a new revision over the server file, not merged.
Other devices then pull it with the normal merge.

**`lesson_opt_ins`** (migration 020) is not in the backup format today. *My call:* add it to
`BackupData` so learn-ahead choices sync.

**Schema version:** if the remote file's `schemaVersion` is newer than this app understands, do not
sync; show "Update the app to sync". Never push over a newer file.

### Conflict dialog

- Shown only when there is at least one conflicting item. Non-conflicting changes always merge.
- **One** dialog with the list of conflicting items (item, and which side changed when) and two
  choices: **Keep this device** or **Use other device**. The choice applies to all listed items.
- After the choice, apply the merged result locally in one transaction, push it as a new revision.
- If the push gets `409` (another device synced while the dialog was open), pull and compare again.

### When sync runs

- Pull + merge on app open (web: page load) and before a review session.
- Push after a lesson or review session ends, and when the app goes to the background
  (web: `visibilitychange` to hidden).
- No network → skip; Settings shows the last sync time and the last error. No silent retries that
  hide failure; one retry on the next trigger is fine.

### First sign-in on a device

- Account empty → push local progress.
- Device empty (fresh install) → pull, apply.
- Both have progress, no base exists → compare local vs remote directly: rows on one side only are
  added; rows that differ are conflicts → same dialog.

### Performance

New sync code uses the **async** SQLite API (`getAllAsync`, `withExclusiveTransactionAsync`) with
batched writes, and does gzip/JSON work in a way that does not freeze the UI. Do not reuse the
synchronous export/restore code paths as they are.

Done when: two devices (phone + web) each review different items and sync with no
dialog and no lost reviews; both review the same item → dialog lists it, both choices give the
expected result; the merge logic is pure functions with unit tests for every row rule above.

## Part 4 — Curriculum updates from R2

- Host the curriculum files and the manifest in R2, served through the Worker. Replace the
  placeholder manifest URL in `curriculumConfig.ts`.
- Sign the manifest with Ed25519; put the public key in the app; reject unsigned or bad manifests.
  The existing SHA-256 file check stays.
- *My call:* sign each release **offline** (operator's machine or a CI secret), never in the
  Worker. The Worker only serves files. Then a compromised Cloudflare account cannot sign a bad
  curriculum.
- Mobile: existing OTA flow (manifest semver → download → SHA-256 → atomic replace).
- Web: after the first download, check the same manifest in the background and replace the
  browser copy of `curriculum.db` the same way.
- Works without sign-in.
- How new curriculum versions get uploaded to R2 (CI step or manual script) is the builder's call.

## Left to the builder

- Exact per-table row keys; the folder for the backend code; Workers test setup; how the base copy
  is stored on device (file vs table); the Apple-on-Android mechanism; whether `streaks` /
  `goalRingState` can be recomputed; the R2 upload path for curriculum releases; screen-level
  layout of the sign-in entry and the conflict dialog (follow existing Settings patterns and
  semantic NativeWind tokens).
