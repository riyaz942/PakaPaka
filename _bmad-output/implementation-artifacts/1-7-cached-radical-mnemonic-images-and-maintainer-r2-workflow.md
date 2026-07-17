# Story 1.7: Cached radical mnemonic images and maintainer R2 workflow

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **radical mnemonic images loaded from URLs in curriculum and cached for offline viewing**,
So that **I see visuals without broken states when offline (FR49, FR4b delivery path, NFR20)**.

## Acceptance Criteria

1. **Shared `MnemonicImage` component (FR49, FR4b, NFR20, UX-DR33)**

   **Given** a curriculum row provides `visual_mnemonic_url` (HTTPS) and optional `mnemonic_text`  
   **When** `MnemonicImage` renders with those props  
   **Then** it uses `expo-image` with `cachePolicy="disk"` (default disk persistence — FR49)  
   **And** `source={{ uri: visual_mnemonic_url }}` loads and displays the image with `contentFit="contain"` inside a bounded container  
   **And** `accessibilityLabel` is set to a meaningful description: prefer `mnemonic_text`, else compose from `meaning` / `primary_form` props — never an empty label (UX-DR33, UX spec line ~1311)  
   **And** on `onError` (network failure, 404, corrupt file) or missing/invalid URL, the component shows **text fallback** (`mnemonic_text` or composed label) — **no broken-image icon, no empty box, no infinite spinner** (NFR20)  
   **And** while loading, a neutral placeholder/skeleton is acceptable; loading must not block parent layout

2. **Curriculum query path for radicals (Epic 1 verification slice)**

   **Given** bundled `curriculum.db` is open (25 N5 radicals, `visual_mnemonic_url` on each row per Story 1.5)  
   **When** the learner opens the **Learn** tab verification UI (minimal slice — not full Epic 4 hub)  
   **Then** N5 radicals load from `curriculum.db` via a typed repository (`item_type = 'radical'`, `jlpt_level = 'N5'`, ordered by `sort_order`)  
   **And** each row shows `primary_form`, `meaning`, and `MnemonicImage` using the row's `visual_mnemonic_url` + `mnemonic_text`  
   **And** tapping a row is optional; a scrollable list is sufficient for this story

3. **Offline cache behavior (FR49)**

   **Given** a radical image was successfully loaded once while online  
   **When** the device is offline (airplane mode) and the learner views the same radical again  
   **Then** `expo-image` serves the image from disk cache without network  
   **And** no error UI appears for cached images

4. **Cache miss + offline fallback (NFR20)**

   **Given** an image was **never** cached and the device is offline (or URL returns 404)  
   **When** the learner views that radical  
   **Then** text fallback (`mnemonic_text` or meaning label) displays instead of a broken image  
   **And** the experience remains usable (readable text, accessible label)

5. **Maintainer R2 workflow documentation (FR34, FR37b operational path)**

   **Given** a maintainer follows the new doc at `docs/content/radical-mnemonic-images.md` (linked from `curriculum/README.md`)  
   **When** they generate PNG assets, upload to Cloudflare R2, and set `visual_mnemonic_url` in `curriculum/radicals/*.json`  
   **Then** the documented URL pattern matches compiled data: `https://assets.japanese-learning.app/radicals/{jlpt_lower}/{slug}.png` (e.g. `n5/ichi.png`)  
   **And** `npm run validate-schema && npm run compile-curriculum` still passes with updated URLs  
   **And** CI (`compile-curriculum.yml`) still passes  
   **And** docs cover: naming convention, recommended image dimensions/format, R2 public-read bucket setup (high level — no secrets in repo), wrangler/AWS CLI upload example, and re-compile + LFS commit steps

6. **Tests and CI (`mobile/`)**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** unit tests cover: `MnemonicImage` text fallback on error / missing URL; `accessibilityLabel` present; `radicalRepository` returns N5 radicals in sort order  
   **And** add `__mocks__/expo-image.tsx` if needed for deterministic component tests

