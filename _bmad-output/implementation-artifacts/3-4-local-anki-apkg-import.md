# Story 3.4: Local Anki `.apkg` import

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an **Anki user**,
I want **to pick a deck file and import locally with no cloud upload**,
so that **my decks stay private and mapped cards enter my SRS queue at appropriate intervals (FR33f, NFR9, NFR19)**.

## Acceptance Criteria

1. **File picker for `.apkg` selection**

   **Given** the import screen with the Anki source selected  
   **When** I tap "Select Anki deck file"  
   **Then** the system document picker opens, filtered to allow `.apkg` files  
   **And** after selection, the file is copied to the app cache directory for processing  
   **And** the picker uses `expo-document-picker` with `copyToCacheDirectory: true`

2. **On-device `.apkg` parsing with no cloud upload**

   **Given** a valid `.apkg` file selected via the document picker  
   **When** parsing runs  
   **Then** the `.apkg` ZIP archive is extracted entirely on-device using `expo-file-system` for reading and a JS-based ZIP library  
   **And** the SQLite collection database (`collection.anki2`, `collection.anki21`, or `collection.anki21b`) is located and queried locally  
   **And** no file data is transmitted to any external service (NFR9)  
   **And** card notes are extracted with their field content, SRS review data, and deck metadata

3. **Mapping Anki cards to internal curriculum items**

   **Given** parsed Anki notes with field content  
   **When** mapping runs  
   **Then** each note's sort field (`sfld`) is matched against internal curriculum items via the `external_id_mappings` table with source `'anki'`  
   **And** matched items produce `MappedImportItem` entries with FSRS state conversion  
   **And** unmatched items produce `UnmatchedImportItem` entries listing the card front text for user review (FR33g)

4. **Anki interval-to-FSRS conversion**

   **Given** Anki cards with review intervals (from the `cards` table: `ivl`, `factor`, `reps`, `lapses`, `queue`, `type`)  
   **When** FSRS conversion runs  
   **Then** Anki intervals are converted to FSRS state using interval-based mapping:  
   - New cards (type=0) → FSRS `new` state  
   - Learning cards (type=1, queue=1/3) → FSRS `learning` state with short stability  
   - Review cards (type=2) with `ivl` days → FSRS `review` state with stability approximated from interval  
   - Suspended/buried cards with long intervals → treated as mature reviews  
   **And** the conversion produces reasonable FSRS stability/difficulty values approximated from Anki's interval and ease factor

5. **Malformed file handling**

   **Given** a file selected by the user that is not a valid `.apkg` (corrupted ZIP, missing SQLite DB, wrong file type)  
   **When** parsing attempts to process it  
   **Then** a specific, user-friendly error is shown: "This file doesn't appear to be a valid Anki deck. Make sure you're selecting an .apkg file exported from Anki." (NFR19)  
   **And** no partial import state is committed to `user.db`  
   **And** temporary files are cleaned up from the cache directory

6. **Transactional persistence and summary**

   **Given** a successful parse and mapping  
   **When** the import persists  
   **Then** mapped cards update `user.db` via `persistMappedImportItems` in a single transaction  
   **And** the `import_metadata` row records `source = 'anki'`  
   **And** on failure or cancel, the transaction rolls back with no partial state  
   **And** mapped/unmatched counts are available for the summary screen (FR33h feeds Story 3.5)

## Tasks / Subtasks

- [x] **AC1 - Add `expo-document-picker` dependency and mock**
  - [x] Install `expo-document-picker` in `mobile/` (`npx expo install expo-document-picker`)
  - [x] Add `expo-document-picker` plugin to `app.json` if needed for iOS iCloud/Files access
  - [x] Create `mobile/__mocks__/expo-document-picker.ts` for test environment
  - [x] Add module name mapping in `jest` config in `package.json`

- [x] **AC1 + AC2 - Add ZIP parsing dependency**
  - [x] Evaluate and install a ZIP extraction library. Preferred: `jszip` (pure JS, works in RN runtime, no native module needed). Alternative: `react-native-zip-stream` (native, requires dev build).
  - [x] If using `jszip`: install it and note it runs on the JS thread — for large decks, consider warning the user about processing time
  - [x] Create mock for ZIP library if needed for tests

