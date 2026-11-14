# Web App Part 1 — Web Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The existing Expo app runs in Chrome and Safari with the core loop (onboarding → lesson → review → Browse → Stats → Settings, backup/restore), hosted on Cloudflare Workers static assets. No server, no sign-in yet.

**Architecture:** Same code as mobile. `expo-sqlite` on web (wa-sqlite + OPFS) runs the existing dual-DB data layer unchanged, after three fixes to its web sync bridge carried as a `patch-package` patch. Native-only voice libraries are swapped for an empty stub at bundle time on web, and every surface that needs them (Talk, voice, notifications, theme override, curriculum OTA, third-party imports) is hidden behind one capability module.

**Tech Stack:** Expo SDK 55, expo-router (web output `single`), expo-sqlite 55.0.17 web, NativeWind, Jest (`jest-expo`), patch-package, Cloudflare Wrangler 4.

**Spec:** `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md` (Part 1). Background: `docs/design/backup-and-web-plan.md` §B.

## Findings from the 2026-11-04 probe build (change the spec's Part 1 details)

A throwaway web build was run in Chrome (all probe changes reverted). Results:

1. `importDatabaseFromAssetAsync` **works on web** in expo-sqlite 55.0.17 (`web/worker.ts` handles `importAssetDatabase`). The curriculum loaded and a lesson ran. So **no `database.web.ts`** — `src/data/database.ts` stays as is.
2. `expo-sqlite` web has **three** sync-bridge bugs, not one: (a) the length truncation (expo/expo#44148); (b) `invokeWorkerSync` gives up after 1,000,000 `Atomics.pause()` spins (milliseconds), so ordinary writes such as `setOnboardingCompleted` fail with `Sync operation timeout`; (c) the result buffer is a fixed 1 MB, and a full `getAllSync` of a large table (backup export) is larger.
3. `web.output: "static"` pre-renders every route in Node and crashes on `react-native-executorch` import. Use `"single"`.
4. Metro needs `wasm` in `assetExts`.
5. `react-native-executorch` throws at import on web (`NativeETInstaller.js`), and is imported by `PronunciationButton` (lesson/Browse), so it must be stubbed at bundle time.
6. `Appearance.setColorScheme` does not exist on react-native-web; `useThemeMode` crashes Home. Theme follows the system on web (NativeWind `darkMode: 'media'`).
7. The web tab bar overlaps the Home header.
8. `crossOriginIsolated === true` with COOP/COEP headers served.

## Global Constraints

- Native behaviour must not change. All native tests stay green: `cd mobile && npm test`.
- Fallible ops return `Result<T, AppError>` (`src/types/result.types.ts`); do not throw across async boundaries.
- Never write to `curriculum.db`.
- Hide unsupported surfaces on web (absent, not broken). No silent fallbacks (no `localStorage` key storage, no try/catch that hides a missing feature).
- Not in scope: service worker, offline shell, install prompt, Talk/voice/notifications on web, curriculum OTA on web.
- Styling: semantic NativeWind tokens only, no raw hex.
- `npm run lint` in `mobile/` must pass (a11y rules).
- Host on the operator's own domain (decided). Never ship on `*.workers.dev`. Deploying is outward-facing: the operator runs it or approves it.
- Headers on every response: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`.

## Review Focus

1. **App open in two browser tabs.** OPFS access handles are exclusive, so the second tab cannot open `user.db`. Expected: a plain message telling the user to close the other tab and reload — not a raw SQLite error. Test in Task 5.
2. **Large query results (> 1 MB).** Backup export of a heavy user reads whole tables with `getAllSync`. Expected: works. Test in Task 1 (2 MB result).
3. **Slow OPFS writes.** Expected: a write that takes 1–5 s completes; only a genuinely stuck worker (30 s) errors. Checked in Task 7's browser walk (onboarding completion is the known trigger).
4. **Deep link to `/converse` on web.** Expected: redirect to Home, no crash. Test in Task 3.
5. **Restoring a backup exported from the phone, on the web.** Expected: the preview counts and the restore work exactly as on mobile. Test in Task 4; manual round trip in Task 7.

## File map

| File | Responsibility |
| --- | --- |
| `mobile/patches/expo-sqlite+55.0.17.patch` | The three sync-bridge fixes |
| `mobile/__tests__/expoSqliteWebPatch.test.ts` | Proves the patch is applied |
| `mobile/metro.config.js` | `wasm` asset ext, web stub for native voice libs, COOP/COEP on the dev server |
| `mobile/web-stubs/native-module-stub.js` | Empty module used on web for native-only packages |
| `mobile/app.json` | `web.output: "single"` |
| `mobile/public/_headers` | COOP/COEP for Cloudflare |
| `mobile/wrangler.jsonc` | Cloudflare Workers static-assets config |
| `mobile/src/platform/capabilities.ts` | The only place that decides what exists on web |
| `mobile/src/data/user/backupFile.ts` / `backupFile.web.ts` | Save and read backup bytes per platform |
| `mobile/src/platform/requestPersistentStorage.ts` / `.web.ts` | `navigator.storage.persist()` on web, no-op native |

---

### Task 1: Patch expo-sqlite's web sync bridge

**Files:**
- Modify (via patch): `mobile/node_modules/expo-sqlite/web/WorkerChannel.ts`
- Create: `mobile/patches/expo-sqlite+55.0.17.patch`
- Modify: `mobile/package.json` (devDependency `patch-package`, script `"postinstall": "patch-package"`)
- Test: `mobile/__tests__/expoSqliteWebPatch.test.ts`

**Interfaces:**
- Produces: a working synchronous SQLite bridge on web. No app-code API changes.

- [ ] **Step 1: Write the failing test**

```ts
import { sendWorkerResult } from 'expo-sqlite/web/WorkerChannel';

function syncTrait(initial = 1024 * 1024) {
  return {
    lockBuffer: new SharedArrayBuffer(4),
    resultBuffer: new SharedArrayBuffer(initial, { maxByteLength: 256 * 1024 * 1024 }),
  };
}
function readLength(buf: SharedArrayBuffer) {
  return new Uint32Array(buf, 0, 1)[0];
}

test('writes the full 32-bit length for a result of 300 bytes', () => {
  const trait = syncTrait();
  sendWorkerResult({ id: 1, result: 'x'.repeat(300), error: null, syncTrait: trait });
  expect(readLength(trait.resultBuffer)).toBeGreaterThan(300); // serialized JSON, not length & 0xFF
});

test('grows the result buffer for a 2 MB result', () => {
  const trait = syncTrait();
  sendWorkerResult({ id: 2, result: 'y'.repeat(2 * 1024 * 1024), error: null, syncTrait: trait });
  const length = readLength(trait.resultBuffer);
  expect(length).toBeGreaterThan(2 * 1024 * 1024);
  expect(trait.resultBuffer.byteLength).toBeGreaterThanOrEqual(4 + length);
});
```

(Check `sendWorkerResult`'s exact export name and parameter shape in `WorkerChannel.ts` first and match it; if Jest does not transform this file, add `expo-sqlite` to `transformIgnorePatterns`' allowlist.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd mobile && npx jest __tests__/expoSqliteWebPatch.test.ts`
Expected: FAIL — first test reads a truncated length; second throws `RangeError` (offset out of bounds).

- [ ] **Step 3: Edit `node_modules/expo-sqlite/web/WorkerChannel.ts`**

Three changes:
1. Worker side: `if (4 + length > resultBuffer.byteLength) resultBuffer.grow(4 + length);` then `new Uint32Array(resultBuffer, 0, 1)[0] = length;` (replaces `resultArray.set(new Uint32Array([length]), 0)`), then write the bytes at offset 4 through a fresh `Uint8Array(resultBuffer)` view.
2. Main side `invokeWorkerSync`: allocate `new SharedArrayBuffer(1024 * 1024, { maxByteLength: 256 * 1024 * 1024 })`; read with `new Uint8Array(resultBuffer, 4, length)`.
3. Main side wait loop: replace both iteration-count limits with a wall-clock deadline of **30 000 ms** (`Date.now()` checked every 1 000 spins), same error text `Sync operation timeout`.

- [ ] **Step 4: Run it and see it pass**

Run: `cd mobile && npx jest __tests__/expoSqliteWebPatch.test.ts` → PASS.

- [ ] **Step 5: Save the patch and prove it re-applies**

Run: `cd mobile && npm i -D patch-package && npx patch-package expo-sqlite && rm -rf node_modules/expo-sqlite && npm install && npx jest __tests__/expoSqliteWebPatch.test.ts`
Expected: `patches/expo-sqlite+55.0.17.patch` exists; test PASS after reinstall. Add a comment line at the top of the patch's hunk area or in `mobile/README.md` linking expo/expo#44148 and stating "re-check on every expo-sqlite bump".

- [ ] **Step 6: Commit**

```bash
git add mobile/patches mobile/package.json mobile/package-lock.json mobile/__tests__/expoSqliteWebPatch.test.ts
git commit -m "fix(web): patch expo-sqlite sync bridge (length, timeout, result size)"
```

---

### Task 2: Web bundle builds

**Files:**
- Modify: `mobile/app.json` (`expo.web.output`: `"static"` → `"single"`)
- Modify: `mobile/metro.config.js`
- Create: `mobile/web-stubs/native-module-stub.js` (`module.exports = {};`)
- Create: `mobile/public/_headers`
- Modify: `mobile/package.json` scripts: `"build:web": "expo export -p web"`

**Interfaces:**
- Produces: `npm run build:web` → `mobile/dist/` with `index.html`, `_headers`, the wasm, and the seed `curriculum.db`.

- [ ] **Step 1: Run the build and see it fail**

Run: `cd mobile && npm run build:web`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'get')` in `react-native-executorch/.../NativeETInstaller.js`.

- [ ] **Step 2: Change `metro.config.js`**

- `config.resolver.assetExts.push('wasm')`.
- `config.resolver.resolveRequest`: when `platform === 'web'` and the module name matches `^(react-native-executorch|react-native-executorch-expo-resource-fetcher|react-native-audio-api)(/|$)`, return `{ type: 'sourceFile', filePath: path.resolve(__dirname, 'web-stubs/native-module-stub.js') }`; otherwise defer to the previous resolver or `context.resolveRequest`. (The stub must be inside the project root or Metro cannot hash it.)
- `config.server.enhanceMiddleware`: set the two COOP/COEP headers on every response so `expo start --web` is cross-origin isolated too.

- [ ] **Step 3: Write `public/_headers`**

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

- [ ] **Step 4: Build and check the output**

Run: `cd mobile && npm run build:web && ls dist/_headers && find dist -name '*.wasm' -o -name 'curriculum.*.db' | head`
Expected: exit 0; `_headers`, one `wa-sqlite.*.wasm`, one `curriculum.*.db` listed.

- [ ] **Step 5: Check native is unchanged**

Run: `cd mobile && npm test && npm run typecheck`
Expected: PASS (same counts as before the task).

- [ ] **Step 6: Commit**

```bash
git add mobile/app.json mobile/metro.config.js mobile/web-stubs mobile/public/_headers mobile/package.json
git commit -m "build(web): single-page export, wasm asset, native voice stub, COOP/COEP"
```

---

### Task 3: Capabilities, and hide what web does not support

**Files:**
- Create: `mobile/src/platform/capabilities.ts`, `mobile/src/platform/capabilities.test.ts`
- Modify: `mobile/src/app/(tabs)/_layout.web.tsx` (remove the Talk trigger)
- Modify: `mobile/src/app/(tabs)/converse/_layout.tsx` (`<Redirect href="/" />` when `!supportsTalk()`)
- Modify: `mobile/src/components/learn/PronunciationButton.tsx` (return `null` when `!supportsVoice()`)
- Modify: `mobile/src/app/(tabs)/settings/index.tsx` (hide `ByokSettingsSection`, `VoiceModelsSettingsSection`, the notifications block, the theme picker)
- Modify: `mobile/src/data/hooks/useThemeMode.ts` (skip `Appearance.setColorScheme` when `!supportsThemeOverride()`)
- Modify: `mobile/src/providers/DatabaseProvider.tsx` (skip the background curriculum update when `!supportsCurriculumOta()`)
- Modify: the web tab layout styles so the tab bar no longer overlaps the screen header (probe finding 7)
- Tests: the co-located `*.test.tsx` of each modified screen/component

**Interfaces:**
- Produces (all `() => boolean`, read `Platform.OS` at call time so tests can switch it):
  `isWeb()`, `supportsTalk()`, `supportsVoice()`, `supportsNotifications()`, `supportsThemeOverride()`, `supportsCurriculumOta()`, `supportsThirdPartyImport()` — each is `!isWeb()` for now.

- [ ] **Step 1: Write the failing tests**

Use the existing `setPlatform(os)` pattern from `src/app/(tabs)/index.test.tsx` (`Object.defineProperty(Platform, 'OS', …)`, restore `'ios'` after each test).
- `capabilities.test.ts`: on `'web'` every `supports*()` is `false` and `isWeb()` is `true`; on `'ios'` and `'android'` the reverse.
- `PronunciationButton` test: on web, `queryByTestId('pronunciation-button')` is `null`.
- Settings test: on web, `settings-notifications-toggle`, `settings-theme-mode-light`, and the BYOK and voice-model section test IDs are absent; on iOS they are present.
- Converse layout test: on web, renders a redirect to `/`.
- `useThemeMode` test: on web, `Appearance.setColorScheme` is not called (mock it as `undefined`, assert no throw).
- `DatabaseProvider` test: on web, `checkAndApplyCurriculumUpdate` is not called.

- [ ] **Step 2: Run them and see them fail**

Run: `cd mobile && npx jest src/platform src/components/learn/PronunciationButton src/app/\(tabs\)/settings src/app/\(tabs\)/converse src/data/hooks/useThemeMode src/providers/DatabaseProvider`
Expected: FAIL (module `@/platform/capabilities` not found, elements present).

- [ ] **Step 3: Implement `capabilities.ts` and the guards listed under Files**

- [ ] **Step 4: Run them and see them pass; run the full suite**

Run: same command → PASS; then `npm test && npm run lint && npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): capability checks; hide Talk, voice, notifications, theme override, OTA on web"
```

---

### Task 4: Backup and restore on web

**Files:**
- Create: `mobile/src/data/user/backupFile.ts` (native: the current `writeBackupFile`/`readBackupFile` bodies, including their test-mode branches, moved out of `exportBackup.ts` / `restoreBackup.ts`)
- Create: `mobile/src/data/user/backupFile.web.ts`, `mobile/src/data/user/backupFile.web.test.ts`
- Modify: `mobile/src/data/user/exportBackup.ts`, `restoreBackup.ts` (call the new module)
- Modify: `mobile/src/app/(tabs)/settings/index.tsx` (skip `Sharing` when `fileUri` is `null`)
- Modify: `mobile/src/app/onboarding/import.tsx`, `welcome.tsx` (on web: only the "restore a backup" source; hide WaniKani/Bunpro/Anki pills when `!supportsThirdPartyImport()` — they need secure storage or the file system)

**Interfaces:**
- Consumes: `supportsThirdPartyImport()` from Task 3.
- Produces:
  - `saveBackupFile(fileName: string, base64: string): Promise<string | null>` — native: writes to the document directory, returns the `file://` URI; web: triggers a browser download of `fileName` (Blob + `<a download>`), returns `null`.
  - `readBackupFile(fileUri: string): Promise<string>` — returns base64. Native: unchanged behaviour. Web: `fetch(fileUri)` (document picker gives a `blob:` URI) → bytes → base64.
  - `ExportBackupResult.fileUri` becomes `string | null`.

