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

Fill the empty `vars` in `wrangler.jsonc` (`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_IDS`, `TURNSTILE_SITE_KEY`, `USAGE_ALERT_EMAIL`, `CF_ACCOUNT_ID`) and the D1 `database_id` after you create the Cloudflare resources.