- [x] **AC2 - Build Anki parser in core layer**
  - [x] Create `mobile/src/core/import/ankiParser.ts` — pure parser that receives raw extracted file buffers/strings and returns structured Anki data
  - [x] Support all three `.apkg` database formats: `collection.anki2` (legacy), `collection.anki21` (legacy 2), `collection.anki21b` (latest)
  - [x] Extract from `notes` table: `id`, `guid`, `mid` (model ID), `flds` (fields separated by `\x1f`), `sfld` (sort field)
  - [x] Extract from `cards` table: `id`, `nid` (note ID), `did` (deck ID), `ivl` (interval in days, negative = seconds for learning), `factor` (ease factor / 1000), `reps`, `lapses`, `queue` (0=new, 1=learning, 2=review, -1=suspended, -2=buried, 3=day-learn, 4=preview), `type` (0=new, 1=learning, 2=review, 3=relearning)
  - [x] Extract deck name from `col` table's `decks` JSON field (for display purposes)
  - [x] Define return type `AnkiParseResult` with notes, cards, and deck info
  - [x] Handle malformed data: missing tables, corrupt SQLite, empty decks

- [x] **AC2 - Build `.apkg` file reader in data layer**
  - [x] Create `mobile/src/data/import/ankiFileReader.ts` — handles file system operations: unzip, locate SQLite DB, read via `expo-sqlite`, clean up temp files
  - [x] Use `expo-file-system` to read the copied `.apkg` from cache
  - [x] Unzip the archive using chosen ZIP library to a temp directory
  - [x] Detect which `collection.anki*` file is present (prefer `collection.anki21b` > `collection.anki21` > `collection.anki2`)
  - [x] Open the extracted SQLite DB using `expo-sqlite`'s `openDatabaseAsync` with a path to the temp file
  - [x] Query the DB, pass raw data to `ankiParser.ts` for transformation
  - [x] Clean up temp directory after parsing (success or failure)
  - [x] Return `Result<AnkiParseResult, AppError>` — never throw

- [x] **AC3 - Build Anki mapper in core layer**
  - [x] Create `mobile/src/core/import/ankiMapper.ts` — pure transformer from `AnkiParseResult` to `AnkiMapResult { mapped, unmatched, summary }`
  - [x] Follow the exact same signature pattern as `wanikaniMapper.ts` and `bunproMapper.ts`: `mapAnkiCards(parseResult, externalIdToItemId, now)`
  - [x] Match each note's `sfld` (sort field) against the `externalIdToItemId` lookup from `curriculum.db`
  - [x] For matched items: create `MappedImportItem` with FSRS conversion from Anki card data
  - [x] For unmatched items: create `UnmatchedImportItem` with `externalId = sfld` for user display
  - [x] Summary counts: mapped, unmatched, with breakdown by card type (new/learning/review)

- [x] **AC4 - Add Anki interval-to-FSRS conversion**
  - [x] Add `convertAnkiCardToFsrs(card: AnkiCard, now: Date): FsrsImportState | null` to `mobile/src/core/import/fsrsConverter.ts`
  - [x] Conversion logic based on Anki's card fields:
    - `type=0` (new) → skip (no SRS state to import) or `new` state
    - `type=1` (learning), `queue=1/3` → `learning` state, stability from short intervals
    - `type=2` (review) → `review` state, stability ≈ `ivl` days, difficulty derived from `factor` (ease/1000, mapped to FSRS 1-10 scale)
    - `type=3` (relearning) → `relearning` state
    - `ivl >= 365` and `queue != -1` → consider as mature/near-burned
    - Suspended (`queue=-1`): import with current interval state (user chose to suspend, not the scheduler)
    - Buried (`queue=-2`): import with current interval state
  - [x] Due date: `now + ivl` days for review cards; `now + |ivl|` seconds for learning cards with negative intervals
  - [x] Map Anki ease factor (typically 1300-3500, default 2500) to FSRS difficulty (1-10 scale): `difficulty ≈ 10 - (factor - 1300) / (3500 - 1300) * 8` clamped to [1, 10]