## Tasks / Subtasks

- [x] **AC1 — `MnemonicImage` component**
  - [x] Create `mobile/src/components/common/MnemonicImage.tsx` — props: `imageUrl`, `mnemonicText`, `meaning?`, `primaryForm?`, `className?`, `testID?`.
  - [x] Use `expo-image` `Image` with `cachePolicy="disk"`, `contentFit="contain"`, `onError` → set local state to show text fallback.
  - [x] Export from `mobile/src/components/common/index.ts` (create barrel if missing).
  - [x] Build `accessibilityLabel` helper (inline or `utils/mnemonicAccessibilityLabel.ts`) — no empty labels.

- [x] **AC2 — Data layer**
  - [x] Create `mobile/src/data/curriculum/radicalRepository.ts` — `listRadicalsByLevel(db, jlptLevel): RadicalItem[]`.
  - [x] Create `mobile/src/data/curriculum/curriculum.types.ts` — `RadicalItem` with `id`, `slug`, `primaryForm`, `meaning`, `mnemonicText`, `visualMnemonicUrl`, `sortOrder`.
  - [x] Create `mobile/src/data/hooks/useRadicals.ts` — reads `curriculumDb` from context, returns radicals for a level (optional memoization).
  - [x] **Do not** add `attachCurriculumForQuery` unless needed — single-DB reads on `curriculumDb` handle are sufficient for radicals.

- [x] **AC2 — Learn tab verification UI**
  - [x] Replace `learn.tsx` placeholder with minimal radical list using `useDatabase` / `DatabaseContext` (guard: show loading until DB ready — follow `DatabaseProvider` pattern).
  - [x] Each list item: character, meaning, `MnemonicImage` (~120–160px height).
  - [x] Use NativeWind tokens (`bg-background`, `text-primary`, `content-radical` accent if appropriate).
  - [x] Add `__DEV__` subtitle noting "Epic 4 will replace with full Learn hub" (optional one-line).

- [x] **AC5 — Maintainer documentation**
  - [x] Create `docs/content/radical-mnemonic-images.md` — end-to-end maintainer workflow.
  - [x] Update `curriculum/README.md` — link to maintainer doc, reaffirm URL pattern and FR37b field.
  - [x] Document that placeholder URLs may 404 until assets upload — app must still show text fallback (NFR20).

- [x] **AC3/AC4/AC6 — Tests**
  - [x] `MnemonicImage.test.tsx` — fallback on error; label present; valid URL renders mocked Image.
  - [x] `radicalRepository.test.ts` — against mock sqlite or in-memory fixture rows.
  - [x] `__mocks__/expo-image.tsx` — stub `Image` with triggerable `onError`.
  - [x] Manual: load app online → view radical with live R2 URL → airplane mode → revisit (cached). Force 404 URL in dev → text fallback.

## Dev Notes

### Epic context (Epic 1)

Epic 1 delivers the installable shell. **Stories 1.1–1.6** established Expo SDK 55, NativeWind, dual SQLite, tab shell, curriculum compile pipeline, bundled N5 seed (114 items, **25 radicals**), and atomic curriculum updates. **This story (1.7)** completes Epic 1's media path: **R2 URL → expo-image disk cache → offline viewing** plus **maintainer upload documentation**.

**Out of scope for 1.7 (do not implement):**

| Area | Deferred to |
| --- | --- |
| Full Learn hub, JLPT level grids, item detail routes | Epic 4 (Stories 4.1, 4.2) |
| Review session radical cards | Epic 5 |
| Personal mnemonics editor | Epic 4.8 |
| Actual Cloudflare R2 bucket provisioning / wrangler secrets in CI | Maintainer ops (document only) |
| Prefetching radical images for review queue | Epic 5.10 or 4.2 integration |
| `Image.prefetch` batch on app launch | Optional enhancement — not required unless trivial |
| Production asset upload automation in GitHub Actions | Post-MVP |

