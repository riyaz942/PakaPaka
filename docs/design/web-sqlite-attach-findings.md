# Web SQLite: cross-database ATTACH findings (expo-sqlite v55 / wa-sqlite / OPFS)

Investigated 2026-08-06. Installed version: **expo-sqlite 55.0.17** (expo ~55.0.27).
All `web/…` line numbers refer to `mobile/node_modules/expo-sqlite/`.

## Verdict — **ATTACH works. EXECUTED, not inferred.**

Cross-database `ATTACH` + `JOIN` between `user.db` and `curriculum.db` was **executed successfully**
against the exact `AccessHandlePoolVFS` + `wa-sqlite.wasm` (SQLite 3.50.3) build vendored in
expo-sqlite 55.0.17, using the real 2.2 MB `curriculum.db`, driven through a Node harness with an
OPFS shim. `mobile/src/data/database.ts:117` needs **no change** for web: on web
`curriculumDb.databasePath` is `./curriculum.db`, which the VFS normalizes to the same pool slot the
standalone curriculum connection already holds. Peak pool usage is 3 of 6 slots — the capacity risk
is real but the app is well under it.

**However — while confirming this I found a strictly bigger web blocker that has nothing to do with
ATTACH: the app makes 222 synchronous SQLite calls and 0 async ones, and expo-sqlite's web sync
channel is broken for any result ≥ 256 bytes, in every published version through the current latest
(57.0.1).** See "The actual web blocker" below. Do not plan web work around ATTACH; plan it around
sync-vs-async.

---

## Q1 — Capacity math

### Journal mode the app actually uses

**No journal-mode pragma exists anywhere in the app.** `grep -rn "journal_mode\|PRAGMA" mobile/src`
returns only:

- `mobile/src/data/database.ts:135` — `PRAGMA foreign_keys = ON`
- `mobile/src/data/migrations/018_ai_session_topic_ids.ts:19` — `PRAGMA table_info(...)` (a read)

So both databases run SQLite's default **`journal_mode = DELETE`** (rollback journal). This is the
right answer for this VFS anyway: `AccessHandlePoolVFS` implements no `xShmMap`, so
`journal_mode = WAL` is not available on web at all. Nothing needs changing here.

### Pool slots consumed

`DEFAULT_CAPACITY = 6` (`web/wa-sqlite/AccessHandlePoolVFS.js:25`), allocated once at
`AccessHandlePoolVFS.js:234` inside `isReady()`. A slot is one entry in `#mapPathToAccessHandle`
(`getSize()`, line 244); capacity is the number of physical OPFS files (`getCapacity()`, line 252).

Steady-state and peak inventory for this app:

| Pool key | When it exists | Slot |
|---|---|---|
| `/user.db` | always | 1 |
| `/user.db-journal` | only while a write txn is open (migrations, SRS writes) | 2 |
| `/curriculum.db` | always | 3 |
| `/curriculum.db-journal` | only during first-launch seed / OTA swap `backup()` | 4 |
| super-journal | **never** — SQLite only creates one when a txn writes to 2+ attached DBs, and curriculum is never written | — |

**Predicted peak = 4 of 6. Measured peak = 3 of 6** (see Q4 — the seed's `srcDb`/`destDb` share one
slot and the backup never opens a curriculum journal). Three slots of headroom.

Note the ATTACH does **not** add a slot: the attached curriculum resolves to the same
`#mapPathToAccessHandle` entry as the standalone `curriculumDb` connection (see Q2). Journal slots
are reclaimed: `jDelete` → `#deletePath` (line 450) returns the handle to `#availableAccessHandles`.

Residual risk I flagged before testing — SQLite temp files for large sorts open with
`zName === null`, which `jOpen` line 75 assigns a random path, consuming a slot — **was tested and
does not occur**: a forced external sort over a cross-database join with `cache_size=8` moved the
pool not at all (Q4 test C). Temp storage in this wasm build is in-memory.