- [x] **AC5 - Handle malformed `.apkg` files**
  - [x] In `ankiFileReader.ts`: catch ZIP extraction failures → return `{ ok: false, error: { code: 'anki_invalid_file', userMessage: "This file doesn't appear to be a valid Anki deck..." } }`
  - [x] Handle missing SQLite collection file inside ZIP → specific error message
  - [x] Handle SQLite DB that lacks expected tables (`notes`, `cards`, `col`) → specific error message
  - [x] Handle empty decks (0 notes) → return success with 0 mapped/unmatched and informational message
  - [x] Always clean up temp extracted files in a `finally` block

- [x] **AC3 + AC6 - Add Anki types to import.types.ts**
  - [x] Add `AnkiCard` type: `{ id: number; nid: number; did: number; ivl: number; factor: number; reps: number; lapses: number; queue: number; type: number }`
  - [x] Add `AnkiNote` type: `{ id: number; guid: string; mid: number; flds: string; sfld: string; tags: string }`
  - [x] Add `AnkiParseResult` type: `{ notes: AnkiNote[]; cards: AnkiCard[]; deckName: string }`
  - [x] Add `AnkiMapResult` type: `{ mapped: MappedImportItem[]; unmatched: UnmatchedImportItem[]; summary: ImportSummary }`

- [x] **AC6 - Wire Anki import through importRepository**
  - [x] Add `runAnkiImport(userDb, curriculumDb, filePath, deps)` to `mobile/src/data/user/importRepository.ts`
  - [x] Orchestration flow: read & parse file → map → persist transactionally
  - [x] No credential step needed (file-based, no API key) — but still follows `Result<T, AppError>` contract
  - [x] Reuse `persistMappedImportItems` for transactional write — Anki mapped items use the same `srs_states` table
  - [x] Source value in `import_metadata` is `'anki'` (already in the CHECK constraint from migration 003)
  - [x] Clean up temp files after import (success or failure)

- [x] **AC1 + AC6 - Extend onboarding import screen with Anki option**
  - [x] Add `'anki'` to the `ImportSource` type in `import.tsx`
  - [x] Add an "Anki" source selector button alongside WaniKani and Bunpro
  - [x] When Anki is selected: show "Select Anki deck" button that triggers `DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/zip', 'application/octet-stream'] })`
  - [x] Show selected file name after pick
  - [x] Show "Import" button once a file is selected
  - [x] On import: call `runAnkiImport`, show progress indicator, display result
  - [x] Error states: file picker cancelled (no action), invalid file (show error), parse error (show error with retry)
  - [x] Privacy note: "Your deck file is processed entirely on this device. No data is sent to any server."

- [x] **Tests and quality gates**
  - [x] Add unit tests for `ankiParser.ts`: valid legacy DB, valid modern DB, malformed data, empty notes, missing tables
  - [x] Add unit tests for `ankiMapper.ts`: mapped card, unmatched card, new/learning/review conversion, empty input, mixed deck
  - [x] Add unit tests for `convertAnkiCardToFsrs`: new cards, learning cards, review cards with various intervals, suspended/buried, edge cases (zero interval, very large interval, extreme ease factors)
  - [x] Add data-layer tests for `ankiFileReader.ts` (mocked file system and ZIP): successful extraction, corrupt ZIP, missing DB file, cleanup verification
  - [x] Add integration tests for `runAnkiImport`: end-to-end flow, transactional rollback on failure
  - [x] Run `npm run lint`, `npm run typecheck`, and `npm test` in `mobile/`

## Dev Notes

### Epic context and intended outcome

