# Web app Part 2 — Server and Google sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cloudflare Worker API at `/api/*` (same origin as https://paka-paka.app) with optional Google sign-in on web, Android and iOS, device management, sign out everywhere and delete account — plus limits, a usage watch, repo hardening and the product-rule doc updates.

**Architecture:** One Worker in a new top-level `backend/` serves the existing static app (`mobile/dist`) and runs first for `/api/*` and `/auth/*`. D1 holds users, identities and hashed refresh tokens; R2 is bound only for Delete account in Part 2. Mobile signs in natively (`react-native-nitro-google-signin`) and exchanges the Google ID token for a 15-minute access JWT + rotating refresh token in `expo-secure-store`; web uses authorization code + PKCE through a Worker-served sign-in page (Turnstile) and `HttpOnly` cookies.

**Tech Stack:** Cloudflare Workers + D1 + R2 + Rate Limiting binding + Cron Trigger + `send_email`; TypeScript; `jose` 6; Vitest 4 + `@cloudflare/vitest-pool-workers` 0.23; Expo 55 / RN 0.83; `react-native-nitro-google-signin` 2.3 + `react-native-nitro-modules` 0.37; Jest (`jest-expo`) for mobile.

**Spec:** `docs/superpowers/specs/2026-11-15-web-app-part2-server-signin-design.md` (wins where it differs) and Part 2 of `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md`. Read both before any task.

## Global Constraints

- Sign-in is **optional**. Signed out, the app is unchanged except one Settings row "Sign in to sync". Never prompt, nudge or badge toward sign-in anywhere else.
- A signed-out user makes **zero** `/api/*` requests (native: no tokens in secure store; web: no `pp_signed_in=1` cookie).
- BYOK keys, AI conversations, Google ID tokens, access tokens and refresh tokens are **never logged** (no `console.*` of request bodies, headers or token values, server or client). Email is never requested (`scope=openid` only), stored, or used to match users.
- Users are keyed by `(provider, sub)`; `provider` is `'google'` in Part 2.
- Access token: HS256 JWT, **15 minutes** (`exp = iat + 900`), claims `sub` (user_id), `did` (device_id). Refresh token: 32 random bytes base64url, **60 days**, stored only as `HMAC-SHA256(HMAC_KEY, token)` hex. Reuse of a revoked token revokes every row of that device.
- Web cookies: `__Host-pp_at` (Path=/, Max-Age=900), `__Secure-pp_rt` (Path=/api/auth, Max-Age=5184000), both `HttpOnly; Secure; SameSite=Lax`; `pp_signed_in=1` (Path=/, Max-Age=5184000, `Secure; SameSite=Lax`, not HttpOnly). No `localStorage`/`sessionStorage` for anything auth-related.
- Cookie-authenticated state-changing requests (POST/DELETE) must carry `Origin` equal to `env.APP_ORIGIN`, else `403 {"error":"bad_origin"}`.
- JSON error body is always `{ "error": "<code>" }`. Codes: `unauthorized`, `bad_origin`, `rate_limited`, `turnstile_failed`, `invalid_token`, `invalid_nonce`, `not_found`, `payload_too_large`, `bad_payload`, `quota_exceeded`, `server_error`.
- Upload cap **2,000,000 bytes**. Rate limits: `AUTH_LIMITER` 10 per 60 s per IP (`CF-Connecting-IP`); `UPLOAD_LIMITER` 6 per 60 s per user_id.
- Client copy (exact): paused → `Sync is paused until tomorrow — your progress is safe on this device.`; rate limited → `Too many attempts. Try again in a minute.`; network → `Can't reach the server. Check your connection and try again.`; session ended → `You were signed out. Sign in again to sync.`; other → `Something went wrong. Try again.`; Sync now caption → `Sync arrives in a later update.`; delete confirm body → `This deletes your account and its data on the server. Your progress on this device stays.`
- Mobile: every fallible op returns `Result<T, AppError>` (`mobile/src/types/result.types.ts`); no throws across async boundaries. Platform differences via `mobile/src/platform/capabilities.ts` or `.web.ts` file splits — never try/catch. Semantic NativeWind tokens only; no raw hex. No `user.db` migration in Part 2.
- Backend never imports from `mobile/` except `mobile/src/global.css` as text (Task 7). Mobile never imports from `backend/`.
- Existing mobile tests stay unchanged and green. Do not edit any existing test file except where a task says so.
- **Stop and ask the operator before:** creating D1/R2/rate-limit/Turnstile/Email Routing resources, any `wrangler secret put`, any `wrangler deploy` or `deploy:web`, `wrangler d1 migrations apply --remote`, any Cloudflare or GitHub setting change.

## Review Focus

1. **Two refreshes at once** (two API calls with an expired access token): exactly one `POST /api/auth/refresh` goes out; the second call waits for it. Without this, reuse detection signs the user out. → Task 11 test `refreshes once for concurrent calls`.
2. **Rotation response lost** (server rotated, client kept the old token): next refresh gets 401; the client clears tokens, shows "You were signed out…", and does not retry in a loop. → Task 11 test `refresh 401 ends the session once`.
3. **Delete account with many R2 objects or a mid-way failure:** R2 is emptied first (paginated `list` with cursor, all pages), then D1 rows in one batch; if D1 fails the user still exists and a retry completes. → Task 6 tests `deletes every page of R2 objects` and `D1 failure after R2 keeps the user for retry`.
4. **Signed-out user opens the app and Settings:** no network request at all. → Task 13 test `signed out: no fetch on mount`.
5. **Web callback with `error=access_denied`, a missing/expired/tampered state cookie, or a state mismatch:** 302 to `/settings?signin=failed` (or `cancelled`), no session cookies set, state cookie cleared. → Task 7 tests `callback rejects …`.

---

## File Structure