- [ ] **Step 1: Write the failing tests**

`backupFile.web.test.ts` (import `./backupFile.web` directly):
- `readBackupFile('blob:x')` with `global.fetch` mocked to return bytes `[0x1f, 0x8b, 0x08]` resolves to `'H4sI'`.
- `saveBackupFile('pakapaka-backup-1.json.gz', 'H4sI')` calls `URL.createObjectURL` once, clicks an anchor whose `download` is `pakapaka-backup-1.json.gz`, calls `URL.revokeObjectURL`, and resolves `null` (stub `document.createElement` / `URL`).
- Settings test (web): after a successful export, `Sharing.shareAsync` is not called and no error text is shown.
- Onboarding import test (web): WaniKani/Bunpro/Anki options absent; backup option present. Welcome test (web): the three pills absent.
- Existing `exportBackup.test.ts` / `restoreBackup.test.ts` pass unchanged (native path).

- [ ] **Step 2: Run them and see them fail**

Run: `cd mobile && npx jest src/data/user/backupFile src/data/user/exportBackup src/data/user/restoreBackup src/app/\(tabs\)/settings src/app/onboarding`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement as listed under Files/Interfaces**

- [ ] **Step 4: Run them and see them pass; full suite**

Run: same, then `npm test && npm run lint && npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): backup download and restore from picked file on web"
```

