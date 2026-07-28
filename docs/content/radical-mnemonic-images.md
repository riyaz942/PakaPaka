# Radical mnemonic images — maintainer workflow

This guide covers how to create, commit, and wire radical mnemonic images for the mobile app.

**Scope:** radicals only. Kanji (and vocab/grammar) do not get mnemonic images.

## Decision (July 2026)

Radical mnemonic images are **stored in this repository and bundled into the app binary**. There is no CDN, R2 bucket, or remote image host — learners get images offline on first install.

Rationale: the taught radical set is small and finite (~150 for N5+N4; Kangxi ceiling 214), art changes rarely, and bundling matches the offline-first product better than HTTPS fetch + disk cache.

## Purpose

- **FR34** — Maintainers manage mnemonic image assets (in-repo files + curriculum refs).
- **FR4b** — Learners see radical mnemonic images in the app.
- **FR37b (revised)** — Curriculum points each radical at a **bundled asset path** (compiled into `items.visual_mnemonic_url` or a successor field). Legacy seed rows may still carry placeholder `https://…` values until the schema/app wiring lands; those placeholders are not a hosting plan.
- **NFR20** — Missing or unloadable assets fall back to text (`mnemonic_text` / meaning). No broken-image icon.

## Where files live

| Role | Path |
| --- | --- |
| Radical art (source of truth) | `mobile/assets/radicals/{jlpt_lower}/{slug}.webp` (or `.png`) |
| Git | Prefer **Git LFS** for `mobile/assets/radicals/**` (same pattern as `curriculum.db`) so clones stay lean |
| App | Expo packs `mobile/assets/` into the binary; images update with app releases, not a separate media deploy |

Slug must match the radical entry in `curriculum/radicals/*.json`. JLPT segment is lowercase (`n5`, `n4`, …).

Examples:

- `mobile/assets/radicals/n5/ichi.webp`
- `mobile/assets/radicals/n5/ni.webp`

## Asset specification

| Property | Recommendation |
| --- | --- |
| Format | **WebP preferred**; PNG acceptable |
| Aspect ratio | Square or 4:3 |
| **Hard size budget** | **≤80 KB per image** (aim 30–80 KB). Pack target: ~150 radicals ≈ **5–12 MB** total |
| Soft ceiling (reject in review) | Do not ship images that push the radical pack toward tens of MB; recompress or simplify before merging |
| Transparency | OK |
| Naming | `{slug}.webp` / `{slug}.png` (matches curriculum `slug`) |

The old ~512 KB-per-image ceiling assumed CDN delivery. At that size, ~214 radicals would bloat the IPA/APK — **byte budget is the real constraint**, not hosting.

Review checklist before commit:

- Image clearly illustrates the radical mnemonic
- No offensive or misleading content
- Readable at ~140 px display height on a phone
- File size within the hard budget above
- If derived from KanjiVG: record share-alike obligation in root `NOTICE` (CC BY-SA 3.0)

## Curriculum / app wiring

Target shape (implement with Phase 3; until then seed may still show HTTPS placeholders and text fallback):

1. Commit the image under `mobile/assets/radicals/{level}/{slug}.…`.
2. Point the radical row at the bundled asset (path or stable asset key — exact field shape lands with the schema change that drops the HTTPS-only rule).
3. From repo root:

   ```bash
   npm run validate-schema && npm run compile-curriculum
   ```

4. Commit together:
   - Image file(s) under `mobile/assets/radicals/…` (LFS)
   - Updated JSON under `curriculum/radicals/`
   - Recompiled `mobile/assets/curriculum-seed/curriculum.db` (Git LFS)

5. CI `compile-curriculum.yml` must pass; validator should eventually fail if a radical references a missing bundled file.

`MnemonicImage` should load via the bundler / local asset map (not `source={{ uri: https… }}`). Text fallback remains for missing files.

## Generation tips

- Use consistent art style across a level (color palette, line weight, background).
- Anchor the image in the radical's mnemonic / description text — generate text first, then art from it (see content pipeline Phase 3).
- Prefer simple compositions; detail is lost at small sizes.
- Compress aggressively (WebP, limited palette) before committing.
- Run a quick visual pass on device after wiring (Learn / radical detail).

## Tier 1 vs Tier 2 (content pipeline Phase 3)

Both tiers are **radicals only** — same paths and size budget.

- **Tier 1 — deterministic KanjiVG cards:** render radical stroke SVGs into card images (theme-consistent backgrounds, readable at 140 px). Ships coverage quickly; visually consistent.
- **Tier 2 — curated AI art (~150):** prompted from each radical's established mnemonic/description; human-review every image. Replaces or supersedes Tier 1 per radical when ready.

## Verification

1. Open radical detail / lesson with a wired asset — image shows with no network.
2. Airplane mode on a fresh install — image still shows (bundled, not “cache after first fetch”).
3. Missing file or bad ref — text fallback only, no broken-image icon.
4. After replacing an image, ship a new app build (bundled assets do not OTA independently of the binary).

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Text instead of image | Asset not committed or path/slug mismatch | Confirm file under `mobile/assets/radicals/…` and curriculum ref |
| Text instead of image | Schema/app still on HTTPS placeholder | Expected until Phase 3 wiring; fallback is correct |
| Stale image after replace | Old binary / Metro cache | Rebuild app; clear Metro cache if needed |
| CI / validate fails | Missing file or oversize asset | Add file, recompress, or fix slug |
| Clone / repo huge | Images not on LFS | Track `mobile/assets/radicals/**` with Git LFS |

## Related docs

- [curriculum/README.md](../../curriculum/README.md) — compile commands and radical image overview
- [content-pipeline-plan.md](./content-pipeline-plan.md) — Phase 3 image generation
- `MnemonicImage` — shared renderer (text fallback); update load path when bundling lands