**Epic 1 completion:** After 1.7, run `epic-1-retrospective` (optional in sprint-status).

### Technical requirements (must follow)

- **Data shape (FR37b):** Radical JSON requires `visual_mnemonic_url` as HTTPS URI ([Source: `curriculum/schema/curriculum.schema.json`]). Compiled to `items.visual_mnemonic_url`. Kanji/vocab/grammar rows have `null` URL.
- **URL pattern SSOT:** `https://assets.japanese-learning.app/radicals/n5/{slug}.png` ([Source: `curriculum/README.md`], [Source: `curriculum/radicals/n5.json`]).
- **Graceful degradation chain (architecture):** Cached image → R2 fetch → text mnemonic fallback. No broken image states ([Source: architecture.md — Error Handling]).
- **expo-image already installed** at `~55.0.10` — **do not** add `react-native-fast-image` ([Source: architecture.md — Images decision, PRD image caching note]).
- **cachePolicy:** Use `"disk"` explicitly (default is disk, but be explicit in component for Story 4.2 reuse). Optional `cacheKey`: use stable `visual_mnemonic_url` or `slug`-based key if URL ever gains query params.
- **onError handling:** `expo-image` `onError(error, retry)` — for this story, **do not** auto-retry in a loop; show text fallback immediately. Optional single manual retry is OK but not required.
- **Layer boundaries:** Repository in `data/curriculum/`; UI in `components/common/`; **no** `expo-sqlite` in `components/`.
- **Database access:** Use existing `DatabaseContext` / `useDatabase()` — databases are ready before tab screens render inside `DatabaseProvider`.
- **Placeholder R2 URLs:** Current seed URLs point at `assets.japanese-learning.app` which may not host files yet — **this is expected**. Verification = text fallback works + any uploaded test asset loads and caches. Do not block story on production CDN going live.
- **No new mobile dependencies** unless `@testing-library/react-native` is needed for component tests (add as devDependency if writing RTL tests; jest-expo may suffice with shallow render).

### MnemonicImage API (recommended)

```typescript
type MnemonicImageProps = {
  imageUrl: string | null | undefined;
  mnemonicText?: string | null;
  meaning?: string | null;
  primaryForm?: string | null;
  className?: string;
  testID?: string;
};
```

**Fallback text priority:** `mnemonicText` → `` `${meaning} (${primaryForm})` `` → `"Mnemonic image unavailable"`.

**Accessibility label priority:** same as fallback text (screen reader users learn from description per UX spec).

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| FR49 Cached images offline | `expo-image` `cachePolicy="disk"` |
| FR4b R2 radical images | Load from `visual_mnemonic_url` |
| FR34 Maintainer image management | `docs/content/radical-mnemonic-images.md` |
| FR37b URLs in curriculum data | Already in seed; docs describe update path |
| NFR20 Graceful image fallback | `onError` + missing URL → text |
| UX-DR33 expo-image + a11y label | `MnemonicImage` component |
| Graceful image fallback pattern | architecture Error Handling table |
| Cloudflare R2 integration | HTTPS public URLs, no auth |
| Epic 4.2 reuse | Export shared `MnemonicImage` — Story 4.2 must import this, not duplicate |

### Library / framework requirements

| Package | Where | Notes |
| --- | --- | --- |
| `expo-image` ~55.0.10 | mobile | **Already installed** — use `Image` from `expo-image` |
| `expo-sqlite` ~55 | mobile | Existing — read `items` table |
| `@testing-library/react-native` | mobile devDep | Add only if using RTL for `MnemonicImage` tests |

**Do not add:** `react-native-fast-image`, image download via `expo-file-system` (expo-image handles caching).

### File structure requirements