---

### Task 5: Browser storage — persistence and the second-tab case

**Files:**
- Create: `mobile/src/platform/requestPersistentStorage.ts` (native no-op), `requestPersistentStorage.web.ts`, `requestPersistentStorage.web.test.ts`
- Modify: `mobile/src/providers/DatabaseProvider.tsx` (call it once after a successful open; on web, the error screen adds one line)
- Test: `mobile/src/providers/DatabaseProvider.test.tsx`

**Interfaces:**
- Produces: `requestPersistentStorage(): Promise<'granted' | 'denied' | 'unsupported'>`. Web: `navigator.storage?.persist` missing → `'unsupported'`; else `persisted()` true → `'granted'`; else `persist()` result. Never throws (wrap and return `'unsupported'`).

- [ ] **Step 1: Write the failing tests**

- `requestPersistentStorage.web.test.ts`: three cases — no `navigator.storage` → `'unsupported'`; `persisted()` true → `'granted'` and `persist` not called; `persisted()` false, `persist()` false → `'denied'`.
- `DatabaseProvider.test.tsx` (web, `initializeDatabases` mocked to fail): screen shows `Unable to open local databases.` **and** `If PakaPaka is open in another tab, close that tab and reload this page.` On iOS the second line is absent.

- [ ] **Step 2: Run, see fail** — `npx jest src/platform/requestPersistentStorage src/providers/DatabaseProvider` → FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run, see pass; full suite** → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): request persistent storage; explain the second-tab DB error"
```

---

### Task 6: Cloudflare hosting

**Files:**
- Create: `mobile/wrangler.jsonc`
- Modify: `mobile/package.json` (devDependency `wrangler`; script `"deploy:web": "npm run build:web && wrangler deploy"`)
- Modify: `mobile/.gitignore` (`.wrangler/`, `.dev.vars`)

**Interfaces:**
- Produces: a Worker named `pakapaka-web` serving `dist/` as a single-page app. Part 2 adds the API to this same Worker (same origin).

- [ ] **Step 1: Write `wrangler.jsonc`**

```jsonc
{
  "name": "pakapaka-web",
  "compatibility_date": "2026-11-01",
  "assets": { "directory": "./dist", "not_found_handling": "single-page-application" }
  // "routes": [{ "pattern": "<operator domain>", "custom_domain": true }]  ← added in Step 4
}
```

- [ ] **Step 2: Run locally and check isolation**

Run: `cd mobile && npm run build:web && npx wrangler dev --port 8787` then in Chrome open `http://localhost:8787`, run `crossOriginIsolated` in the console.
Expected: `true`; `curl -sI http://localhost:8787/ | grep -i cross-origin` shows both headers; a deep URL such as `/browse` returns `index.html`.