Epic 3 establishes trustworthy migration from existing SRS tools. Story 3.4 handles Anki `.apkg` import — unlike WaniKani (API) and Bunpro (API), Anki import is entirely file-based and local. The `.apkg` format is a standard ZIP archive containing a SQLite database, making it amenable to on-device parsing without any network calls. This aligns with NFR9 (no data transmitted) and the app's local-first philosophy.

The key challenge is that Anki decks are highly customizable — users create arbitrary note types, field configurations, and deck structures. The mapper must handle this gracefully: match what it can against the curriculum, clearly flag what it cannot match, and never silently drop cards.

### `.apkg` file format (critical technical context)

An `.apkg` file is a standard ZIP archive containing:

| File | Description |
| --- | --- |
| `collection.anki2` | Legacy SQLite database (Anki pre-2.1) |
| `collection.anki21` | Legacy 2 SQLite database (Anki 2.1+, schema v11) |
| `collection.anki21b` | Latest SQLite database (schema v18, may use zstd compression internally) |
| `media` | JSON file mapping numbered filenames to original media names |
| `0`, `1`, `2`, ... | Numbered media files (images, audio) — NOT needed for import |
| `meta` | Protobuf metadata (present in newer formats) |

**Database tables needed for import:**

- **`notes`** table: contains the actual content (kanji, vocabulary, etc.)
  - `id` — note ID
  - `guid` — globally unique ID (10-char string, useful for dedup)
  - `mid` — model/note type ID (FK to models in `col`)
  - `flds` — all fields concatenated with `\x1f` (ASCII unit separator, char code 31)
  - `sfld` — sort field value (typically the "front" of the card, the primary content)
  - `tags` — space-separated tags

- **`cards`** table: contains SRS scheduling data (one note can have multiple cards)
  - `id` — card ID
  - `nid` — note ID (FK to `notes`)
  - `did` — deck ID
  - `ivl` — interval: positive = days, negative = seconds (for learning cards)
  - `factor` — ease factor as integer (divide by 1000 for actual value; 2500 = 2.5 ease)
  - `reps` — number of reviews
  - `lapses` — number of lapses (times forgotten)
  - `queue` — 0=new, 1=learning, 2=review, -1=suspended, -2=buried, 3=day-learn, 4=preview
  - `type` — 0=new, 1=learning, 2=review, 3=relearning

- **`col`** table (single row): collection metadata
  - `decks` — JSON string containing deck names and configs
  - `models` — JSON string containing note type definitions

**For this story, media files are NOT needed** — we only need the SQLite data to extract card content and scheduling state. Media files (audio, images) in Anki decks are Anki-specific assets, not relevant to our curriculum.

### Previous story intelligence (Story 3.3 — Bunpro import)

- Story 3.3 extended the import screen to support WaniKani/Bunpro as selectable sources. Story 3.4 adds Anki as a third source option.
- The import orchestration pattern `runWaniKaniImport` / `runBunproImport` is well-established: get data → map → persist transactionally → discard credential (for Anki, no credential step).
- `persistMappedImportItems` is reusable as-is — Anki mapped items use the same `srs_states` table with `source = 'anki'`.
- The FSRS converter already supports WaniKani stages (1-9) and Bunpro stages (1-9). Anki conversion is different — it's interval-based, not stage-based — so a new `convertAnkiCardToFsrs` function is needed.
- All 175 existing tests pass. The test infrastructure (expo-sqlite mock, expo-secure-store mock) is established.
- Story 3.3 left the import screen with WaniKani and Bunpro tabs. Anki needs to be added as a third tab.

### Previous story intelligence (Story 3.2 — WaniKani import)

- Established the canonical import pipeline: client → mapper → converter → repository → UI.
- For Anki, the "client" is replaced by a file reader (no API calls).
- The mapper pattern `mapWaniKaniAssignments(assignments, externalIdToItemId)` should be mirrored: `mapAnkiCards(parseResult, externalIdToItemId, now)`.
- `getExternalIdMappings(curriculumDb, 'anki', externalIds)` lookup is already available.

### Architecture compliance (must follow)