The genuine capacity risk is not this app's own file count, it is **shared-origin pollution**.
`localhost:8081` is one OPFS origin for every Expo web project you have ever run, and leaked pool
associations accumulate there. This is exactly what upstream users hit (Q6).

### Can app code call `addCapacity()`?

**No.** `addCapacity` (line 261) is never called from `web/worker.ts` outside the one-time
`isReady()` bootstrap, and there is no worker message type for it — `web/web.types.ts` has no such
message, and `web/SQLiteModule.ts` exposes no hook. The `_vfs` instance is a module-local in the
worker (`worker.ts:55`) and is not reachable from the main thread.

Two escape hatches if 6 ever proves too few:

1. **Pre-seed the OPFS directory (no patching).** `#acquireAccessHandles()` (line 295) enumerates
   *every* file in the OPFS directory `expo-sqlite/` at VFS start and adds each to capacity. A
   zero-length file fails the digest check (line 356), logs `Disassociating file with bad digest`,
   and lands in `#availableAccessHandles` — i.e. it becomes a usable free slot. So creating N empty
   files in OPFS `expo-sqlite/` before the first expo-sqlite call raises capacity by N. INFERRED.
2. `patch-package` on `worker.ts` to call `_vfs.addCapacity(n)` after `create()`.

### Failure mode if capacity is exceeded — **EXECUTED**

Not silent, but the useful half of the message is decoupled from the throwable half.
`AccessHandlePoolVFS.js:79-87`: when `getSize() >= getCapacity()` it
`throw new Error('cannot create file')`, which the surrounding `catch` (line 99) turns into
`console.error('cannot create file')` + `return SQLITE_CANTOPEN`. Observed exactly this:

```
   filler2.db opened; size=5/6
cannot create file                                         <- console.error only
   filler3.db THREW: SQLiteError: Error code 14: unable to open database file  (code=14)
```

So: `cannot create file` in the console, `SQLITE_CANTOPEN (14) unable to open database file` thrown.
In the app that surfaces as a throw from `execSync`/`getAllSync`, landing in the `catch` in
`initializeDatabases` as `DB_INIT_ERROR` with a message that does not mention capacity at all.
Note the wall was hit not on *opening* the 7th database but on the first *write* to the 6th — the
rollback journal is what pushes past capacity. Users report exactly this error string (Q6).

---

## Q2 — The exact path string

`#getPath(nameOrURL)` — `AccessHandlePoolVFS.js:441`:

```js
const url = typeof nameOrURL === 'string' ? new URL(nameOrURL, 'file://localhost/') : nameOrURL;
return url.pathname;
```

It resolves the name against `file://localhost/` and returns `url.pathname`. Therefore all of
`curriculum.db`, `./curriculum.db`, and `/curriculum.db` normalize to the **same** key
`/curriculum.db`. There is no per-connection namespacing.

`jFullPathname` is a pure copy — `web/wa-sqlite/FacadeVFS.js:76-83` writes the filename back
verbatim — so SQLite's stored full pathname is whatever string was passed in, and normalization
happens only inside `#getPath`. Both the `open_v2` path and the ATTACH path funnel through
`xOpen` → `jOpen` → `#getPath`.

### Is `curriculumDb.databasePath` on web already the right string?

**Yes — no transformation needed.**

- `SQLiteDatabase.databasePath` is set from `createDatabasePath(databaseName, directory)` —
  `expo-sqlite/src/SQLiteDatabase.ts:582,589` and `src/pathUtils.ts:24-36`.
- On web `defaultDatabaseDirectory = '.'` — `expo-sqlite/web/SQLiteModule.ts:392`.
- So `createDatabasePath('curriculum.db')` returns **`'./curriculum.db'`**.
- The main-connection open uses that same string: `worker.ts:406`
  `sqlite3.open_v2(databasePath, flags, VFS_NAME_PERSISTENT)`.
