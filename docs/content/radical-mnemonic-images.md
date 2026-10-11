# Radical mnemonic images — maintainer workflow

This guide covers how to create, commit, and wire radical mnemonic images for the mobile app.

**Scope:** radicals only. Kanji (and vocab/grammar) do not get mnemonic images.

## Decision (July 2026)

Radical mnemonic images are **stored in this repository and bundled into the app binary**. There is no CDN, R2 bucket, or remote image host — learners get images offline on first install.

Rationale: the taught radical set is small and finite (~150 for N5+N4; Kangxi ceiling 214), art changes rarely, and bundling matches the offline-first product better than HTTPS fetch + disk cache.

## Purpose

- **FR34** — Maintainers manage mnemonic image assets (in-repo files + curriculum refs).
- **FR4b** — Learners see radical mnemonic images in the app.
- **FR37b (revised)** — Curriculum points each radical at a **bundled asset path** in `items.visual_mnemonic_url`: `radicals/{slug}.webp`, relative to `mobile/assets/`. The path holds no level — see "Curriculum / app wiring" below. The schema rejects `https://` values, so a remote URL cannot be reintroduced by accident.
- **NFR20** — Missing or unloadable assets fall back to text (`mnemonic_text` / meaning). No broken-image icon.

## Where files live

| Role | Path |
| --- | --- |
| Radical art (source of truth) | `mobile/assets/radicals/{slug}.webp` — one folder for every level |
| Git | **Git LFS**, via `mobile/assets/radicals/**/*.webp` in `.gitattributes` (same pattern as `curriculum.db`) so clones stay lean |
| App | `mobile/src/utils/radicalImages.ts` — generated `require()` map; never hand-edited |
| App | Expo packs `mobile/assets/` into the binary; images update with app releases, not a separate media deploy |

Slug must match the radical entry in `curriculum/radicals/*.json`.

Examples:

- `mobile/assets/radicals/ichi.webp`
- `mobile/assets/radicals/ni.webp`

## Asset specification

| Property | Recommendation |
| --- | --- |
| Format | **WebP only** — the schema pattern and the asset-map generator both reject anything else, so convert generated PNGs before committing |
| Aspect ratio | Square or 4:3 |
| **Hard size budget** | **≤80 KB per image** (aim 30–80 KB). Pack target: ~150 radicals ≈ **5–12 MB** total |
| Soft ceiling (reject in review) | Do not ship images that push the radical pack toward tens of MB; recompress or simplify before merging |
| Transparency | OK |
| Naming | `{slug}.webp` (matches curriculum `slug`) |

The old ~512 KB-per-image ceiling assumed CDN delivery. At that size, ~214 radicals would bloat the IPA/APK — **byte budget is the real constraint**, not hosting.

Review checklist before commit:

- Image clearly illustrates the radical mnemonic
- No offensive or misleading content
- Readable at ~140 px display height on a phone
- File size within the hard budget above
- If derived from KanjiVG: record share-alike obligation in root `NOTICE` (CC BY-SA 3.0)

## Curriculum / app wiring

Every radical that has `mnemonic_text` already carries its ref, written by
`curriculum/_build/generate.py`. Adding art is therefore just dropping the file in and
regenerating the map — no curriculum edit needed unless the slug changes.

**The path holds no level.** `generate.py` writes `radicals/{slug}.webp` for every
radical, so a radical that moves to another level keeps its ref and its file. Always read
the destination off the item's own `visual_mnemonic_url`.

1. Save the image at the path the item's `visual_mnemonic_url` names, under
   `mobile/assets/` (≤80 KB).
2. From `mobile/`, rebuild the bundler's asset map:

   ```bash
   npm run generate-radical-assets
   ```

   This rewrites `src/utils/radicalImages.ts` with one literal `require()` per file — Metro
   cannot resolve a path built at runtime, so the map has to be checked in. The script exits
   non-zero on anything that is not `{n1-n5,k}/{slug}.webp`.

3. If you changed any curriculum JSON, from repo root:

   ```bash
   npm run validate-schema && npm run compile-curriculum
   ```

4. Commit together:
   - Image file(s) under `mobile/assets/radicals/…` (LFS)
   - Regenerated `mobile/src/utils/radicalImages.ts`
   - Any updated JSON under `curriculum/radicals/` + recompiled `mobile/assets/curriculum-seed/curriculum.db` (Git LFS)

5. CI `compile-curriculum.yml` must pass. The validator does **not** yet cross-check that a
   radical's ref has a matching file on disk — a typo'd slug shows text, not an error.

`MnemonicImage` resolves refs through `getRadicalImage()` in `src/utils/radicalImages.ts`. There is no URL path left in the component — a ref with no entry in the map renders the mnemonic text.

## Generation tips

- Use consistent art style across a level (color palette, line weight, background).
- Anchor the image in the radical's mnemonic / description text — generate text first, then art from it (see content pipeline Phase 3).
- Prefer simple compositions; detail is lost at small sizes.
- Compress aggressively (WebP, limited palette) before committing.
- Run a quick visual pass on device after wiring (Learn / radical detail).

## Tier 1 vs Tier 2 (content pipeline Phase 3)

Both tiers are **radicals only** — same paths and size budget.

- **Tier 1 — deterministic KanjiVG cards:** render radical stroke SVGs into card images (theme-consistent backgrounds, readable at 140 px). Ships coverage quickly; visually consistent.
- **Tier 2 — curated AI art (~150):** prompted from each radical's established mnemonic/description; human-review every image. Replaces or supersedes Tier 1 per radical when ready. Process: [`docs/workflows/radical-art-web-chat-workflow.md`](../workflows/radical-art-web-chat-workflow.md).

## Verification

1. Open radical detail / lesson with a wired asset — image shows with no network.
2. Airplane mode on a fresh install — image still shows (bundled, not “cache after first fetch”).
3. Missing file or bad ref — text fallback only, no broken-image icon.
4. After replacing an image, ship a new app build (bundled assets do not OTA independently of the binary).

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Text instead of image | Asset not committed or path/slug mismatch | Confirm file under `mobile/assets/radicals/…` and curriculum ref |
| Text instead of image | Asset map not regenerated after adding art | Run `npm run generate-radical-assets` in `mobile/` and commit the result |
| Stale image after replace | Old binary / Metro cache | Rebuild app; clear Metro cache if needed |
| CI / validate fails | Missing file or oversize asset | Add file, recompress, or fix slug |
| Clone / repo huge | Images not on LFS | Track `mobile/assets/radicals/**` with Git LFS |

## Related docs

- [curriculum/README.md](../../curriculum/README.md) — compile commands and radical image overview
- [content-pipeline-plan.md](./content-pipeline-plan.md) — Phase 3 image generation
- `MnemonicImage` — shared renderer (text fallback for refs with no bundled file)