```
backend/
  package.json            scripts: test, dev, deploy, typecheck
  tsconfig.json
  wrangler.jsonc          moved from mobile/; assets ../mobile/dist; bindings
  vitest.config.ts
  migrations/0001_init.sql
  src/
    index.ts              fetch + scheduled entry; router
    env.ts                Env type
    deps.ts               Deps type + makeDeps(env)
    http.ts               json(), errorResponse(), parseCookies(), setCookie()
    result.ts             Result<T, E> (same shape as mobile's)
    crypto.ts             randomToken, hmacHex, signValue/verifySignedValue, sha256 base64url
    accessToken.ts        issueAccessToken / verifyAccessToken
    google.ts             verifyGoogleIdToken, buildAuthUrl, exchangeCode
    sessions.ts           D1 user/device/refresh-token store
    authenticate.ts       Bearer or cookie → { userId, deviceId, viaCookie }
    limits.ts             rateLimit(), checkUploadBody(), toServerErrorResponse()
    deviceLabel.ts        deviceLabelFromUserAgent()
    routes/mobileAuth.ts  nonce, exchange
    routes/session.ts     refresh, signout (both clients)
    routes/account.ts     account, devices, signout-all, delete
    routes/webAuth.ts     /auth/signin page + js, web/start, google/callback
    signinPage.ts         HTML + CSP for /auth/signin
    usage.ts              fetchUsage, evaluateUsage, buildAlertEmail, runUsageWatch
  test/                   *.test.ts (vitest-pool-workers), helpers.ts
mobile/
  src/platform/capabilities.ts        + supportsNativeGoogleSignIn, usesCookieSession
  src/core/account/account.types.ts   AccountError codes, Device, AccountInfo
  src/core/account/errorMessages.ts   accountErrorMessage()
  src/core/account/apiClient.ts       createApiClient()
  src/core/account/sessionManager.ts  createSessionManager() (single-flight refresh)
  src/data/account/session.ts         native session (secure store + google sign-in)
  src/data/account/session.web.ts     web session (cookies, redirect)
  src/data/account/googleSignIn.ts    native Google sign-in wrapper
  src/providers/AccountProvider.tsx   context + useAccount()
  src/components/settings/AccountSettingsSection.tsx
  __mocks__/react-native-nitro-google-signin.ts
  public/_headers                     CSP rules
.github/CODEOWNERS, SECURITY.md
```

---

### Task 1: Backend scaffold, D1 schema, CI job

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/migrations/0001_init.sql`, `backend/src/{index,env,deps,http}.ts`, `backend/test/scaffold.test.ts`
- Move: `mobile/wrangler.jsonc` → `backend/wrangler.jsonc`
- Modify: `mobile/package.json` (`deploy:web`, remove `wrangler` devDependency), `.github/workflows/ci.yml` (add `backend` job), root `.gitignore` (`.env*`, `.dev.vars`, `backend/.wrangler/`)

**Interfaces:**
- Produces: `Env` (`DB: D1Database; PROGRESS: R2Bucket; AUTH_LIMITER: RateLimit; UPLOAD_LIMITER: RateLimit; ALERT_EMAIL: SendEmail; ASSETS: Fetcher; APP_ORIGIN: string; GOOGLE_WEB_CLIENT_ID: string; GOOGLE_IOS_CLIENT_IDS: string; TURNSTILE_SITE_KEY: string; USAGE_ALERT_EMAIL: string; CF_ACCOUNT_ID: string; SESSION_SIGNING_KEY: string; HMAC_KEY: string; GOOGLE_WEB_CLIENT_SECRET: string; TURNSTILE_SECRET: string; CF_ANALYTICS_TOKEN: string`).
- Produces: `Deps = { now: () => number /* ms */; fetch: typeof fetch; googleJwks: JWTVerifyGetKey }`; `makeDeps(env: Env): Deps` (uses `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))`, created once at module scope).
- Produces: `json(body: unknown, status?: number, headers?: HeadersInit): Response`; `errorResponse(code: ErrorCode, status: number): Response`; `parseCookies(header: string | null): Record<string, string>`; `serializeCookie(name, value, opts: { maxAge: number; path: string; httpOnly: boolean }): string` (always `Secure; SameSite=Lax`); `ErrorCode` union of the Global Constraints codes.
- Produces: router in `index.ts`: `export default { fetch(req, env, ctx), scheduled(event, env, ctx) }`; unmatched `/api/*` → `404 {"error":"not_found"}`.

- [ ] **Step 1:** Create `backend/package.json` (private, `"type": "module"`), devDeps `wrangler@^4.162.0`, `vitest@^4.1`, `@cloudflare/vitest-pool-workers@^0.23`, `@cloudflare/workers-types`, `typescript@~5.9.2`; dep `jose@^6.2`. Scripts: `test: vitest run`, `dev: wrangler dev`, `typecheck: tsc --noEmit`, `deploy: wrangler deploy`. Run `npm install` in `backend/`.
- [ ] **Step 2:** `git mv mobile/wrangler.jsonc backend/wrangler.jsonc`; set `main: "src/index.ts"`, `assets: { directory: "../mobile/dist", binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/api/*", "/auth/*"] }`, keep `routes`, add `vars` (non-secret, `APP_ORIGIN: "https://paka-paka.app"`, `GOOGLE_WEB_CLIENT_ID: ""`, `GOOGLE_IOS_CLIENT_IDS: ""`, `TURNSTILE_SITE_KEY: ""`, `USAGE_ALERT_EMAIL: ""`, `CF_ACCOUNT_ID: ""` — filled at Task 17), `d1_databases` (`binding: DB`, `database_name: pakapaka`, `database_id: "REPLACE_AT_TASK_17"`, `migrations_dir: migrations`), `r2_buckets` (`binding: PROGRESS`, `bucket_name: pakapaka-progress`), `ratelimits` (`AUTH_LIMITER` namespace_id 1001 `{limit:10, period:60}`, `UPLOAD_LIMITER` 1002 `{limit:6, period:60}`), `triggers.crons: ["0 1 * * *"]`, `send_email: [{ name: "ALERT_EMAIL" }]`. Change mobile `deploy:web` to `npm run build:web && npm --prefix ../backend run deploy`; remove `wrangler` from mobile devDeps; `npm install` in `mobile/` to update the lockfile.
- [ ] **Step 3:** `0001_init.sql`:

```sql
CREATE TABLE users (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE identities (provider TEXT NOT NULL, sub TEXT NOT NULL, user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, PRIMARY KEY (provider, sub));
CREATE INDEX identities_user ON identities(user_id);
CREATE TABLE sync_state (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, last_device_id TEXT);
CREATE TABLE refresh_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  device_id TEXT NOT NULL, device_label TEXT NOT NULL, created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL, revoked_at INTEGER);
CREATE INDEX refresh_tokens_device ON refresh_tokens(device_id);
CREATE INDEX refresh_tokens_user ON refresh_tokens(user_id);
```

- [ ] **Step 4: Write failing tests** in `backend/test/scaffold.test.ts` using `SELF` from `cloudflare:test`, with migrations applied in a setup file via `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` (`readD1Migrations` in `vitest.config.ts`; follow the 0.23 README for the config helper name). Vitest miniflare bindings: fake secret strings, `APP_ORIGIN: "https://paka-paka.app"`, `GOOGLE_WEB_CLIENT_ID: "web-client"`, `GOOGLE_IOS_CLIENT_IDS: "ios-a,ios-b"`.
  - `unknown api route returns 404 json`: `GET https://paka-paka.app/api/nope` → status 404, body `{error:"not_found"}`.
  - `migrations create the four tables`: `SELECT name FROM sqlite_master WHERE type='table'` includes `users`, `identities`, `sync_state`, `refresh_tokens`.
  - `parseCookies` / `serializeCookie` unit tests: `serializeCookie('a','b',{maxAge:5,path:'/',httpOnly:true})` === `'a=b; Max-Age=5; Path=/; HttpOnly; Secure; SameSite=Lax'`; `parseCookies('x=1; y=2')` → `{x:'1',y:'2'}`; `parseCookies(null)` → `{}`.
- [ ] **Step 5:** Run `npm test` in `backend/` → FAIL. Implement. Run → PASS. `npm run typecheck` → clean.
- [ ] **Step 6:** Add CI job `backend` (ubuntu, Node 22.13.0, `npm ci`, `npm run typecheck`, `npm test` with `working-directory: backend`, cache path `backend/package-lock.json`). Add `.gitignore` lines. Verify `cd mobile && npm run build:web` still succeeds and `cd backend && npx wrangler deploy --dry-run` bundles without error.
- [ ] **Step 7: Commit** `feat(backend): Worker scaffold, D1 schema, CI job`.

### Task 2: Crypto primitives and access tokens

**Files:** Create `backend/src/crypto.ts`, `backend/src/accessToken.ts`, `backend/test/crypto.test.ts`

**Interfaces:**
- Produces: `randomToken(bytes = 32): string` (base64url); `hmacHex(key: string, data: string): Promise<string>`; `sha256Base64Url(data: string): Promise<string>` (PKCE S256); `signValue(key: string, payload: object, expiresAtMs: number): Promise<string>` → `base64url(json) + "." + hmacHex`; `verifySignedValue<T>(key: string, value: string, nowMs: number): Promise<T | null>` (null on bad MAC, bad JSON, or expired; constant-time compare).
- Produces: `issueAccessToken(env: Env, userId: string, deviceId: string, nowMs: number): Promise<string>`; `verifyAccessToken(env: Env, token: string, nowMs: number): Promise<{ userId: string; deviceId: string } | null>` (jose `SignJWT`/`jwtVerify`, HS256, `currentDate: new Date(nowMs)`).

- [ ] **Step 1: Failing tests:** `signed value round-trips before expiry`; `signed value is null after expiry` (now = exp + 1); `signed value is null when one character changes`; `hmacHex is stable and 64 hex chars`; `access token verifies at 899 s and fails at 901 s`; `access token signed with another key fails`; `randomToken(32) is 43 chars base64url`; `sha256Base64Url('abc') === 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0'`.
- [ ] **Step 2:** Run → FAIL. Implement with WebCrypto + jose. Run → PASS.
- [ ] **Step 3: Commit** `feat(backend): signed values, HMAC, access tokens`.

### Task 3: Google ID token verification

**Files:** Create `backend/src/google.ts`, `backend/test/google.test.ts`, `backend/test/helpers.ts`

**Interfaces:**
- Produces: `verifyGoogleIdToken(idToken: string, opts: { jwks: JWTVerifyGetKey; audiences: string[]; expectedNonce: string; nowMs: number }): Promise<Result<{ sub: string }, 'invalid_token' | 'invalid_nonce'>>` — define a local `Result` type in `backend/src/result.ts` mirroring mobile's shape (`{ok:true,value}|{ok:false,error}`). Checks: signature via `jwks`, `iss` ∈ `['accounts.google.com','https://accounts.google.com']`, `aud` ∈ `audiences`, `exp` (jose, `clockTolerance: 30`), then `payload.nonce === expectedNonce` else `invalid_nonce`.
- Produces: `googleAudiences(env: Env): string[]` → `[env.GOOGLE_WEB_CLIENT_ID, ...env.GOOGLE_IOS_CLIENT_IDS.split(',').map(trim).filter(Boolean)]`.
- Produces (used in Task 7): `buildGoogleAuthUrl(env, { state, nonce, codeChallenge }): string` — `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri=${APP_ORIGIN}/api/auth/google/callback`, `response_type=code`, `scope=openid`, `state`, `nonce`, `code_challenge`, `code_challenge_method=S256`, `prompt=select_account`; `exchangeGoogleCode(env, deps, { code, codeVerifier }): Promise<Result<string /* id_token */, 'invalid_token'>>` — POST form to `https://oauth2.googleapis.com/token` via `deps.fetch`.
- Produces (test helper): `makeTestGoogle(): Promise<{ jwks: JWTVerifyGetKey; sign(claims: Partial<JWTPayload> & { nonce?: string }): Promise<string> }>` — RS256 key pair, `createLocalJWKSet`; default claims `iss: 'https://accounts.google.com'`, `aud: 'web-client'`, `sub: 'g-123'`, `iat`/`exp` now/now+3600.

