# Radical mnemonic images — maintainer workflow

This guide covers how to create, host, and wire radical mnemonic images for the mobile app.

## Purpose

- **FR34** — Maintainers manage mnemonic image assets.
- **FR4b** — Learners see radical mnemonic images in the app.
- **FR37b** — Curriculum JSON stores full HTTPS URLs in `visual_mnemonic_url`, compiled to `items.visual_mnemonic_url`.
- **FR49 / NFR20** — The app caches images on disk and falls back to text when an image is missing or fails to load.

Placeholder URLs in seed data are valid HTTPS links. They may return **404** until assets are uploaded. The app must still show readable text fallback — that is expected behavior, not a bug.

## Asset specification

| Property | Recommendation |
| --- | --- |
| Format | PNG (preferred) |
| Aspect ratio | Square or 4:3 |
| Max file size | ~512 KB per image |
| Transparency | OK |
| Naming | `{slug}.png` (matches curriculum `slug`, e.g. `ichi.png`) |

Review checklist before upload:

- Image clearly illustrates the radical mnemonic
- No offensive or misleading content
- Readable at ~140 px display height on a phone
- File size reasonable for mobile cache

## URL convention

Public CDN pattern (single source of truth):

```text
https://assets.japanese-learning.app/radicals/{jlpt_lower}/{slug}.png
```

Examples:

- `https://assets.japanese-learning.app/radicals/n5/ichi.png`
- `https://assets.japanese-learning.app/radicals/n5/ni.png`

JLPT level segment is lowercase (`n5`, `n4`, …). The slug must match the radical entry in `curriculum/radicals/*.json`.

## Generation tips

- Use consistent art style across a level (color palette, line weight, background).
- Anchor the mnemonic story in `mnemonic_text` — the image should reinforce that text.
- Prefer simple compositions; detail is lost at small sizes.
- Run a quick visual pass on device after upload (Learn tab).

## Cloudflare R2 upload (high level)

1. Create an R2 bucket (e.g. bound to custom domain `assets.japanese-learning.app`).
2. Enable **public read** for the `radicals/` prefix (or entire bucket if appropriate).
3. Map the custom domain in Cloudflare DNS / R2 settings.
4. Upload objects with the path `{jlpt_lower}/{slug}.png`.

**Do not commit credentials** to this repository. Use local env vars or a secrets manager.

### Example: Wrangler CLI

```bash
# Placeholders — replace BUCKET and paths
wrangler r2 object put "BUCKET/radicals/n5/ichi.png" --file ./out/ichi.png --content-type image/png
```

### Example: AWS CLI (S3-compatible API)

```bash
# Placeholders — configure endpoint + credentials via env/profile
aws s3 cp ./out/ichi.png s3://BUCKET/radicals/n5/ichi.png \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
  --content-type image/png
```

## Curriculum update

1. Edit the radical row in `curriculum/radicals/n5.json` (or the relevant level file):

   ```json
   "visual_mnemonic_url": "https://assets.japanese-learning.app/radicals/n5/ichi.png"
   ```

2. From repo root, validate and compile:

   ```bash
   npm run validate-schema && npm run compile-curriculum
   ```

3. Commit:
   - Updated JSON under `curriculum/`
   - Recompiled `mobile/assets/curriculum-seed/curriculum.db` (Git LFS)

4. CI workflow `compile-curriculum.yml` must pass on the PR.

## Verification

1. Open the app **Learn** tab (N5 radical list).
2. Online: confirm images load for uploaded assets; placeholders show **text fallback** until upload.
3. Offline: revisit a radical whose image loaded once — cached image should appear without network.
4. Force a bad URL in dev — text fallback only, no broken-image icon.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Text instead of image | 404 or URL typo | Confirm R2 object path and JSON URL match |
| Text instead of image | Offline, never cached | Expected (NFR20); load online first |
| Stale image after replace | expo-image disk cache | Reinstall app or clear app data; optional future: `Image.clearDiskCache()` |
| CI compile fails | Schema / HTTPS validation | Fix JSON; URLs must be `https://` |

## Related docs

- [curriculum/README.md](../curriculum/README.md) — compile commands and FR37b overview
- Story 1.7 implementation — `MnemonicImage` component with `cachePolicy="disk"`