- **Layering:** File reading/ZIP extraction in `data/import/ankiFileReader.ts`; pure parsing/mapping in `core/import/ankiParser.ts` and `core/import/ankiMapper.ts`; FSRS conversion in `core/import/fsrsConverter.ts`; persistence via `data/user/importRepository.ts`.
- **Boundary rule:** `core/` must not import from `data/`, React, or React Native. The parser and mapper are pure functions receiving already-extracted data.
- **Error contract:** All paths return `Result<T, AppError>`; no throw-based flow control. Parsing errors, file errors, and mapping errors all produce typed `AppError` results.
- **Non-destructive import:** On failure/cancel, no partial imported state remains committed. Reuse `persistMappedImportItems` which already wraps writes in a transaction.
- **No credential storage needed:** Anki import is file-based. No `credentialStore` interaction. The file is selected, processed, and the temp copy is cleaned up.
- **No new migration needed:** `import_metadata.source` CHECK constraint already includes `'anki'`; `srs_states` table is generic.
- **Temp file cleanup:** The `.apkg` is copied to cache by `expo-document-picker`. After import (success or failure), delete the cached copy and any extracted temp files.

### File structure guidance for this story

New files:
- `mobile/src/core/import/ankiParser.ts` — pure parser extracting structured data from raw Anki SQLite queries
- `mobile/src/core/import/ankiParser.test.ts` — parser unit tests
- `mobile/src/core/import/ankiMapper.ts` — pure mapper from parsed Anki data to internal format
- `mobile/src/core/import/ankiMapper.test.ts` — mapper unit tests
- `mobile/src/data/import/ankiFileReader.ts` — file system operations: unzip, SQLite read, cleanup
- `mobile/src/data/import/ankiFileReader.test.ts` — file reader tests with mocked FS
- `mobile/__mocks__/expo-document-picker.ts` — mock for document picker

Modified files:
- `mobile/src/core/import/fsrsConverter.ts` — add `convertAnkiCardToFsrs`
- `mobile/src/core/import/fsrsConverter.test.ts` — add Anki card conversion tests
- `mobile/src/core/import/import.types.ts` — add `AnkiCard`, `AnkiNote`, `AnkiParseResult`, `AnkiMapResult`
- `mobile/src/data/user/importRepository.ts` — add `runAnkiImport`
- `mobile/src/data/user/importRepository.test.ts` — add Anki import integration tests
- `mobile/src/app/onboarding/import.tsx` — add Anki as third import source with file picker UI
- `mobile/package.json` — add `expo-document-picker` + ZIP library dependency
- `mobile/app.json` — potentially add `expo-document-picker` plugin

Do NOT modify:
- `mobile/src/data/migrations/*` — no new migration needed
- `mobile/src/data/user/credentialStore.ts` — Anki import is file-based, no credentials
- `mobile/src/data/curriculum/externalIdMappingRepository.ts` — already supports any source string

### Technical requirements

- **`expo-document-picker`** for native file selection. Use `getDocumentAsync({ copyToCacheDirectory: true, type: ['application/zip', 'application/octet-stream'] })` to ensure `expo-file-system` can read the file immediately. The `.apkg` MIME type isn't standardized — use generic types and validate the extension/content after pick.
- **ZIP extraction approach:** Two viable options:
  1. **`jszip` (recommended for MVP):** Pure JavaScript, works in RN's JS runtime, no native module needed, compatible with Expo Go for development. Handles deflate compression. For large decks this may block the JS thread — acceptable for import (which is a one-time operation with a progress indicator).
  2. **Native ZIP library** (e.g., `react-native-zip-stream`): Better performance for large files but requires dev build. Consider for future optimization if `jszip` proves too slow.