- [ ] **Step 1: Failing tests:** `accepts a valid token` (→ `{sub:'g-123'}`); `accepts aud from GOOGLE_IOS_CLIENT_IDS`; `rejects wrong aud`; `rejects wrong iss`; `rejects expired (exp 31 s in the past)`; `rejects a token signed by another key`; `rejects nonce mismatch with invalid_nonce`; `rejects missing nonce with invalid_nonce`; `buildGoogleAuthUrl has scope=openid and no email scope`; `exchangeGoogleCode posts code_verifier and client_secret and returns id_token` (fake `fetch` capturing the body); `exchangeGoogleCode non-200 → invalid_token`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(backend): Google ID token verification and code exchange`.

### Task 4: Session store (users, devices, refresh rotation)

**Files:** Create `backend/src/sessions.ts`, `backend/test/sessions.test.ts`

**Interfaces:**
- Produces: `findOrCreateUser(db: D1Database, provider: 'google', sub: string, nowMs: number): Promise<string /* userId */>` — algorithm: new `crypto.randomUUID()`; `INSERT INTO identities … ON CONFLICT(provider, sub) DO NOTHING`; `SELECT user_id FROM identities WHERE provider=? AND sub=?`; if it equals the new id, `INSERT INTO users`. (No orphan user rows on a concurrent first sign-in.)
- Produces: `createDevice(env: Env, userId: string, label: string, nowMs: number): Promise<{ deviceId: string; refreshToken: string }>`.
- Produces: `rotateRefreshToken(env: Env, token: string, nowMs: number): Promise<Result<{ userId: string; deviceId: string; refreshToken: string }, 'unauthorized'>>` — look up by hash; missing → `unauthorized`; `revoked_at` set → revoke all rows of that `device_id`, `unauthorized`; `created_at + 60 days < now` → `unauthorized`; else in one `db.batch`: set `revoked_at = now` on old, insert new row (same device_id/label, `created_at = last_used_at = now`).
- Produces: `revokeDevice(db, userId, deviceId, nowMs): Promise<boolean /* found */>` (scoped to userId); `revokeAllDevices(db, userId, nowMs): Promise<void>`; `listDevices(db, userId): Promise<Array<{ deviceId: string; label: string; lastUsedAt: number }>>` (one entry per device with an active row, newest `last_used_at` first); `deleteUserRows(db, userId): Promise<void>` (one batch: `refresh_tokens`, `sync_state`, `identities`, `users`).

- [ ] **Step 1: Failing tests:** `same (provider, sub) returns the same user`; `different sub returns a new user`; `rotation returns a new token and the old one stops working`; `reusing a rotated token revokes the device` (after reuse, the *new* token also returns `unauthorized`); `token older than 60 days is unauthorized`; `revokeDevice of another user's device returns false and changes nothing`; `listDevices hides revoked devices and orders by last use`; `deleteUserRows removes rows in all four tables`; `stored token_hash is not the raw token` (`SELECT token_hash` ≠ token).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(backend): user, device and refresh-token store`.

