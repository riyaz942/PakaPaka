# Web: second tab in browse-only mode, with "Use here"

Date: 2026-11-21
Scope: web build only. Native is not affected.

## Why

On the web, PakaPaka runs in one tab only. A second tab shows "PakaPaka is
open in another tab" and nothing else.

The operator's use case: during a review in tab A, open tab B to look up a
kanji, a word or a passage, then go back to tab A and continue the review.
Today this is not possible.

## Goals

- Tab B opens in **browse-only** mode: Browse, item details, compare,
  passages, Home and Stats work, with the same content and progress as tab A.
- The review in tab A continues without interruption.
- Tab B tells the user clearly why it is browse-only and how to study there.
- A **Use here** button moves the app to tab B (hand-off, as in WhatsApp Web).

## Non-goals

- Two tabs that both study and write at the same time.
- Live updates in tab B. Tab B shows a snapshot from when it opened.
- Any change to native.

## Anti-goals (a failure even if it works)

- Tab B writes to the real databases, uploads data (sync), or erases data.
- Tab B shows locked content as unlocked, or shows no progress.
- A silent fallback (for example, tab B opens the bundled curriculum without
  progress when tab A does not answer). See the "no hidden fallback" rule.

## Facts that shape the design

- Storage: expo-sqlite's web build uses `AccessHandlePoolVFS`. At startup it
  takes an exclusive lock on **every** file in its OPFS folder
  (`curriculum.db`, `user.db`, spare files). A second tab cannot open any of
  them, read-only included.
- The app uses synchronous SQLite calls (86 places in app code), through a
  dedicated worker and `SharedArrayBuffer`. So tab B cannot send its queries
  to tab A. Tab B needs its own databases in memory.
- expo-sqlite's worker creates the OPFS pool VFS the first time it opens any
  database, in-memory too (`maybeInitAsync`). In tab B that throws. The
  existing `patches/expo-sqlite+55.0.17.patch` must make the pool VFS lazy:
  create it only when a non-memory path is opened.
- Grades persist per answer (`ReviewSessionProvider`). A hand-off loses only
  the card on screen, not saved answers.
- `curriculumDb` is ATTACHed to `userDb` by file path
  (`attachCurriculumForQuery`). In tab B both are in-memory copies, so the
  attach must work on those copies (see "Left to the builder").

## Approaches considered

1. **Hand-off only.** Tab B shows "Use here"; tab A releases. Small change.
   Rejected as the only path: a lookup stops the review in tab A.
2. **Both tabs fully live.** Replace the storage layer with one that allows
   shared access, and add change notifications between tabs. Large change and
   a real risk of lost progress. Rejected.
3. **Browse-only second tab + Use here.** Chosen by the operator.

## Design

### Who owns the databases

- The owner tab holds a Web Lock (`navigator.locks`, name `pakapaka-db`)
  for its whole life.
