# Web app Part 2 — Server and sign-in: decisions

Date: 2026-11-15 · Status: design approved 2026-11-15 · Parent spec:
[`2026-11-04-web-app-accounts-sync-design.md`](./2026-11-04-web-app-accounts-sync-design.md) (Part 2)

This file records the Part 2 choices made on 2026-11-15. The parent spec stays the source for the
why, goals, anti-goals and Parts 3–4. Where this file differs from the parent spec, this file wins.

## Scope change: Google only

- **Google sign-in only** on web, Android and iOS. **Apple sign-in is deferred** to a later part
  (operator decision, 2026-11-15). No Apple Services ID, `.p8` key, Apple web flow or Apple token
  revoke in Part 2. The tables stay provider-neutral (`identities.provider`), so Apple needs no
  migration later.
- **Release blocker (App Store 4.8):** an iOS build that offers Google sign-in must also offer Sign
  in with Apple. Part 2 builds Google on iOS (works in dev-client builds). Before the next App
  Store or external TestFlight release, either add Apple or turn sign-in off on iOS. Record this in
  `docs/working-history.md`.
- **No provider linking UI** in Part 2. `identities` supports more than one provider per user.
  With one provider, this does not matter yet.
- **"Sync now"** shows in Settings but is disabled, with the caption "Sync arrives in a later
  update." Part 3 enables it.

## Approaches (chosen)

| Question | Chosen | Rejected and why |
| --- | --- | --- |
| Backend folder | Top-level `backend/`, own `package.json` + `tsconfig`. The single `wrangler.jsonc` moves there; `assets.directory` points at `../mobile/dist`. `mobile` `deploy:web` builds, then runs `wrangler deploy --config ../backend/wrangler.jsonc`. | `mobile/worker/`: mixes Workers deps and test runner into the RN app's `package.json` and Jest config. |
| Workers tests | Vitest + `@cloudflare/vitest-pool-workers` (real `workerd`, local D1 with migrations applied). CI job `backend`. Mobile Jest untouched. | Plain Node + mocked D1: faster but drifts from the runtime (WebCrypto, D1 semantics). |
| Native Google sign-in | `react-native-nitro-google-signin` (MIT; Android Credential Manager, iOS GoogleSignIn 10; custom nonce passed through on both — checked in native source 2.3.1). Adds `react-native-nitro-modules`. Call its `signOut()` right after the exchange so its own encrypted ID-token cache is cleared. | Free `@react-native-google-signin`: deprecated Android stack, no Credential Manager. Paid Universal: yearly cost. Local Expo module: ~200 lines of native code to own. Browser flow on mobile: not native. |
| Apple on Android | Deferred with Apple. When Apple returns: Apple web flow via `expo-web-browser` → Worker callback → `pakapaka://` deep link with a one-time code. | — |
| Apple token revoke | Deferred with Apple. When Apple returns: ask the user to sign in with Apple once more at delete time; store no Apple token. | Store Apple refresh token encrypted in D1. |

## Turnstile vs. cross-origin isolation

The app sends `COEP: require-corp`; the Turnstile iframe is unlikely to load under it. So the web
app never embeds Turnstile. The Worker serves its own sign-in page **`/auth/signin`** (HTML from
the Worker, no COOP/COEP, its own strict CSP that allows `challenges.cloudflare.com`). The page
runs Turnstile, then POSTs to `/api/auth/web/start`, which checks the Turnstile token server-side
and redirects to Google. The Settings "Sign in to sync" button on web is a plain full-page
navigation to `/auth/signin`.

## Worker shape

One Worker serves assets and the API. `assets.run_worker_first: ["/api/*", "/auth/*"]`; every
other path stays static assets (landing page at `/`, SPA elsewhere), unchanged from Part 1.

Bindings: `DB` (D1), `PROGRESS` (R2, used in Part 2 only by Delete account), `AUTH_LIMITER` and
`UPLOAD_LIMITER` (Workers Rate Limiting binding; periods must be 10 s or 60 s), cron trigger
(usage watch), `send_email` (usage watch email).

Secrets (operator runs `npx wrangler secret put`): `SESSION_SIGNING_KEY` (HS256 access tokens),
`HMAC_KEY` (refresh-token hashing + signed nonces + OAuth state), `GOOGLE_WEB_CLIENT_SECRET`,
`TURNSTILE_SECRET`, `CF_ANALYTICS_TOKEN` (read-only, usage watch). Non-secret vars:
`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_IDS` (comma list: prod, preview, dev), `TURNSTILE_SITE_KEY`,
`USAGE_ALERT_EMAIL`.