### Task 5: Authenticate, rate limit, mobile auth and session routes

**Files:** Create `backend/src/authenticate.ts`, `backend/src/limits.ts` (rate-limit part), `backend/src/routes/mobileAuth.ts`, `backend/src/routes/session.ts`, `backend/src/deviceLabel.ts`, `backend/test/mobileAuth.test.ts`, `backend/test/session.test.ts`; Modify `backend/src/index.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `authenticate(req: Request, env: Env, nowMs: number): Promise<{ userId: string; deviceId: string; viaCookie: boolean } | null>` — `Authorization: Bearer` first, else `__Host-pp_at` cookie; signature + `exp` only, no D1 read (agreed design: a removed device keeps access until its access token expires, ≤ 15 minutes).
- Produces: `requireSameOrigin(req, env): Response | null` (403 `bad_origin` when `viaCookie` and method ≠ GET and `Origin` ≠ `APP_ORIGIN`).
- Produces: `rateLimit(limiter: RateLimit, key: string): Promise<Response | null>` → `429 {"error":"rate_limited"}` or null. Router applies `AUTH_LIMITER` keyed by `CF-Connecting-IP` to every `/api/auth/*` and `/auth/*` request before the handler.
- Produces: `POST /api/auth/nonce` → `{ nonce }` where `nonce = signValue(HMAC_KEY, { n: randomToken(16) }, now + 600_000)`.
- Produces: `handleExchange(req, env, deps)` for `POST /api/auth/exchange` body `{ provider: 'google', idToken: string, nonce: string, deviceLabel: string }` → verify nonce signature/expiry (`invalid_nonce` 400), `verifyGoogleIdToken(…, expectedNonce: nonce)` (401 `invalid_token`/`invalid_nonce`), `findOrCreateUser`, `createDevice(label trimmed to 60 chars, empty → 'Phone')` → `200 { accessToken, refreshToken, deviceId, provider: 'google' }`.
- Produces: `POST /api/auth/refresh`: JSON body `{ refreshToken }` → `200 { accessToken, refreshToken }`; no body token → read `__Secure-pp_rt` cookie, respond `204` with new `__Host-pp_at` + `__Secure-pp_rt` + `pp_signed_in` cookies. Failure → `401 unauthorized`; cookie path also clears all three cookies (`Max-Age=0`).
- Produces: `POST /api/auth/signout` (authenticated) → revoke current device; cookie path clears cookies; `204`.
- Produces: `deviceLabelFromUserAgent(ua: string | null): string` → `"<Browser> on <OS>"` (Browser ∈ Edge, Chrome, Firefox, Safari; OS ∈ macOS, Windows, iOS, Android, ChromeOS, Linux), else `'Web browser'`. (Used in Task 7.)

- [ ] **Step 1: Failing tests** (`handleExchange` called directly with `deps.googleJwks` from `makeTestGoogle`; other routes via `SELF.fetch`):
  - `exchange returns tokens and the same user on a second sign-in`
  - `exchange rejects a nonce we did not sign` (400 `invalid_nonce`)
  - `exchange rejects an expired nonce` (deps.now = issued + 600_001)
  - `exchange rejects an id token whose nonce differs` (401 `invalid_nonce`)
  - `refresh (body) rotates; old token then 401`
  - `refresh (cookie) sets three cookies with the exact attributes` (assert each `Set-Cookie` string against Global Constraints)
  - `refresh (cookie) failure clears cookies`
  - `signout revokes the device; its refresh token then 401`
  - `cookie POST with foreign Origin → 403 bad_origin`; `bearer POST without Origin is allowed`
  - `11th auth request in a window → 429 rate_limited` (stub `AUTH_LIMITER` in the miniflare config, or call `rateLimit` with a fake limiter `{ limit: async () => ({ success: false }) }`)
  - `deviceLabelFromUserAgent` table test: macOS Chrome UA → `Chrome on macOS`; iPhone Safari UA → `Safari on iOS`; `null` → `Web browser`.
  - `no token value appears in console output`: spy on `console.log/info/warn/error` across an exchange + refresh; assert no call argument contains the issued tokens.
- [ ] **Step 2:** Run → FAIL. Implement; wire routes in `index.ts`. Run → PASS.
- [ ] **Step 3: Commit** `feat(backend): mobile exchange, refresh rotation, sign-out, auth rate limit`.

### Task 6: Account routes and Delete account

**Files:** Create `backend/src/routes/account.ts`, `backend/test/account.test.ts`; Modify `backend/src/index.ts`

**Interfaces:**
- Consumes: `authenticate`, `requireSameOrigin`, Task 4 store.
- Produces: `GET /api/account` → `{ provider: 'google', devices: Array<{ deviceId, label, lastUsedAt, current: boolean }> }`.
- Produces: `DELETE /api/account/devices/:deviceId` → `204`, or `404 not_found` when not this user's active device.
- Produces: `POST /api/account/signout-all` → `204` (cookie path clears cookies).
- Produces: `DELETE /api/account` → delete every R2 object under `progress/${userId}/` (loop `PROGRESS.list({ prefix, cursor })` until `truncated` is false; `PROGRESS.delete(keys)` per page), **then** `deleteUserRows`; `204` (cookie path clears cookies). Any failure → error via `toServerErrorResponse` (Task 8; until then `500 server_error`).
- All four: unauthenticated → `401 unauthorized`.

- [ ] **Step 1: Failing tests:** `account lists devices and marks current`; `removing another device revokes only it`; `removing a device of another user → 404`; `signout-all revokes every device of this user only`; `deletes every page of R2 objects` (put 1,005 objects under the prefix + 1 under another user's prefix; after delete, prefix list is empty, the other object remains); `D1 failure after R2 keeps the user for retry` (call the handler with a `db` wrapper whose `batch` rejects once; user row still exists; second call succeeds); `unauthenticated → 401` for each route.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(backend): account, devices, sign out everywhere, delete account`.

### Task 7: Web sign-in (Turnstile page, PKCE start, callback)

**Files:** Create `backend/src/signinPage.ts`, `backend/src/routes/webAuth.ts`, `backend/test/webAuth.test.ts`; Modify `backend/src/index.ts`, `backend/wrangler.jsonc` (`rules: [{ type: "Text", globs: ["**/*.css"] }]`)

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces: `GET /auth/signin` → HTML (no COOP/COEP) with: page title "Sign in to sync", Turnstile widget `<div class="cf-turnstile" data-sitekey="${TURNSTILE_SITE_KEY}" data-callback="onTurnstileOk">`, `<form method="post" action="/api/auth/web/start">` with a "Continue with Google" button disabled until `onTurnstileOk`, a "Back to the app" link to `/settings`. Scripts only from `/auth/signin.js` and `https://challenges.cloudflare.com/turnstile/v0/api.js`. Headers: `Content-Security-Policy: default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`. Colors: `:root` + `@media (prefers-color-scheme: dark)` blocks built by `tokenCss(globalCssText: string): string`, which copies the `--color-*` declarations from `mobile/src/global.css` (imported as text) and uses `rgb(var(--color-…))`. No hex in `signinPage.ts`.
- Produces: `GET /auth/signin.js` → `window.onTurnstileOk = () => { document.getElementById('continue').disabled = false; }` (`Content-Type: text/javascript`).
- Produces: `POST /api/auth/web/start` (form body has `cf-turnstile-response`) → POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` (`secret`, `response`, `remoteip`) via `deps.fetch`; not `success` → `303` to `/auth/signin?error=turnstile` (page shows "Check failed. Try again."); success → `verifier = randomToken(32)`, `state = randomToken(16)`, `nonce = randomToken(16)`; cookie `__Host-pp_oauth = signValue(HMAC_KEY, {state, verifier, nonce}, now + 600_000)` (HttpOnly, Path=/, Max-Age=600); `303` to `buildGoogleAuthUrl(…, codeChallenge: sha256Base64Url(verifier))`.
- Produces: `handleGoogleCallback(req, env, deps)` for `GET /api/auth/google/callback?code&state` (or `?error`) → always clears `__Host-pp_oauth`. `error=access_denied` → `302 /settings?signin=cancelled`. Missing/invalid/expired cookie, state mismatch, exchange or verify failure → `302 /settings?signin=failed`. Success → `findOrCreateUser`, `createDevice(deviceLabelFromUserAgent(UA))`, set `__Host-pp_at`, `__Secure-pp_rt`, `pp_signed_in`, `302 /settings?signin=ok`.

- [ ] **Step 1: Failing tests:** `signin page has the CSP and no COEP header`; `signin page CSS has no hex colors` (`/#[0-9a-fA-F]{3,8}\b/` absent in the `<style>`); `tokenCss copies light and dark --color-background`; `start with failed turnstile redirects to signin?error=turnstile and sets no cookie`; `start with passing turnstile sets the oauth cookie and redirects to Google with S256 challenge of the verifier`; `callback success sets three session cookies and redirects to /settings?signin=ok` (fake `deps.fetch` for the token endpoint returns an id_token signed by `makeTestGoogle` with the cookie's nonce); `callback rejects error=access_denied → cancelled`; `callback rejects missing state cookie → failed`; `callback rejects tampered state cookie → failed`; `callback rejects expired state cookie → failed`; `callback rejects state mismatch → failed`; `callback rejects id token nonce mismatch → failed`; every reject: no `__Host-pp_at` in `Set-Cookie`, and `__Host-pp_oauth` cleared.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(backend): web Google sign-in with Turnstile and PKCE`.

