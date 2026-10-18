# Curriculum schema migration plan

**Status:** Not started, except Phase A (frozen item ids): done 2026-09-27 as phase 1 of the
[level-agnostic curriculum plan](./level-agnostic-curriculum-plan.md). Run the rest before the first
public release, after content is finalized.

**Written:** 2026-09-15, after a dev-device crash: `no such column: word_type`. The device held
curriculum `1.12.1-vocabulary-skeleton`; the app code and the bundled seed were at `1.13.1`.

## Summary

The app has two databases. `user.db` is mutable and already has a correct numbered migration
runner (`src/data/migrations/`, 20 migrations, `migrationRunner.ts`). `curriculum.db` is read-only
content and has **no version contract at all**. This plan gives `curriculum.db` that contract.

It fixes two defects. The first is the crash above. The second is larger and is not visible yet
because no one has upgraded content on a real install.

### Defect 1 — the bundled seed never re-imports

`openCurriculumDatabase` (`mobile/src/data/database.ts:42`) imports the bundled seed **only when
`curriculum_update_source` is unset**, that is, only on the very first launch. After that, a new app
build ships a new seed that is never installed. New code then queries columns the old on-device file
does not have, and every screen that runs that query crashes.

### Defect 2 — curriculum item ids are positional, so content edits scramble user progress

`assignItemIds` (`scripts/compile-curriculum.ts:408`) sorts all items by
`(jlpt_level, item_type, slug)` and assigns `index + 1`:

```ts
const idByKey = new Map<string, number>();
sorted.forEach((entry, index) => {
  idByKey.set(itemKey(entry.itemType, entry.slug), index + 1);
});
```

Adding one N5 radical shifts the id of every item after it. Ten `user.db` tables key on those ids:

| Table | Migration |
| --- | --- |
| `item_study_status` | 002 |
| `srs_states` | 003 |
| `passage_practice_results` (`passage_id`) | 004 |
| `personal_mnemonics` | 005 |
| `related_item_boosts` | 006 |
| `weakness_stats` | 007 |
| `user_synonyms` | 012 |
| `furigana_overrides` | 016 |
| `ai_sessions` (`topic_item_id`, `topic_item_ids`) | 017, 018 |
| `lesson_opt_ins` | 020 |

So the first OTA content update after launch would silently re-point every learner's SRS state at
different items. Burned kanji become unseen vocabulary. There is no error and no way back — the
old ids are gone.

**Phase A below is a hard blocker for the first public release.** Everything else can ship later;
Phase A cannot, because after launch you can no longer renumber without a per-learner mapping you
do not have.

## Decision: three ladders, not one

The NestJS / TypeORM / Rails model has **one** database, where schema and user rows live together.
A migration must transform in place, because dropping the table would drop the user's data with it.

This app has two databases, so the same job splits into three ladders with three different triggers.
Naming them separately is what keeps each one simple.

| Ladder | Acts on | Triggered by | Exists today |
| --- | --- | --- | --- |
| **1. User schema** — numbered TS migrations | `user.db` shape | App start | Yes — `src/data/migrations/`, 20 of them |
| **2. Curriculum shape** — whole-file replacement | `curriculum.db` | New seed or OTA download | No — Phases B, C, D |
| **3. Content change** — recorded, replayable ops | `user.db` **rows**, after a content swap | New curriculum version | No — Phase G |

Ladder 1 is already correct and this plan does not touch it.

Ladder 2 is a **replacement, not an `ALTER` script**, and that is deliberate. `curriculum.db` holds
no user state — every byte is reproducible from `curriculum/**/*.json` by `npm run
compile-curriculum`. An `ALTER TABLE` ladder against it would only ever rebuild data the compiler
already produces, and `migration 020` states the intended model outright: *"that file is replaced
wholesale by OTA update"*.

**Ladder 3 is the one you are asking about, and my first draft of this plan missed it.** Replacing
the content file is not always enough, because some content edits change what the learner's existing
progress *means*. If a vocabulary item splits in two, if two merge, if a kanji gains a prerequisite,
or if a meaning changes enough that old mastery is a lie — then rows in `user.db` must be
transformed, in a recorded order, once per learner. That is a real migration in the NestJS sense,
and Phase G builds it.

The distinction that keeps it small: ladder 3 migrates **user rows**, never curriculum rows. Content
itself is never migrated, only replaced.

---

## Phase A — freeze item identity (pre-launch blocker)

**Goal:** an item's id is permanent from the moment it first compiles, for the life of the app.

### Work

