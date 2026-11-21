# Web app Part 4 — Curriculum updates from R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phones and the web app install new curriculum releases from R2. Each release is signed offline with the operator's Ed25519 key, and the app rejects a manifest that is unsigned, tampered, signed with an unknown key, or made for a different curriculum schema.

**Architecture:** The operator runs a release script on their Mac. The script signs a small manifest for the committed seed `curriculum.db`, then uploads the file and the manifest to a new R2 bucket with `wrangler`. The Worker serves both at `/api/curriculum/*` with no auth. The app verifies the signature with public keys bundled in the app (pure function in `mobile/src/core/curriculum/`). Then it downloads the file, checks SHA-256, and swaps `curriculum.db`. Native uses the existing file swap. Web loads the bytes into memory and copies them into the OPFS `curriculum.db` in one SQLite backup transaction.

**Tech Stack:** Node 22 `node:crypto` (Ed25519 sign, scripts); `@noble/curves` (Ed25519 verify, mobile, new dependency); `better-sqlite3` (scripts, exists); Cloudflare Workers + R2 (existing Worker `pakapaka-web`); Vitest 4 + `@cloudflare/vitest-plugin`; Expo 55 / RN 0.83, `expo-sqlite` 55 (`deserializeDatabaseAsync`, `backupDatabaseAsync`), `expo-file-system/legacy`, `expo-crypto`; Jest (`jest-expo` in `mobile/`, `ts-jest` at the repo root).

**Spec:** `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md`, Part 4 (read "Anti-goals" and "Existing work to build on" too). Also read `docs/design/curriculum-schema-migration-plan.md` Phases B and D: this plan does Phase D steps 1, 2 and 4 in part (see Findings 6). The spec wins where this plan is silent. Where this plan differs from the spec, "Approved decisions" or "Findings" lists the difference.