- `#getPath('./curriculum.db')` → `/curriculum.db`. Identical slot.

The existing line `mobile/src/data/database.ts:117` —
`ATTACH DATABASE '${curriculumDb.databasePath...}' AS curriculum` — therefore emits
`ATTACH DATABASE './curriculum.db' AS curriculum` on web and resolves to the already-open handle.

The derived journal name follows the same rule: `./curriculum.db-journal` → `/curriculum.db-journal`.

**EXECUTED confirmation** — all three spellings attach and read the same data with zero pool growth:

```
=== T6. path-string equivalence (do variants hit the same pool slot?) ===
   'curriculum.db'   -> items=1725  poolSize 2->2 (SAME SLOT)
   '/curriculum.db'  -> items=1725  poolSize 2->2 (SAME SLOT)
   './curriculum.db' -> items=1725  poolSize 2->2 (SAME SLOT)
```

### Caveat worth flagging (not a blocker)

`AccessHandlePoolVFS` hands the *same* `FileSystemSyncAccessHandle` to every `fileId` opened on the
same path, and it inherits the no-op `jLock`/`jUnlock` from `FacadeVFS` (lines 154, 163) — there is
no cross-connection locking. Once curriculum is both (a) open as its own `SQLiteDatabase` and
(b) attached to `userDb`, two SQLite connections share one file with no locking. That is benign
while both are read-only, which is the case here. It becomes dangerous during the OTA swap, when
`importAssetDatabase` writes the same file from a third connection — `attachCurriculumForQuery`
already does DETACH-then-ATTACH after `reopenCurriculumDatabase()`, which is the right mitigation,
but on web the *standalone* `curriculumDb` connection's page cache is not invalidated by that.
Worth a separate look when OTA lands on web.

---

## Q3 — `deserializeAsync` on web

**Memory VFS, and it is incompatible with ATTACH-to-OPFS.**

`worker.ts:272-283`:

```js
async function deserializeDatabase(sqlite3, serializedData) {
  const pointer = await sqlite3.open_v2(':memory:', SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE,
                                        VFS_NAME_MEMORY);
  await sqlite3.deserialize(pointer, 'main', serializedData);
  return pointer;
}
```

`VFS_NAME_MEMORY = 'expo-sqlite-memfs'` (`worker.ts:49`) — a `MemoryVFS`, registered non-default at
`worker.ts:803`. `openDatabase` routes to it whenever `serializedData` is present (`worker.ts:389`)
and, separately, whenever `databasePath === ':memory:'` (`worker.ts:405`).

Consequences:

- A deserialized connection's VFS is `MemoryVFS`. `ATTACH` uses the *connection's* VFS, so
  `ATTACH './user.db'` from a deserialized DB would be resolved by `MemoryVFS`, not the OPFS pool.
  With `SQLITE_OPEN_CREATE` set this silently yields an **empty in-memory database** rather than an
  error — the worst possible failure mode.
- The reverse also fails: from the OPFS-backed `userDb`, `ATTACH ':memory:'` creates a *fresh
  private* in-memory database, not the deserialized one. `sqlite3_deserialize` can target a
  non-`main` schema in principle, but expo exposes no API to deserialize into an attached schema of
  an existing connection.

**EXECUTED confirmation of the silent-empty failure** (Q4 test T8): a connection opened on
`expo-sqlite-memfs` and populated via `deserialize` was told to `ATTACH './user.db' AS u`. It
**reported success** and then showed an empty schema — it had fabricated a blank in-memory database:

```
=== T8. can a MemoryVFS (deserialized) connection ATTACH an OPFS db? ===
   deserialized mem db item count = 1725
   ATTACH './user.db' from MemoryVFS conn -> "succeeded", tables seen = []
   >>> SILENTLY EMPTY: it created a blank memfs database, NOT the real user.db
```

