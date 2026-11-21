# Curriculum releases (operator runbook)

This page tells the operator how to publish a new curriculum to the phones and the web app. Use it with the plan `docs/superpowers/plans/2026-11-19-web-app-part4-curriculum-r2.md`.

## What a release is

A release is the **committed seed**: `mobile/assets/curriculum-seed/curriculum.db`. The release script reads this file, signs a small manifest for it, and uploads both to the R2 bucket `pakapaka-curriculum`.

- The script does not use the CI file. **The CI artifact is not a release.** CI compiles in its own working copy. The file `dist/curriculum.db` from `compile-curriculum.yml` has a version number (N+1) that is not committed. The next real compile gives the same number to a different file. Compile on your Mac, commit the seed, then release it.
- A version is a whole number. `npm run compile-curriculum` adds 1 to it each time.
- The app installs a release only when its signed `version` is higher than the installed `curriculum_metadata.version`.

## R2 layout and URLs

| R2 key | URL | Content |
| --- | --- | --- |
| `s<schema>/manifest.json` | `/api/curriculum/s<schema>/manifest.json` | The signed manifest (about 400 bytes) |
| `files/<sha256>.db` | `/api/curriculum/files/<sha256>.db` | The curriculum file. The name is its SHA-256, so the file is never overwritten. |

The Worker only serves these two routes. It does not sign, read cookies, read headers or log. The bucket has no public access and no API token.

## The manifest and the signed bytes

```json
{ "format": "pakapaka-curriculum-manifest", "formatVersion": 1,
  "keyId": "k1", "payload": "<base64>", "signature": "<base64 of 64 bytes>" }
```

- The signed bytes are exactly the bytes you get when you decode `payload` from base64.
- The payload is UTF-8 JSON in this key order: `schema`, `version`, `sha256`, `size_bytes`, `published_at`.
- The app checks in this order: envelope shape, key for `keyId`, signature, payload fields, `schema`, `version`. It rejects the manifest at the first failure. It makes no file request for a rejected manifest.
- The app builds the file URL itself from `sha256`. After the download it checks the SHA-256 and checks that `curriculum_metadata.version` in the file equals the signed `version`.
- A rejected manifest, a failed download or no network changes nothing. The app keeps its curriculum and shows no error.

## Where the keys are

| Key | Use | Where |
| --- | --- | --- |
| `k1` | Signs each release | Private key in `~/.pakapaka-keys/curriculum-k1.pem` (mode 600). One copy in the password manager. |
| `k2` | Recovery key | Password manager only. It is not on the Mac. |

The two public keys are in `mobile/src/config/curriculum-signing-keys.json`. They are not secret.

Never put a private key in git, in the Worker, in a Wrangler secret, in CI or in a chat. The scripts never print a private key.

## Release commands

Run these on your Mac, at the repo root. First make sure that the seed is committed and that `git lfs pull` is done.

1. Dry run. It signs, checks and prints the plan. It uploads nothing.

   ```bash
   CURRICULUM_SIGNING_KEY_FILE=~/.pakapaka-keys/curriculum-k1.pem npm run release-curriculum -- --key-id k1 --dry-run
   ```

2. Read the output: version, SHA-256, size, key ID. Check that they are what you expect.
3. Real run. Use the same command without `--dry-run`.

   ```bash
   CURRICULUM_SIGNING_KEY_FILE=~/.pakapaka-keys/curriculum-k1.pem npm run release-curriculum -- --key-id k1
   ```

The real run uploads the file first and the manifest last. Then it fetches the live manifest and the live file and checks them. It ends with `Release <version> is live.` If a check fails after the upload, the message starts with `Uploaded, but the live check failed`.

## What the script checks

- The seed has no uncommitted changes.
- The seed is a real SQLite file (not a Git LFS pointer).
- `curriculum_metadata.version` is a whole number.
- The key file can be read, and its public key equals the public key for `--key-id` in `curriculum-signing-keys.json`.
- The new version is higher than the version that is live now.
- The new manifest verifies with the public keys (self-check).
- After the upload: the live manifest verifies, and its version, SHA-256 and size match. The live file has the same SHA-256.

The script never deletes an R2 object.

## The schema rule

The app reads only `s<REQUIRED_CURRICULUM_SCHEMA_VERSION>/manifest.json`. It installs only a payload whose `schema` equals that number. Two constants must stay equal (a root test checks this):

- `CURRICULUM_SCHEMA_VERSION` in `scripts/curriculum-schema.ts`
- `REQUIRED_CURRICULUM_SCHEMA_VERSION` in `mobile/src/data/curriculum/curriculumConfig.ts`

When the curriculum DDL changes in a way that a query can see, raise both in one commit. Then the new file goes to a new path (`s2/...`). Old apps keep reading `s1` and keep their curriculum. Both are `1` now.

## Key rotation

The app trusts `k1` and `k2` from the first build.

| Case | What to do |
| --- | --- |
| `k1` is lost | Sign with `k2`: use `--key-id k2` and the `k2` key file from the password manager. No app update is needed. |
| `k1` is leaked | Sign with `k2`. Remove `k1` from `curriculum-signing-keys.json`. Ship new app and web builds. Until a phone has the new build, it still trusts `k1`. |
| `k1` and `k2` are both lost | Make new keys with `npm run curriculum-keygen -- --out <path>`. Put the new public keys in `curriculum-signing-keys.json`. Ship an app update. Old apps keep their curriculum and get no more updates. |

Put a key file back on the Mac only for the time that you sign. Delete it after.

## Cache and cost

- Manifest: `Cache-Control: public, max-age=300`. A new release can take up to 5 minutes to show.
- File: `Cache-Control: public, max-age=31536000, immutable`.
- A missing object, another method or another path: `404` with `no-store`.
- Each app start costs 1 Worker request and 1 R2 read (about 400 bytes). 1,000 daily users with 3 starts each are about 3,000 requests a day (3% of the free 100,000) and about 90,000 R2 reads a month (1% of 10 million).
- Each install downloads about 12 MB once. R2 egress is free.
- Each release stores about 12 MB. 10 GB holds about 800 releases.
- If the Workers free plan runs out for a day, the manifest request fails. The app treats that like no network.

## The web limit

On the web, the signature stops only a change in R2. The web JavaScript, with the public keys, comes from the same Cloudflare account. A person who controls the account can change the JavaScript. So "a compromised Cloudflare account cannot sign a bad curriculum" is fully true for phones only. (Finding 4 of the plan.)

## How to remove an old file by hand

The script never deletes. Remove a file only when no live manifest names it.

1. Open the live manifest `https://paka-paka.app/api/curriculum/s<schema>/manifest.json` for each schema. Decode `payload` and read `sha256`.
2. Do not remove `files/<that sha256>.db`. Never remove `s<schema>/manifest.json`.
3. For an older file, run this from `backend/`:

   ```bash
   npx wrangler r2 object delete pakapaka-curriculum/files/<sha256>.db --remote
   ```

A phone or tab that is part-way through a download of the old file fails that download. It keeps its curriculum and tries again at the next start.