- **SQLite access for extracted DB:** After unzipping, the extracted `collection.anki*` file needs to be opened as a SQLite database. Use `expo-sqlite`'s `openDatabaseAsync` pointing to the temp file path. Query the `notes`, `cards`, and `col` tables.
- **`collection.anki21b` caveat:** The latest format may use zstd compression on the database file within the ZIP. `jszip` handles standard deflate but NOT zstd. If the extracted DB file appears corrupt, try the `collection.anki21` or `collection.anki2` fallback files which use standard compression. Log a warning if only `collection.anki21b` is found and cannot be read — the user may need to re-export from Anki with a compatible format. Most shared `.apkg` files use legacy formats.
- **`ts-fsrs`** pinned to `^5.3.2` per architecture.
- **Performance consideration:** Anki decks can be large (10,000+ cards). The parser should process cards efficiently. The mapper should batch lookups. `persistMappedImportItems` already handles bulk writes in a transaction.

### Anki interval to FSRS conversion mapping

Unlike WaniKani/Bunpro (discrete SRS stages), Anki uses continuous intervals and ease factors. The conversion must approximate FSRS state from Anki's scheduling data:

| Anki Card State | Anki Fields | FSRS Mapping |
| --- | --- | --- |
| New (type=0, queue=0) | ivl=0, reps=0 | Skip import — no SRS history to preserve. Or: state='new', stability=0.5, difficulty=5 |
| Learning (type=1, queue=1/3) | ivl < 0 (seconds) or small positive | state='learning', stability=max(0.5, \|ivl\|/86400), difficulty=5 |
| Review, short interval (type=2, ivl < 7) | ivl=1-6 days | state='review', stability=ivl, difficulty from ease |
| Review, medium (type=2, ivl 7-30) | ivl=7-30 days | state='review', stability=ivl, difficulty from ease |
| Review, mature (type=2, ivl > 30) | ivl=31-365 days | state='review', stability=ivl, difficulty from ease |
| Review, very mature (type=2, ivl > 365) | ivl > 365 days | state='review', stability=min(ivl, 365), isBurned=true if ivl>=365 |
| Relearning (type=3) | similar to learning | state='relearning', stability from ivl |
| Suspended (queue=-1) | any ivl | Import with current interval state — user deliberately suspended |
| Buried (queue=-2) | any ivl | Import with current interval state — temporary scheduling hold |

**Ease factor to FSRS difficulty conversion:**
- Anki ease factor range: typically 1300–3500 (as integer, / 1000 for actual multiplier)
- Default ease: 2500 (2.5x multiplier)
- FSRS difficulty scale: 1 (easy) to 10 (hard)
- Mapping: `difficulty = clamp(10 - ((factor - 1300) / (3500 - 1300)) * 8, 1, 10)`
  - factor=3500 → difficulty≈2 (easy)
  - factor=2500 → difficulty≈5.6 (medium)
  - factor=1300 → difficulty≈10 (hard)

**Reps and lapses:** Pass through directly from Anki's `cards.reps` and `cards.lapses`.

**Due date:** `now + ivl` days for review cards (positive `ivl`). For learning cards with negative `ivl` (seconds), `now + |ivl|` seconds.

### UI guidance for Anki import

The Anki section of the import screen should:
1. **Be the simplest import path** — no API keys, no tokens, just pick a file. The UX should feel effortless.
2. **Show privacy assurance** prominently: "Your deck is processed entirely on this device."
3. **Show selected file name** after picking — confirm to the user what they selected.
4. **Handle large decks** gracefully: show a progress indicator ("Processing deck...") since parsing may take a few seconds for large decks.
5. **On error, be specific:**
   - "This file doesn't appear to be a valid Anki deck." (not a valid ZIP or missing DB)
   - "No cards found in this deck." (empty deck)
   - "Could not read the deck database. The file may be corrupted." (SQLite error)
6. **After successful import:** show mapped/unmatched counts consistent with other import sources.

### Testing requirements

- `ankiParser` tests: parse valid legacy SQLite data, parse modern format, handle missing `notes` table, handle missing `cards` table, handle empty deck, handle malformed `flds` field, extract deck name from `col.decks` JSON.
- `ankiMapper` tests: mapped card, unmatched card, new card (skipped or minimal state), learning card conversion, review card with various intervals, suspended/buried card handling, empty input, summary count accuracy.
- `convertAnkiCardToFsrs` tests: new card, learning card (negative interval), review card (short/medium/long/very long interval), relearning card, ease factor extremes (1300, 2500, 3500), zero interval edge case, boundary values.
- `ankiFileReader` tests (mocked FS/ZIP): successful read and parse, invalid ZIP file, missing collection DB inside ZIP, temp file cleanup on success, temp file cleanup on error.
- `runAnkiImport` integration tests: end-to-end successful flow, transactional rollback on mapping failure, empty deck handling.