| Path | Action |
| --- | --- |
| `mobile/src/components/common/MnemonicImage.tsx` | **Create** |
| `mobile/src/components/common/MnemonicImage.test.tsx` | **Create** |
| `mobile/src/components/common/index.ts` | **Create** or extend |
| `mobile/src/data/curriculum/radicalRepository.ts` | **Create** |
| `mobile/src/data/curriculum/radicalRepository.test.ts` | **Create** |
| `mobile/src/data/curriculum/curriculum.types.ts` | **Create** |
| `mobile/src/data/hooks/useRadicals.ts` | **Create** (optional thin hook) |
| `mobile/src/app/(tabs)/learn.tsx` | **Modify** — radical verification list |
| `mobile/__mocks__/expo-image.tsx` | **Create** |
| `docs/content/radical-mnemonic-images.md` | **Create** |
| `curriculum/README.md` | **Modify** — link maintainer doc |

**Do not create:** `src/app/learn/item/[id].tsx`, `itemRepository.ts` (full), review components, R2 upload scripts in CI, FSRS tables.

### Testing requirements

- **Unit (required):** `MnemonicImage` error/missing URL → text fallback; accessibility label non-empty; `radicalRepository` sort order and field mapping (`visual_mnemonic_url` → camelCase).
- **Mocking:** `__mocks__/expo-image.tsx` — render `View`/`Text` stub, expose test hook to fire `onError`.
- **Repository tests:** Use `expo-sqlite` mock or inject `SQLiteDatabase` with prepared statements — follow `database.test.ts` / `curriculumUpdate.test.ts` patterns.
- **Mobile CI:** `npm run lint`, `typecheck`, `test` in `mobile/`.
- **Manual checklist:**
  1. Online: open Learn → radicals list renders (images or text fallback).
  2. Upload one test PNG to R2 (or temporarily point one JSON URL at a known-good HTTPS image) → image displays.
  3. Revisit same radical offline → cached image shows.
  4. Invalid URL + offline → text fallback only.

### Previous story intelligence (Story 1.6)

- `curriculumUpdate.ts` handles DB file swap — **does not** affect image cache (separate disk cache). After curriculum update with new URLs, expo-image fetches new images; old cache entries may linger — acceptable for Epic 1; document optional `Image.clearDiskCache()` as future maintainer note only.
- `DatabaseProvider` wraps app in `_layout.tsx` inside `ThemeProvider` — Learn screen has DB access via context.
- `preferencesRepository.ts` exists for user prefs — **not** needed for image caching.
- Gated bundled import (`curriculum_update_source`) — unchanged by this story.
- `Result<T, AppError>` pattern in data layer — repository can return plain arrays (read-only sync queries) like `database.ts` metadata reads; use `Result` only if try/catch boundary adds value.
- Code review learnings from 1.6: atomic operations with rollback; recover handles on failure — not directly applicable to images but maintain defensive `onError` handling.

### Previous story intelligence (Story 1.5)

- 25 N5 radicals with `visual_mnemonic_url` + `mnemonic_text` in seed JSON.
- Schema enforces HTTPS on `visual_mnemonic_url`.
- `items` columns: `visual_mnemonic_url TEXT` nullable at SQL level but required for radicals in JSON schema.
- Compile assigns deterministic IDs — repository should query by `item_type` + `jlpt_level`, not hardcode IDs.

### Git intelligence summary

Latest commit `dd65064` added curriculum version check and atomic swap (`curriculumUpdate.ts`, `preferencesRepository.ts`, `Banner.tsx`). **No `MnemonicImage`, `radicalRepository`, or `docs/` yet** — greenfield for this story. `expo-image` already used in `animated-icon.tsx` for **local** `require()` assets only — MnemonicImage is first **remote URI + cache** usage. Follow co-located `*.test.ts` pattern and `__mocks__/` for expo modules.

### Latest technical information (expo-image SDK 55)