### Endpoints

| Route | Who | What |
| --- | --- | --- |
| `GET /auth/signin` | web | Sign-in page with Turnstile. |
| `POST /api/auth/web/start` | web | Check Turnstile. Make `state`, PKCE verifier, nonce; keep them in a short-lived signed `HttpOnly` cookie `__Host-pp_oauth` (`Path=/`: the `__Host-` prefix requires it). 302 to Google. |
| `GET /api/auth/google/callback` | web | Check `state`; exchange the code (client secret + PKCE verifier); verify the ID token; find or create the user; create the web device; set cookies; 302 to `/settings`. |
| `POST /api/auth/nonce` | mobile | Return a signed nonce (HMAC, 10-minute expiry). |
| `POST /api/auth/exchange` | mobile | `{ provider: "google", idToken, nonce, deviceLabel }` → verify nonce signature + expiry, verify ID token → `{ accessToken, refreshToken, deviceId }`. |
| `POST /api/auth/refresh` | both | Rotate. Mobile: token in body. Web: refresh cookie. |
| `POST /api/auth/signout` | both | Revoke this device. Web: clear cookies. |
| `GET /api/account` | both | Provider, devices (`deviceId`, label, last used, "this device"). |
| `DELETE /api/account/devices/:id` | both | Revoke that device. |
| `POST /api/account/signout-all` | both | Revoke every device. |
| `DELETE /api/account` | both | Delete every R2 object under `progress/{user_id}/` first, then the D1 rows (`identities`, `refresh_tokens`, `sync_state`, `users`) in one batch. A D1 failure leaves the user row, so a retry completes the delete. |

All JSON errors: `{ "error": "<code>" }`. Codes include `unauthorized`, `rate_limited`,
`turnstile_failed`, `invalid_token`, `quota_exceeded`.

### Token verification (Google)

`jose` `createRemoteJWKSet(https://www.googleapis.com/oauth2/v3/certs)`; `iss` ∈
{`accounts.google.com`, `https://accounts.google.com`}; `aud` ∈ {web client ID, iOS client IDs};
`exp`; `nonce` equals the nonce we issued. Android Credential Manager tokens carry the **web**
client ID as `aud`; the Android client IDs (package + SHA-1, one per app variant) are only
registered in Google Cloud and never appear in code. The user key is `(provider, sub)`. The server never stores, logs or uses your email. On mobile, the Google sign-in token can contain it; the server reads only the account ID (`sub`). Web sign-in asks only for `openid`.

### Sessions

- **Access token:** HS256 JWT, 15 minutes, claims `sub` = user_id, `did` = device_id.
- **Refresh token:** 32 random bytes, base64url. D1 stores `HMAC-SHA256(HMAC_KEY, token)` only.
  60-day life. One active token per device. On use: mark the old row `revoked_at`, insert the new
  one. A token that is already revoked → revoke **every** row of that device (reuse detection).
- **Clients refresh single-flight** (one refresh in progress at a time). Web: OPFS already limits
  the app to one tab per origin. No grace window.
- **Web cookies:** `__Host-pp_at` (access, `Path=/`, 15 min) and `__Secure-pp_rt` (refresh,
  `Path=/api/auth`, 60 days), both `HttpOnly; Secure; SameSite=Lax`. Plus a non-secret,
  non-`HttpOnly` cookie `pp_signed_in=1` so the app knows whether to call the API at all —
  a signed-out web user makes **zero** API calls. No `localStorage`. State-changing routes also
  check the `Origin` header.
- **Mobile:** tokens in `expo-secure-store`. Device label from `expo-device` (model name).

### Limits and quota

- `AUTH_LIMITER`: per IP (`CF-Connecting-IP`) on `/api/auth/*` and `/auth/signin`, 10 per 60 s (`/auth/signin.js` is not counted). On a limit hit, browser routes show a page or redirect instead of JSON.
- `UPLOAD_LIMITER` + upload guard (≤ 2 MB by `Content-Length` and by counted bytes, gzip magic
  bytes, small envelope check): built and tested in Part 2, mounted on `PUT /api/sync` in Part 3.
  Per user, 6 per 60 s (bounds to ≤ 360/hour; the binding has no hour period).