### Scope boundaries

**In scope:**
- `expo-document-picker` integration for `.apkg` file selection
- ZIP extraction of `.apkg` files on-device
- SQLite parsing of Anki collection database
- Mapping Anki notes/cards to internal curriculum items
- Anki interval/ease → FSRS state conversion
- `runAnkiImport` orchestration in `importRepository.ts`
- Onboarding import screen extension with Anki third tab
- Malformed file error handling and temp file cleanup
- Tests for all new code

**Out of scope (defer):**
- Anki media file import (images, audio) — not needed for SRS state import
- `collection.anki21b` zstd decompression (edge case — most shared decks use legacy format)
- Anki deck creation/export
- Full import summary UX polish with `ImportSummaryCard` (Story 3.5)
- Multi-source onboarding branch completion and routing (Story 3.6)
- Curriculum data population of `external_id_mappings` for Anki source (content pipeline concern)

### Dependency decision guidance

**ZIP library choice — evaluate in this order:**

1. **`jszip` (v3.x):** Pure JS, ~100KB, handles deflate compression in ZIP files. Works in RN runtime without native modules. No Expo config plugin needed. Suitable for one-time import operations where blocking the JS thread for a few seconds is acceptable (user sees a loading indicator). **Recommended for MVP unless performance testing shows unacceptable delays on typical deck sizes (500-2000 cards).**

2. **`react-native-zip-stream`:** Native module with Expo plugin support. Better performance for large archives. Requires dev build (not Expo Go). Use only if `jszip` proves too slow.

**The developer should install and test `jszip` first.** If it handles a 1000-card `.apkg` in under 5 seconds on a mid-range device, it's sufficient.

### Git intelligence summary

Recent commits:
- `25dc8a6` (Story 3.3): Added Bunpro import with the source-switcher UI pattern. Extended import screen to support WaniKani/Bunpro tabs.
- `933a3e6` (Story 3.2): Added WaniKani import pipeline — the canonical pattern for client→mapper→converter→repository→UI.
- `3ad429c` (Story 3.1): Established credential store. Anki doesn't need credentials but the secure storage patterns are established.

The import screen currently has two source tabs (WaniKani, Bunpro). Story 3.4 adds a third tab for Anki with a fundamentally different UX (file picker instead of API key input).

### Project Structure Notes

- Aligns with architecture's `core/import/ankiParser.ts` file placement
- Data layer file at `data/import/ankiFileReader.ts` matches the pattern of `data/import/wanikaniClient.ts` and `data/import/bunproClient.ts` — each external source gets its own data-layer reader
- `expo-document-picker` is listed in the architecture's dependency table under `expo-file-system` usage for Anki imports
- The `expo-file-system` package is already installed and mocked

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.4 ACs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — External integration: "Anki deck files | core/import/ankiParser.ts | Local file parsing (.apkg = SQLite zip)", expo-file-system for Anki deck import, non-destructive import pattern]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR33f (Anki deck import), FR33g (unmatched flagged), NFR9 (local processing), NFR19 (malformed file handling)]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Flow 3: "Select Anki deck file" → "Fetch & map progress" → "Import Summary", ImportSummaryCard source badge includes "Anki", expo-file-system listed for Anki deck import]
- [Source: `_bmad-output/implementation-artifacts/3-3-bunpro-import-or-documented-fallback.md` — previous story patterns, import screen UI tabs, test infrastructure]
- [Source: `_bmad-output/implementation-artifacts/3-2-wanikani-v2-import-with-mapping-and-fsrs-conversion.md` — canonical import pipeline pattern]
- [Source: `mobile/src/core/import/import.types.ts` — existing import type contracts to extend]
- [Source: `mobile/src/core/import/fsrsConverter.ts` — stage conversion pattern to extend with interval-based conversion]
- [Source: `mobile/src/data/user/importRepository.ts` — orchestration and persistence pattern to follow]
- [Source: `mobile/src/app/onboarding/import.tsx` — current import UI to extend with Anki tab]
- [Source: Anki .apkg format documentation — ZIP archive structure, SQLite schema, notes/cards/col tables]
- [Source: expo-document-picker documentation — getDocumentAsync API, copyToCacheDirectory option]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Chose `jszip` over native ZIP libraries for Expo Go compatibility; extraction runs on JS thread with UI progress indicator for large decks.
- `expo-document-picker` requires no additional `app.json` plugin for SDK 55 file access.
- ZIP/FS tests use injectable deps on `ankiFileReader` rather than mocking `jszip` directly.