- **`cachePolicy`:** Default `'disk'` — images persist across sessions (FR49). Use explicit `cachePolicy="disk"` in component.
- **`onError`:** `(error, retry) => void` — implement fallback UI on error; avoid infinite retry loops.
- **`accessibilityLabel`:** Sets screen reader text and web `alt` — required per UX-DR33.
- **`Image.prefetch(urls, { cachePolicy: 'disk' })`:** Optional for batch warm-cache — defer unless trivial.
- **`Image.getCachePathAsync(cacheKey)`:** Useful for debug logging in `__DEV__` only.
- **Web:** `getCachePathAsync` / disk cache APIs resolve to `false` on web — ensure text fallback works on web; primary target is iOS/Android.

### UX requirements

| Element | Requirement | Source |
| --- | --- | --- |
| Mnemonic image loading | `expo-image` with disk cache | UX-DR33, epics.md |
| Image unavailable | `accessibilityLabel` with text description; visual text fallback | UX-DR33, NFR20 |
| Learn tab (interim) | Simple list — Epic 4 replaces with full hub | Story scope guard |
| Color | Use semantic tokens; no color-only state | UX-DR23 (general) |
| Safe areas | Learn list respects safe area / tab inset | Story 1.4 pattern via layout |

### Maintainer doc outline (`docs/content/radical-mnemonic-images.md`)

1. **Purpose** — FR34 / FR4b / FR37b overview.
2. **Asset spec** — PNG recommended; square or 4:3; max ~512KB; transparent OK; naming `{slug}.png`.
3. **URL convention** — `https://assets.japanese-learning.app/radicals/{level}/{slug}.png` (`n5`, `n4`, …).
4. **Generation** — AI prompt tips (brief); quality review checklist.
5. **R2 upload** — Bucket `assets.japanese-learning.app` (or custom domain); public read; example `aws s3 cp` / `wrangler r2 object put` commands with placeholders (no credentials).
6. **Curriculum update** — Edit `curriculum/radicals/n5.json` `visual_mnemonic_url`; run validate + compile; commit JSON + LFS `curriculum.db`.
7. **Verification** — Open app Learn tab; confirm image loads; offline test.
8. **Troubleshooting** — 404 → text fallback expected until upload; cache stale → reinstall or clear app data.

### Project context reference

No `project-context.md` in repo. Use this story + `architecture.md` + `epics.md` + `prd.md` (FR34, FR37b, FR49, NFR20) + `curriculum/README.md` + Stories 1.5–1.6 artifacts.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.7]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Media/R2, Graceful image fallback, expo-image, project structure]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR34, FR37b, FR49, NFR20, image caching, maintainer journey]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Offline-first, mnemonic a11y ~line 1311, UX-DR33 in epics.md]
- [Source: `_bmad-output/implementation-artifacts/1-6-curriculum-version-check-and-atomic-on-device-update.md`]
- [Source: `_bmad-output/implementation-artifacts/1-5-curriculum-json-validation-sqlite-compile-actions-lfs-and-bundled-seed.md`]
- [Source: `curriculum/radicals/n5.json` — URL shape]
- [Source: `curriculum/README.md` — FR37b, URL pattern]
- [Source: `curriculum/schema/curriculum.schema.json` — visual_mnemonic_url validation]
- [Source: `scripts/compile-curriculum.ts` — items insert with visual_mnemonic_url]
- [Source: `mobile/src/components/animated-icon.tsx` — existing expo-image import pattern]
- [Source: `mobile/src/app/(tabs)/learn.tsx` — replace placeholder]
- [Source: `https://docs.expo.dev/versions/latest/sdk/image/` — cachePolicy, onError, accessibilityLabel]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- `mobile/`: `npm run lint`, `npm run typecheck`, `npm test` — all pass (43 tests after review fixes)

### Senior Developer Review (AI)

**Reviewer:** Composer (adversarial code review workflow)  
**Date:** 2026-06-06  
**Outcome:** Approve (after fixes)

#### Git vs story File List