1. Add `curriculum/id-registry.json`, committed, mapping the natural key to the id:

   ```json
   {
     "next_id": 12157,
     "ids": { "radical:ground": 1, "kanji:one": 2, "vocabulary:one-thing": 3 },
     "retired": { "vocabulary:removed-word": 4821 },
     "aliases": { "vocabulary:old-slug": "vocabulary:new-slug" }
   }
   ```

   `(item_type, slug)` is already the natural key — `items` carries `UNIQUE (item_type, slug)`.

2. Rewrite `assignItemIds` (`scripts/compile-curriculum.ts:387-413`) to read the registry:
   known key → its recorded id; new key → `next_id++`. Ids are append-only. A retired id is never
   reused. An alias resolves a renamed slug back to its original id, so a content rename never
   moves an id and never needs a `user.db` migration.

3. Seed the registry once from the current `1.13.1` build, so today's on-disk ids are preserved.
   Generate it with a one-off script that reads
   `mobile/assets/curriculum-seed/curriculum.db`; do not hand-write it.

4. Add `--update-registry` to the compile script for the authoring loop. Without the flag, a compile
   that meets an unknown key **fails** rather than inventing an id, so CI can never silently mint ids.

### Why ordering is safe

No mobile query orders by `items.id` — presentation order comes from the separate `sort_order`
column (verified by grep over `mobile/src`). Freezing ids therefore does not freeze curriculum
order: you can still re-band or re-sequence content freely, because `sort_order` is recomputed on
every compile while the id stays put.

### Verify

- Compile twice with an item inserted in the middle of N5 between runs; diff
  `SELECT item_type, slug, id FROM items` — only the new row appears, no id changes.
- A test in `scripts/` asserting that a registry key whose id changed makes the compile fail.
- `npm test` at repo root stays green.

---

## Phase B — schema version contract

**Goal:** the app can tell, before running a query, whether a `curriculum.db` file matches its code.

### Work

1. Add to `curriculum_metadata` in `scripts/curriculum-schema.ts:5`:

   ```sql
   schema_version INTEGER NOT NULL
   ```

   Keep it separate from `version`. `version` is the **content** semver (`1.13.1-jlpt-first-bands`);
   `schema_version` is the **shape** of the tables. Content publishes bump `version` only.

2. Define `CURRICULUM_SCHEMA_VERSION` as a constant in `scripts/curriculum-schema.ts`, exported
   next to `CURRICULUM_DDL`, and write it in the compiler's `curriculum_metadata` insert
   (`scripts/compile-curriculum.ts:952`).

3. Mirror the same number in `mobile/src/data/curriculum/curriculumConfig.ts` as
   `REQUIRED_CURRICULUM_SCHEMA_VERSION` — the shape the mobile queries need. CI keeps the two equal
   (Phase F).

4. Start at `1`. **The rule from this point on:** any change to `CURRICULUM_DDL` that a query can
   observe — a new column, a renamed column, a dropped column, a new table, a changed `CHECK` —
   bumps `schema_version` by one, in the same commit. Adding rows does not. Changing
   `sort_order` values does not.

5. Read it in `readCurriculumVersion` (`mobile/src/data/database.ts:26`), returning
   `{ version, schemaVersion }`. A file with no `schema_version` column is treated as
   `schemaVersion: 0`, which is how every pre-plan install on a dev device is recognised.

### Verify

- Unit test: a fixture db with no `schema_version` column reads as `0` and does not throw.
- Compile output has `schema_version = 1` in `curriculum_metadata`.

---

## Phase C — re-import the bundled seed when the app updates

**Goal:** an app-store update that carries a new schema or newer content installs it.

### Work

Replace the `updateSource === null` gate in `openCurriculumDatabase`
(`mobile/src/data/database.ts:41-50`) with a decision made after reading the installed file:

1. No `curriculum.db` on device → import the seed.
2. `installed.schemaVersion !== seed.schemaVersion` → import the seed. This covers the crash you
   hit, and also the reverse case of an app downgrade.
3. `installed.schemaVersion === seed.schemaVersion` and `seed.version > installed.version` by
   semver → import the seed. An app update that ships newer content wins.
4. Otherwise keep the installed file. This is what protects an OTA-downloaded curriculum that is
   newer than the seed — the existing contract at `database.ts:33-36`, which must not regress.

The file must be opened to be read, so the sequence is: open → read metadata → decide → if
importing, `closeAsync`, `importDatabaseFromAssetAsync`, reopen. Update
`setCurriculumInstallMetadata` with `source: 'bundled'` on every import, not only the first.