### Completion Notes List

- Implemented full on-device Anki `.apkg` import pipeline: file picker → ZIP extract → SQLite query → parse → map → transactional persist.
- Added `convertAnkiCardToFsrs` with interval/ease-based FSRS conversion (learning, review, relearning, suspended/buried, burned).
- Extended onboarding import screen with Anki as third source tab, file picker UX, privacy note, and processing indicator.
- Added 29 new tests; full suite now 204 passing. Lint and typecheck clean.

### File List

- mobile/package.json
- mobile/package-lock.json
- mobile/__mocks__/expo-document-picker.ts
- mobile/__mocks__/expo-file-system.ts
- mobile/src/core/import/import.types.ts
- mobile/src/core/import/ankiParser.ts
- mobile/src/core/import/ankiParser.test.ts
- mobile/src/core/import/ankiMapper.ts
- mobile/src/core/import/ankiMapper.test.ts
- mobile/src/core/import/fsrsConverter.ts
- mobile/src/core/import/fsrsConverter.test.ts
- mobile/src/data/import/ankiFileReader.ts
- mobile/src/data/import/ankiFileReader.test.ts
- mobile/src/data/user/importRepository.ts
- mobile/src/data/user/importRepository.test.ts
- mobile/src/app/onboarding/import.tsx

### Change Log

- 2026-06-14: Story 3.4 — Local Anki `.apkg` import with on-device parsing, FSRS conversion, repository orchestration, UI, and tests.
- 2026-06-14: Code review — empty-deck warning, collection DB fallback on read failure, stage-label ordering fix; 205 tests passing.

## Senior Developer Review (AI)

**Reviewer:** Composer (bmad-code-reviewer)  
**Date:** 2026-06-14  
**Outcome:** Approve after fixes

### Findings (before fix)

| Severity | Issue | Resolution |
| --- | --- | --- |
| HIGH | AC5 required an informational message for empty decks; mapper returned success with no `warningMessage` | Added `warningMessage: 'No cards found in this deck.'` in `mapAnkiCards` |
| HIGH | Dev notes required fallback to `collection.anki21` / `collection.anki2` when `collection.anki21b` SQLite read fails; only first filename was attempted | Added `listCollectionDbFileNames` and iterative fallback in `readAnkiApkgFile` |
| MEDIUM | `getAnkiStageLabel` in `ankiMapper.ts` had unreachable `type === 3` branch (relearning mislabeled as learning) | Reordered checks so relearning is evaluated before queue-based learning |
| MEDIUM | Anki import success UI ignored `summary.warningMessage` (unlike Bunpro) | Added `formatAnkiImportSuccessMessage` |

### Validation

- All 6 acceptance criteria verified against implementation
- File List matches git changes (16 mobile files)
- `npm run lint`, `npm run typecheck`, `npm test` — 205 passed

### Remaining low-severity notes (no action)

- Post-pick `.apkg` extension validation not enforced (MIME types used; content validated on parse)
- `collection.anki21b` zstd compression explicitly out of scope per story
- New-only Anki cards intentionally skipped per AC4 conversion rules