| Finding | Severity |
| --- | --- |
| `sprint-status.yaml` changed but omitted from File List | Medium (documentation) |

#### Acceptance criteria validation

| AC | Status | Notes |
| --- | --- | --- |
| AC1 `MnemonicImage` | Implemented | `cachePolicy="disk"`, `contentFit="contain"`, a11y label, text fallback on missing URL / `onError` |
| AC2 Radical query + Learn UI | Implemented | `radicalRepository`, `useRadicals`, scrollable N5 list |
| AC3 Offline disk cache | Implemented (manual) | `expo-image` disk policy; offline verification documented |
| AC4 Cache miss / offline fallback | Implemented | Invalid/missing URL and `onError` → text fallback |
| AC5 Maintainer R2 docs | Implemented | `docs/content/radical-mnemonic-images.md` + `curriculum/README.md` link |
| AC6 Tests & CI | Implemented | lint/typecheck/test pass; component + repository + a11y tests |

#### Findings and resolution

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| M1 | Medium | `hasError` stuck after `onError`; image never retried on URL change | **Fixed:** reset `hasError` when `imageUrl` changes; test added |
| M2 | Medium | `isValidMnemonicImageUrl` accepted `http://` (schema requires HTTPS) | **Fixed:** HTTPS-only validation; test asserts `http://` rejected |
| M3 | Medium | Story File List missing `sprint-status.yaml` | **Fixed:** File List updated |
| L1 | Low | Test name claimed HTTPS-only but did not assert `http://` rejection | **Fixed:** assertion added |
| L2 | Low | No `MnemonicImage` test for malformed URL | **Fixed:** invalid URL fallback test added |
| L3 | Low | No loading skeleton during image fetch | **Waived:** AC allows optional skeleton; bounded container satisfies NFR20 |
| L4 | Low | `.DS_Store` in working tree | **Waived:** exclude from commits |

### Completion Notes List

- Added shared `MnemonicImage` with `expo-image` disk cache, accessibility labels, and text fallback on missing URL or `onError`.
- Added `radicalRepository` + `useRadicals` hook; Learn tab shows scrollable N5 radical verification list.
- Added maintainer doc `docs/content/radical-mnemonic-images.md` and linked from `curriculum/README.md`.
- Extended `expo-sqlite` mock with `items` query support and `__mockSetItems` for repository tests.
- Added `@testing-library/react-native` and `@types/react-test-renderer` as devDependencies for component tests.
- Code review (2026-06-06): reset `hasError` on `imageUrl` change; HTTPS-only URL validation; expanded unit tests.

### File List

- `mobile/src/components/common/MnemonicImage.tsx` (new)
- `mobile/src/components/common/MnemonicImage.test.tsx` (new)
- `mobile/src/components/common/index.ts` (new)
- `mobile/src/data/curriculum/curriculum.types.ts` (new)
- `mobile/src/data/curriculum/radicalRepository.ts` (new)
- `mobile/src/data/curriculum/radicalRepository.test.ts` (new)
- `mobile/src/data/hooks/useRadicals.ts` (new)
- `mobile/src/app/(tabs)/learn.tsx` (modified)
- `mobile/src/utils/mnemonicAccessibilityLabel.ts` (new)
- `mobile/src/utils/mnemonicAccessibilityLabel.test.ts` (new)
- `mobile/__mocks__/expo-image.tsx` (new)
- `mobile/__mocks__/expo-sqlite.ts` (modified)
- `mobile/package.json` (modified)
- `mobile/package-lock.json` (modified)
- `docs/content/radical-mnemonic-images.md` (new)
- `curriculum/README.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-06-06 — Story 1.7 implemented: MnemonicImage disk cache, radical list on Learn tab, maintainer R2 workflow docs, unit tests.
- 2026-06-06 — Code review: fixed sticky `hasError`, HTTPS-only URL validation, expanded tests; story approved.