### Task 8: Upload guard and quota mapping

**Files:** Modify `backend/src/limits.ts`; Create `backend/test/limits.test.ts`; Modify route handlers to use `toServerErrorResponse`

**Interfaces:**
- Produces: `checkUploadBody(req: Request, maxBytes = 2_000_000): Promise<Result<Uint8Array, 'payload_too_large' | 'bad_payload'>>` — reject when `Content-Length` > max before reading; read the stream counting bytes and cancel the reader past max; require first two bytes `0x1f 0x8b`. Envelope (format/version) check is Part 3's, since Part 3 defines the format. Not mounted on any route in Part 2.
- Produces: `uploadRateLimit(env, userId): Promise<Response | null>` (wraps `rateLimit(env.UPLOAD_LIMITER, userId)`).
- Produces: `toServerErrorResponse(err: unknown): Response` → `503 {"error":"quota_exceeded"}` when the error message matches D1/R2 limit errors (confirm the exact D1 "exceeded" message text from Cloudflare D1 docs and pin it in a constant with a source comment), else `500 {"error":"server_error"}`. Never includes the error message in the body. Logs only the error name/code, never request data.

- [ ] **Step 1: Failing tests:** `2,000,000-byte gzip body passes`; `2,000,001 bytes → payload_too_large`; `lying Content-Length (small header, large stream) → payload_too_large`; `non-gzip → bad_payload`; `quota error → 503 quota_exceeded`; `other error → 500 server_error with no message leak`; `upload limiter false → 429`.
- [ ] **Step 2:** Run → FAIL. Implement; route handlers' catch blocks use `toServerErrorResponse`. Run all backend tests → PASS.
- [ ] **Step 3: Commit** `feat(backend): upload guard and quota error mapping`.

### Task 9: Usage watch (cron)

**Files:** Create `backend/src/usage.ts`, `backend/test/usage.test.ts`, `backend/test/fixtures/usage-graphql.json`; Modify `backend/src/index.ts` (`scheduled`)