**So the deserialize-based seeding approach and the ATTACH approach cannot be combined**, and the
failure is silent rather than loud. Pick one.

**Good news: the app is already on the compatible side.** `openCurriculumDatabase`
(`mobile/src/data/database.ts:47`) calls `importDatabaseFromAssetAsync`, which on web hits
`worker.ts:341-371` `importAssetDatabase`. That deserializes into a scratch connection and then
`sqlite3.backup()`s into the **persistent OPFS file** before closing both. Curriculum therefore
lands in the OPFS pool as a real `/curriculum.db`, exactly where ATTACH needs it. No change needed.

---

## Q4 — Empirical test (**EXECUTED**)

### Why not `SQLiteModule.node.ts`

Dead end. `web/SQLiteModule.node.ts` is a **no-op stub for server rendering** — every method has an
empty body and returns `0`/`[]` (e.g. `execSync(source: string): void {}` at line 38,
`getAllSync(...) { return []; }` at line 93). It never touches wasm. It cannot test anything.

### What I did instead

Built a Node 22 harness that loads the **real vendored artifacts** —
`web/wa-sqlite/wa-sqlite.wasm`, `sqlite-api.js`, `AccessHandlePoolVFS.js`, `MemoryVFS.js`, copied
byte-for-byte from `node_modules` — behind a ~100-line shim implementing the OPFS surface the VFS
uses (`navigator.storage.getDirectory`, `getFileHandle`, `createSyncAccessHandle` with
`read/write/truncate/getSize/flush/close`, directory async-iteration) on top of `node:fs`. It then
replicates `worker.ts` semantics exactly: VFS named `expo-sqlite` registered as default, database
paths spelled `./<name>` (because `defaultDatabaseDirectory === '.'`), and the seed performed the
way `importAssetDatabase` does it (open persistent → `deserialize` → `backup` into persistent).

Harness (throwaway, not in the repo):
`/private/tmp/claude-502/.../scratchpad/harness/{opfs-shim.js,attach-test.mjs,attach-test2.mjs}`

**Fidelity caveat:** this is real SQLite + the real VFS class, but a Node fs shim rather than a
browser's OPFS, and single-threaded rather than inside a Web Worker. It proves SQLite/VFS
*semantics*; it does not prove browser-specific behavior (storage quota, `createSyncAccessHandle`
exclusivity across tabs, COOP/COEP). Those are separately covered by the upstream reports in Q6.

### Run 1 output (verbatim)

```
sqlite version: 3.50.3

=== T0. fresh VFS ===
   [pool] after create: size=0 capacity=6

=== T1. seed curriculum.db exactly like worker.ts importAssetDatabase() ===
   asset bytes: 2310144
   [pool] mid-backup (curriculum.db open): size=1 capacity=6
   [pool] post-backup: size=1 capacity=6
   [pool] after seed, both closed: size=1 capacity=6
   OPFS dir: 6 files

=== T2. open user.db + curriculum.db as the app does ===
   [pool] both main DBs open: size=2 capacity=6
   journal_mode(user) = delete
   journal_mode(curriculum) = delete
   temp_store = 0
   curriculum item count (own conn) = 1725

=== T3. migrations-style write on user.db (journal slot churn) ===
   [pool] after DDL commit: size=2 capacity=6
   [pool] INSIDE open write txn (journal live): size=3 capacity=6
   [pool] after COMMIT (journal should be released): size=2 capacity=6

=== T4. THE TEST: ATTACH curriculum onto user.db ===
   ATTACH ./curriculum.db  -> OK
   [pool] after ATTACH: size=2 capacity=6
   database_list = [[0,"main","./user.db"],[2,"curriculum","./curriculum.db"]]

=== T5. cross-database JOIN ===
   curriculum.items sample ids = [[1],[2],[3]]
   CROSS-DB JOIN rows = [[1,"radical","guru"],[2,"radical","guru"],[3,"radical","guru"]]
   aggregate across DBs = [["vocabulary",1245],["kanji",200],["grammar",171],["radical",109]]

=== T5b. write txn WHILE attached (does it need a 2nd journal / super-journal?) ===
   [pool] INSIDE write txn with curriculum attached: size=3 capacity=6
   [pool] after COMMIT: size=2 capacity=6

=== T6. path-string equivalence ===
   'curriculum.db' -> items=1725  poolSize 2->2 (SAME SLOT)
   '/curriculum.db' -> items=1725  poolSize 2->2 (SAME SLOT)
   './curriculum.db' -> items=1725  poolSize 2->2 (SAME SLOT)

=== T7. capacity exhaustion failure mode ===
   capacity=6 size=2; opening filler DBs...
   filler0.db opened; size=3/6
   filler1.db opened; size=4/6
   filler2.db opened; size=5/6
cannot create file
   filler3.db THREW: SQLiteError: Error code 14: unable to open database file  (code=14)

=== T8. can a MemoryVFS (deserialized) connection ATTACH an OPFS db? ===
   deserialized mem db item count = 1725
   ATTACH './user.db' from MemoryVFS conn -> "succeeded", tables seen = []
   >>> SILENTLY EMPTY: it created a blank memfs database, NOT the real user.db
```