- **"Sync is paused":** D1/R2 quota errors → `503 {"error":"quota_exceeded"}`. When the Workers
  daily request limit is hit, Cloudflare answers before our code (non-JSON 429/5xx). The client
  treats `quota_exceeded` and any non-JSON 429/503 from `/api/*` as "Sync is paused until
  tomorrow — your progress is safe on this device." Our own JSON `rate_limited` shows "Too many
  attempts. Try again in a minute." Local study is never blocked.
- **Usage watch:** daily cron trigger reads yesterday's Workers / D1 / R2 usage from the
  Cloudflare GraphQL Analytics API (read-only token) and emails `USAGE_ALERT_EMAIL` through the
  `send_email` binding when any metric passes 70% of its free limit. Needs Cloudflare Email
  Routing on the domain with a verified destination address (a Cloudflare setting — ask first).

### CSP

- SPA (`_headers`): `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'
  'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
  worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self';
  object-src 'none'`. `style-src 'unsafe-inline'` is required: react-native-web inserts style tags
  at runtime. The built `index.html` has no inline script (checked). Verify every core screen in
  Chrome and Safari after the change.
- Landing page and `/auth/signin` get their own CSP. `/auth/signin` allows
  `https://challenges.cloudflare.com` for script and frame, and `form-action 'self'
  https://accounts.google.com` (Chrome applies `form-action` to the redirect after the POST). The
  page sends `Referrer-Policy: strict-origin-when-cross-origin`; `no-referrer` makes the form POST
  send `Origin: null`, which the start route rejects.

## App changes

- `capabilities.ts`: `supportsNativeGoogleSignIn()` (iOS, Android) and `usesCookieSession()` (web).
  No try/catch for platform detection.
- `src/core/account/` (pure logic, Result-typed API client, error-to-message mapping) and an
  `AccountProvider`. All calls return `Result<T, AppError>`; nothing throws across async
  boundaries. Tokens and ID tokens are never logged.
- Settings, signed out: one row "Sign in to sync". Nothing else changes, nowhere else in the app.
  Signed in: an Account section — "Signed in with Google", "Sync now" (disabled, caption), device
  list with Remove (current device marked; removing it = sign out), Sign out, Sign out everywhere,
  Delete account (confirm: "Your progress on this device stays."). Semantic NativeWind tokens only.
- **Sign out** deletes local tokens (and, in Part 3, the sync base copy); local progress stays.
- No `user.db` migration in Part 2 (tokens live in secure store / cookies).

## Repo hardening

`SECURITY.md` (private vulnerability reporting); `.gitignore` adds `.env*`, `.dev.vars`;
workflows get `permissions: contents: read` and every action pinned by SHA; `CODEOWNERS` for
`backend/`. Secret scanning, push protection, and private vulnerability reporting are GitHub repo
settings — the operator turns them on (or approves `gh api` calls).

## Docs to update

`CLAUDE.md` ("no accounts"), `docs/design/backup-and-web-plan.md` §A3, §B3.6, §B4,
`docs/working-history.md` (Part 2 row + the App Store 4.8 blocker).

## Operator steps (when each is needed)

1. Before the web flow can run against Google: Google Cloud OAuth clients — **web** (redirect
   URI `https://paka-paka.app/api/auth/google/callback`, plus `http://localhost:8787/...` for
   local dev), **iOS** ×3 (bundle IDs `com.pakapaka.app`, `.preview`, `.dev`), **Android** ×3
   (same package names + each build's SHA-1).
2. Before the first deploy: Turnstile widget for `paka-paka.app`; approve creating D1, R2 and the
   rate-limit namespaces; Email Routing destination for the usage watch; `wrangler secret put` for
   each secret above.
3. After the app code is in: dev-client rebuild on a real device (new native modules).

## Done when

A user can sign in with Google on web and on a phone (Android and iOS dev build), see and remove
devices, sign out, sign out everywhere, and delete the account. Rate limits and Turnstile work.
Tokens are verified and rotated; reuse revokes the device. Backend tests, mobile tests, lint and
typecheck are green; existing native tests are unchanged. Docs are updated.

## Left to the builder

Exact rate-limit numbers within the above; D1 index choices; file layout inside `backend/src/`;
copy text beyond the strings quoted here; whether the Worker uses a small router library or a
hand-written switch (keep dependencies minimal).