Because the seed always ships inside the same binary as the code, its `schema_version` always
matches `REQUIRED_CURRICULUM_SCHEMA_VERSION`. The seed is therefore the **guaranteed recovery
path**: any unreadable or mismatched curriculum file on device is repairable offline, with no
network and no user action.

### What this costs

Case 3 discards an OTA curriculum that is older than the seed and re-copies ~9 MB on first launch
after an app update. That is correct, not wasteful — the seed is the newer content. The OTA check
then runs as usual and pulls anything newer still.

### Verify

- Test: installed `schema_version 0`, seed `1` → seed is imported, and a `word_type` query then
  succeeds. This is a direct regression test for the reported crash.
- Test: installed content `1.14.0` downloaded, seed `1.13.1`, same schema version → seed is **not**
  imported and `curriculum_update_source` stays `downloaded`.
- Test: installed `1.13.1` bundled, seed `1.14.0` → seed is imported.

---

## Phase D — gate the OTA path on schema version

**Goal:** an OTA download can never install a file the running code cannot read.

### Work

1. Add `schema_version` to the manifest shape (`curriculumManifest.types.ts`) and to
   `parseCurriculumManifest` (`mobile/src/data/curriculum/curriculumUpdate.ts:45`). Treat a manifest
   without the field as incompatible, not as a wildcard.
2. In `checkForCurriculumUpdate` (`:403`), skip the download when
   `manifest.schema_version !== REQUIRED_CURRICULUM_SCHEMA_VERSION`. No bytes are fetched for a
   build that cannot use them.
3. In `validateDownloadedCurriculumFile` (`:351`), re-check `schema_version` from the file itself,
   beside the existing `version` probe, **before** `atomicReplaceCurriculumFile` runs. The manifest
   is a claim; the file is the fact.
4. Publish the manifest `schema_version` from the compiled db, so the two cannot drift.

### Visible state, not silent degradation

When a newer curriculum exists but needs a newer app, the app must **say so** in Settings — "New
content is available. Update the app to get it." — and not quietly stay on old content forever. One
path that can fail, visible when it does.

### Verify

- Test: manifest at `schema_version 2`, app requires `1` → `checkForCurriculumUpdate` returns
  `null`, no `downloadAsync` call, Settings shows the app-update notice.
- Test: manifest claims `1`, downloaded file contains `2` → validation fails with
  `CURRICULUM_SQLITE_INVALID`, temp file deleted, installed db untouched.

---

## Phase E — tolerate retired ids

**Goal:** a `user.db` row pointing at an item that no longer exists degrades to nothing, not to a
crash or a stuck queue.

With Phase A, ids never move, so the only residue is an item removed from the curriculum while
`srs_states` still holds a row for it. Every query that joins `user.db` progress to
`curriculum.items` must drop such a row rather than surface a half-built card.

### Work

Audit the review queue (`src/core/srs/`, `useReviewQueue`), Browse, and Stats counts for `LEFT JOIN`
against `curriculum.items` that can yield a null item. Make the join inner, or filter nulls, wherever
a null item would reach a screen. Leave the orphan rows in `user.db` — deleting them would lose
progress if the item returns in a later content version.

### Verify

- Test: `srs_states` holds an id absent from the attached curriculum → the review queue builds, the
  item is absent, and the due count matches the visible cards.

---

## Phase F — CI guardrails

Without these, the whole contract rests on remembering to do it by hand.

### Work

Add `npm run check-curriculum-contract` at repo root, wired into
`.github/workflows/compile-curriculum.yml`. It fails when:

1. **Id drift** — a key in `id-registry.json` maps to a different id than the freshly compiled db,
   or a key present in the registry is missing from the build without a `retired` entry.
2. **Silent schema change** — `CURRICULUM_DDL` changed against the merge base while
   `CURRICULUM_SCHEMA_VERSION` did not. This is the check that turns "bump the version" from a
   habit into a rule.
3. **Constant drift** — `CURRICULUM_SCHEMA_VERSION` (repo root) ≠
   `REQUIRED_CURRICULUM_SCHEMA_VERSION` (`mobile/src/data/curriculum/curriculumConfig.ts`).
4. **Stale seed asset** — the committed `mobile/assets/curriculum-seed/curriculum.db` has a
   different `schema_version` or `version` than a fresh compile. Today the seed is copied by hand
   (`curriculum/metadata.json` `maintainer_notes`), so forgetting to recommit it after a schema bump
   would ship a binary whose every install fails Phase C on launch. Compare metadata, not bytes —
   `build_date` and `content_hash` change on every run.