### Run 2 output (verbatim) — app-shaped queries, idempotency, temp spill

```
=== A. app pattern: DETACH-then-ATTACH, called twice (idempotency) ===
   pass 1: DETACH threw (expected on first): Error code 1: no such database: curriculum
   pass 1: ATTACH ok, items=1725
   pass 2: DETACH ok
   pass 2: ATTACH ok, items=1725
   [pool] after 2 attach cycles: size=2 capacity=6

=== B. real app query shapes across the ATTACH boundary ===
   mastery-shape: [["vocabulary",716],["kanji",106],["radical",76],["grammar",74]]
   browse-shape: [[1041,"会","meet",null],[1041,"会","かい",null],[1018,"同","same",null]]
   passages: [[19]]

=== C. temp-file spill: does a big sort consume a pool slot? ===
   temp_store = 0
   sorted 20001 rows
   pool size before=2 peak-during-sort=2 after=2
   >>> no pool slot consumed (temp storage is in-memory)

=== D. worst realistic peak, all at once ===
   [pool] write txn open + curriculum attached + curriculum open standalone: size=3 capacity=6
   [pool] with standalone curriculum connection too: size=3 capacity=6
   [pool] final: size=2 capacity=6
OPFS files on disk: 6
```

### What this establishes

| Claim | Status |
|---|---|
| ATTACH resolves to the already-open OPFS pool slot | **EXECUTED** |
| Cross-database JOIN returns correct rows | **EXECUTED** |
| `curriculumDb.databasePath` (`./curriculum.db`) is the right string, no transform | **EXECUTED** |
| `journal_mode` is `delete` on both DBs, unset by the app | **EXECUTED** |
| Peak pool usage 3/6, journal slot released on COMMIT | **EXECUTED** |
| No super-journal even with a write txn while attached | **EXECUTED** |
| Temp/sort spill does not consume pool slots | **EXECUTED** |
| `attachCurriculumForQuery`'s DETACH-then-ATTACH is safe and idempotent | **EXECUTED** |
| Capacity failure = console `cannot create file` + thrown SQLITE_CANTOPEN(14) | **EXECUTED** |
| Deserialized (MemoryVFS) connection cannot reach OPFS DBs, fails silently | **EXECUTED** |
| Behavior inside a real browser Worker with real OPFS | **INFERRED** (shim, not browser) |

---

## Q5 — Blast radius (EXECUTED greps)

Cross-database SQL is far more contained than the file counts suggest. Counting only
`curriculum.<real table name>` (tables enumerated from `curriculum.db` itself) plus the
alias-interpolated form `${C}.` used in `browseRepository`:

**6 production files, ~16 references.**

| File | Refs | Tables touched |
|---|---|---|
| `mobile/src/data/curriculum/browseRepository.ts` | 5 | `accepted_answers` x2, `kanji_readings`, `items`, `reading_passages` |
| `mobile/src/data/ai/recentGrammarRepository.ts` | 7 | `items` x3, `grammar_rules` x3, `example_sentences` |
| `mobile/src/data/ai/wordLookupRepository.ts` | 1 | `items` |
| `mobile/src/data/user/furiganaOverrideRepository.ts` | 1 | `items` |
| `mobile/src/data/user/masteryRepository.ts` | 1 | `items` |
| `mobile/src/data/database.ts` | 1 | (comment only, line 102) |

`CURRICULUM_ATTACH_ALIAS` itself is imported in exactly **one** place outside `database.ts`:
`mobile/src/data/curriculum/browseRepository.ts:13,33`.

5 test files also use qualified `curriculum.*` SQL and would need the same treatment
(`itemRepository.test.ts`, `browseRepository.test.ts`, `passageRepository.test.ts`,
`greetingRepository.test.ts`, and the `browse/passage/[id].test.tsx` / `useReadingReadiness` suites).

Nothing in `mobile/src/core/srs/` uses cross-database SQL — the SRS queue reads `user.db` only and
is joined to curriculum at the hook layer.

**Implication:** if ATTACH turned out to be unusable, the fallback (two round-trips: query
curriculum by id-set, then user state, join in JS) is a ~1-2 day change touching 6 files, not a
rewrite. That is a cheap insurance policy, not a weeks-long risk.

---

## Q6 — Upstream

### The capacity limit is a real, frequently-hit problem in the wild

[expo/expo#39903](https://github.com/expo/expo/issues/39903) — *"Expo-sqlite Web Support - cannot
create file - Error: sqlite3_open_v2"*, opened 2025-09-22, **closed 2026-05-16 as stale, never
fixed**. Reproduces on a blank `create-expo-app` + `SQLiteProvider` on Chrome, Edge, Brave, and
Firefox. Diagnosed in-thread by `adrian-stokes` (2026-01-16) as exactly `DEFAULT_CAPACITY = 6` in
`AccessHandlePoolVFS.js:25`, with the note that "redundant files are being created/left in addition
to the SQLite database files (perhaps related to the associated journal files?)" and that "the
situation is compounded if you have multiple projects and/or database files, as the limit is reached
more quickly." Workaround that people confirm works — clear OPFS from the console (Chrome DevTools'
"clear site data" does *not* do it):

```js
(async () => {
  const root = await navigator.storage.getDirectory();
  for await (const [name] of root.entries()) await root.removeEntry(name, { recursive: true });
})()
```

Takeaway: my measured 3/6 is the clean-origin number. On a dev `localhost:8081` shared with every
other Expo project, capacity is effectively unpredictable. Budget for hitting it in development.

### Nothing in flight will change the ATTACH answer