**Start state:** branch `part4-curriculum-r2`, made from `main` at `54e445e5` (Parts 1–3 merged; Part 3 is PR #25). Do not change Part 3 sync code (`mobile/src/core/sync/`, `mobile/src/data/sync/`, `SyncProvider`, `SyncGate`, `backend/src/routes/sync.ts`).

## Global Constraints

- **Never write to `curriculum.db` except by the verified swap.** A failed or interrupted update leaves the current curriculum working. An update never touches `user.db` rows except the three install preferences (`installed_curriculum_version`, `installed_curriculum_content_hash`, `curriculum_update_source`) that it writes after a good swap.
- **Offline-first:** no network or a failed check → the app works with the curriculum it has. No error banner, no new copy. The only UI is the existing dashboard banner `Curriculum updated — fresh content is live.` after a good swap (native and web).
- **No silent fallback paths.** There is one manifest URL. The `__DEV__` mock manifest, the `bundled://` download branches, the placeholder `https://example.invalid/...`, `extra.curriculumManifestUrl` and `EXPO_PUBLIC_CURRICULUM_MANIFEST_URL` are removed. The only override is the existing build-time `EXPO_PUBLIC_API_BASE_URL` (`mobile/src/config/api.ts`).
- **The private signing key never goes into git, the Worker, wrangler secrets, CI, or a chat.** It lives at `~/.pakapaka-keys/curriculum-k1.pem` on the operator's Mac (mode 600). The recovery key `k2` lives only in the operator's password manager. Scripts never print a private key or its path contents. Public keys are not secret and may be shown.
- **The Worker only serves files.** No signing, no key, no auth, no cookies read, no logging on curriculum routes. Never log tokens, request bodies or auth headers.
- **No account data in curriculum requests.** Web curriculum `fetch` calls use `credentials: 'omit'` (the access cookie `__Host-pp_at` has `Path=/`). Native calls add no auth header.
- **Mobile:** fallible ops return `Result<T, AppError>` (`mobile/src/types/result.types.ts`); no throws across async boundaries. Platform differences through `mobile/src/platform/capabilities.ts`, never try/catch. No new UI, so no new NativeWind tokens.
- **Versions are whole numbers.** Install only when the signed `version` > the installed `curriculum_metadata.version` (`isCurriculumVersionNewer`).
- **Schema rule:** the app reads only `/api/curriculum/s<REQUIRED_CURRICULUM_SCHEMA_VERSION>/manifest.json` and accepts only a payload whose `schema` equals that number. `CURRICULUM_SCHEMA_VERSION` (scripts) and `REQUIRED_CURRICULUM_SCHEMA_VERSION` (mobile) start at `1` and must be equal (a root test checks this).
- Backend never imports from `mobile/`; mobile never imports from `backend/` or `scripts/`. Scripts may **read** `mobile/src/config/curriculum-signing-keys.json` and `mobile/src/data/curriculum/curriculumConfig.ts` as files.
- **Existing tests stay unchanged and green, except these named edits:** `mobile/src/data/curriculum/curriculumUpdate.test.ts` (rewritten in Task 5 for signed manifests, no `bundled://` path), `mobile/src/providers/DatabaseProvider.test.tsx` (case `skips the curriculum update on web` replaced in Task 6), `mobile/src/platform/capabilities.test.ts` (`supportsCurriculumOta` removed, new capability case in Task 5), `mobile/__mocks__/expo-sqlite.ts` (add `isInTransactionAsync` only if missing, Task 5).
- **Stop and ask the operator before:** making the R2 bucket or any Cloudflare setting, making a signing key, any `wrangler deploy` / `npm run deploy:web`, the first signed upload. These steps are marked **(operator)**. Never ask for a private key or a secret value.

## Approved decisions (operator, 2026-11-19)

**1. Bucket and paths.** New R2 bucket `pakapaka-curriculum`, Worker binding `CURRICULUM`. R2 keys: `s<schema>/manifest.json` and `files/<sha256>.db` (named by content, never overwritten). URLs: `GET /api/curriculum/s<schema>/manifest.json` and `GET /api/curriculum/files/<sha256>.db`. `/api/*` is already in `run_worker_first`. Any other path or method under `/api/curriculum/` → `404 {"error":"not_found"}`.

**2. Manifest format and signed bytes.**

```json
{ "format": "pakapaka-curriculum-manifest", "formatVersion": 1,
  "keyId": "k1", "payload": "<base64>", "signature": "<base64 of 64 bytes>" }
```

- Signed bytes = exactly the bytes that base64-decoding `payload` gives.
- Payload = UTF-8 JSON with this key order: `{"schema":1,"version":54,"sha256":"<64 lowercase hex>","size_bytes":12582912,"published_at":"2026-11-20T10:00:00.000Z"}`.
- The app checks in this order: envelope shape → key for `keyId` → signature → payload JSON and field types → `schema` equals the app's schema → `version` newer. Then it builds the file URL itself: base + `/api/curriculum/files/<sha256>.db`. After the download: SHA-256 equals `sha256`, and the file's `curriculum_metadata.version` equals `String(version)`.

**3. Upload path.** A manual script on the operator's Mac (`npm run release-curriculum`), not CI. It releases the **committed seed** `mobile/assets/curriculum-seed/curriculum.db`. It uploads the file first and the manifest last, then checks the live result.

**4. Key rotation.** The app trusts two public keys from day one: `k1` (signs each release) and `k2` (recovery, kept offline). k1 lost → sign with k2, no app update. k1 leaked → sign with k2 and ship app and web builds without k1. Both lost → ship an app update with new keys; old apps keep their curriculum.

**5. Version and compatibility.** See Global Constraints "Schema rule". Raise `CURRICULUM_SCHEMA_VERSION` and `REQUIRED_CURRICULUM_SCHEMA_VERSION` together, in one commit, when `CURRICULUM_DDL` changes in a way that a query can observe (the rule of `curriculum-schema-migration-plan.md` Phase B step 4).

**6. Web check.** Once per page load, after the databases open (native: once per cold start, as today). Web downloads into memory, verifies, loads the bytes with `deserializeDatabaseAsync`, probes them, then closes and detaches the curriculum and copies the bytes with `backupDatabaseAsync` into `curriculum.db` (one SQLite transaction; the OPFS pool VFS keeps a rollback journal). **Swap gate (native and web):** the swap waits while a lesson or review layout is mounted, and is deferred to the next start when `user.db` is inside a transaction.

**7. Cache.** Manifest `Cache-Control: public, max-age=300`. Files `Cache-Control: public, max-age=31536000, immutable`. 404 → `Cache-Control: no-store`. No Worker Cache API, no stored "last check" time. The script never deletes R2 objects.

**8. Dev mock and placeholder.** Both go (Global Constraints). The `__DEV__` "any network" download rule also goes: native downloads only on Wi-Fi in every build. `curriculum-mock-update.db` stays as a test fixture only.

## Findings made while planning (operator: review these)

1. **The spec says "manifest semver"; versions are whole numbers** (`scripts/compile-curriculum.ts` adds 1 to `curriculum/metadata.json` on each compile).
2. **The CI artifact is not a release.** CI compiles in its own working copy, so `dist/curriculum.db` from `compile-curriculum.yml` has an uncommitted version N+1 that the next real compile also uses. Releases come from the committed seed only. CI is not changed.
3. **Web needs its own install path.** `downloadAsync` and base64 file hashing do not exist on web, and `expo-network` on web reports type `UNKNOWN`, which fails the Wi-Fi rule. New capability `curriculumDownloadNeedsWifi()` (native only).
4. **On web, the signature stops only R2 tampering.** The web JS (with the public keys) comes from the same Cloudflare account. An attacker who controls the account can change the JS. The spec's promise ("a compromised Cloudflare account cannot sign a bad curriculum") holds fully for phones only.
5. **Native OTA has never run in production** (the placeholder URL). Part 4 makes the live swap real for the first time. That is the reason for the swap gate (decision 6).
6. **Overlap with `curriculum-schema-migration-plan.md` Phase D.** Done here: schema in the manifest and no download for a different schema (Phase D steps 1–2), and the release script publishes the schema from `scripts/curriculum-schema.ts` (step 4 in part). **Not done here:** step 3 (re-check `schema_version` inside the downloaded file; this needs Phase B, which adds the column) and the Settings notice "New content is available. Update the app to get it." (an old app reads only its own `s<N>` manifest, so it cannot see a newer schema). When Phase B lands, the release script reads the schema from the file and the app re-checks it in the probe.
7. **Sync interplay.** After a swap, items that became known get their synced rows at the next sync trigger (Part 3 behavior). Nothing in Part 4 starts a sync.
8. **Before the first release (operator):** confirm that the oldest app build in use can read the seed at `main`. After that, schema 1 is fixed.

## Cost

Per app start: 1 Worker request + 1 R2 Class B read (manifest, about 400 bytes). 1,000 daily users × 3 starts ≈ 3,000 requests/day (3% of the Workers free 100k/day) and ≈ 90k R2 reads/month (1% of 10M). Each install downloads about 12 MB once (R2 egress is free). Each release stores about 12 MB (10 GB holds about 800). Workers free plan fails closed: a used-up day makes the manifest fetch fail, and the app treats that like offline. R2 has a payment method on the account (open point from Part 2), so R2 use past the free tier bills; this traffic is far below it. The existing usage watch counts R2 for the whole account, so the new bucket is included.

## Steps that need the operator

| When | What | How |
| --- | --- | --- |
| Before Task 2 Step 4 | **O1 — make the two signing keys** | On the Mac (not a web agent): commands in Task 2 Step 4. Paste only the two printed **public** keys into the chat. |
| Before Task 8 Step 2 | **O2 — make the R2 bucket** | Web agent, prompt P1 below. |
| Task 8 Step 2 | **O3 — deploy** | On the Mac: `cd mobile && npm run deploy:web`. Then web agent prompt P2 to check the binding. |
| Task 8 Step 3 | **O4 — phone build** | Dev-client or preview build for Android and iPhone with this branch. |
| Task 8 Step 5 | **O5 — first signed upload** | On the Mac: `CURRICULUM_SIGNING_KEY_FILE=~/.pakapaka-keys/curriculum-k1.pem npm run release-curriculum -- --key-id k1 --dry-run`, check the output, then the same command without `--dry-run`. Then web agent prompt P3. |

No Worker secret, no CI secret, no D1 change and no new rate limit is needed. If one becomes necessary, stop and ask.

### Prompts for the operator's web agent (Cloudflare dashboard)

Give these to the web agent as they are. They contain no secret. The web agent must not make API tokens or touch other resources.

**P1 — make the bucket**

```text
In the Cloudflare dashboard, for the account that owns the Worker "pakapaka-web" and the
R2 bucket "pakapaka-progress":
1. Go to R2 Object Storage → Overview → Create bucket.
2. Bucket name: pakapaka-curriculum
   Location: Automatic. Default storage class: Standard.
3. Create it. Do NOT turn on public access, the r2.dev subdomain, a custom domain, CORS,
   lifecycle rules, event notifications, or data catalog. Do NOT create an R2 API token.
4. Do not change any other bucket, Worker, D1 database, DNS record or setting.
Report back: the exact bucket name, that it shows 0 objects, and that "Public access" shows
as disabled (r2.dev subdomain off, no custom domain).
```

**P2 — check the binding after the deploy**

```text
In the Cloudflare dashboard, open Workers & Pages → pakapaka-web → Settings → Bindings.
Do not change anything. Report the full list of bindings with their type and target. I
expect: R2 bucket binding CURRICULUM → pakapaka-curriculum, R2 bucket binding PROGRESS →
pakapaka-progress, D1 binding DB → pakapaka, plus the existing rate limit, email and assets
bindings. Also report the "Deployments" tab's latest deployment time.
```

**P3 — check the objects after the first release**

```text
In the Cloudflare dashboard, open R2 Object Storage → pakapaka-curriculum → Objects.
Do not download, delete, rename or upload anything, and do not change any setting.
Report every object key with its size and upload time. I expect exactly two objects:
"s1/manifest.json" (well under 1 KB) and "files/<64 hex characters>.db" (about 12 MB).
```

## Review Focus

1. **Interrupted download** (network drops, app killed, tab closed during the 12 MB download): nothing is swapped, the current curriculum works, the temp file is deleted (native), the next start tries again. → Task 5 test `a failed download leaves the prior curriculum and deletes the temp file`; Task 6 test `a failed file fetch changes nothing`; Task 8 Step 6 (live).
2. **Bad hash** (file in R2 differs from the signed `sha256`): no swap. → Task 5 test `leaves prior curriculum when the checksum does not match`; Task 6 test `a hash mismatch changes nothing and closes nothing`.
3. **Bad, missing or wrong-key signature** (attacker edits the manifest in R2, or signs with their own key under `keyId` `k1`): the manifest is rejected **before any file request**. → Task 2 verify tests; Task 5 test `a rejected manifest makes no file request`; Task 6 test of the same name; Task 7 local checks.
4. **Old app + new curriculum, or a replayed old manifest:** a payload with another `schema` → no download; a `version` that is not newer → no download; a file whose `curriculum_metadata.version` differs from the signed version → rejected before the swap. → Task 2 test `rejects a payload for another schema`; Task 5 tests `an older signed manifest is ignored` and `rejects a file whose version differs from the signed version`.
5. **Web tab busy during the swap:** a lesson or review is open → the swap waits until it closes; `user.db` is in a transaction (a sync run) → deferred to the next load, nothing closed; the backup copy fails → the old curriculum is reopened and attached again; the tab closes during the copy → SQLite's journal rolls the copy back at the next open. → Task 5 gate tests; Task 6 tests `waits for the swap gate`, `user.db in a transaction defers the swap`, `a failed copy reopens and attaches the old curriculum`; Task 7 Step 4 (Chrome, real OPFS).

---

## File Structure

```
scripts/
  curriculum-schema.ts          + export CURRICULUM_SCHEMA_VERSION = 1
  curriculum-release.ts         pure: payload encode, sign, verify, key helpers, release checks
  curriculum-release.test.ts
  curriculum-keygen.ts          CLI: make a key file, print the public key
  release-curriculum.ts         CLI: sign + upload + live check
  __fixtures__/curriculum-signed-manifest.json   fixed test manifest (test key, not a real key)
package.json                    + scripts "curriculum-keygen", "release-curriculum"
backend/
  src/routes/curriculum.ts      handleCurriculum()
  src/index.ts, src/env.ts      + route, + CURRICULUM binding
  wrangler.jsonc, vitest.config.ts   + r2 bucket CURRICULUM
  test/curriculum.test.ts
  README.md                     + routes, R2 layout
mobile/
  src/config/curriculum-signing-keys.json   { "k1": "<base64>", "k2": "<base64>" } (public)
  src/core/curriculum/manifestSignature.ts  verifySignedManifest()
  src/core/curriculum/manifestSignature.test.ts
  src/data/curriculum/curriculumConfig.ts   REQUIRED_CURRICULUM_SCHEMA_VERSION, URLs; mock + placeholder removed
  src/data/curriculum/curriculumManifest.types.ts   CurriculumRelease, CheckAndApplyCurriculumUpdateResult
  src/data/curriculum/curriculumUpdate.ts   native: signed manifest, version probe, gate, no bundled path
  src/data/curriculum/curriculumUpdate.web.ts        web: in-memory download + backup copy
  src/data/curriculum/curriculumUpdate.web.test.ts
  src/data/curriculum/curriculumSwapGate.ts (+ test)
  src/hooks/useHoldCurriculumSwap.ts
  src/app/lesson/_layout.tsx, src/app/review/_layout.tsx   + useHoldCurriculumSwap()
  src/platform/capabilities.ts  − supportsCurriculumOta, + curriculumDownloadNeedsWifi
  src/providers/DatabaseProvider.tsx         runs the check on web too
  assets/curriculum-manifest/mock-manifest.json   deleted; README.md rewritten
docs/curriculum-releases.md     operator runbook (keys, release, rotation)
```

---

### Task 1: Signing helpers, schema constant and key generator (scripts, test-first)

**Files:**
- Modify: `scripts/curriculum-schema.ts` (export `CURRICULUM_SCHEMA_VERSION = 1` next to `CURRICULUM_DDL`, with the Phase B rule as a comment), `package.json` (script `"curriculum-keygen": "tsx scripts/curriculum-keygen.ts"`)
- Create: `scripts/curriculum-release.ts`, `scripts/curriculum-keygen.ts`, `scripts/__fixtures__/curriculum-signed-manifest.json`
- Test: `scripts/curriculum-release.test.ts`

**Interfaces:**
- Produces (`scripts/curriculum-release.ts`):
  - `type ManifestPayload = { schema: number; version: number; sha256: string; size_bytes: number; published_at: string }`
  - `type SignedManifest = { format: 'pakapaka-curriculum-manifest'; formatVersion: 1; keyId: string; payload: string; signature: string }`
  - `encodePayload(p: ManifestPayload): Buffer` — `JSON.stringify` with the key order of Approved decisions 2, UTF-8.
  - `signManifest(p: ManifestPayload, keyId: string, privateKey: KeyObject): SignedManifest` — `crypto.sign(null, encodePayload(p), privateKey)`.
  - `verifyManifest(raw: unknown, publicKeys: Record<string, string>): ManifestPayload` — throws `Error` with a short reason (`unknown key`, `bad signature`, `bad envelope`, `bad payload`). Same check order as the app, without the schema and version checks.
  - `publicKeyBase64(key: KeyObject): string` — the raw 32-byte public key as standard base64 (from `key.export({ format: 'jwk' }).x`, base64url → base64).
  - `publicKeyFromBase64(b64: string): KeyObject` — `createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' })`.
  - `readSigningKeys(repoRoot: string): Record<string, string>` — reads `mobile/src/config/curriculum-signing-keys.json`.
- Produces (`scripts/curriculum-keygen.ts`): CLI `npm run curriculum-keygen -- --out <path>`. Refuses if `<path>` exists. Creates the parent folder with mode `0o700`. Writes the private key as PKCS#8 PEM with mode `0o600` (`writeFileSync(path, pem, { mode: 0o600, flag: 'wx' })`). Prints only `Public key: <base64>`. Never prints the PEM.
- Fixture: `curriculum-signed-manifest.json` = `signManifest(FIXTURE_PAYLOAD, 'test', FIXTURE_KEY)`, where `FIXTURE_KEY` is the Ed25519 key from the 32-byte seed `0x01` repeated 32 times (`createPrivateKey` from JWK with `d` = that seed and `x` = its public key) and `FIXTURE_PAYLOAD = { schema: 1, version: 54, sha256: 'ab'.repeat(32), size_bytes: 1024, published_at: '2026-11-20T00:00:00.000Z' }`. The file also has a top-level field `"_testPublicKey": "<base64>"` that the verifiers ignore. Ed25519 is deterministic, so the file is stable. Task 2 verifies it with the mobile code: this proves that both implementations agree on the bytes.

- [ ] **Step 1: Failing tests** (`scripts/curriculum-release.test.ts`, keys from `generateKeyPairSync('ed25519')`):
  - `sign then verify returns the payload`.
  - `encodePayload keeps the key order` → `'{"schema":1,"version":54,"sha256":"…","size_bytes":1024,"published_at":"…"}'`.
  - `verify rejects a manifest with no signature` (`bad envelope`); `rejects one changed byte in the payload` (`bad signature`); `rejects one changed byte in the signature`; `rejects a manifest signed by another key under keyId k1`; `rejects an unknown keyId`; `rejects format or formatVersion that differ`; `rejects a payload that is not JSON` (signed garbage bytes → `bad payload`); `rejects a sha256 that is not 64 lowercase hex`; `rejects a version that is not a positive integer`.
  - `publicKeyBase64 round-trips through publicKeyFromBase64`.
  - `the committed fixture equals signManifest(FIXTURE_PAYLOAD, 'test', FIXTURE_KEY)` and `its _testPublicKey equals publicKeyBase64(FIXTURE_KEY)`.
  - `CURRICULUM_SCHEMA_VERSION is 1`.
- [ ] **Step 2:** Run `npx jest scripts/curriculum-release.test.ts` at the repo root → FAIL.
- [ ] **Step 3:** Implement `curriculum-release.ts`, the schema constant and the fixture (write it with a one-off `tsx` call to `signManifest`; commit the output, not the one-off code). Implement `curriculum-keygen.ts`.
- [ ] **Step 4:** Run the same command → PASS. Run `npm test` at the root → green. Run `npm run curriculum-keygen -- --out "$TMPDIR/pp-test-key.pem"` → prints one `Public key:` line; `stat -f %Lp "$TMPDIR/pp-test-key.pem"` → `600`; a second run → refuses. Delete the test file.
- [ ] **Step 5: Commit** `feat(curriculum): Ed25519 manifest signing helpers and key generator`.

### Task 2: Manifest verification in the app (pure, test-first)

**Files:**
- Create: `mobile/src/core/curriculum/manifestSignature.ts`, `manifestSignature.test.ts`, `mobile/src/config/curriculum-signing-keys.json`, `scripts/curriculum-schema-sync.test.ts`
- Modify: `mobile/package.json` (dependency `@noble/curves`), `mobile/src/data/curriculum/curriculumConfig.ts` (only add `export const REQUIRED_CURRICULUM_SCHEMA_VERSION = 1;` in this task)

**Interfaces:**
- Consumes: the fixture of Task 1 (read with `require('../../../../scripts/__fixtures__/curriculum-signed-manifest.json')` in the test only).
- Produces (`manifestSignature.ts`):
  - `type CurriculumRelease = { schema: number; version: number; sha256: string; sizeBytes: number; publishedAt: string; keyId: string }` (exported from `mobile/src/data/curriculum/curriculumManifest.types.ts`; this task adds it there and leaves the old type for Task 5 to remove).
  - `verifySignedManifest(raw: unknown, keys: Readonly<Record<string, string>>, requiredSchema: number): Result<CurriculumRelease, AppError>` — order and error codes:
    1. envelope not an object / `format` ≠ `'pakapaka-curriculum-manifest'` / `formatVersion` ≠ `1` / `keyId`, `payload` or `signature` not a string → `CURRICULUM_MANIFEST_INVALID`
    2. `keys[keyId]` missing → `CURRICULUM_SIGNATURE_INVALID`
    3. base64 decode of payload, signature (must be 64 bytes) or key (must be 32 bytes) fails → `CURRICULUM_SIGNATURE_INVALID`
    4. `ed25519.verify(signature, payloadBytes, publicKey)` false → `CURRICULUM_SIGNATURE_INVALID`
    5. payload bytes are not UTF-8 JSON, or a field has the wrong type (`schema` and `version` positive integers, `sha256` `/^[a-f0-9]{64}$/`, `size_bytes` integer ≥ 0, `published_at` string) → `CURRICULUM_MANIFEST_INVALID`
    6. `schema !== requiredSchema` → `CURRICULUM_SCHEMA_MISMATCH`
  - Base64 decode: write a small decoder with `globalThis.atob` (Hermes and browsers have it). Never `Buffer`.
  - `SIGNING_KEYS` — the parsed `curriculum-signing-keys.json` (`{ "k1": "<base64>", "k2": "<base64>" }`), exported from `manifestSignature.ts`.
- Produces: `scripts/curriculum-schema-sync.test.ts` — reads `mobile/src/data/curriculum/curriculumConfig.ts` as text, extracts `REQUIRED_CURRICULUM_SCHEMA_VERSION = (\d+)`, expects it to equal `CURRICULUM_SCHEMA_VERSION`.

- [ ] **Step 1: Failing tests** (`manifestSignature.test.ts`; test keys and signatures are made with `node:crypto` `generateKeyPairSync('ed25519')` and `sign(null, …)`, so the test also proves that `node:crypto` signatures verify with `@noble/curves`):
  - `accepts a good manifest` → `ok`, and every field of `CurriculumRelease` (`sizeBytes` from `size_bytes`, `publishedAt` from `published_at`, `keyId`).
  - `accepts the scripts fixture with its _testPublicKey` (keys `{ test: fixture._testPublicKey }`).
  - `rejects an unsigned manifest` (no `signature`) → `CURRICULUM_MANIFEST_INVALID`.
  - `rejects a tampered payload` (decode, change `"version":54` to `"version":99`, encode again, old signature) → `CURRICULUM_SIGNATURE_INVALID`.
  - `rejects a tampered signature` (flip one bit) → `CURRICULUM_SIGNATURE_INVALID`.
  - `rejects a manifest signed by a wrong key` (signed by key B, `keyId: 'k1'` → key A) → `CURRICULUM_SIGNATURE_INVALID`.
  - `rejects an unknown keyId` → `CURRICULUM_SIGNATURE_INVALID`.
  - `rejects a 63-byte signature` → `CURRICULUM_SIGNATURE_INVALID`.
  - `rejects formatVersion 2` → `CURRICULUM_MANIFEST_INVALID`.
  - `rejects a signed payload with a bad sha256` → `CURRICULUM_MANIFEST_INVALID`.
  - `rejects a payload for another schema` (signed `schema: 2`, required 1) → `CURRICULUM_SCHEMA_MISMATCH`.
  - `checks the signature before it reads the payload` (signed garbage payload with a bad signature → `CURRICULUM_SIGNATURE_INVALID`, not `MANIFEST_INVALID`).
  - `the bundled keys file has k1 and k2, each 32 bytes`.
- [ ] **Step 2:** `cd mobile && npm install @noble/curves`. Run `npx jest src/core/curriculum` → FAIL. If Jest cannot load the package (ESM), add `@noble` to the existing `transformIgnorePatterns` exception list in `mobile/package.json`; change nothing else in the Jest config.
- [ ] **Step 3:** Implement with `import { ed25519 } from '@noble/curves/ed25519'` (use the subpath that the installed version exports).
- [ ] **Step 4 (operator O1 — make the keys; stop and ask).** Show the operator these commands, to run on their Mac at the repo root:

  ```bash
  npm run curriculum-keygen -- --out ~/.pakapaka-keys/curriculum-k1.pem
  npm run curriculum-keygen -- --out ~/.pakapaka-keys/curriculum-k2.pem
  ```

  Then the operator: (a) saves `~/.pakapaka-keys/curriculum-k1.pem` as an extra copy in their password manager; (b) saves `curriculum-k2.pem` in the password manager, checks that the entry opens, then deletes `~/.pakapaka-keys/curriculum-k2.pem` from the Mac; (c) pastes only the two `Public key:` lines into the chat. Write them into `curriculum-signing-keys.json` as `k1` and `k2`. Never ask for or accept a PEM.
- [ ] **Step 5:** Run `npx jest src/core/curriculum` → PASS; at the root `npx jest scripts/curriculum-schema-sync.test.ts` → PASS; in `mobile/` `npm run typecheck` → clean.
- [ ] **Step 6: Commit** `feat(curriculum): verify signed curriculum manifests in the app`.

### Task 3: Release script

**Files:**
- Create: `scripts/release-curriculum.ts`
- Modify: `scripts/curriculum-release.ts` (+ release checks), `scripts/curriculum-release.test.ts` (+ cases), `package.json` (script `"release-curriculum": "tsx scripts/release-curriculum.ts"`)

**Interfaces:**
- Consumes: Task 1 helpers, `CURRICULUM_SCHEMA_VERSION`.
- Produces (pure, in `curriculum-release.ts`):
  - `isSqliteFile(head: Buffer): boolean` — first 16 bytes equal `'SQLite format 3\0'` (a Git LFS pointer fails).
  - `checkNewerThanLive(newVersion: number, live: ManifestPayload | null): void` — throws `live version <n> is not older than <m>` when `live && live.version >= newVersion`.
  - `checkKeyMatches(privateKey: KeyObject, keyId: string, keys: Record<string, string>): void` — throws `keyId <id> is not in curriculum-signing-keys.json` or `the key file does not match <id>`.
  - `buildPayload(seed: { version: number; sha256: string; sizeBytes: number }, schema: number, now: Date): ManifestPayload`.
- Produces (CLI `npm run release-curriculum -- --key-id <id> [--dry-run]`, key path from env `CURRICULUM_SIGNING_KEY_FILE`, base URL `https://paka-paka.app`), in this order; any failure prints one line and exits 1 with nothing uploaded:
  1. `git status --porcelain -- mobile/assets/curriculum-seed` is empty (the seed is committed).
  2. `isSqliteFile` of the seed (else: `Run git lfs pull first.`).
  3. Read `SELECT version FROM curriculum_metadata` with `better-sqlite3` (`readonly: true`); must be a whole number. SHA-256 and size of the file bytes.
  4. `GET <base>/api/curriculum/s<schema>/manifest.json` with `cache: 'no-store'`: 404 → `live = null`; 200 → `verifyManifest` (failure stops: `The live manifest does not verify: <reason>`); other status → stop. Then `checkNewerThanLive`.
  5. Read the key file, `checkKeyMatches`, `buildPayload`, `signManifest`, `verifyManifest` of the result (self-check).
  6. Write `manifest.json` to `mkdtemp(os.tmpdir()/pakapaka-release-)`. Print version, sha256, size, keyId and the two upload commands.
  7. `--dry-run` → stop here (exit 0).
  8. Upload with `execFileSync('npx', ['wrangler', 'r2', 'object', 'put', 'pakapaka-curriculum/<key>', '--file', <path>, '--content-type', <type>, '--remote'], { cwd: 'backend', stdio: 'inherit' })`: first `files/<sha256>.db` (`application/vnd.sqlite3`), then `s<schema>/manifest.json` (`application/json`). No shell string.
  9. Live check: fetch the manifest again (`no-store`), `verifyManifest`, version equal; fetch the file, SHA-256 equal. Print `Release <version> is live.`
- The script never prints the key file contents and never deletes R2 objects.

- [ ] **Step 1: Failing tests:** `isSqliteFile accepts a SQLite header and rejects an LFS pointer` (`'version https://git-lfs…'`); `checkNewerThanLive: no live → ok; live 53, new 54 → ok; live 54, new 54 → throws; live 55, new 54 → throws`; `checkKeyMatches: right key → ok; other key under k1 → throws; unknown id → throws`; `buildPayload uses the schema and an ISO time`.
- [ ] **Step 2:** Run `npx jest scripts/curriculum-release.test.ts` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Check the dry run with a throwaway key** (not a real key): make a key with `curriculum-keygen` into `$TMPDIR`, add its public key to a **local, uncommitted** copy of the keys file under id `tmp`, run `CURRICULUM_SIGNING_KEY_FILE=$TMPDIR/… npm run release-curriculum -- --key-id tmp --dry-run` → prints the payload and the commands, uploads nothing. Before the deploy, the live Worker answers `404` for the unknown `/api/curriculum/` path, so the script treats it as a first release and continues to the dry-run stop. Then `git checkout mobile/src/config/curriculum-signing-keys.json` and delete the throwaway key.
- [ ] **Step 4: Commit** `feat(curriculum): release script that signs offline and uploads to R2`.

### Task 4: Worker routes

**Files:**
- Create: `backend/src/routes/curriculum.ts`, `backend/test/curriculum.test.ts`
- Modify: `backend/src/index.ts` (route), `backend/src/env.ts` (`CURRICULUM: R2Bucket`), `backend/wrangler.jsonc` (`r2_buckets` + `{ "binding": "CURRICULUM", "bucket_name": "pakapaka-curriculum" }`), `backend/vitest.config.ts` (`r2Buckets: ["PROGRESS", "CURRICULUM"]`), `backend/README.md`

**Interfaces:**
- Produces: `handleCurriculum(req: Request, env: Pick<Env, "CURRICULUM">): Promise<Response>`:
  - Only `GET`. Path `^/api/curriculum/s([1-9][0-9]{0,2})/manifest\.json$` → key `s<n>/manifest.json`, `Content-Type: application/json`, `Cache-Control: public, max-age=300`. Path `^/api/curriculum/files/([a-f0-9]{64})\.db$` → key `files/<hex>.db`, `Content-Type: application/vnd.sqlite3`, `Cache-Control: public, max-age=31536000, immutable`.
  - Both: body = the R2 object body (streamed), `Content-Length: <object.size>`, `ETag: <object.httpEtag>`, `X-Content-Type-Options: nosniff`.
  - Object missing, another method or another path → `errorResponse("not_found", 404)` with `Cache-Control: no-store`.
  - Reads no cookie and no header, logs nothing.
- `index.ts`: inside the `try`, before the auth rate-limit block: `if (pathname.startsWith("/api/curriculum/")) return await handleCurriculum(req, env);`.

- [ ] **Step 1: Failing tests** (`SELF.fetch`; seed objects with `env.CURRICULUM.put`):
  - `manifest: 200, the stored bytes, JSON type, max-age=300`.
  - `file: 200, the stored bytes, sqlite type, immutable cache, Content-Length`.
  - `missing manifest → 404 not_found with no-store`; `missing file → 404`.
  - `bad paths → 404`: `/api/curriculum/s0/manifest.json`, `/api/curriculum/s1/../manifest.json`, `/api/curriculum/files/ABC.db`, `/api/curriculum/files/<63 hex>.db`, `/api/curriculum/`, `/api/curriculum/s1/manifest.json/x`.
  - `POST and PUT → 404 and nothing written` (R2 list unchanged).
  - `works with no cookie and ignores a cookie and an Authorization header` (same bytes).
  - `does not read the progress bucket` (an object at `progress/u1/x` in `PROGRESS` is not served at `/api/curriculum/files/…`).
  - `no console output` (spy on `console.*` across a manifest and a file GET).
  - `curriculum requests do not use the auth rate limiter` (fake limiter as in `limits.test.ts`: 20 manifest GETs → all 200).
- [ ] **Step 2:** Run `cd backend && npm test` → FAIL. Implement. Run → PASS. `npm run typecheck` → clean.
- [ ] **Step 3:** `backend/README.md`: add the two routes, the bucket and key layout, the cache rules, and "The Worker never signs. Releases: `docs/curriculum-releases.md`."
- [ ] **Step 4: Commit** `feat(backend): serve signed curriculum releases from R2`.

> The bucket (O2) and the deploy (O3) are in Task 8. A deploy before O2 fails because the binding's bucket does not exist.

### Task 5: Native wiring — signed manifest, one URL, swap gate

**Files:**
- Create: `mobile/src/data/curriculum/curriculumSwapGate.ts` (+ `curriculumSwapGate.test.ts`), `mobile/src/hooks/useHoldCurriculumSwap.ts`
- Modify: `mobile/src/data/curriculum/curriculumConfig.ts`, `curriculumManifest.types.ts`, `curriculumUpdate.ts`, `curriculumUpdate.test.ts` (named edit), `mobile/src/platform/capabilities.ts` + `capabilities.test.ts` (named edit), `mobile/src/app/lesson/_layout.tsx`, `mobile/src/app/review/_layout.tsx`, `mobile/__mocks__/expo-sqlite.ts` (only `isInTransactionAsync`, if missing)
- Delete: `mobile/assets/curriculum-manifest/mock-manifest.json`

**Interfaces:**
- Consumes: `verifySignedManifest`, `SIGNING_KEYS`, `CurriculumRelease` (Task 2); `API_BASE_URL`.
- Produces (`curriculumConfig.ts`): `REQUIRED_CURRICULUM_SCHEMA_VERSION = 1`; `getCurriculumBaseUrl(): string` (`isWeb() ? '' : API_BASE_URL`); `getCurriculumManifestUrl(): string` (`<base>/api/curriculum/s1/manifest.json`, schema from the constant); `getCurriculumFileUrl(sha256: string): string` (`<base>/api/curriculum/files/<sha256>.db`). Remove `BUNDLED_MOCK_MANIFEST_SCHEME`, `BUNDLED_FIXTURE_SCHEME`, the `extra` and env lookups and the placeholder. File-system helpers stay.
- Produces (`curriculumManifest.types.ts`): remove `CurriculumManifest`; keep `CurriculumUpdateSource`; move `CheckAndApplyCurriculumUpdateResult` here from `curriculumUpdate.ts` (unchanged shape) so that the web module shares it.
- Produces (`capabilities.ts`): remove `supportsCurriculumOta`; add `curriculumDownloadNeedsWifi = (): boolean => !isWeb()` with the comment "expo-network on web has no connection type".
- Produces (`curriculumSwapGate.ts`): `holdCurriculumSwap(): () => void` (counter + 1; the returned release runs once only, counter − 1); `isCurriculumSwapHeld(): boolean`; `waitForCurriculumSwapAllowed(): Promise<void>` (resolves at once when the counter is 0, else when it next reaches 0); `resetCurriculumSwapGateForTests(): void`.
- Produces (`useHoldCurriculumSwap.ts`): `useHoldCurriculumSwap(): void` — `useEffect(() => holdCurriculumSwap(), [])`. Called once at the top of `LessonLayout` and `ReviewLayout` (signed in or not). No other change in those files.
- Changes in `curriculumUpdate.ts`:
  - `loadCurriculumManifest(): Promise<Result<CurriculumRelease, AppError>>` — `fetch(getCurriculumManifestUrl())`, non-200 → `CURRICULUM_MANIFEST_FETCH_FAILED`, then `verifySignedManifest(json, SIGNING_KEYS, REQUIRED_CURRICULUM_SCHEMA_VERSION)`. Remove `parseCurriculumManifest`, the mock `require`s and every `bundled://` branch, including the test-only fixture branch in `downloadManifestDatabase`.
  - `checkForCurriculumUpdate(localVersion: string): Promise<Result<CurriculumRelease | null, AppError>>` — a rejected manifest returns `{ ok: true, value: null }` (offline-first, no banner), with the existing `__DEV__` log naming the error code.
  - `canDownloadCurriculumUpdate()` — `!isConnected || isInternetReachable === false` → false; `curriculumDownloadNeedsWifi()` → require `WIFI`; else true. The `__DEV__` bypass is removed.
  - `downloadManifestDatabase(release)` downloads `getCurriculumFileUrl(release.sha256)`; a thrown download deletes the temp file (exists).
  - `validateDownloadedCurriculumFile(fileUri: string, release: CurriculumRelease)` — SHA-256 as today, then the probe version must equal `String(release.version)` → else `CURRICULUM_SQLITE_INVALID`.
  - `downloadAndSwapCurriculum(release, handles)` — after validation: `await waitForCurriculumSwapAllowed()`; then `await handles.userDb.isInTransactionAsync()` true → delete the temp file, return error `CURRICULUM_DOWNLOAD_DEFERRED` (maps to status `deferred`). Then the existing close → swap → reopen → attach → metadata (`contentHash: release.sha256`).

- [ ] **Step 1: Failing tests.**
  - `curriculumSwapGate.test.ts`: `not held → wait resolves at once`; `held → wait resolves only after release`; `two holds → resolves after both release`; `calling one release twice counts once`.
  - `capabilities.test.ts` (named edit): remove the `supportsCurriculumOta` cases; add `curriculumDownloadNeedsWifi is true on ios and android, false on web`.
  - `curriculumUpdate.test.ts` (named edit; rewrite the manifest parts, keep the `openCurriculumDatabase bundled import gating` block unchanged). Helpers in the test: a test key pair from `node:crypto`; `jest.mock('@/core/curriculum/manifestSignature', …)` that keeps the real `verifySignedManifest` and replaces only `SIGNING_KEYS` with `{ k1: <test public key> }`; `signedManifest({ version, sha256, schema? })`; `global.fetch` mocked to return it. The download source is seeded with `setMockFileContents(getCurriculumFileUrl(sha), fixtureBase64)` (the expo-file-system mock copies by URL).
    - `checkForCurriculumUpdate returns the release when the signed version is newer`; `returns null when local is already current`; `an older signed manifest is ignored` (signed 2, local 3 → null).
    - `a rejected manifest returns null and makes no file request` (tampered payload → `null`; `downloadAsync` spy not called).
    - `a manifest for another schema returns null`.
    - `checkForCurriculumUpdate requests the s1 manifest under API_BASE_URL` (`fetch` called with `https://paka-paka.app/api/curriculum/s1/manifest.json`).
    - `updates preferences and curriculum version on success` (as today, with a signed release for version `'2'` and the fixture hash; `contentHash` preference = the sha256).
    - `leaves prior curriculum when the checksum does not match` (as today).
    - `rejects a file whose version differs from the signed version` (signed version 3, fixture holds 2 → `CURRICULUM_SQLITE_INVALID`, version still `'1'`, temp file deleted).
    - `a failed download leaves the prior curriculum and deletes the temp file` (no seeded source → `CURRICULUM_DOWNLOAD_FAILED`, version `'1'`, temp absent).
    - `waits for the swap gate before closing the curriculum` (hold the gate; the swap promise is pending and `curriculumDb` is open; release → success).
    - `user.db in a transaction defers the swap` (`isInTransactionAsync` → true → `CURRICULUM_DOWNLOAD_DEFERRED`, version `'1'`, temp deleted).
    - `downloads only on Wi-Fi on native` (cellular → `canDownloadCurriculumUpdate` false; Wi-Fi → true).
  - Layouts: no new test; the existing lesson and review tests stay green unchanged.
- [ ] **Step 2:** Run `cd mobile && npx jest src/data/curriculum src/platform src/hooks` → FAIL. Implement. Delete `mock-manifest.json`. Run → PASS.
- [ ] **Step 3:** Run `npm test -- --ci`, `npm run typecheck`, `npm run lint` → green. `grep -rn "bundled://\|example.invalid\|EXPO_PUBLIC_CURRICULUM_MANIFEST_URL\|curriculumManifestUrl\|supportsCurriculumOta" src` → no hits.
- [ ] **Step 4: Commit** `feat(curriculum): signed manifest on native, one manifest URL, swap gate`.

### Task 6: Web background update

**Files:**
- Create: `mobile/src/data/curriculum/curriculumUpdate.web.ts`, `curriculumUpdate.web.test.ts`
- Modify: `mobile/src/providers/DatabaseProvider.tsx`, `mobile/src/providers/DatabaseProvider.test.tsx` (named edit)

**Interfaces:**
- Consumes: Task 2 and Task 5 (`verifySignedManifest`, `SIGNING_KEYS`, URLs, gate, `CheckAndApplyCurriculumUpdateResult`, `isCurriculumVersionNewer`, `canDownloadCurriculumUpdate` logic via `expo-network`), `reopenCurriculumDatabase`, `attachCurriculumForQuery`, `CURRICULUM_ATTACH_ALIAS`, `setCurriculumInstallMetadata`.
- Produces: `type WebCurriculumPorts = { fetchJson(url: string): Promise<Result<unknown, AppError>>; fetchBytes(url: string): Promise<Result<Uint8Array, AppError>>; isOnline(): Promise<boolean>; sha256Hex(bytes: Uint8Array): Promise<string>; openMemoryDb(bytes: Uint8Array): Promise<SQLiteDatabase>; openCurriculumFile(): Promise<SQLiteDatabase>; backup(source: SQLiteDatabase, dest: SQLiteDatabase): Promise<void>; waitForSwapAllowed(): Promise<void> }`.
- Produces: `runWebCurriculumUpdate(ports: WebCurriculumPorts, handles: { curriculumDb: SQLiteDatabase; userDb: SQLiteDatabase }): Promise<CheckAndApplyCurriculumUpdateResult>` and `checkAndApplyCurriculumUpdate(handles)` = `runWebCurriculumUpdate(defaultWebPorts, handles)` (same export name as native, so Metro picks the `.web.ts` file for `@/data/curriculum/curriculumUpdate`).
- `defaultWebPorts`: `fetchJson` / `fetchBytes` call `fetch(url, { credentials: 'omit' })` (non-200 → `CURRICULUM_MANIFEST_FETCH_FAILED` / `CURRICULUM_DOWNLOAD_FAILED`); `isOnline` = `Network.getNetworkStateAsync()` connected and reachable; `sha256Hex` = `expo-crypto` `digest(SHA256, bytes)` → hex; `openMemoryDb` = `deserializeDatabaseAsync(bytes)`; `openCurriculumFile` = `openDatabaseAsync(CURRICULUM_DB_NAME)`; `backup` = `backupDatabaseAsync({ sourceDatabase, destDatabase })`; `waitForSwapAllowed` = `waitForCurriculumSwapAllowed`.

Algorithm (the order is the safety rule):

```
1. local = SELECT version FROM curriculum_metadata (curriculumDb, async) → missing: error CURRICULUM_VERSION_MISSING
2. manifest = fetchJson(manifestUrl) → fail: 'skipped'
   release = verifySignedManifest(...) → fail: 'skipped'      (no file request)
   not newer than local → 'up_to_date'
3. !isOnline() → 'deferred'
4. bytes = fetchBytes(fileUrl(release.sha256)) → fail: 'error' (no curriculumDb in the result: nothing was closed)
   sha256Hex(bytes) ≠ release.sha256 → 'error' CURRICULUM_CHECKSUM_MISMATCH
5. mem = openMemoryDb(bytes); mem version ≠ String(release.version) or PRAGMA quick_check ≠ 'ok'
   → close mem; 'error' CURRICULUM_SQLITE_INVALID
6. await waitForSwapAllowed()
   userDb.isInTransactionAsync() → close mem; 'deferred'
7. close curriculumDb; userDb.execAsync('DETACH DATABASE curriculum')
   dest = openCurriculumFile(); backup(mem, dest); close dest
   (any failure in 7: close mem/dest if open, reopen + attach the curriculum, return 'error' with that curriculumDb)
8. close mem; reopened = reopenCurriculumDatabase(); attachCurriculumForQuery(userDb, reopened)
   setCurriculumInstallMetadata(userDb, { version: String(release.version), source: 'downloaded', contentHash: release.sha256 })
   → 'success' with reopened
```

- `DatabaseProvider.tsx`: remove the `supportsCurriculumOta()` condition (the effect runs on every platform). No other change: the success path already swaps the handle and shows the banner.

- [ ] **Step 1: Failing tests** (`curriculumUpdate.web.test.ts`, fake ports that record calls; fake `SQLiteDatabase` objects with `getFirstAsync`, `closeAsync`, `execAsync`, `isInTransactionAsync`; `reopenCurriculumDatabase` / `attachCurriculumForQuery` / `setCurriculumInstallMetadata` mocked; manifests signed with a test key as in Task 5):
  - `installs a newer signed release` → `success`; call order `fetchJson, fetchBytes, sha256Hex, openMemoryDb, waitForSwapAllowed, close curriculum, DETACH, openCurriculumFile, backup, reopen, attach, metadata`.
  - `a rejected manifest makes no file request` (tampered → `skipped`, `fetchBytes` not called) and `an unsigned manifest makes no file request`.
  - `not newer → up_to_date and no file request`.
  - `offline → deferred and no file request`.
  - `a failed file fetch changes nothing` (`error`, curriculum not closed, no backup).
  - `a hash mismatch changes nothing and closes nothing`.
  - `a probe version that differs from the signed version → CURRICULUM_SQLITE_INVALID, memory db closed, curriculum not closed`.
  - `waits for the swap gate` (gate held → curriculum still open; release → continues).
  - `user.db in a transaction defers the swap` (`deferred`, curriculum not closed).
  - `a failed copy reopens and attaches the old curriculum` (`backup` rejects → `error` with `curriculumDb` = reopened handle; attach called; no metadata write).
  - `default ports fetch with credentials omit` (spy on `global.fetch`; both calls get `{ credentials: 'omit' }`).
  - `DatabaseProvider.test.tsx` (named edit): replace `skips the curriculum update on web` with `checks for a curriculum update on web too` (same structure as the native case, `Platform.OS = 'web'`).
- [ ] **Step 2:** Run `npx jest src/data/curriculum/curriculumUpdate.web.test.ts src/providers/DatabaseProvider.test.tsx` → FAIL. Implement. Run → PASS. Full `npm test -- --ci`, `npm run typecheck`, `npm run lint` → green.
- [ ] **Step 3: Commit** `feat(curriculum): background curriculum update on web`.

### Task 7: Local web check (real OPFS, throwaway key only)

**Files:** none (a check; fix and commit only if a step fails).

- [ ] **Step 1:** `cd mobile && npm run build:web`, then `cd ../backend && npx wrangler dev` (local R2). Use `BROWSER=none` if `expo start` is used. Open `http://localhost:8787` in Chrome (one tab only).
- [ ] **Step 2: Rejected manifests change nothing.** Make three files with a small `tsx` one-off in `$TMPDIR` (not committed), each with a payload `version` higher than the local seed and the sha256 of any file: (a) no `signature` field; (b) a valid shape with a random 64-byte signature under `keyId: 'k1'`; (c) signed by a throwaway key under `keyId: 'k1'`. For each: `npx wrangler r2 object put pakapaka-curriculum/s1/manifest.json --file <f> --content-type application/json --local`, reload the page. Expect: no banner, the Network panel shows the manifest request and **no** `/api/curriculum/files/` request, the app works (open Browse and a lesson preview).
- [ ] **Step 3: Cookie check.** In the Network panel, the manifest request has no `Cookie` header (sign in first if the local setup allows it; if not, write "not checked locally" and do it in Task 8).
- [ ] **Step 4: Real swap on OPFS with a throwaway key (Review Focus 5).** Nothing in this step is committed.
  1. Make a throwaway key with `npm run curriculum-keygen -- --out "$TMPDIR/pp-local.pem"`. Add its public key as `"tmp"` to a local copy of `mobile/src/config/curriculum-signing-keys.json`.
  2. `COMPILE_OUTPUT_PATH="$TMPDIR/pp-next/curriculum.db" npm run compile-curriculum` at the root (version N+1), then `git checkout curriculum/metadata.json` (the compile raised it).
  3. Sign a manifest for that file with a `tsx` one-off that calls `signManifest` (`keyId: 'tmp'`). Put the file at `files/<sha256>.db` and the manifest at `s1/manifest.json` in the local R2 (`wrangler r2 object put … --local`).
  4. Rebuild the web app (`npm run build:web`, so the build holds the `tmp` key), restart `wrangler dev`, open the page in one tab, reload. Expect the banner `Curriculum updated — fresh content is live.`, then Browse, a lesson and a review work. Reload → no banner, and the databases open with no "Unable to open local databases".
  5. Gate: put a newer local release (repeat 2–3 with N+2), open a review **before** reloading the page finishes the download (use DevTools throttling "Slow 4G") → no banner while the review is open; leave the review → the banner shows.
  6. Tab closed during the copy: with throttling off, put release N+3, reload, and close the tab as soon as the file request ends. Open a new tab → the app opens and works (version N+2 or N+3, never broken).
  7. Clean up: `git checkout mobile/src/config/curriculum-signing-keys.json`, delete `$TMPDIR/pp-local.pem` and `$TMPDIR/pp-next`, rebuild the web app.
- [ ] **Step 5:** Write the results in the Task 9 history entry.

### Task 8: Deploy, first signed release, live checks (operator-gated)

Ask before each **(operator)** step and show the exact command or prompt. Never ask for a private key.

- [ ] **Step 1:** Confirm Finding 8 with the operator (the oldest app build in use can read the seed at this branch).
- [ ] **Step 2 (operator O2, O3):** Web agent prompt P1 (bucket). Then `cd mobile && npm run deploy:web`. Then web agent prompt P2 (bindings).
- [ ] **Step 3 (operator O4):** Phone builds (Android and iPhone) from this branch, so they hold seed N (the committed seed version now).
- [ ] **Step 4: Smoke test before the first release:** `curl -i https://paka-paka.app/api/curriculum/s1/manifest.json` → `404`, `Cache-Control: no-store`; `curl -i https://paka-paka.app/api/curriculum/files/$(printf 'a%.0s' {1..64}).db` → `404`; `curl -i -X POST …/manifest.json` → `404`. The web app loads with no banner and no console error from the curriculum check.
- [ ] **Step 5 (operator O5): first signed release of a newer seed.** The builder runs `npm run compile-curriculum` at the root (version N+1), runs the root and mobile tests, and commits `chore(curriculum): compile vN+1 for the first signed release` (seed + `curriculum/metadata.json` + `curriculum-seed.json`). Do **not** deploy the web again and do **not** rebuild the phones. Then the operator runs the dry run and the real release (commands in "Steps that need the operator"). Expect `Release <N+1> is live.` Then web agent prompt P3.
- [ ] **Step 6: Live checks (the "done when").**
  1. **Interrupted download (web):** open https://paka-paka.app with DevTools → Network → throttling "Slow 4G"; when `/api/curriculum/files/…` starts, switch to "Offline". → no banner, the app works (Browse, a review). Switch to "No throttling", reload → the banner `Curriculum updated — fresh content is live.` shows.
  2. **Web install:** after the reload, Browse works, a lesson and a review open. Reload again → no banner (up to date). The manifest request has no `Cookie` header while signed in.
  3. **Interrupted download (phone):** on Android, start the app on Wi-Fi and turn on airplane mode during the download (dev build logs `[curriculumUpdate]`). → the app works; next start on Wi-Fi → banner.
  4. **Phone install:** iPhone and Android on Wi-Fi, cold start → banner; Browse, lesson and review work. On cellular only: no download.
  5. **Swap gate:** on one device with a pending update, open a review before the download ends → no swap while the review is open; leave the review → the banner shows.
  6. **No network:** airplane mode, cold start → no error and no banner; the app works.
- [ ] **Step 7:** All tests green: `cd mobile && npm test -- --ci && npm run typecheck && npm run lint`; `cd backend && npm test && npm run typecheck`; root `npm test && npm run check-contrast`. Native tests unchanged except the named edits (check with `git diff --stat main -- 'mobile/**/*.test.*'`).

### Task 9: Docs

**Files:** Create `docs/curriculum-releases.md`. Modify `CLAUDE.md`, `docs/working-history.md`, `mobile/assets/curriculum-manifest/README.md`, `docs/design/backup-and-web-plan.md`, `docs/design/curriculum-schema-migration-plan.md`, `docs/README.md` (one link line).

- [ ] **Step 1: `docs/curriculum-releases.md`** (operator runbook, ASD-STE-100): what a release is (the committed seed); the manifest format and the signed bytes; where the keys live (k1 file + password-manager copy; k2 password manager only); the release commands (dry run, then real); what the script checks; key rotation (k1 lost, k1 leaked, both lost — Approved decisions 4); the schema rule; cache and cost numbers; the web limit (Finding 4); "the CI artifact is not a release" (Finding 2); how to remove an old file by hand (only a file that no live manifest names).
- [ ] **Step 2: `CLAUDE.md`:** in "Project overview" add one line: curriculum updates come from R2 as signed releases (Ed25519, signed offline by the operator; native and web). In "Hard conventions" add: "**Curriculum releases** — signed offline with the operator's key (never in git, the Worker, CI or a chat); the app installs only a manifest whose signature verifies with `curriculum-signing-keys.json` and whose `schema` equals `REQUIRED_CURRICULUM_SCHEMA_VERSION`; raise it with `CURRICULUM_SCHEMA_VERSION` when the curriculum DDL changes. Runbook: `docs/curriculum-releases.md`." In "Architecture crux", change the OTA sentence to: "OTA: signed manifest → download → SHA-256 → swap (native: file swap; web: SQLite backup copy into OPFS)".
- [ ] **Step 3: `mobile/assets/curriculum-manifest/README.md`:** the folder now holds only the test fixture `curriculum-mock-update.db`; it is not bundled; the manifest URL rule and the Wi-Fi rule (native only, every build); link to the runbook.
- [ ] **Step 4: `backup-and-web-plan.md`** (§B3.6/§B4): web now gets curriculum updates (Part 4). **`curriculum-schema-migration-plan.md`** Phase D: a status note per Finding 6.
- [ ] **Step 5: `docs/working-history.md`**, row "Web app, optional accounts, progress sync": Part 4 status (built on `part4-curriculum-r2`; deployed or not; first release version; results of Task 7 and Task 8 Step 6), the Findings, and open items (Phase D step 3 and the Settings notice wait for Phase B; web signature limit).
- [ ] **Step 6: Commit** `docs: Part 4 curriculum updates from R2`.

**Done when (whole of Part 4):** a signed release uploaded to R2 is installed by a phone and by the web app; a tampered or unsigned manifest is rejected with no change; an interrupted download leaves the old curriculum working; no network gives no error; all tests are green; native tests are unchanged except the named edits.