Follow the existing `generator-drift` job as the model; it already does a compile-and-compare.

---

## Phase G — content migration ladder

**Goal:** a content change that invalidates existing progress is written down once, in order, and
replayed exactly once per learner — whichever curriculum version they are coming from.

### What does *not* need a migration

Most content work needs nothing here, and it is worth being precise about that before adding
machinery.

- **New items.** `lessonPlanner.ts` builds candidates from the curriculum and filters by study
  status and dependency unlock. A new radical, kanji, word or grammar point becomes a lesson
  candidate on its own as soon as its prerequisites are met, and reaches review only after the
  learner actually does the lesson. This is the behaviour you described, and it already works.
- **Items already in review.** `srs_states` rows are keyed by item id and are untouched by a
  curriculum file swap. A learner mid-ladder on 漢 keeps their stability, difficulty and due date.
- **Renames.** Handled structurally by the Phase A alias map — the id never moves, so no user row
  needs to change.
- **Removals.** Handled by Phase A tombstones plus Phase E orphan tolerance.
- **Re-ordering, re-banding, new mnemonics, new examples, fixed typos.** These touch `sort_order`
  and text columns only. Nothing in `user.db` refers to them.

### The four operations that do

| Operation | Payload | Effect on `user.db` |
| --- | --- | --- |
| `split` | `{ from, to: [ids], carry: "primary" \| "all" }` | Copy the source `srs_states` / `item_study_status` row to the new ids, or to the primary only and leave the rest as new items |
| `merge` | `{ from: [ids], to }` | Keep the most advanced state among the sources; retire the others |
| `reset_progress` | `{ items: [ids], reason }` | Delete `srs_states` rows so the item is taught again — for when a meaning or reading changed enough that the learner's mastery is now wrong |
| `regate` | `{ child, added_parents: [ids] }` | Record that a learner already reviewing `child` is not re-gated by a prerequisite added after they started |

Four is the whole vocabulary, and it should stay that way. Every operation that can be handled
structurally has been pushed into Phase A or Phase E instead.

### Why `regate` is not optional

`queueBuilder.ts:89` filters the review queue with `isItemUnlocked`:

```ts
if (!isItemUnlocked(item.parents, item.parentStatuses)) return false;
```

So if a content update adds a prerequisite radical to a kanji a learner is already reviewing, and
that radical is `not_started`, **the kanji silently disappears from their review queue** — no error,
no notice, and its due date keeps sliding. Re-banding kanji across JLPT levels is exactly the kind
of edit that adds prerequisite edges, and `curriculum/metadata.json` shows banding is still moving.

**Open decision for implementation time.** Two ways to fix it:

- *(recommended)* Grandfather in `queueBuilder`: an item that already has an `srs_states` row with
  `reps > 0` bypasses unlock gating. One condition, no per-release bookkeeping, and it cannot be
  forgotten. The gate keeps doing its real job, which is deciding what the learner may **start**.
- Per-change `regate` rows. Precise, but it depends on an author remembering to write one for every
  edge they add — and a forgotten row fails silently, which is the failure mode that got us here.

Pick the first unless there is a reason the gate must apply to started items. That reason may exist:
the gate also hides items whose prerequisites were never learned after a WaniKani/Bunpro import.
Check `src/core/import/` before deciding, and keep `regate` in the vocabulary either way.

### Where the migrations live

Inside `curriculum.db` itself. This is the part that differs from NestJS, and the reason is OTA: a
curriculum update can reach a device **without an app update**, so migrations cannot live in the app
binary — the running app would not have the migration for content it just downloaded. Shipping them
inside the content file means the instructions always arrive with the content they describe.

1. Author them in the curriculum repo as `curriculum/migrations/NNNN-<slug>.json`, one file per
   change, exactly the ergonomics you described. Add them to `npm run validate-schema`.

2. Compile them into a table (`scripts/curriculum-schema.ts`):

   ```sql
   CREATE TABLE content_migrations (
     sequence INTEGER PRIMARY KEY NOT NULL,   -- global, monotonic, never reused
     curriculum_version TEXT NOT NULL,        -- version that introduced it
     operation TEXT NOT NULL CHECK(operation IN ('split','merge','reset_progress','regate')),
     payload TEXT NOT NULL,                   -- JSON args
     note TEXT NOT NULL                       -- why, in one line, for the changelog and dev logs
   );
   ```

3. Track application in `user.db` via a new numbered migration in ladder 1:

   ```sql
   CREATE TABLE applied_content_migrations (
     sequence INTEGER PRIMARY KEY NOT NULL,
     applied_at TEXT NOT NULL
   );
   ```