- At startup, a tab asks for the lock with `ifAvailable: true`.
  - Lock granted: normal startup (today's path).
  - Lock not granted: browse-only startup.
- Tabs talk on one `BroadcastChannel` (`pakapaka-db`).

### Browse-only startup (tab B)

1. Tab B posts `snapshot-request`.
2. The owner serializes `curriculum.db` and `user.db` (`serializeAsync`) and
   posts both byte arrays back (about 12 MB plus the user database).
3. Tab B opens both from the bytes in memory, attaches the curriculum, and
   gives the app the same `DatabaseContext` as normal.
4. Tab B does not run: migrations, curriculum seed import, curriculum update
   check, sync, the session-ended erase, or `requestPersistentStorage`.
5. No answer within a timeout (agent's call: 5 s), for the snapshot or for
   a Use here release: show a screen,
   "The other PakaPaka tab did not answer. Open that tab once, then reload
   this page." with a **Reload** button. No fallback to the bundled
   curriculum.

### What the user sees in tab B

- **First, a modal.** Every time tab B opens in browse-only mode, it shows
  this modal before anything else. Tab B asks for the snapshot in the
  background while the modal is open; **Browse** waits for it (spinner on
  the button) if it is not ready yet.

  ```
  ┌───────────────────────────────────────────────────────────┐
  │          PakaPaka is already open in another tab          │
  │                                                           │
  │  Only one tab can save your progress. So this tab cannot  │
  │  run reviews or lessons right now.                        │
  │                                                           │
  │  Browse                                                   │
  │  Look up kanji, words and passages in this tab. Your      │
  │  review in the other tab keeps going. Progress here is    │
  │  from when this tab opened.                               │
  │                                                           │
  │  Use here                                                 │
  │  Move PakaPaka to this tab. The other tab stops. Answers  │
  │  you gave there are saved.                                │
  │                                                           │
  │              [ Browse ]        [ Use here ]               │
  └───────────────────────────────────────────────────────────┘
  ```

  The modal has no close (X) button. The user picks one of the two.

- **Then, a banner.** After **Browse**, a banner stays at the top of every
  screen in tab B:

  ```
  ┌───────────────────────────────────────────────────────────┐
  │ Browse only. Reviews and lessons run in your other tab.   │
  │                                          [ Use here ]     │
  └───────────────────────────────────────────────────────────┘
  ```

- Screens that write or study are replaced by one "Browse only" screen:
  Review, Lesson, Settings, Talk, onboarding, levels. The screen says why and
  has **Use here**:

  ```
            Reviews and lessons run in the other tab

    Only one tab can save your progress. This tab is for
    browsing. To study here, move PakaPaka to this tab.

           [ Use here ]      [ Back to Browse ]
  ```

  One guard covers buttons and deep links. Home's Review / Lesson buttons
  stay visible and lead to this screen.
- Writes that Browse / item detail / Home / Stats do (if any) go to the
  in-memory copy and are lost on close. This is acceptable; the banner says
  progress is not saved here.

### Use here (hand-off)

1. Tab B shows "Moving PakaPaka to this tab…" and asks for the Web Lock
   (waiting, not `ifAvailable`).
2. Tab B posts `release`.
3. Tab A unmounts the app UI, closes both databases, stops the SQLite worker
   (frees the OPFS handles), and releases the Web Lock.
4. Tab A shows:

   ```
              PakaPaka is open in another tab

     You moved PakaPaka to another tab. Your answers up to
     now are saved.
                       [ Use here ]
   ```

   Its **Use here** does the same hand-off in the other direction. Tab A does
   not reopen by itself.
5. Tab B gets the lock, releases it, and reloads. The reload takes the normal
   startup path.

### Existing screens that change

- `DB_LOCKED_BY_OTHER_TAB` screen in `DatabaseProvider`: no longer the
  normal path. It stays for the case where the Web Lock is free but the files
  are still locked (for example, a page in the back/forward cache).
- `SyncProvider`, `AccountProvider` session checks, `OnboardingRedirect`,
  curriculum update: off in browse-only mode.

## Left to the builder

- How tab B attaches the in-memory curriculum to the in-memory user database.
  Options: deserialize into an attached schema (`sqlite3_deserialize` with a
  schema name), or write both copies as named files in the memory VFS and
  attach by name. Prove this first with a short spike; the rest of the design
  depends on it.
- Where the browse-only flag lives (`DatabaseContext` field or a small
  context), and the route guard's exact placement.
- Message shapes on the `BroadcastChannel`.
- Tests: unit tests for the owner / browse-only decision, the snapshot
  handshake (with fakes for `navigator.locks` and `BroadcastChannel`), the
  route guard, and the release path. A browser check with two real tabs.

## Calls made by the agent (operator to check)

- 5 s timeout for the snapshot answer.
- Home and Stats stay available in tab B (they only read).
- Tab A does not reopen by itself after a hand-off.
- Modal, banner and screen wording above.
- The modal shows each time a browse-only tab opens, and has no close button.