- `rhashimoto/wa-sqlite` has **no open issue about ATTACH, multi-database, or pool capacity**.
  The closest, [#104 "Support concurrent access to multiple databases"](https://github.com/rhashimoto/wa-sqlite/issues/104)
  (closed 2023), is about Asyncify re-entrancy and explicitly concludes that the *non-Asyncify*
  build with `AccessHandlePoolVFS` — which is what expo ships — "should not have these problems."
- `expo/expo` has no open issue or PR touching `AccessHandlePoolVFS` capacity or ATTACH-on-web.
- [expo/expo#25618](https://github.com/expo/expo/issues/25618) is ATTACH on *native*, resolved by
  stripping the `file://` scheme. Not applicable to web (web paths have no scheme).

### But two upstream web bugs *are* in flight, and they matter more (see next section)

- [expo/expo#45186](https://github.com/expo/expo/issues/45186) — **OPEN**, filed 2026-04-29:
  sync worker truncates the result-envelope length to one byte.
- [expo/expo#44148](https://github.com/expo/expo/pull/44148) — **OPEN PR**, filed 2026-03-23, last
  touched 2026-07-28, still unmerged: the one-line fix for that.
- [expo/expo#47694](https://github.com/expo/expo/issues/47694) — closed 2026-07-10: `openDatabaseSync`
  at module eval deadlocks worker startup; `Atomics.pause` spin budget is 1e6 iterations. The fix is
  **not** in 55.0.17, 56.0.0, or 57.0.1 — the code still reads `if (i > 1_000_000)`.

---

## The actual web blocker (found while investigating; NOT about ATTACH)

**This is the finding that should drive planning.**

The app's data layer is **100% synchronous**:

```
$ grep -rhoE "\.(execSync|getAllSync|getFirstSync|runSync|withTransactionSync)[<(]" src/
  70 .getAllSync      61 .getFirstSync      59 .runSync
  23 .execSync         9 .withTransactionSync
--- async API usage ---
(none)
```

> **Count corrected 2026-08-06.** The "222" figure below could not be reproduced. Verified counts
> over `mobile/src/`, excluding `*.test.*`: **70 synchronous SQLite calls across 35 files, and zero
> async calls** (`getAllSync`/`getFirstSync`/`runSync`/`execSync`/`prepareSync`/`withTransactionSync`
> vs. their `*Async` counterparts). Including tests, 106 `*Sync(` calls of any kind. The conclusion
> is unchanged and the file count is the number that actually sizes the migration.

222 sync calls, zero async calls. On web, every one of those goes through
`web/WorkerChannel.ts` → `invokeWorkerSync`, which requires `SharedArrayBuffer` (so COOP/COEP
cross-origin isolation is mandatory) and contains this in `sendWorkerResult`:

```ts
const resultArray = new Uint8Array(resultBuffer);
const length = resultBytes.length;
resultArray.set(new Uint32Array([length]), 0);   // writes only length & 0xFF
```

`TypedArray.prototype.set` converts element-wise, so a `Uint32Array` source into a `Uint8Array`
target writes one byte. **EXECUTED** demonstration:

```
$ node -e "const b=new Uint8Array(8); b.set(new Uint32Array([1234]),0);
           console.log(new Uint32Array(b.buffer,0,1)[0])"
210          # 1234 & 0xFF
```

The reader then slices 210 bytes of a 1234-byte JSON envelope and `JSON.parse` throws
`SyntaxError: Unterminated string in JSON`. Any sync result ≥ 256 bytes fails; a result of exactly
256 bytes reads as length 0. Essentially every `getAllSync` in this app exceeds that.

**Verified present in the installed version and in every newer one:**

```
$ grep -n "resultArray.set(new Uint32Array" node_modules/expo-sqlite/web/WorkerChannel.ts   # 55.0.17
41:    resultArray.set(new Uint32Array([length]), 0);
$ npm pack expo-sqlite@56.0.0 && grep -n ... package/web/WorkerChannel.ts
43:    resultArray.set(new Uint32Array([length]), 0);
$ npm pack expo-sqlite@57.0.1 && grep -n ... package/web/WorkerChannel.ts
43:    resultArray.set(new Uint32Array([length]), 0);
```

So: **there is no expo-sqlite release in which this app's data layer works on web as written.**
ATTACH is fine; the sync API is not. Anyone who concluded "web SQLite is blocked" was probably
looking at this and misattributing it to ATTACH.

---

## Recommended path

**1. Keep ATTACH exactly as it is. Zero effort.** `mobile/src/data/database.ts:107-119` is already
correct for web. Do not add a web branch, do not transform `databasePath`, do not switch to
deserialize-based seeding (that would actively *break* the cross-database joins, silently — Q3/T8).

**2. Spend the effort on sync → async instead. This is the real work: ~1-2 weeks.** Options in
preference order:

- **(a) `patch-package` the one-line WorkerChannel fix and keep the sync API.** Change
  `resultArray.set(new Uint32Array([length]), 0)` to a `DataView`/`setUint32` write, mirroring
  [expo/expo#44148](https://github.com/expo/expo/pull/44148). Cheapest by far (hours), keeps 222
  callsites untouched. Cost: you now carry a patch, you still need COOP/COEP headers for
  `SharedArrayBuffer`, you still inherit #47694's module-eval deadlock and 1e6 spin budget, and you
  are busy-spinning the main thread on every query — which will feel bad on a Browse list.
- **(b) Migrate the data layer to the async API.** The correct long-term answer, and it also removes
  the SAB/COOP-COEP requirement entirely. 222 callsites, but they are concentrated in
  `src/data/**` repositories behind hooks, so most UI code does not move. Fits the existing
  `Result<T, AppError>` convention since everything already returns `Result`.
- **(c) Ship (a) now to unblock a web spike, schedule (b) before any web release.**

**3. Add an OPFS-capacity guard, ~half a day.** Before `initializeDatabases`, count entries in the
`expo-sqlite` OPFS directory; if the app later throws `unable to open database file`, surface a
specific error telling the user/dev to clear OPFS rather than the generic `DB_INIT_ERROR`. This is
the single most-reported web failure upstream (#39903) and it is unfixed. Optionally pre-create a
few spare files in that directory at boot to raise capacity — `#acquireAccessHandles`
(`AccessHandlePoolVFS.js:295`) adopts any file it finds, and a zero-length one fails the digest check
and lands in the free pool. **INFERRED**, not tested; verify before relying on it.

**Runner-up (only if ATTACH somehow fails in a real browser): drop cross-database SQL.** Per Q5 this
is 6 production files and ~16 references — query curriculum by id-set, query user state, join in JS.
Roughly 1-2 days including tests. Cheap insurance, and worth writing down as the escape hatch, but
there is now no evidence it is needed.

---

## What would change the answer

- **A real browser disagreeing with the Node shim.** The single highest-value follow-up is running
  the same T1-T8 sequence inside an actual Web Worker on `localhost` with COOP/COEP set. I could
  not do that here. Everything about SQLite and VFS semantics should carry over; what would not is
  browser storage quota, `createSyncAccessHandle` exclusivity when two tabs are open, and Safari's
  OPFS quirks.
- **Two tabs / two windows.** `AccessHandlePoolVFS` takes exclusive sync access handles for the
  whole pool at VFS init. A second tab on the same origin will fail to acquire them. This is
  untested here and is a genuine unknown for a web build — it is a bigger deal than ATTACH.
- **The `curriculum` OTA swap on web.** `AccessHandlePoolVFS` hands the *same* access handle to
  every connection on a path and implements no locking (`jLock`/`jUnlock` are the inherited no-ops
  at `FacadeVFS.js:154,163`). Two read-only connections are fine — proven above — but a swap that
  *writes* `/curriculum.db` while `userDb` has it attached and `curriculumDb` has it open is
  untested and the DETACH/re-ATTACH in `attachCurriculumForQuery` does not invalidate the standalone
  connection's page cache. Test before enabling OTA on web.
- **Expo merging #44148** would remove the need for the patch in step 2(a).
- **Expo raising `DEFAULT_CAPACITY` or exposing `addCapacity`** would retire step 3. Nothing in
  flight suggests this.

## What I could not determine

- Whether ATTACH works in a real browser's OPFS (shim-tested only — but the failure modes that
  would differ are storage-level, not SQL-level).
- Whether a multi-tab web build is viable at all with this VFS.
- Whether the OTA curriculum swap is safe on web while the DB is attached.
- The exact `SQLITE_TEMP_STORE` compile flag; I established empirically that sorts do not spill to
  the pool, which is the thing that actually mattered.