4. Run after every curriculum install — both the OTA swap and the Phase C seed re-import — in one
   `withTransactionSync` against `user.db`: select `content_migrations` where `sequence >
   MAX(applied)`, ordered, apply each, insert the applied row. Same runner shape as
   `migrationRunner.ts`. Return `Result<T, AppError>`; a failure must roll back and leave the
   previous applied high-water mark intact.

5. **Baseline on first install.** A fresh install has no progress to migrate, so stamp every
   `sequence` in the file as applied without executing any of them. Standard baseline behaviour, and
   it is what stops a new user's empty `user.db` from replaying two years of content history.

### Version skips are the point

Because `sequence` is global and monotonic and the file carries the full history, a learner who
jumps 1.13.1 → 1.20.0 in one OTA replays every pending operation in order. A learner who takes every
release applies the same operations one or two at a time. Both land in the same state. That is the
property you want from a migration ladder, and it is why the sequence is global rather than per
release.

### Interaction with the schema contract

An old app must never misread a new migration. Adding a fifth operation to the vocabulary is a
`CHECK` constraint change, so by the Phase B rule it bumps `schema_version`, and by Phase D an app
that does not know the new operation refuses the file before it is ever swapped in. The three
ladders compose; that is the reason Phase B comes first.

### Verify

- Test: `split` from an item with a mature `srs_states` row → both targets carry the stability and
  due date; applied high-water mark advances by one.
- Test: replay is idempotent. Running the swap twice applies each sequence exactly once.
- Test: a learner three curriculum versions behind applies all pending sequences in order, and the
  end state equals a learner who took each release in turn.
- Test: an operation that throws rolls back the whole batch — no partial application, high-water
  mark unchanged.
- Test: fresh install stamps the baseline and mutates no user rows.

---

## Sequencing

| Phase | When | Blocks launch |
| --- | --- | --- |
| A — freeze item ids | Right after content is finalized, before any public build | **Yes** |
| B — `schema_version` | With A, same release | **Yes** |
| C — seed re-import | With A and B | **Yes** |
| F — CI guardrails | With A–C; they are what keep A–C true | **Yes** |
| G — content migration ladder | Empty ladder + runner with A–C; operations as needed after | **Runner yes, operations no** |
| D — OTA gate | Before the first OTA content publish | No, if OTA stays off at launch |
| E — orphan tolerance | Before the first content removal | No |

A, B, C and F are one piece of work and should land together — B without C only detects the problem,
C without A trades a crash for silent progress corruption, and F is what stops all of it decaying.

G splits. The **runner, the two tables and the baseline stamp** must ship in the launch build, because
an app in the field cannot learn how to apply migrations from a file it downloads later — a v1 app
that has no runner will ignore the `content_migrations` table forever, and every learner on v1 is
then permanently unmigratable. The **operations** are authored later, one per content change, and
cost nothing until the first one exists. Ship an empty ladder that works.

The `regate` grandfathering decision in Phase G should also be settled before launch, because it is a
one-line change in `queueBuilder.ts` now and a per-learner repair later.

## The standing rule, after this lands

Ask one question of every change: **does it invalidate progress a learner already has?**

- No — new items, new mnemonics, examples, typo fixes, re-ordering → bump `version` in
  `curriculum/metadata.json`, compile, commit the seed. No migration. New items reach learners on
  their own through the lesson planner.
- Yes — a split, a merge, a meaning or reading that materially changed, a new prerequisite edge →
  same as above, **plus** a `curriculum/migrations/NNNN-*.json` file describing it. One file per
  change, in sequence, never edited after it ships.
- Shape change → change `CURRICULUM_DDL`, bump `CURRICULUM_SCHEMA_VERSION` and its mobile twin in
  the same commit, update the affected repository queries, compile, commit the seed. CI enforces it.
- Rename a slug → add an `aliases` entry. Never edit an id in `id-registry.json` by hand.
- Remove an item → move its key to `retired`. Never reuse the id.
- New `user.db` table or column → a new numbered migration in `src/data/migrations/`, as today.
  Nothing in this plan changes that ladder.

A shipped migration file is immutable, like any migration ladder. If it was wrong, add the next one.

## What this plan does not do

- No `ALTER TABLE` ladder for `curriculum.db`. Content is replaced, never migrated; only the user
  rows that point at it are migrated. See the decision above.
- No backfill of existing dev installs. They are repaired by Phase C on first launch, or now by
  clearing app data.
- No change to how content is authored, validated, or compiled beyond id assignment.