**Interfaces:**
- Produces: `FREE_LIMITS = { workersRequestsPerDay: 100_000, d1ReadsPerDay: 5_000_000, d1WritesPerDay: 100_000, d1StorageBytes: 5e9, r2ClassAPerMonth: 1_000_000, r2ClassBPerMonth: 10_000_000, r2StorageBytes: 10e9 }` (source comment: parent spec, checked 2026-11-03).
- Produces: `UsageSnapshot` with the same keys (day metrics = yesterday UTC; R2 ops = month to date; storage = latest).
- Produces: `fetchUsage(env, deps, day: string /* YYYY-MM-DD */): Promise<Result<UsageSnapshot, 'usage_fetch_failed'>>` — one POST to `https://api.cloudflare.com/client/v4/graphql` with `Authorization: Bearer ${CF_ANALYTICS_TOKEN}`, datasets `workersInvocationsAdaptive`, `d1AnalyticsAdaptiveGroups`, `d1StorageAdaptiveGroups`, `r2OperationsAdaptiveGroups`, `r2StorageAdaptiveGroups` filtered by `CF_ACCOUNT_ID` (verify field names against the Cloudflare GraphQL schema docs; record the query in the fixture test).
- Produces: `evaluateUsage(s: UsageSnapshot, threshold = 0.7): Array<{ metric: keyof UsageSnapshot; used: number; limit: number }>`.
- Produces: `buildAlertEmail(from: string, to: string, alerts, day): string` (raw RFC 5322 text, plain body, subject `PakaPaka: free-plan usage above 70% (${day})`); `runUsageWatch(env, deps)` — fetch, evaluate, send via `env.ALERT_EMAIL.send(new EmailMessage(from, to, raw))` from `cloudflare:email`, `from = alerts@${new URL(APP_ORIGIN).hostname}`. On fetch failure it **also** sends an email ("Usage check failed") — the watch must not go quiet.