- [ ] **Step 3: Commit**

```bash
git add mobile/wrangler.jsonc mobile/package.json mobile/package-lock.json mobile/.gitignore
git commit -m "build(web): Cloudflare Workers static-assets hosting"
```

- [ ] **Step 4: Domain and first deploy — operator step**

Stop and ask the operator for: the domain name (bought and added to their Cloudflare account) and approval to deploy. Then add the `routes` entry, `npx wrangler login` (operator runs it), `npm run deploy:web`.
Expected: `https://<domain>/` loads; `crossOriginIsolated === true` on the deployed page. Commit the `routes` change.

---

### Task 7: Walk every core screen in Chrome and Safari, fix what breaks

**Files:** whatever the walk finds; each logic fix gets a co-located test.

- [ ] **Step 1: Walk, on the local `wrangler dev` build, in Chrome and in Safari (macOS Safari 17+)**

Checklist (record pass/fail for each, in both browsers):
- Onboarding: all three paths (new / placement / restore a backup); onboarding completes (Review Focus 3).
- Lesson: full lesson incl. the quiz; Return advances.
- Review: typed meaning and reading answers (wanakana kana input), wrong answer, synonym add, Return-to-advance, summary.
- Browse: search, filters, item detail (no pronunciation button), passage view.
- Stats; Settings (no Talk/voice/notifications/theme rows).
- Backup: export downloads a `.json.gz`; restore that file; restore a file exported **from the phone** (Review Focus 5).
- Second tab shows the Task 5 message (Review Focus 1).
- `/converse` redirects to Home (Review Focus 4).
- Reload keeps progress.

- [ ] **Step 2: Fix each failure** with a test where the fix is logic (not pure layout), then `npm test && npm run lint && npm run typecheck`.

- [ ] **Step 3: Commit per fix** (`fix(web): …`).

---

### Task 8: Update the docs

**Files:**
- Modify: `docs/design/backup-and-web-plan.md` — §B1.2: seeding works on web in 55.0.17; §B1.4/§B5: three bugs, patched via `patch-package` (decided); §B3.6 and the PWA items: superseded by the spec; link the spec.
- Modify: `docs/working-history.md` — the web-app row: Part 1 done (date), with the remaining parts.
- Modify: `mobile/README.md` — `npm run build:web`, `npx wrangler dev`, `npm run deploy:web`; the expo-sqlite patch and when to re-check it.

- [ ] **Step 1: Edit the three files as listed**
- [ ] **Step 2: Commit** — `git commit -am "docs: web build part 1 status and how to run it"`
