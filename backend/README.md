# backend

Cloudflare Worker for PakaPaka. It serves the web app and the sign-in API.

## What the Worker does

- Serves the web build (`mobile/dist`) as static assets. Only `/api/*` and `/auth/*` run Worker code first.
- Signs users in with Google, on web and on mobile.
- Keeps users, identities, sync state and hashed refresh tokens in D1.
- Gives each device a 15-minute access token and a 60-day rotating refresh token. If a refresh token is used twice, the Worker revokes that device.
- Limits auth requests per IP. Sends a daily usage-watch email. Sets a strict CSP.

The server never receives BYOK keys or AI conversations. The server never stores, logs or uses your email. On mobile, the Google sign-in token can contain it; the server reads only the account ID (`sub`). Web sign-in asks only for `openid`. It never logs tokens, ID tokens, request bodies or auth headers.

## Routes

| Route | Use |
|---|---|
| `GET /auth/signin` | Sign-in page (Turnstile check) |
| `GET /auth/signin.js` | Script for the sign-in page |
| `POST /api/auth/web/start` | Web: start Google sign-in (PKCE) |
| `GET /api/auth/google/callback` | Web: Google redirect target; sets HttpOnly cookies |
| `POST /api/auth/nonce` | Mobile: get a nonce |
| `POST /api/auth/exchange` | Mobile: swap a Google ID token for access + refresh tokens |
| `POST /api/auth/refresh` | Rotate the refresh token |
| `POST /api/auth/signout` | Sign out this device |
| `GET /api/account` | Account and device list |
| `DELETE /api/account/devices/:id` | Remove one device |
| `POST /api/account/signout-all` | Sign out every device |
| `DELETE /api/account` | Delete the account |
| `GET /api/sync?have=<revision>` | Download the progress file. `204` when the server has no newer file. `X-Sync-Revision` gives the server revision |
| `PUT /api/sync?base_revision=<revision>` | Upload the progress file (gzip). `409 revision_conflict` when `base_revision` is not the server revision |

The progress files are in R2 at `progress/<userId>/<revision, 10 digits>-<uuid>.json.gz`. D1 `sync_state` holds the current revision and `object_key`, the key of the current file.

`PUT /api/sync` checks only the size (2,000,000 bytes), the gzip header and the envelope (the first 4,096 compressed bytes). A body with no valid envelope in its head gets `400`, not a hang. The client checks the full shape of every file it uploads or downloads.

`DELETE /api/account` lists and deletes `progress/<userId>/` twice: before and after it deletes the user rows. A `PUT` that races the delete leaves no file.

Recovery: the previous 3 files stay in R2. To restore one, copy it to a new key and set `sync_state.object_key` and a **higher** `revision` by hand; never reuse a revision number. Name the new key with the new revision (`progress/<userId>/<new revision, 10 digits>-<uuid>.json.gz`): the prune reads the 10-digit prefix.

A cron trigger (`0 1 * * *`) runs the usage watch.

## Local development

Install with `npm ci`.

Known issue: plain `npm install` crashes on npm 10.9.x (a vitest 4 / arborist bug). Use `npm ci`. To change dependencies, use npm 11.

Create `backend/.dev.vars`. It is gitignored. Never commit it. Never put real values in docs.

```
SESSION_SIGNING_KEY=
HMAC_KEY=
GOOGLE_WEB_CLIENT_SECRET=
TURNSTILE_SECRET=
CF_ANALYTICS_TOKEN=
USAGE_ALERT_EMAIL=
CF_ACCOUNT_ID=
```

Values in `.dev.vars` override `vars` in `wrangler.jsonc`. For a local run, also set these there: `APP_ORIGIN=http://localhost:8787`, `GOOGLE_WEB_CLIENT_ID`, `TURNSTILE_SITE_KEY`.

For Turnstile, use the Cloudflare "always passes" test keys: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`. They work only on a local run.

In the Google Cloud console, add this redirect URI to the web client: `http://localhost:8787/api/auth/google/callback`.

Run it:

```bash
cd ../mobile && npm run build:web     # builds mobile/dist
cd ../backend
npx wrangler d1 migrations apply pakapaka --local
npx wrangler dev                      # http://localhost:8787
```

## Tests

```bash
npm test               # vitest in the Workers runtime
npm run typecheck
npm run check:tokens   # fails if src/tokenCss.generated.ts is stale
npm run gen:tokens     # rebuild it from mobile/src/global.css
```

## Deploy

Deploy goes through the mobile package, so the web build is fresh:

```bash
cd mobile && npm run deploy:web
```

Never run `wrangler deploy` on its own. It would publish an old `mobile/dist`.

Set each secret once with `npx wrangler secret put <NAME>`:

- `SESSION_SIGNING_KEY`
- `HMAC_KEY`
- `GOOGLE_WEB_CLIENT_SECRET`
- `TURNSTILE_SECRET`
- `CF_ANALYTICS_TOKEN`
- `USAGE_ALERT_EMAIL` (the operator's own address — kept out of git)
- `CF_ACCOUNT_ID`

Do not add `USAGE_ALERT_EMAIL` or `CF_ACCOUNT_ID` to `vars` in `wrangler.jsonc`: a secret and a var with the same name conflict. The public values (`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_IDS`, `TURNSTILE_SITE_KEY`) and the D1 `database_id` stay in `wrangler.jsonc`.
