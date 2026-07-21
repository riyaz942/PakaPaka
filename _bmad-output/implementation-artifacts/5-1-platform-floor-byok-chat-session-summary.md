---
baseline_commit: 9a1a826949e2a33f657c465fb0bdf3447ec61796
---
# Story 5.1: Platform Floor, BYOK Chat & Session Summary

Status: review (code complete; Task 1 native dev-client rebuild smoke test outstanding — owner to verify on a machine with Xcode / Android Studio)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want a Conversation tab with bring-your-own-key chat grounded in what I've learned, and coaching only after I end,
so that I can practise real Japanese without mid-chat corrections or handing data to a vendor I didn't choose.

## Acceptance Criteria

1. **Platform floor & New Architecture** (NFR23): native builds set minimum OS to iOS 17.0 / Android API 33 and enable New Architecture via `expo-build-properties`; a custom dev client is required (Expo Go is insufficient — this unblocks Story 5.2's executorch work, but 5.2 itself is out of scope here).
2. **Tab shell** (FR87, UX-DR3, UX-DR21): opening the Conversation/Talk tab (already occupying the slot freed by removing Read — `app/(tabs)/converse/index.tsx`) shows `KeySetup` if no BYOK key is configured, otherwise the start picker empty state.
3. **BYOK credentials** (FR88, NFR24): entering credentials (in-tab or Settings) supports two adapters — OpenAI-compatible with an editable base URL, and Anthropic. Keys are stored in platform secure storage and only ever sent to the user-configured HTTPS endpoint. Every adapter call returns `Result<T, AppError>`.
4. **Session start & chat** (FR89, FR90): the picker offers practise-recent-grammar / choose-grammar / role-play / random; chat is the default mode. Streaming uses `expo/fetch` SSE; a partial or failed stream degrades without corrupting the persisted transcript (NFR27).
5. **Furigana-formatted replies** (FR91, OA6): AI replies render through the existing `FuriganaText` component using curriculum bracket format; a parse failure renders plain text with no error toast.
6. **In-band control markers** (FR97): control signals (at minimum, the end-of-session wrap-up signal) are hidden markers the app strips before render — no tool-calling layer.
7. **Unknown-word flagging** (FR92, FR93, NFR29): a flagged word that exists in the curriculum but is unstudied deep-links to its details page; an off-curriculum word is display-and-translate only. Flagged words never create SRS rows. A non-gesture alternative exists alongside the long-press/tap gesture.
8. **Session end & summary** (FR94, FR95, FR96): ending (End button or AI wrap-up signal) or abandoning triggers on-demand, once-only, cached summary generation with ≤5 mistakes worth fixing, words met by curriculum membership, and grammar-practice notes. Abandoning closes silently, un-summarised but resumable. A turn budget (placeholder OA4 constants OK) steers endings without a hard cutoff.
9. **Past sessions** (FR89): a top-corner entry point on the Conversation tab opens prior threads as a secondary surface; the start picker remains the primary empty state for new sessions.
10. **Offline handling** (NFR24, UX-DR22): opening Conversation while offline shows a clear "requires internet" state; all other tabs stay fully usable.
11. **Persistence** (NFR28): new `user.db` migration(s) create AI session/message/cached-summary storage without breaking existing user data or colliding with migration `016_furigana_overrides` (see Dev Notes — the next free version is **017**, not "016+").

## Tasks / Subtasks

- [x] **Task 1 — Platform floor + New Architecture** (AC: 1)
  - [x] Add `expo-build-properties` to `mobile/package.json` and `app.json` plugins; set `newArchEnabled: true` (iOS + Android), iOS `deploymentTarget: "17.0"`, Android `minSdkVersion` for API 33.
  - [ ] **BLOCKED — needs a machine with Xcode / Android Studio.** Rebuild the custom dev client (`npx expo prebuild` / `npx expo run:ios` / `npx expo run:android`) and confirm the app still boots — this is a whole-app constraint, not additive code, so smoke-test existing review/lesson flows aren't broken by the New Architecture flip.
- [x] **Task 2 — Migration 017: AI persistence** (AC: 11)
  - [x] Create `mobile/src/data/migrations/017_ai_sessions.ts` (version 17) — do **not** reuse `016`, it's taken. Register it last in `mobile/src/data/migrations/index.ts`.
  - [x] Tables (naming per architecture §Naming Patterns, `snake_case`, `_id`/`_at` suffixes): `ai_sessions` (id, provider, model, started_at, ended_at nullable, ended_reason nullable CHECK IN ('ai_wrap_up','user_end','abandoned'), turn_count, summary_json nullable, summary_generated_at nullable), `ai_messages` (id, session_id FK, role CHECK IN ('user','assistant'), content, created_at). No separate "cached summary" table needed — nullable columns on `ai_sessions` satisfy "generate once, cache, never regenerate" (FR96) with one fewer join.
  - [x] No curriculum.db changes — this is user.db only.
- [x] **Task 3 — BYOK key storage** (AC: 3)
  - [x] Add `mobile/src/data/ai/byokCredential.types.ts` mirroring `data/user/importCredential.types.ts` (`ImportCredentialSource` pattern) for `'openai' | 'anthropic'`, with secure-store keys namespaced `byok.openai` / `byok.anthropic` per architecture §Format Patterns.
  - [x] Add a small store module following `data/user/credentialStore.ts` exactly (`SECURE_OPTIONS` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `Result`-returning save/get/has/discard) — same mechanism as import keys, not a new one.
  - [x] Store the OpenAI-compatible base URL (non-secret, user-editable) via the existing generic `getPreference`/`setPreference` in `data/user/preferencesRepository.ts` — it is not a credential.
- [x] **Task 4 — BYOK adapters** (AC: 3, 4)
  - [x] `core/ai/adapters/openAiCompatibleAdapter.ts` and `core/ai/adapters/anthropicAdapter.ts` — pure, `Result<T, AppError>`-returning, normalize only transport (auth header shape, system-prompt placement, SSE event/delta shape, error/rate-limit mapping, usage-accounting field names) per architecture §API & Communication Patterns. No tool-calling support — see Task 6.
  - [x] Streaming client in `data/ai/` using `expo/fetch` (first use of streaming fetch in this codebase — RN's default `fetch` does not support SSE). Partial-stream failure must commit only completed assistant turns and leave the transcript intact (NFR27) — never wipe messages already written.
- [x] **Task 5 — In-band markers** (AC: 6, 8)
  - [x] `core/ai/markers.ts`: define and parse a small sentinel vocabulary (start with one — the AI-wrap-up signal for FR96/FR94's "steer"). Strip markers from the text **before** it reaches `parseFurigana` — the marker token is not kana-bracket notation and must not be mistaken for malformed furigana.
  - [x] System prompt instructs the model to emit the sentinel when it judges the scene should end (turn budget is a steer via prompt instruction, not app-enforced truncation).
- [x] **Task 6 — Turn budget placeholder (OA4)** (AC: 8)
  - [x] `core/ai/turnBudget.ts`: a small named pure function (e.g. `computeTurnBudget(level, completionStats): number`) with placeholder constants, documented inline as `OA4` — exact formula is an explicitly deferred open item, not a blocker for this story.
- [x] **Task 7 — Chat surface** (AC: 2, 4, 5)
  - [x] Replace the inert placeholder at `app/(tabs)/converse/index.tsx` (currently `TabPlaceholderScreen`) with real routing: unconfigured → `KeySetup`; configured, no active session → `ConversationStartPicker`.
  - [x] New routes per architecture §Project Structure: `app/(tabs)/converse/session/[id].tsx` (chat), `app/(tabs)/converse/summary/[id].tsx` (on-demand summary), plus a history list route for Task 9.
  - [x] `components/converse/`: `ChatBubble`, `Composer`, `KeySetup`, `ConversationStartPicker`, `ConversationSummary`. **Composer must not implement the mic button/PTT promotion** — FR90's mic-to-conversation-mode handoff and everything voice-related is Story 5.2 scope; a disabled or absent mic affordance here is correct, not a gap.
  - [x] AI reply text renders via the existing `FuriganaText` (`components/common/FuriganaText.tsx`) and `parseFurigana` (`core/furigana/parseFurigana.ts`) — **do not write a new parser**; `parseFurigana` already degrades malformed brackets to a single unannotated plain-text segment without throwing, which is exactly FR91/OA6's required behavior.
- [x] **Task 8 — Unknown-word flagging** (AC: 7)
  - [x] Local lookup (zero token cost) against curriculum items — reuse the query shape in `data/user/masteryRepository.ts` / `data/curriculum/itemRepository.ts` (`findItemsByAcceptedAnswer` is the closest existing text→item lookup) rather than inventing a new matching path.
  - [x] Curriculum-but-unstudied → deep-link to `browse/item/[id]`. Off-curriculum → display + translate only, no link, no SRS row (constraint: every SRS row is keyed to a curriculum `item_id` — never write `item_study_status`/`srs_states` for a flagged word without one).
  - [x] Long-press is this app's first `onLongPress` outside Story 3.2/4.x's passage long-press — pair it with a visible non-gesture alternative (NFR29, CI-enforced by `eslint-plugin-react-native-a11y`).
- [x] **Task 9 — Start picker, suggestion, history** (AC: 2, 4, 9)
  - [x] "Practise recent grammar" row sourced from `item_study_status.updated_at` / `srs_states.updated_at` ordered descending, filtered to grammar items — no new tracking table needed, both columns already exist.
  - [x] Top-corner entry → history route listing past `ai_sessions` (secondary surface; start picker stays the primary empty state).
- [x] **Task 10 — Session end & summary** (AC: 8)
  - [x] End button (always present) and the AI wrap-up marker both raise the same end popup → on-demand summary generation (one extra adapter call), written once to `ai_sessions.summary_json`/`summary_generated_at`, never regenerated on reopen.
  - [x] Abandon (navigate away) closes silently: `ended_at`/`ended_reason` may be left null or set without a summary — no summary call fires. A resumed/reopened unsummarised session can still request a summary later (still on-demand, still once).
- [x] **Task 11 — Offline handling** (AC: 10)
  - [x] Detect connectivity (existing `expo-network` usage elsewhere in the app is the precedent) and render a clear "requires internet" state on the Conversation tab only; confirm no other tab's behavior changes.
- [x] **Task 12 — Settings integration** (AC: 3)
  - [x] Add a BYOK section to `app/(tabs)/settings.tsx` (key management for both providers) — this is the first secure-credential UI in Settings; today only `app/onboarding/import.tsx` has credential entry, so there's no existing Settings-side component to extend, model it on the onboarding import screen's input pattern instead.
- [x] **Task 13 — Tests**
  - [x] `core/ai/markers.test.ts`, `core/ai/turnBudget.test.ts`, adapter tests (mock `expo/fetch`), `017_ai_sessions` migration test, unknown-word flagging unit tests, RNTL tests for `KeySetup`/`ConversationStartPicker`/offline empty state.
  - [x] Run `npx tsc --noEmit` and `npm run lint` (mobile/) before considering the story complete — both are enforcement rules, not optional.

### Review Findings

- [x] [Review][Patch] Back without Finish must not call `endAiSession` — leave `ended_at` null so history reopens chat; only explicit Finish (End button / AI wrap-up → Finish) sets `ended_at` [`session/[id].tsx:60-63`]
- [x] [Review][Patch] Corrupt `summary_json` with `summary_generated_at` set permanently blocks regeneration — `parseSummary` returns null but timestamp remains; `useSessionSummary` treats any non-null timestamp as cached [`aiSessionRepository.ts:51-87`] [`useSessionSummary.ts:60-64`]
- [x] [Review][Patch] `saveAiSessionSummary` does not enforce once-only at the DB boundary — concurrent `generate()` can overwrite; use `UPDATE … WHERE summary_generated_at IS NULL` [`aiSessionRepository.ts:218-228`]
- [x] [Review][Patch] Remove dead `newArchEnabled` keys from `expo-build-properties` — SDK 55 makes New Architecture mandatory and the plugin ignores these keys; keep iOS 17 / API 33 floors [`app.json:52-59`]
- [x] [Review][Patch] `ON DELETE CASCADE` is inert without `PRAGMA foreign_keys = ON` — enable on user.db open and make the SQLite mock cascade-delete `ai_messages` [`017_ai_sessions.ts:38`] [`database.ts`]
- [x] [Review][Patch] `setAiOpenAiBaseUrl` can persist empty/whitespace after trim — empty string defeats `?? DEFAULT_OPENAI_BASE_URL` [`preferencesRepository.ts:340-341`]
- [x] [Review][Patch] Fix `PREFERENCE_KEYS` comment that says “these two” while four BYOK keys were added [`preferencesRepository.ts:31-36`]
- [x] [Review][Patch] “lists past sessions newest first” never asserts order — only membership [`aiSessionRepository.test.ts:160-177`]

<!-- Chunk 2 review (AI core / adapters / streaming / data AI) -->
- [x] [Review][Patch] Enforce HTTPS for OpenAI-compatible base URL, with `http:` allowed only for localhost/loopback — reject other schemes before attach/send [`openAiCompatibleAdapter.ts:22-25`] [`preferencesRepository.ts:340-348`]
- [x] [Review][Patch] `listRecentGrammar` uses `MAX(...)` with bare columns and no `GROUP BY`, so SQLite collapses to a single arbitrary row instead of up to `limit` recent grammar items [`recentGrammarRepository.ts:30-41`]
- [x] [Review][Patch] SSE loop never flushes leftover `buffer` or `TextDecoder` on `done`, so a final frame without a trailing blank line (or a split multi-byte UTF-8 sequence) is silently dropped [`streamingClient.ts:124-166`]
- [x] [Review][Patch] `parseStreamData` returns only `delta` when the same choice frame has both content and `finish_reason`, so `complete` stays false when the provider omits a separate `[DONE]` [`openAiCompatibleAdapter.ts:88-95`]
- [x] [Review][Patch] `lookupFlaggedWord` matches `primary_form` with no `item_type` preference/order — 69 kanji/vocab collisions in seed curriculum can deep-link to the wrong details page [`wordLookupRepository.ts:49-62`]
- [x] [Review][Patch] `resolveAiConfig` uses `getAiModel(...) ?? DEFAULT_MODELS` — empty string from `setAiModel` (trim-only) bypasses the default and sends an empty model name [`aiConfig.ts:105`] [`preferencesRepository.ts:375-384`]
- [x] [Review][Patch] After a failed turn that committed only the user message, the next send yields consecutive `user` roles; Anthropic Messages API rejects that — coalesce or insert a placeholder assistant before build [`useAiConversation.ts:40-42`] [`anthropicAdapter.ts:40-43`]
- [x] [Review][Patch] Grammar prompt topics never load `example_sentences` even though `GrammarPromptTopic` / `buildConversationSystemPrompt` support them — practise/choose-grammar prompts omit the examples Dev Notes say to use [`recentGrammarRepository.ts:26-71`] [`systemPrompt.ts:72-74`]
- [x] [Review][Patch] `hasByokKey` treats any non-null SecureStore value as configured, including `""` [`byokCredentialStore.ts:59-65`]
- [x] [Review][Patch] Unbounded SSE `buffer` growth when the peer never emits a blank-line delimiter — add a max buffer size and fail the turn [`streamingClient.ts:120-134`]
- [x] [Review][Defer] OpenAI-compatible requests always send `max_tokens`; some newer compatible models want `max_completion_tokens` instead — deferred, provider API variance beyond v1 transport normalize [`openAiCompatibleAdapter.ts:37`]

## Dev Notes

**Scope boundary — read before starting:** This story is chat-only. Push-to-talk, executorch, Supertonic TTS, Whisper STT, and the mic-button mode promotion (FR90's second half, FR98–FR100) are **Story 5.2**, already a separate backlog entry (`5-2-push-to-talk-voice-with-on-device-tts-stt`). Story 5.1 raises the platform floor that 5.2 depends on but must not pull voice work forward — the source brainstorming session's build order (`_bmad-output/brainstorming/brainstorming-session-2026-07-19-1651-ai-conversation.md`, "Suggested build order" + "Revised build order") explicitly sequences chat (steps 1–7) before executorch (step 8) as one unit, precisely to avoid a half-shipped voice feature.

**Migration numbering — the planning docs are stale here.** PRD/epics/architecture all say "`016+`" for AI tables, written when `015_furigana_overrides` was still the planned name. In the shipped codebase, `015` went to `015_goal_ring_state` and `016` went to `016_furigana_overrides` (see `mobile/src/data/migrations/016_furigana_overrides.ts`'s own header comment, which documents this exact renumbering for the same reason). The next free version for this story is **017**. Register it last in `mobile/src/data/migrations/index.ts` alongside the existing 16 entries.

**Reuse, do not rebuild — the furigana pipeline already exists and matches the AI-reply format exactly.** `core/furigana/parseFurigana.ts` parses `私[わたし]は学生[がくせい]です。` (verified identical to `curriculum/grammar/*.json`'s `example_sentences[].furigana` field), never throws, and degrades malformed/unbalanced brackets to one plain-text segment — this *is* FR91/OA6's "parse failure → plain text, no error" requirement, already built and tested. `components/common/FuriganaText.tsx` renders it and already supports a non-interactive mode (`interactive={false}`) for when a parent Pressable should own the tap — useful if AI chat bubbles want tap-to-toggle disabled or scoped differently than lesson/passage text.

**BYOK secure storage precedent.** `data/user/credentialStore.ts` + `data/user/importCredential.types.ts` (`IMPORT_CREDENTIAL_KEYS` record, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `Result`-returning CRUD) is the exact mechanism NFR24/FR88 wants extended — same store, new key namespace (`byok.openai`, `byok.anthropic` per architecture §Format Patterns), not a new secure-storage abstraction.

**Generic preference storage precedent.** `data/user/preferencesRepository.ts` already has a generic `getPreference`/`setPreference` key-value pair (used for onboarding path, intensity, furigana mode, notification time, etc.) — use it for the OpenAI-compatible base URL and any other non-secret BYOK config. Do not create a new preferences mechanism.

**Unknown-word / mastery lookup precedent.** `data/user/masteryRepository.ts` (`isVocabularyItemKnown`, `getKnownVocabularyCharacters`) and `data/curriculum/itemRepository.ts` (`findItemsByAcceptedAnswer`) already implement "is this text a known/curriculum item" queries against the ATTACHed `curriculum` database (`CURRICULUM_ATTACH_ALIAS` in `data/database.ts`). Flagging logic should call into this layer, not duplicate the join.

**Tab shell is already wired — you're replacing content, not adding a tab.** `app/(tabs)/_layout.tsx` already has a `converse` tab titled "Talk" occupying the slot freed by removing Read (done in Epic 3). `app/(tabs)/converse/index.tsx` is currently `TabPlaceholderScreen` with an explicit comment: "Deliberately inert — no BYOK key setup, no chat surface, nothing that reaches the network." This story removes that placeholder and its `.test.tsx`.

**Adapter/provider selection is an open design point this story must resolve sensibly (not gated by an AC, but don't skip it):** FR88 supports both adapters existing simultaneously; nothing in the planning docs says whether a user configures one or both, or how the active adapter for a new session is chosen. Recommend a simple non-secret preference (e.g. `ai_active_provider`) alongside the two credential slots, defaulting to whichever key is configured (or the most-recently-saved one if both are).

**Grammar content for system prompts** ships rich structure already (`primary_form`, `meaning`, `structure`, `conjugation_rules`, `accepted_forms`, `example_sentences[].{japanese, furigana, vocabulary_slugs}`) — verified against `curriculum/grammar/n5.json`. This is what "practise this grammar" / "recent grammar" prompts should be built from; no curriculum schema changes needed for this story.

**Hard conventions (project-wide, re-affirmed for this story):**
- Every fallible async operation (adapter calls, streaming, migration, secure storage) returns `Result<T, AppError>` — never throw across an async boundary (`src/types/result.types.ts`). Error `code` values are lowercase snake_case strings (see `secure_store_error`, `invalid_credential` in `credentialStore.ts`) — follow the same style for new AI error codes.
- Never write to `curriculum.db`. This story only adds `user.db` tables/migrations.
- NativeWind semantic tokens only (`bg-background`, `text-primary`, etc.) — no raw hex, no the deprecated `Colors` object. Conversation's accent reuses `feedback-info` blue (UX-DR32) — already the tab's active tint (`colors.feedbackInfo` in `_layout.tsx`).
- No UI animations requirement is specific to the *review* loop (NFR5b) — does not apply here, but keep chat interactions responsive regardless.
- Co-locate tests (`Foo.ts` → `Foo.test.ts`), named exports only, no default exports, no barrel imports from `core/`.
- Wrap multi-table SQLite writes (e.g. session + first message) in a transaction.

**Anti-patterns specific to this story (from architecture §Enforcement Guidelines):**
- Tool-calling for BYOK control → use in-band markers (`core/ai/markers.ts`) instead.
- Silent cloud STT fallback → not applicable to 5.1 (no STT here at all — see scope boundary above).
- Creating an SRS row for an AI-flagged word without a curriculum `item_id` → forbidden, full stop.
- A second/fallback code path "whose selection depends on something the developer can't see" (the brainstorming session's core design theme, `no-hidden-fallback-paths` applies here as much as anywhere in this codebase) — e.g. no silent retry-with-different-adapter, no automatic provider switching. Where a choice is genuinely needed, it's a visible user setting.

**API surface currently unpinned — verify at implementation time.** Neither the PRD nor architecture doc fixes exact OpenAI/Anthropic endpoint paths, request/response shapes, or SSE event names (they're intentionally described only as "normalize transport" requirements). Anthropic's Messages API (`system` as a top-level field, `content-block-delta` SSE events) and OpenAI-compatible chat completions (`system` as a message role, `choices[].delta` SSE events) differ exactly as the brainstorming session (`#2.1`) describes — confirm current field/event names against each provider's live docs before wiring the adapters, since this is the one part of the story with no in-repo precedent to copy.

### Project Structure Notes

- New `core/ai/` (pure, React-free): `adapters/openAiCompatibleAdapter.ts`, `adapters/anthropicAdapter.ts`, `markers.ts`, `turnBudget.ts`.
- New `data/ai/`: streaming client (`expo/fetch` wrapper), `byokCredential.types.ts` + key-store module, session/message repository (naming consistent with `data/user/*Repository.ts` — e.g. `data/user/aiSessionRepository.ts`, since this is `user.db` state like every other `data/user/` repo).
- New `components/converse/`: `ChatBubble.tsx`, `Composer.tsx`, `KeySetup.tsx`, `ConversationStartPicker.tsx`, `ConversationSummary.tsx`.
- Modified: `app/(tabs)/converse/index.tsx` (replace placeholder), `app/(tabs)/_layout.tsx` (no change expected — tab already exists), `app/(tabs)/settings.tsx` (add BYOK section), `data/migrations/index.ts` (register 017), `app.json` + `mobile/package.json` (expo-build-properties, New Architecture, min OS).
- Removed: `app/(tabs)/converse/index.test.tsx`'s placeholder-specific assertions (replace with real coverage), the `TabPlaceholderScreen` usage in `converse/index.tsx`.
- No changes to `curriculum/`, `scripts/`, or any `curriculum.db` schema.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1: Platform Floor, BYOK Chat & Session Summary] — canonical AC source
- [Source: _bmad-output/planning-artifacts/prd.md#AI Conversation] FR87–FR100, NFR23–NFR30
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] target directory tree, naming conventions, enforcement rules
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Flow 6: AI Conversation Session] and `#Component Strategy` (`ConversationStartPicker`/`ChatBubble`/`Composer`/`ConversationSummary`/`KeySetup`)
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-07-19-1651-ai-conversation.md] — implementation-level decisions not restated in epics/PRD: furigana-format-as-segmentation (§B1), in-band sentinel over tool-calling (§2.2–2.3), two-adapters-not-four (§2.5), three-way session end (§1.14), on-demand-once summary (§1.15), v1/5.2 boundary (§"v1 boundary", "Revised build order")
- [Source: mobile/src/data/migrations/016_furigana_overrides.ts] migration-numbering precedent/header comment
- [Source: mobile/src/core/furigana/parseFurigana.ts, mobile/src/components/common/FuriganaText.tsx] reusable furigana rendering
- [Source: mobile/src/data/user/credentialStore.ts, mobile/src/data/user/importCredential.types.ts] secure-storage precedent
- [Source: mobile/src/data/user/preferencesRepository.ts] generic preference storage precedent
- [Source: mobile/src/data/user/masteryRepository.ts, mobile/src/data/curriculum/itemRepository.ts] curriculum lookup precedent
- [Source: mobile/src/app/(tabs)/_layout.tsx, mobile/src/app/(tabs)/converse/index.tsx] existing tab shell / placeholder to replace
- [Source: curriculum/grammar/n5.json] verified furigana-bracket example-sentence shape for system-prompt content

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMad dev-story workflow)

### Debug Log References

- `npm test` (mobile/) — 170 suites, 1376 tests, all passing.
- `npx tsc --noEmit` (mobile/) — clean.
- `npm run lint` (mobile/) — 0 errors, 1 pre-existing warning in `browse/passage/[id].test.tsx`.
- `npm run check-contrast` (repo root) — 72 token pairs pass.
- `npx expo config --type introspect` (mobile/) — confirms the resolved native config: iOS `deploymentTarget: '17.0'`, Android `minSdkVersion: 33`, `newArchEnabled: true` on both, `RCTNewArchEnabled: true` in the generated Info.plist.

### Completion Notes List

**Scope held to chat.** No push-to-talk, executorch, TTS/STT, or mic affordance. `Composer` deliberately ships without a mic button and `converse/index.test.tsx` asserts its absence, so Story 5.2 pulling voice forward is a visible test change rather than a silent drift.

**Migration numbering.** Used **017**, not the `016+` the planning docs state — `016` was taken by `016_furigana_overrides`. `017_ai_sessions.test.ts` asserts the version, the registration position, and that no duplicate versions exist, so a future renumbering error fails loudly.

**Summary storage.** Nullable `summary_json` / `summary_generated_at` columns on `ai_sessions` rather than a separate table — one-to-one with the session, one fewer join, and `summary_generated_at IS NULL` is exactly the "abandoned but resumable" state FR94 describes.

**Reused, did not rebuild.** `parseFurigana` / `FuriganaText` render AI replies unchanged (FR91/OA6 behaviour was already built and tested); `credentialStore.ts` supplied the secure-storage shape; `preferencesRepository` the non-secret config; `masteryRepository`'s join shape the curriculum lookup.

**Marker choice is load-bearing.** The wrap-up sentinel is `<<<END_SESSION>>>` — angle brackets, never square. A `[...]` sentinel would read as a malformed furigana reading and make `parseFurigana` collapse the entire reply to plain text. `markers.test.ts` asserts a stripped reply still parses into annotated segments, so this cannot silently regress.

**Partial-stream contract (NFR27).** `streamAssistantTurn` returns salvaged text alongside every failure, and the hook commits that prefix as a real turn before reporting the error. The transcript is never rewound or wiped. Covered by tests for mid-stream transport death, mid-stream provider error frames, HTTP errors, and aborts.

**No hidden fallback paths.** The active provider is an explicit preference surfaced in Settings whenever both keys exist. A missing key for the chosen provider is an error that points at Settings — never a silent switch to the other provider. Likewise no retry-with-a-different-adapter anywhere.

**Flagging never touches SRS.** `lookupFlaggedWord` is read-only; `wordLookupRepository.test.ts` asserts `runSync` is never called on either the matched or unmatched path. Off-curriculum words render as unlinked, display-only chips.

**A11y bug found and fixed by a test.** `ChatBubble`'s screen-reader label initially carried the raw annotated text, so a reader would announce every bracket around every reading. It now announces the parsed plain sentence. The long-press has a visible "Look up words" button beside it (NFR29).

**Incidental fixes outside this story's scope** (both needed to get the suite green, both one-line test-mock gaps):
- `src/app/lesson/index.test.tsx` was **already failing on `main`** before this story (verified via `git stash`): its `expo-router` mock omitted `useFocusEffect`, which `useIsKnownWord` calls. Added it.
- `src/app/(tabs)/settings.test.tsx` and `migrationRunner.test.ts` were updated for the new preferences and the new last-migration.

**Outstanding — needs your machine.** Task 1's second subtask (rebuild the custom dev client, confirm the app boots, smoke-test review/lesson under the New Architecture flip) cannot be done here: it needs Xcode / Android Studio and a simulator, and `expo prebuild` would rewrite the tracked `ios/` and `android/` projects. The configuration is verified via introspection, but the runtime New-Architecture flip is unverified.

### File List

**Added**
- `mobile/src/core/ai/aiSession.types.ts`
- `mobile/src/core/ai/markers.ts`
- `mobile/src/core/ai/markers.test.ts`
- `mobile/src/core/ai/turnBudget.ts`
- `mobile/src/core/ai/turnBudget.test.ts`
- `mobile/src/core/ai/systemPrompt.ts`
- `mobile/src/core/ai/systemPrompt.test.ts`
- `mobile/src/core/ai/summaryParser.ts`
- `mobile/src/core/ai/summaryParser.test.ts`
- `mobile/src/core/ai/wordCandidates.ts`
- `mobile/src/core/ai/wordCandidates.test.ts`
- `mobile/src/core/ai/adapters/openAiCompatibleAdapter.ts`
- `mobile/src/core/ai/adapters/openAiCompatibleAdapter.test.ts`
- `mobile/src/core/ai/adapters/anthropicAdapter.ts`
- `mobile/src/core/ai/adapters/anthropicAdapter.test.ts`
- `mobile/src/data/ai/byokCredential.types.ts`
- `mobile/src/data/ai/byokCredentialStore.ts`
- `mobile/src/data/ai/streamingClient.ts`
- `mobile/src/data/ai/streamingClient.test.ts`
- `mobile/src/data/ai/aiConfig.ts`
- `mobile/src/data/ai/connectivity.ts`
- `mobile/src/data/ai/wordLookupRepository.ts`
- `mobile/src/data/ai/wordLookupRepository.test.ts`
- `mobile/src/data/ai/recentGrammarRepository.ts`
- `mobile/src/data/migrations/017_ai_sessions.ts`
- `mobile/src/data/migrations/017_ai_sessions.test.ts`
- `mobile/src/data/user/aiSessionRepository.ts`
- `mobile/src/data/user/aiSessionRepository.test.ts`
- `mobile/src/data/hooks/useByokStatus.ts`
- `mobile/src/data/hooks/useAiConversation.ts`
- `mobile/src/data/hooks/useSessionSummary.ts`
- `mobile/src/components/converse/KeySetup.tsx`
- `mobile/src/components/converse/ConversationStartPicker.tsx`
- `mobile/src/components/converse/ChatBubble.tsx`
- `mobile/src/components/converse/ChatBubble.test.tsx`
- `mobile/src/components/converse/Composer.tsx`
- `mobile/src/components/converse/ConversationSummary.tsx`
- `mobile/src/components/converse/WordLookupSheet.tsx`
- `mobile/src/components/converse/WordLookupSheet.test.tsx`
- `mobile/src/components/converse/ByokSettingsSection.tsx`
- `mobile/src/app/(tabs)/converse/_layout.tsx`
- `mobile/src/app/(tabs)/converse/history.tsx`
- `mobile/src/app/(tabs)/converse/session/[id].tsx`
- `mobile/src/app/(tabs)/converse/summary/[id].tsx`
- `mobile/__mocks__/expo-fetch.ts`

**Modified**
- `mobile/app.json` (expo-build-properties plugin: iOS 17.0, Android API 33, New Architecture)
- `mobile/package.json` (expo-build-properties dependency; `expo/fetch` jest moduleNameMapper)
- `mobile/package-lock.json`
- `mobile/src/app/(tabs)/converse/index.tsx` (placeholder replaced with the real tab)
- `mobile/src/app/(tabs)/converse/index.test.tsx` (placeholder assertions replaced with real coverage)
- `mobile/src/app/(tabs)/settings.tsx` (BYOK section)
- `mobile/src/app/(tabs)/settings.test.tsx` (AI preference stubs)
- `mobile/src/data/migrations/index.ts` (registers 017)
- `mobile/src/data/user/preferencesRepository.ts` (non-secret BYOK config keys + accessors)
- `mobile/src/data/migrations/migrationRunner.test.ts` (last-migration assertion → 017)
- `mobile/src/components/converse/ChatBubble.tsx` (a11y label fix)
- `mobile/src/app/lesson/index.test.tsx` (pre-existing failure: missing `useFocusEffect` in router mock)
- `mobile/__mocks__/expo-sqlite.ts` (ai_sessions / ai_messages statements, transaction snapshot)
- `mobile/__mocks__/expo-crypto.ts` (deterministic `randomUUID`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-21 | Story 5.1 implemented: platform floor + New Architecture config, migration 017, BYOK credential storage, two streaming adapters over `expo/fetch`, in-band control markers, turn-budget placeholder (OA4), chat surface with furigana replies, unknown-word flagging, start picker + history, on-demand once-only summary, offline state, and Settings BYOK management. 1376 tests passing; lint, typecheck, and contrast gates clean. Task 1's native dev-client rebuild remains outstanding — it requires Xcode / Android Studio. |
| 2026-07-21 | Code review chunk 1 (platform + persistence): applied 8 patches — back-without-Finish no longer ends the session; corrupt summary cache heals; once-only summary write guarded in SQL; removed dead `newArchEnabled` keys (SDK 55 always-on); enabled `PRAGMA foreign_keys`; empty base URL clears preference; preference comment + history order test fixed. Chunks 2–3 (AI core / UI) still pending review. |