- [ ] **Step 1: Failing tests:** `evaluateUsage flags exactly the metrics at or above 70%`; `evaluateUsage returns [] under threshold`; `fetchUsage parses the fixture into a snapshot`; `fetchUsage non-200 → usage_fetch_failed`; `runUsageWatch sends one email when a metric is high`; `runUsageWatch sends nothing when all are low`; `runUsageWatch sends a failure email when fetch fails` (fake `ALERT_EMAIL`).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(backend): daily free-plan usage watch`.

### Task 10: Strict CSP for the app and landing page

**Files:** Modify `mobile/public/_headers`; Create `mobile/__tests__/webHeaders.test.ts`

**Interfaces:** none.

- [ ] **Step 1: Failing test** `mobile/__tests__/webHeaders.test.ts` (Node fs, reads `public/_headers` and `public/landing/index.html`):
  - `/* rule has the SPA CSP`: exactly `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`, plus COOP/COEP kept.
  - `landing rules detach the SPA CSP and allow each inline script by hash`: rules for `/` and `/landing/*` contain `! Content-Security-Policy` and a CSP whose `script-src` lists `'sha256-…'` for every inline `<script>` body in `landing/index.html` (compute with `crypto.createHash('sha256')`), and nothing like `'unsafe-inline'` in `script-src`.
- [ ] **Step 2:** Run `npx jest __tests__/webHeaders.test.ts` in `mobile/` → FAIL. Edit `_headers`. Run → PASS.
- [ ] **Step 3: Verify in a real browser:** `cd mobile && npm run build:web`, `cd ../backend && npx wrangler dev` (local D1). `curl -sI http://localhost:8787/`, `/dashboard`, `/auth/signin` and check each CSP. In Chrome **and** Safari: onboarding, lesson, review (typed answer, Return), Browse search, Stats, Settings, backup export — no CSP violations in the console; `crossOriginIsolated === true` on `/dashboard`. If a violation appears, fix the policy (never by adding `'unsafe-inline'` to `script-src` or `'unsafe-eval'`) and extend the test.
- [ ] **Step 4: Commit** `feat(web): strict CSP for app and landing page`.

### Task 11: Mobile account core (API client, single-flight session)

**Files:** Create `mobile/src/core/account/{account.types,errorMessages,apiClient,sessionManager}.ts` + co-located tests; Modify `mobile/src/platform/capabilities.ts` (+ test cases in `capabilities.test.ts` — new cases only)

**Interfaces:**
- Produces: `supportsNativeGoogleSignIn = () => Platform.OS === 'ios' || Platform.OS === 'android'`; `usesCookieSession = () => isWeb()`.
- Produces: `AccountErrorCode = 'paused' | 'rate_limited' | 'network' | 'session_ended' | 'cancelled' | 'not_found' | 'server'`; `AccountDevice = { deviceId: string; label: string; lastUsedAt: number; current: boolean }`; `AccountInfo = { provider: 'google'; devices: AccountDevice[] }`.
- Produces: `accountErrorMessage(code: AccountErrorCode): string | null` (exact copy from Global Constraints; `cancelled` → null; `not_found` and `server` → "Something went wrong. Try again.").
- Produces: `toAccountError(res: Response | null): Promise<AppError>` — `null` (fetch rejected) → `network`; JSON `quota_exceeded` → `paused`; **non-JSON** 429/503 → `paused`; JSON `rate_limited` → `rate_limited`; 401 → `session_ended`; 404 → `not_found`; else `server`. `AppError.code` = the AccountErrorCode, `userMessage` = `accountErrorMessage`.
- Produces: `createApiClient(opts: { baseUrl: string; fetch: typeof fetch }): ApiClient` with `request(path: string, init: RequestInit & { accessToken?: string }): Promise<Result<Response>>` (adds `Authorization: Bearer` when given; `fetch` rejection → `network`; non-2xx → `toAccountError`). Never logs bodies or headers.
- Produces: `createSessionManager(deps: { api: ApiClient; store: TokenStore; nowMs: () => number }): SessionManager` where `TokenStore = { load(): Promise<Result<StoredSession | null>>; save(s: StoredSession): Promise<Result<void>>; clear(): Promise<Result<void>> }`, `StoredSession = { accessToken: string; accessExpiresAtMs: number; refreshToken: string; deviceId: string }`; `SessionManager = { authorizedRequest(path, init): Promise<Result<Response>>; refreshNow(): Promise<Result<void>> }`. Refresh when `accessExpiresAtMs - 30_000 < now` or on a 401 (once). Refreshes are **single-flight** (shared promise). Refresh 401 → `store.clear()` and return `session_ended`; no further refresh until a new sign-in.

- [ ] **Step 1: Failing tests:** `errorMessages` table test (each code → exact copy); `toAccountError` — `fetch rejection → network`, `non-JSON 429 → paused`, `non-JSON 503 → paused`, `JSON quota_exceeded → paused`, `JSON rate_limited → rate_limited`, `401 → session_ended`; `apiClient adds bearer header`; `sessionManager`: `uses a fresh token without refreshing`, `refreshes once for concurrent calls` (two `authorizedRequest` calls with an expired token → fake fetch sees exactly one `/api/auth/refresh`, both calls succeed), `retries once after a 401 then gives up`, `refresh 401 ends the session once` (store cleared, result `session_ended`, a third call makes **no** fetch); `capabilities`: new cases for ios/android/web.
- [ ] **Step 2:** Run `npx jest src/core/account src/platform` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(mobile): account API client and single-flight session manager`.

### Task 12: Native Google sign-in and session (secure store)

> **Operator step before Step 4:** create the Google OAuth clients (spec "Operator steps" 1) and send the **client IDs** (public values, safe in chat): web, iOS × 3 (prod/preview/dev). Steps 1–3 do not need them.

**Files:** Create `mobile/src/data/account/googleSignIn.ts`, `mobile/src/data/account/session.ts`, `mobile/src/data/account/tokenStore.ts`, tests for each, `mobile/__mocks__/react-native-nitro-google-signin.ts`; Modify `mobile/package.json` (deps + jest `moduleNameMapper` entry), `mobile/app.config.js`, `mobile/src/config/` (API base URL)

**Interfaces:**
- Consumes: Task 11.
- Produces: `API_BASE_URL` in `mobile/src/config/api.ts` = `process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://paka-paka.app'`.
- Produces: `signInWithGoogleNative(nonce: string): Promise<Result<{ idToken: string }>>` — `GoogleOneTapSignIn.configure({ webClientId, iosClientId, nonce })` (IDs from `Constants.expoConfig.extra.google`), then `createAccount()`; `type: 'cancelled'` → error code `cancelled`; no `idToken` → `server`; then `GoogleOneTapSignIn.signOut()` to clear the library's cached ID token (its failure is ignored only because the token is already used; add a one-line comment). Library calls that reject → `AppError` (wrap with `.then/.catch` into Result — this is a library boundary, not a platform check).
- Produces: `secureTokenStore: TokenStore` (`expo-secure-store`, key `account_session_v1`, JSON, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, same error shape as `credentialStore.ts`).
- Produces: `createAccountSession(): AccountSession` (native file; Task 13 adds the `.web.ts` twin with the same name) where `AccountSession = { isSignedIn(): Promise<boolean>; signIn(): Promise<Result<void>>; getAccount(): Promise<Result<AccountInfo>>; removeDevice(id: string): Promise<Result<void>>; signOut(): Promise<Result<void>>; signOutEverywhere(): Promise<Result<void>>; deleteAccount(): Promise<Result<void>> }` (type in `account.types.ts`). `signIn` = `POST /api/auth/nonce` → `signInWithGoogleNative` → `POST /api/auth/exchange` (`deviceLabel` = `Device.modelName ?? Platform.OS`) → `store.save`. `signOut` = `POST /api/auth/signout` then `store.clear()` regardless of the server result (local sign-out must always work; the server row expires or shows in the device list). `signOutEverywhere`/`deleteAccount` clear the store after success. Removing the current device = `signOut`.
- `app.config.js`: per variant (prod default, preview, dev) add `extra.google = { webClientId, iosClientId }` and the plugin `['react-native-nitro-google-signin', { iosUrlScheme: <reversed iOS client id> }]`. One `GOOGLE_CLIENTS` map at the top of the file, keyed by variant.

- [ ] **Step 1: Failing tests** (mock maps `react-native-nitro-google-signin`; fake fetch): `signIn stores the session from exchange`; `signIn passes the server nonce to configure`; `cancelled sign-in stores nothing and returns cancelled`; `signOut clears the store even when the server call fails`; `deleteAccount clears the store on success and keeps it on failure`; `isSignedIn false with an empty store makes no fetch`; `library signOut is called after a successful sign-in`.
- [ ] **Step 2:** Run → FAIL. Install `react-native-nitro-google-signin@^2.3.1 react-native-nitro-modules@^0.37` (`npx expo install` where it applies). Implement. Run → PASS. `npm run typecheck`, `npm run lint` → clean.
- [ ] **Step 3: Commit** `feat(mobile): native Google sign-in and secure session`.
- [ ] **Step 4 (after client IDs arrive):** fill `GOOGLE_CLIENTS`; `npx expo prebuild --clean` dry check (or `npx expo config --type prebuild`) shows the plugin and URL scheme for each variant. Commit `chore(mobile): Google OAuth client IDs`.

### Task 13: Web session, AccountProvider, Settings section

**Files:** Create `mobile/src/data/account/session.web.ts` (+ test), `mobile/src/providers/AccountProvider.tsx` (+ test), `mobile/src/components/settings/AccountSettingsSection.tsx` (+ test); Modify `mobile/src/app/_layout.tsx` (wrap in `AccountProvider` inside `DatabaseProvider`), `mobile/src/app/(tabs)/settings/index.tsx` (one line: render `<AccountSettingsSection />` above the Backup heading)

**Interfaces:**
- Consumes: Tasks 11–12.
- Produces: `session.web.ts` exports `createAccountSession(): AccountSession` (same name as the native file; Metro picks the file). Web: `isSignedIn` = `document.cookie` has `pp_signed_in=1`; `signIn` = `window.location.assign('/auth/signin')` and resolve ok; calls use relative URLs (cookies are sent same-origin), on 401 one `POST /api/auth/refresh` (single-flight via a shared promise) then retry once; refresh 401 → `session_ended` (server already cleared cookies).
- Produces: `AccountProvider` / `useAccount(): { status: 'signed_out' | 'loading' | 'signed_in'; account: AccountInfo | null; error: string | null; signInResult: 'ok' | 'failed' | 'cancelled' | null; signIn(); refresh(); removeDevice(id); signOut(); signOutEverywhere(); deleteAccount() }`. On mount: `isSignedIn()`; only if true, `getAccount()`. On web, read `?signin=` once from `window.location.search` (then `history.replaceState` to drop it) into `signInResult` (`failed` → "Sign-in did not finish. Try again."; `cancelled` → no message). `session_ended` from any call → `status: 'signed_out'` + its message.
- Produces: `AccountSettingsSection` — signed out: `SectionHeading "Account"`, one `Button` "Sign in to sync" (secondary variant), caption "Optional. Keeps your progress the same on all your devices." Signed in: "Signed in with Google"; disabled "Sync now" button + caption `Sync arrives in a later update.`; device list in a `SettingsCard`-style card (label, "This device" tag on current, last used date, "Remove" button with `accessibilityLabel="Remove <label>"`); buttons "Sign out", "Sign out everywhere", "Delete account" (destructive styling via existing token classes, e.g. `text-feedback-incorrect-deep`); delete opens an in-app confirm (existing `ExplainerSheet` or a confirm card like `RestorePreviewCard`; **not** `Alert`/`window.confirm`) with the exact confirm copy and buttons "Delete account" / "Cancel". Error text uses the `settings-backup-error` style. testIDs prefixed `settings-account-`.

- [ ] **Step 1: Failing tests:**
  - `AccountProvider`: `signed out: no fetch on mount` (fetch spy called 0 times, native and web); `signed in: loads account`; `session_ended moves to signed_out with the message`; web `reads ?signin=failed and clears it from the URL`.
  - `AccountSettingsSection`: `signed out shows only the sign-in button and caption`; `signed in lists devices and marks this device`; `Remove calls removeDevice with that id`; `Sync now is disabled with the caption`; `Delete account asks first, with the exact copy`; `paused error shows the paused copy`.
  - `settings/index.test.tsx` is an existing test: run it unchanged; it must still pass (signed-out default renders one extra row only).
- [ ] **Step 2:** Run → FAIL. Implement. Run full mobile suite `npm test -- --ci`, `npm run lint`, `npm run typecheck` → green.
- [ ] **Step 3: Verify on web locally:** `npm run build:web` + `wrangler dev` in `backend/` with `.dev.vars` (operator creates it from the Google web client — no secrets in chat). Sign in with Google at `http://localhost:8787/settings`, see the device, sign out, sign in again, Sign out everywhere, Delete account; local progress (Stats) unchanged after each.
- [ ] **Step 4: Commit** `feat(mobile): account settings section and web cookie session`.

### Task 14: Repo hardening

**Files:** Create `SECURITY.md`, `.github/CODEOWNERS`; Modify `.github/workflows/ci.yml`, `.github/workflows/compile-curriculum.yml`

- [ ] **Step 1:** `SECURITY.md`: how to report (GitHub private vulnerability reporting, link `https://github.com/riyaz942/PakaPaka/security/advisories/new`), scope (backend, web app, mobile app), what never reaches the server (BYOK keys, conversations), response target in plain words.
- [ ] **Step 2:** `CODEOWNERS`: `/backend/ @riyaz942` and `/.github/ @riyaz942`.
- [ ] **Step 3:** Both workflows: top-level `permissions: contents: read`. Pin every `uses:` to a full commit SHA with the tag in a trailing comment (resolve with `gh api repos/<owner>/<action>/git/ref/tags/<tag>`; dereference annotated tags). Covers `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/setup-python@v5`.
- [ ] **Step 4: Verify:** `grep -n "uses:" .github/workflows/*.yml` shows only 40-char SHAs; push the branch and confirm CI passes (operator approves the push).
- [ ] **Step 5: Commit** `chore: SECURITY.md, CODEOWNERS, least-privilege pinned workflows`.
- [ ] **Step 6 (operator, GitHub settings):** turn on secret scanning, push protection, private vulnerability reporting (Settings → Code security). Ask before running any `gh api` that changes settings.

### Task 15: Product-rule docs

**Files:** Modify `CLAUDE.md`, `docs/design/backup-and-web-plan.md` (§A3, §B3.6, §B4), `docs/working-history.md`, `backend/README.md` (create)

- [ ] **Step 1:** `CLAUDE.md`: replace "no accounts" with "optional Google sign-in for sync (no account needed)"; add a `backend/` line to Commands (`cd backend && npm test`) and a Hard-conventions line: "Server never receives BYOK keys, AI conversations or email; never log tokens"; note AI Conversation is no longer the only network feature (sign-in/sync too).
- [ ] **Step 2:** `backup-and-web-plan.md`: §A3 — strike "cloud sync, accounts, or a server" with a pointer to the 2026-11-04 spec; §B3.6 and §B4 — mark PWA/offline shell and "no OTA on web" as replaced by the web app spec.
- [ ] **Step 3:** `working-history.md`: Part 2 status (what is built, what is deployed), and a **release blocker** line: "iOS: App Store 4.8 requires Sign in with Apple next to Google — add Apple or turn sign-in off on iOS before the next App Store / external TestFlight build."
- [ ] **Step 4:** `backend/README.md`: what the Worker does, local dev (`.dev.vars` keys list, `wrangler dev`, Google redirect URI for localhost), tests, deploy, the secret names.
- [ ] **Step 5: Commit** `docs: optional accounts replace the no-server rule; Part 2 status`.

### Task 16: Cloudflare resources, secrets, deploy (operator-gated)

Every step below needs the operator's yes first. Ask once per step; show the exact command.

- [ ] **Step 1 (operator):** Turnstile widget for `paka-paka.app` (managed mode) → site key (public, may be sent in chat) into `vars.TURNSTILE_SITE_KEY`.
- [ ] **Step 2 (ask):** `npx wrangler d1 create pakapaka` → put `database_id` in `wrangler.jsonc`; `npx wrangler r2 bucket create pakapaka-progress`.
- [ ] **Step 3 (ask):** `npx wrangler d1 migrations apply pakapaka --remote`.
- [ ] **Step 4 (operator):** Email Routing on `paka-paka.app` with a verified destination address; create a read-only API token (Account Analytics: Read); fill `USAGE_ALERT_EMAIL`, `CF_ACCOUNT_ID`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_IDS` vars.
- [ ] **Step 5 (operator runs each, in `backend/`):** `npx wrangler secret put SESSION_SIGNING_KEY` (value: `openssl rand -base64 48`), `HMAC_KEY` (same), `GOOGLE_WEB_CLIENT_SECRET`, `TURNSTILE_SECRET`, `CF_ANALYTICS_TOKEN`. Verify with `npx wrangler secret list` (names only).
- [ ] **Step 6 (ask):** `cd mobile && npm run deploy:web`.
- [ ] **Step 7: Smoke test on https://paka-paka.app:** landing `/` and app routes still load, `crossOriginIsolated === true`; `curl https://paka-paka.app/api/nope` → 404 JSON; signed-out Settings shows only "Sign in to sync"; Google sign-in on web; devices; Sign out everywhere; Delete account; 11 rapid `POST /api/auth/nonce` → 429 on the 11th; trigger the cron once (`npx wrangler triggers` / dashboard "Trigger" — ask) and confirm the email or no-email outcome is as expected.
- [ ] **Step 8 (operator):** dev-client rebuild on a real Android and iPhone (`eas build --profile development` or local); sign in with Google on each; see all devices from web; remove the phone from web → within 15 minutes (next refresh) the phone's account section shows signed out.
- [ ] **Step 9:** Update `docs/working-history.md` with the deployed date and results. Commit `docs: Part 2 deployed`.
