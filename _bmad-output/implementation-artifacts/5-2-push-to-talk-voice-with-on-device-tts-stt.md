---
baseline_commit: 238aa18077623e3994cd7bdc573c4a871049d8b2
---
# Story 5.2: Push-to-Talk Voice with On-Device TTS/STT

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want optional on-device voice conversation I explicitly download and control,
so that I can speak Japanese in full-screen PTT mode without silent cloud fallbacks or blocking the rest of the app.

## Acceptance Criteria

1. **Mic promotes mid-session** (FR90, FR98): tapping the mic in the composer (chat is already in progress) promotes the session to conversation mode — there is no up-front mode choice at session start.
2. **Full-screen PTT layout** (FR98, UX-DR21): conversation mode is full-screen with chat history hidden. On screen: the AI's latest line (readable text, plus on-device TTS speaking it) and the learner's latest transcription, with push-to-talk below.
3. **Transcript confirms before sending** (FR99): on-device STT output lands in an editable field for confirm/edit/retry — never straight onto the wire. Exiting conversation mode needs no chat-log reconciliation (every spoken turn was already confirmed text before it was sent).
4. **Pinned executorch runtime** (FR100, NFR30): TTS/STT ship via a pinned `react-native-executorch` nightly with Supertonic Japanese TTS + Whisper Japanese STT. No interim system-TTS engine (`expo-speech` or otherwise) is adopted at any point.
5. **Explicit, non-blocking model download** (NFR25, NFR3, UX-DR23): if the voice models are not yet downloaded, chat remains fully usable; tapping the mic prompts an explicit user-initiated download with clear size disclosure. The download never blocks cold start or any other tab.
6. **Cloud STT is opt-in only** (FR99, UX-DR33): cloud transcription is available only as an explicit Settings toggle, never an automatic fallback when on-device STT is unavailable or performs poorly.

## Tasks / Subtasks

- [x] **Task 1 — Pin `react-native-executorch` + build wiring** (AC: 4)
  - [x] Add `react-native-executorch` as a pinned nightly dependency in `mobile/package.json`. **Do not use `npm install react-native-executorch@latest`** — npm `latest` is still `0.9.2`, which has no Japanese in its `TextToSpeechLanguage` union (Kokoro has no `ja` phonemizer). Japanese TTS (Supertonic) only exists on a nightly dist-tag off `main`. A nightly verified during planning was `react-native-executorch@0.10.0-nightly-a0bf85b-20260719` (2026-07-19) — **re-verify and pin whatever the current nightly dist-tag actually is** at implementation time (today is later); do not assume that exact string is still current or installable.
  - [x] After installing, **read the package's own setup docs/type definitions in `node_modules/react-native-executorch`** for the real API surface (hook/function names for TTS speak, STT start/stop, and model download/status). Nothing in this codebase or the planning docs names the exact API — do not guess or invent hook names; confirm against the installed package before writing `data/ai/voice/`.
  - [x] Add the manual `metro.config.js` `assetExts` entries executorch's docs require (no Expo config plugin exists for this package — confirmed during planning; autolinking + this one manual Metro edit is the full integration surface). `mobile/metro.config.js` currently has no `assetExts` customization — add only what executorch's own setup instructions specify.
  - [x] No Expo Go — already true for this project since Story 5.1 (custom dev client). Confirm the dev client still boots after adding the native module (this needs a machine with Xcode/Android Studio, same constraint 5.1 flagged as outstanding for its own platform-floor change).
- [x] **Task 2 — `data/ai/voice/` module** (AC: 4, 5)
  - [x] Create `mobile/src/data/ai/voice/` per architecture §Format Patterns ("Voice (STT/TTS) — `data/ai/voice/` wrapping executorch — not inside review components"). Suggested split: `ttsClient.ts` (Supertonic Japanese speak), `sttClient.ts` (Whisper Japanese start/stop + transcript), `modelDownloadManager.ts` (download/status). All fallible operations return `Result<T, AppError>` — never throw across the async boundary, matching every other `data/` module.
  - [x] Model files are downloaded explicitly to app storage, **not inside either SQLite DB** (architecture §Data Architecture, "Caching"). Model presence is a filesystem fact, not a DB row — check via `getInfoAsync`-equivalent on each use, the same pattern `curriculumUpdate.ts` uses for `curriculum.db` (`mobile/src/data/curriculum/curriculumUpdate.ts:195-221`), not a new preference flag as the source of truth (a preference can drift from the filesystem; a stale "downloaded" flag pointing at a deleted file is exactly the kind of silent-failure trap this codebase's `no-hidden-fallback-paths` principle rejects).
  - [x] Whisper model sizes (verified during planning, both platforms fp32 on Android so ~3× iOS): `whisper-tiny` 232.6 MB / 76.8 MB, `whisper-base` 398.7 MB / 146.6 MB, `whisper-small` 1128.7 MB / 485.3 MB (Android / iOS). **Use `whisper-small`** — tiny's Japanese WER is too poor for learner speech; this was an explicit accepted-cost decision, not an oversight. Disclose the real size for whichever variant you pin (~1.1 GB Android / ~485 MB iOS for `whisper-small`) in the download prompt — do not show a placeholder number.
  - [x] Use `expo-file-system/legacy` for the download (same import path `curriculumUpdate.ts` uses — the mocked module only maps `expo-file-system/legacy`, not the new File/Directory API). Given the download is ~1 GB (vs. curriculum's much smaller `downloadAsync`), a progress callback is needed for a usable progress bar — check whether `expo-file-system/legacy`'s `createDownloadResumable` is available and use it; if not, `downloadAsync` with a coarse "downloading… / done" state is an acceptable fallback, but say so explicitly in your completion notes rather than silently shipping no progress indication.
  - [x] Extend `mobile/__mocks__/expo-file-system.ts` with whatever download function you use (it currently mocks `downloadAsync` but not `createDownloadResumable`) so voice-download tests don't hit a real network call.
  - [x] Downloads must never block cold start or other tabs (NFR3, NFR25): confirm nothing in `data/ai/voice/` is imported/executed eagerly from app init — it should only run when a learner explicitly taps the mic and confirms the download prompt.
- [x] **Task 3 — Model download UX** (AC: 5)
  - [x] When the mic is tapped and models are missing, show an explicit prompt with size disclosure and a Download action — never an automatic silent download. Chat must stay fully usable while this prompt is open or a download is in progress (UX-DR23, UX Consistency Patterns "Voice models missing").
  - [x] Surface download progress; a failed/interrupted download must not leave a half-written model file mistaken for a complete one (re-run the same filesystem-presence check Task 2 established, not a separate "download succeeded" flag that could be wrong).
- [x] **Task 4 — Composer mic button** (AC: 1)
  - [x] Add a mic button to `mobile/src/components/converse/Composer.tsx`. It currently has **no** mic affordance by design (Story 5.1's explicit scope boundary — see its docstring and `mobile/src/app/(tabs)/converse/index.test.tsx:108` asserting no mic on the *start-picker* screen, which is a different screen and does not need touching). This is the one intentional piece of 5.1 this story reverses; update `Composer.tsx`'s own docstring since its "no mic" comment will now be false.
  - [x] Composer currently has zero test coverage (`Composer.test.tsx` does not exist) — add it alongside the mic button, not as an afterthought.
  - [x] Tapping the mic with models downloaded enters conversation mode immediately (AC 1); tapping it without models downloaded triggers Task 3's prompt instead — the mic button is the single entry point for both states, not two different buttons.
- [x] **Task 5 — Conversation mode (PTT) screen** (AC: 1, 2, 3)
  - [x] Add a full-screen conversation-mode view — architecture's project-structure tree names it `PttOverlay` (`mobile/src/components/converse/`); the UX spec calls the same thing `PTTSession` in its component-strategy list. These are the same component under two names in two documents — pick one file name (recommend following the architecture tree literally: `PttOverlay.tsx`) and do not build two components.
  - [x] Entered from `Composer`'s mic tap inside `mobile/src/app/(tabs)/converse/session/[id].tsx`. This screen already holds all conversation state via `useAiConversation(sessionId)` (`mobile/src/data/hooks/useAiConversation.ts`) — conversation mode is a different **view** over the same session, not a new data path. A local `mode: 'chat' | 'ptt'` state in the session screen is sufficient; do not build a new `AiConversationContext` for this — architecture §Communication Patterns names one, but Story 5.1 did not create it (state lives in the `useAiConversation` hook instead), and introducing a Context now for one boolean would be inconsistent with the pattern actually shipped.
  - [x] Layout per FR98/UX-DR21 and the brainstorming session's confirmed conversation-mode spec: full screen, tab bar and chat history hidden; only the AI's latest line and the learner's latest transcription are visible; push-to-talk control below. Reuse `parseFurigana(text).map(s => s.text).join('')` (the exact pattern `ChatBubble.tsx:49-51` already uses for its screen-reader label) to get the plain-text sentence for both the readable AI line and what TTS speaks — do not write a second furigana-stripping function.
  - [x] Press-and-hold to record, release to stop and transcribe (push-to-talk, not open-mic — confirmed decision, not an implementation detail up for reinterpretation). The transcript lands in an editable text field; the learner confirms/edits/clears-and-retries before it sends via the *same* `send()` from `useAiConversation` used by chat mode — do not add a second send path.
  - [x] AI replies while in conversation mode speak via Supertonic TTS (Task 2's `ttsClient`) as well as rendering as text — both, not either/or (FR98: "readable text ... **and** ... TTS").
  - [x] An explicit exit control returns to the normal chat view with the full transcript intact and unchanged — because every turn was confirmed text before sending, there is nothing to reconcile (AC 3). Don't build any reconciliation logic; its absence is the point.
- [x] **Task 6 — Cloud STT opt-in setting** (AC: 6)
  - [x] Add a `cloudSttOptIn` preference following the exact existing pattern in `mobile/src/data/user/preferencesRepository.ts` (`PREFERENCE_KEYS`, boolean stored as `'true'`/`'false'`, getter/setter pair — same shape as `weaknessBiasEnabled`/`reviewAutoAdvance`). Default `false`.
  - [x] Add the toggle to the Settings screen's existing BYOK section (`mobile/src/app/(tabs)/settings.tsx`, added in Story 5.1 Task 12) per UX-DR33 ("Settings surfaces: ... cloud STT opt-in ..."). This is one more toggle in an existing section, not a new one.
  - [x] **Open design point you must resolve, not skip:** no planning document names a concrete cloud-STT provider contract. The only description anywhere is "Whisper via the user's key." Of the two BYOK adapters, only OpenAI (and OpenAI-compatible endpoints) expose an audio-transcription endpoint — Anthropic has none. A reasonable, minimal-scope resolution: cloud STT is only offered/effective when the OpenAI-compatible adapter is the configured/active provider; if only Anthropic is configured, either hide the toggle or show it disabled with an explanatory note — do not build a third adapter abstraction for this. Document whichever choice you make in Completion Notes; this is exactly the kind of judgment call 5.1 made explicitly for provider selection (see its Dev Notes, "Adapter/provider selection is an open design point").
  - [x] Whatever you build, the core rule is non-negotiable: on-device STT is the default and cloud STT fires **only** when the toggle is on — never a silent fallback when on-device fails or underperforms (this is the same `no-hidden-fallback-paths` principle 5.1's "active provider" preference already follows).
- [x] **Task 7 — Tests**
  - [x] `data/ai/voice/*.test.ts` (mock executorch calls and the filesystem), `modelDownloadManager` tests for the missing/partial/complete states, `Composer.test.tsx` (mic button present, tap behavior, disabled states), conversation-mode screen tests (enter/exit, transcript confirm/edit/retry, TTS invoked on new AI line), `cloudSttOptIn` preference tests, Settings toggle test.
  - [x] Run `npx tsc --noEmit` and `npm run lint` (mobile/) before considering the story complete.

## Dev Notes

**Scope boundary — read before starting.** Story 5.1 (chat, BYOK, summary — status: review, one code-review pass already applied and committed at `238aa18`) deliberately shipped **zero** voice code: no mic button, no `data/ai/voice/`, no executorch dependency. Everything in FR98–FR100 is this story. Do not assume any voice scaffolding already exists — `Composer.tsx` has no mic today, and this is one of the very few places in the codebase where you are reversing a previous story's explicit "this is deliberately absent" decision.

**This is one unit of work, not a staged rollout.** The planning session explicitly considered and rejected shipping TTS into chat mode first ("tap a message to hear it") as a lower-risk intermediate step, then rejected it: *"v1 is the complete two-mode feature, not a partial one that grows"* (brainstorming §Revised build order). Don't invent an intermediate TTS-only milestone inside this story either — chat-mode "tap to hear" is not an AC and not requested.

**The executorch API surface is not documented anywhere in this repo or the planning docs — go read the installed package.** Everything here about executorch (Supertonic having `'ja'`, Whisper's `{ language: 'ja' }` option, model sizes) came from a source-verified subagent investigation during planning, not from writing any code against it. The actual hook/function names for triggering TTS speech, starting/stopping STT recording, and checking/triggering model downloads are unknown to this story file. Confirm them against `node_modules/react-native-executorch`'s own type definitions and docs after pinning the dependency (Task 1) — do not invent an API shape that merely "sounds plausible."

**Nightly pin, not a release.** `react-native-executorch`'s npm `latest` tag (`0.9.2` as of planning) has no Japanese TTS at all — Supertonic's `ja` support only exists on a nightly dist-tag built off `main`, with no semver guarantee and no release notes (NFR30's accepted cost). The specific nightly string verified during planning (`0.10.0-nightly-a0bf85b-20260719`) is dated 2026-07-19; treat it as evidence the capability exists on *some* nightly, not as the exact string to install today — re-check and pin whatever nightly is current, then re-verify Japanese TTS/STT still work on it (NFR30's "manual upgrade + re-verify accepted cost" applies from day one, not just future upgrades).

**Why executorch and not `expo-speech`/`react-native-tts`.** This was investigated and explicitly rejected, not overlooked: `expo-speech` on Android fails **silently** when Japanese voice data isn't installed (`Speech.speak` produces no sound and does not throw — a real upstream Expo issue) and `react-native-tts` wraps the identical OS engines with no quality gain. Supertonic ships its own model rather than depending on user-installed OS voice data, which is exactly why it avoids that silent-failure class. Do not add either as a stopgap.

**Model download precedent to reuse, not reinvent.** `mobile/src/data/curriculum/curriculumUpdate.ts` is the only existing "download a large file, verify it, use it" flow in this codebase — study its `Result`-returning shape, its temp-file-then-atomic-placement pattern, and its `expo-file-system/legacy` import path (not the new File/Directory API — the Jest mock only covers `/legacy`). It does **not** need a progress callback (curriculum DB downloads are small); voice models do, at ~0.5–1.1 GB, so you'll need more than that precedent gives you for the progress bar — see Task 2.

**Model presence is a filesystem fact, not a database row or a trusted preference flag.** Per architecture §Data Architecture: "STT/TTS model files downloaded explicitly to app storage (not inside either DB)." No new migration is needed for this story — checking whether the model files exist on disk is the source of truth every time, the same way `curriculumUpdate.ts` checks `getInfoAsync` rather than trusting a cached belief that a file is there.

**`AiConversationContext` named in architecture was never built — don't build it now either.** Architecture §Communication Patterns lists a planned `AiConversationContext` ("Session id, stream buffer, mode (chat vs PTT)"). Story 5.1 implemented equivalent state entirely through the `useAiConversation` hook + local component state, with no React Context. Follow the pattern that actually shipped: conversation-mode's chat/PTT toggle is local state in `session/[id].tsx`, not a new Context — introducing one now for a single boolean would contradict the established precedent for no clear benefit.

**Reuse the furigana-stripping pattern already proven for accessibility.** `ChatBubble.tsx` already computes a plain-text "spoken" version of an AI reply for its screen-reader label (`parseFurigana(text).map((segment) => segment.text).join('')`, `ChatBubble.tsx:49-51`). This is exactly the text TTS should speak and exactly the text conversation mode should show as the "readable" AI line — reuse it, don't write a second furigana-stripping helper.

**Send path is shared, not forked.** `useAiConversation(sessionId).send(text)` (`mobile/src/data/hooks/useAiConversation.ts:92-175`) already commits the learner's turn, streams the reply, and degrades a partial/failed stream without corrupting the transcript (NFR27, proven in Story 5.1). Conversation mode's confirmed transcript must call this same function — do not build a parallel "voice send" path with different persistence semantics.

**Naming mismatch between planning docs, not a real ambiguity in the codebase.** Architecture's project-structure tree names the full-screen component `PttOverlay`; the UX spec's component-strategy list names it `PTTSession`. Same component, two documents, two names — pick one (recommend `PttOverlay.tsx`, matching the literal directory tree) rather than treating this as license to build two.

**Cloud STT has no defined provider contract anywhere in planning** — see Task 6. This is the single biggest open design point in this story, comparable to how Story 5.1 had to resolve BYOK adapter/provider selection without an AC dictating it. Resolve it pragmatically (only the OpenAI-compatible adapter has an audio-transcription endpoint), document the choice, and do not let it block the rest of the story — the non-negotiable part is only that it's opt-in and never a silent fallback.

**Hard conventions (project-wide, re-affirmed for this story):**
- Every fallible async operation (executorch calls, model download, file I/O) returns `Result<T, AppError>` — never throw across an async boundary.
- No new `curriculum.db` or `user.db` schema changes are anticipated for this story (model presence is filesystem-checked; cloud STT opt-in is a `user_preferences` row via the existing generic key-value store). If you find yourself reaching for a migration, stop and re-read architecture §Data Architecture's caching note above — it's very likely you don't need one.
- NativeWind semantic tokens only — no raw hex, no deprecated `Colors` object.
- Co-locate tests (`Foo.ts` → `Foo.test.ts`), named exports only, no default exports, no barrel imports from `core/`.
- No silent fallbacks anywhere in this story: not model-download-to-nothing, not STT-failure-to-cloud, not TTS-failure-to-system-voice. Every alternate path is either a visible user action (download prompt, cloud STT toggle) or a visible error state.

**Anti-patterns specific to this story:**
- Silent cloud STT fallback when on-device STT is missing, slow, or inaccurate → forbidden; toggle-gated only (FR99, UX-DR33).
- Auto-triggering a ~1 GB download on cold start, tab open, or any non-mic-tap event → forbidden (NFR3, NFR25).
- A new `AiConversationContext` for the chat/PTT mode toggle → inconsistent with the hook-based pattern Story 5.1 actually shipped; use local state instead.
- Adding `expo-speech` or `react-native-tts` as an interim voice engine "until Supertonic is ready" → explicitly rejected during planning; Supertonic is already the target for v1, not a future upgrade.
- Reconciliation logic between "what was spoken" and "what was logged" when exiting conversation mode → unnecessary by construction; every turn was confirmed text before it was sent.

### Project Structure Notes

- New `data/ai/voice/` (per architecture §Format Patterns): `ttsClient.ts`, `sttClient.ts`, `modelDownloadManager.ts` (naming illustrative — split as the installed executorch API naturally suggests, but keep it under `data/ai/voice/`, not inside `components/converse/` or any review component).
- New `components/converse/PttOverlay.tsx` (== UX spec's `PTTSession` — same component, see Dev Notes).
- Modified: `components/converse/Composer.tsx` (mic button, docstring update), `app/(tabs)/converse/session/[id].tsx` (chat/PTT mode toggle, mounts `PttOverlay`), `app/(tabs)/settings.tsx` (cloud STT toggle in existing BYOK section), `data/user/preferencesRepository.ts` (`cloudSttOptIn` key + accessors), `mobile/package.json` (pinned `react-native-executorch` nightly), `mobile/metro.config.js` (`assetExts`), `__mocks__/expo-file-system.ts` (whichever download function Task 2 uses).
- No changes to `curriculum/`, `scripts/`, or any `curriculum.db`/`user.db` schema expected.
- No new migration file expected — flag it in Completion Notes if you find you genuinely need one, since that would contradict the architecture note this story's Dev Notes rely on.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2: Push-to-Talk Voice with On-Device TTS/STT] — canonical AC source
- [Source: _bmad-output/planning-artifacts/prd.md#AI Conversation] FR98–FR100, NFR3, NFR23, NFR25, NFR30
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries, §Format Patterns, §Communication Patterns] `data/ai/voice/` placement, `PttOverlay` in directory tree, model-file caching note, `AiConversationContext` (planned but not built in 5.1)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Flow 6: AI Conversation Session, #Component Strategy, #UX Consistency Patterns] `PTTSession` naming, full-screen/history-hidden layout, voice-model-missing empty state
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-07-19-1651-ai-conversation.md §3.1–3.4, §Post-session revision] push-to-talk UX decisions (3.2/3.3), executorch investigation findings (3.5–3.10), model sizes, Supertonic/Whisper decision rationale, "no interim TTS" and "cloud STT is a visible setting" principles, confirmed v1 conversation-mode scope
- [Source: _bmad-output/planning-artifacts/.decision-log.md] D-AI-5, OA3 — platform-floor + voice-in-v1 decisions
- [Source: _bmad-output/implementation-artifacts/5-1-platform-floor-byok-chat-session-summary.md] previous story: scope boundary this story fills, migration numbering precedent (017 taken; no new migration expected here), `useAiConversation` hook shape, `ChatBubble` furigana-stripping pattern, no-hidden-fallback principle applied to provider selection
- [Source: mobile/src/data/hooks/useAiConversation.ts] session state/send/end — the single data path conversation mode must reuse
- [Source: mobile/src/components/converse/ChatBubble.tsx:49-51] furigana-to-plain-text pattern for TTS/accessibility
- [Source: mobile/src/components/converse/Composer.tsx] current no-mic state to change
- [Source: mobile/src/data/curriculum/curriculumUpdate.ts] large-file download/verify precedent (`expo-file-system/legacy`, `Result`-returning, atomic placement)
- [Source: mobile/src/data/user/preferencesRepository.ts] generic preference storage precedent for `cloudSttOptIn`
- [Source: mobile/__mocks__/expo-file-system.ts, mobile/test-support/file-system-test-state.ts] existing filesystem mock to extend for model-download tests
- [Source: mobile/package.json, mobile/metro.config.js] current dependency/Metro config state (no executorch, no `assetExts` yet)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `npx tsc --noEmit` — clean
- `npm test` (mobile/) — 184 suites, 1474 tests passing
- `npm run lint` (mobile/) — 0 errors, 1 warning (pre-existing, `browse/passage/[id].test.tsx:35`)
- `npm run check-contrast` (repo root) — 72 token pairs pass

### Completion Notes List

**Nightly pinned (Task 1).** `react-native-executorch@0.10.0-nightly-a0bf85b-20260721` — the current
`executorch-nightly` dist-tag, re-verified rather than assuming the planning-era string. Japanese is
confirmed present on this build: `TextToSpeechSupertonicLanguage` includes `'ja'` and
`SpeechToTextLanguage` includes `'ja'`. Also pinned
`react-native-executorch-expo-resource-fetcher@0.10.0-nightly-0a8fe7e-20260527` (that package's own
current nightly tag; it publishes less often than the main package). Both exact-pinned, no `^`.
**Code-review decision (2026-07-21):** this July-main / May-fetcher skew is **accepted**. Same-date
alignment would require the May main package, which has Kokoro only (no Supertonic/`ja`) and fails
AC4. No newer fetcher nightly exists. Tracked in `docs/known-issues.md`; re-check when upstream
publishes a matching fetcher or stable-with-`ja`.

**New dependency approved mid-story: `react-native-audio-api@0.13.2`.** The story assumed executorch
covered the whole voice surface. It does not — it has no microphone capture and no audio playback.
`transcribe()` takes a `Float32Array` and `forward()` returns one; nothing in the package touches
hardware. Supertonic therefore cannot "speak" on its own, which AC2 requires. `expo-audio` was
checked first and does not fit: it records to a compressed `.m4a` file and plays files, so it never
exposes the raw samples Whisper needs and cannot accept Supertonic's array.
`react-native-audio-api` (Software Mansion, same authors) provides
`AudioRecorder.onAudioReady({ sampleRate: 16000 })` for capture and `AudioContext`/`AudioBuffer` for
playback — both ends, no voice or processing of its own. **Halted and got explicit approval from
Riyaz before installing.** This does not breach the "no interim TTS engine" rule: unlike
`expo-speech`, it generates no audio and substitutes no voice.

**Metro `assetExts` deliberately not changed.** Task 1 anticipated an `assetExts` edit, but the
installed package's setup instructions specify none, and `assetExts` only matters when `.pte`/`.bin`
model files are `require()`d as bundled assets. Every model here is fetched from a remote URL at
runtime, so Metro never sees one. Adding entries would have been cargo-culted config. The full
integration surface was autolinking + the `react-native-audio-api` Expo config plugin (added to
`app.json` for the microphone permission, with background audio and the Android foreground service
disabled — push-to-talk is foreground-only).

**Download uses executorch's own fetcher, not `expo-file-system` directly.** Task 2 called for
`expo-file-system/legacy` + `createDownloadResumable`. Reading the installed package changed this:
`ExpoResourceFetcher` already *is* that code (it uses `createDownloadResumable` with a progress
callback internally) and, critically, it writes into the `RNEDirectory` the model loaders read from.
Downloading to our own path would have produced files executorch could not find. So progress
reporting is real (0→1 callback), and the temp-then-move requirement is satisfied by the library:
it downloads into the cache directory and only moves the file into the model directory on
completion, so `listDownloadedFiles()` can never show a half-written file. `__mocks__/expo-file-system.ts`
was consequently **not** extended — no voice code calls it. The new
`__mocks__/react-native-executorch-expo-resource-fetcher.ts` preserves the same property.

**Model presence is filesystem-only.** `areVoiceModelsDownloaded()` lists the model directory and
compares basenames derived with `ResourceFetcherUtils.getFilenameFromUri` — the same derivation the
fetcher uses when writing. No preference flag, no DB row, re-checked on every mic tap. No migration
was needed, as the story predicted.

**Size disclosure is the real number, or nothing.** `getVoiceModelDownloadBytes()` reads actual
sizes over HEAD. If that fails, the prompt shows the error and **no Download button** rather than a
placeholder figure — a device that cannot size the files cannot fetch them either.

**Resolved open design point — cloud STT provider contract (Task 6).** Cloud STT is offered only
through the OpenAI-compatible adapter, since Anthropic exposes no audio-transcription endpoint. With
only an Anthropic key configured the Settings switch is rendered **disabled with the reason shown**
rather than hidden, so the option does not appear to vanish. No third adapter abstraction was added.
`transcribeJapaneseViaCloud` posts a WAV to `{baseUrl}/audio/transcriptions` with `language: 'ja'`
and model `whisper-1`, reusing the existing `isAllowedByokRequestUrl` HTTPS guard (NFR24).
The `whisper-1` model id is not named in any planning document — it is the id OpenAI-compatible
transcription endpoints universally expose, and it is a single exported constant if it needs changing.

**The toggle actually routes, and never falls back in either direction.** `transcription.ts` holds
the single decision: toggle off → on-device only, and an on-device failure stays a failure rather
than quietly uploading the learner's audio; toggle on → cloud only, and a cloud failure is reported
rather than silently retried on-device. Both directions are covered by tests. Building the cloud
call was slightly beyond Task 6's literal subtasks, but AC6 says cloud transcription is
*"available"* via the toggle, and a switch that changed nothing would have been a user-visible lie.

**Sample rates are handled, not assumed.** Whisper requires 16 kHz (`whisper/Constants.h`) and
Supertonic emits 44.1 kHz (`supertonic/Constants.h`); both were read from the package's native
sources. The recorder documents that hardware may ignore the requested rate, so captured audio is
linearly resampled to 16 kHz using the rate actually delivered — Whisper misreads wrong-rate audio
silently rather than rejecting it, which is exactly the failure mode this story forbids.

**`PttOverlay` renders in a full-screen `Modal`.** The session screen sits inside the `(tabs)`
navigator, so the tab bar belongs to a parent and cannot be hidden by swapping the screen's content.
A Modal covers it, satisfying UX-DR21's full-screen requirement. The chat stays mounted and
untouched underneath, which is the mechanical reason exiting needs no reconciliation. Named
`PttOverlay` per the architecture tree; the UX spec's `PTTSession` is the same component — only one
was built.

**Naming/state decisions followed the shipped precedent.** Chat/PTT mode is local `useState` in
`session/[id].tsx`; no `AiConversationContext` was introduced. Conversation mode sends through the
same `useAiConversation().send` chat uses — no second send path. The AI's readable line and the text
handed to TTS both come from the existing `parseFurigana(...).map(s => s.text).join('')` pattern; no
second furigana-stripping helper was written.

**Model memory is released on exit.** Leaving conversation mode calls `releaseSttModel`,
`releaseTtsModel` and `releaseAudioSession` — `whisper-small` alone is hundreds of megabytes
resident, so this is not stray-listener cleanup.

**⚠️ Pre-existing defect found — please fix during review, tracked in
[`docs/known-issues.md`](../../docs/known-issues.md).** `feedback-error` is used in 6 places but is
not defined as a token in `tailwind.config.js` or `global.css`, so all 6 render with no colour. It
predates this story and is therefore mostly outside this diff — it is called out here because a
diff-scoped review would otherwise never see it, and Story 5.1, which introduced 5 of the 6 usages,
is already `done` and will not be reviewed again.

The sharp end is `Button`'s `destructive` variant (`bg-feedback-error` + `text-white`), whose one
live usage is the "End session" button in `SessionExitSheet.tsx:24` — white text on an unstyled
background. `npm run check-contrast` cannot catch this because it only validates *defined* tokens.

Recommended fix: replace all 6 usages with the defined `feedback-incorrect` token, keeping the
palette to UX-DR2's four feedback colours. New code in this story already uses `feedback-incorrect`,
so nothing added by Story 5.2 needs changing. Full detail, file/line table and the alternative fix
are in `docs/known-issues.md`.

**Not verified on device.** Nothing here has been run on real hardware: a physical build needs
Xcode/Android Studio, the same constraint Story 5.1 flagged as outstanding for its own platform-floor
change. Everything is covered by tests against mocks written from the installed packages' real type
definitions and native constants. First on-device run should confirm the dev client still boots with
the native module, that Supertonic actually speaks Japanese on this nightly, and that microphone
permission is prompted correctly on both platforms.

### File List

**Added**
- `mobile/src/data/ai/voice/voiceModels.ts`
- `mobile/src/data/ai/voice/executorchRuntime.ts`
- `mobile/src/data/ai/voice/modelDownloadManager.ts`
- `mobile/src/data/ai/voice/modelDownloadManager.test.ts`
- `mobile/src/data/ai/voice/sttClient.ts`
- `mobile/src/data/ai/voice/sttClient.test.ts`
- `mobile/src/data/ai/voice/ttsClient.ts`
- `mobile/src/data/ai/voice/ttsClient.test.ts`
- `mobile/src/data/ai/voice/audioSession.ts`
- `mobile/src/data/ai/voice/audioSession.test.ts`
- `mobile/src/data/ai/voice/cloudSttClient.ts`
- `mobile/src/data/ai/voice/cloudSttClient.test.ts`
- `mobile/src/data/ai/voice/transcription.ts`
- `mobile/src/data/ai/voice/transcription.test.ts`
- `mobile/src/data/ai/voice/wav.ts`
- `mobile/src/data/ai/voice/wav.test.ts`
- `mobile/src/components/converse/PttOverlay.tsx`
- `mobile/src/components/converse/PttOverlay.test.tsx`
- `mobile/src/components/converse/VoiceModelDownloadPrompt.tsx`
- `mobile/src/components/converse/VoiceModelDownloadPrompt.test.tsx`
- `mobile/src/components/converse/Composer.test.tsx`
- `mobile/src/components/converse/ByokSettingsSection.test.tsx`
- `mobile/src/app/(tabs)/converse/session/[id].test.tsx`
- `mobile/__mocks__/react-native-executorch.ts`
- `mobile/__mocks__/react-native-executorch-expo-resource-fetcher.ts`
- `mobile/__mocks__/react-native-audio-api.ts`

**Modified**
- `mobile/package.json` (pinned deps, Jest module mappings)
- `mobile/package-lock.json`
- `mobile/app.json` (`react-native-audio-api` config plugin — microphone permission)
- `mobile/src/components/converse/Composer.tsx` (mic button, docstring)
- `mobile/src/components/converse/ByokSettingsSection.tsx` (cloud STT toggle)
- `mobile/src/app/(tabs)/converse/session/[id].tsx` (chat/PTT mode, download prompt, mic wiring)
- `mobile/src/data/user/preferencesRepository.ts` (`cloudSttOptIn` key + accessors)
- `mobile/src/data/user/preferencesRepository.test.ts` (cloud STT opt-in tests)
- `mobile/src/app/(tabs)/settings.test.tsx` (stub the new preference reads)
- `mobile/__mocks__/expo-fetch.ts` (JSON response support for the transcription call)
- `docs/README.md` (index the new known-issues doc)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Added (not app code)**
- `docs/known-issues.md` (tracker for the pre-existing `feedback-error` token defect)

### Review Findings

_Chunk A (voice engine / deps / mocks) — 2026-07-21. Chunks B–E still queued._

- [x] [Review][Decision] Executorch vs resource-fetcher nightly skew — **Resolved:** keep July main (`…a0bf85b-20260721`) + May fetcher (`…0a8fe7e-20260527`). Same-date alignment is impossible without dropping Supertonic/`ja` (May main is Kokoro-only); no newer fetcher nightly exists. Documented as accepted upstream publishing skew; re-check when a matching fetcher or stable-with-`ja` ships.
- [x] [Review][Patch] Document forced executorch/fetcher nightly skew in Completion Notes + `docs/known-issues.md` (July main required for Japanese; May fetcher is tip of `executorch-nightly` for that package) — done
- [x] [Review][Patch] `fromModelName` can still download models — gated `sttClient`/`ttsClient` load behind `areVoiceModelsDownloaded` so missing models cannot trigger `ResourceFetcher.fetch` (AC5/NFR25)
- [x] [Review][Patch] Size disclosure can return 0 / under-report — probe each remote source individually; reject non-positive sizes
- [x] [Review][Patch] Missing model directory treated as check failure — map missing-dir errors to `{ ok: true, value: false }`
- [x] [Review][Patch] `AudioRecorder.start` / `onAudioReady` / `stop` Results ignored — inspect `status === 'error'`
- [x] [Review][Patch] Mic permission copy claims voice is “never uploaded” — reworded for default on-device + optional cloud STT
- [x] [Review][Patch] `playWaveform` returns before playback ends — await `onEnded`; stop prior source; recreate context on sample-rate change
- [x] [Review][Patch] `AudioRecorder.onError` never wired — surface mid-capture faults via `recordingFault`
- [x] [Review][Patch] `startRecording` has no already-recording guard — stop/clear before restarting
- [x] [Review][Patch] Model/audio release races — skip model delete while in-flight; stop recorder on session release
- [x] [Review][Patch] Download cannot be cancelled — added `cancelVoiceModelDownload`
- [x] [Review][Patch] Native audio session never configured — `setAudioSessionOptions` + `setAudioSessionActivity` before record/play
- [x] [Review][Patch] Cloud STT fetch has no timeout; `FormData`/`Blob` construction sits outside the try/catch — 30s AbortSignal + construction inside try
- [x] [Review][Patch] Reject non-finite/non-positive `sourceSampleRate` in `resampleTo16kHz`
- [x] [Review][Patch] Move `ensureExecutorchInitialised()` inside each manager try/catch so init failures stay `Result`
- [x] [Review][Patch] Treat empty TTS `forward()` output as `voice_tts_failed`, not success
- [x] [Review][Defer] Presence check is basename-only (no size/hash) — truncated/corrupt but listed files still report ready; cache-then-move already prevents half-files from listing; deeper integrity check deferred pending on-device soak [`modelDownloadManager.ts`] — deferred, accepted residual risk
- [x] [Review][Defer] Cloud STT `Blob`+`FormData` multipart path unproven on device — API shape covered by mocks; first device build must confirm upload encoding [`cloudSttClient.ts`] — deferred, needs device verification

_Chunk B (PTT UI) — 2026-07-21. Chunks C–E still queued._

- [x] [Review][Patch] PTT pressIn/pressOut race: `handlePressOut` no-ops until `phase === 'recording'`, so permission dialog / quick tap can leave the mic stuck in Listening [`PttOverlay.tsx:100`] — done (press generation guard)
- [x] [Review][Patch] Hold-to-speak stays enabled while TTS plays — learner can record over loudspeaker and feed the model its own audio [`PttOverlay.tsx:227`] — done (`speaking` gate)
- [x] [Review][Patch] `spokenRef` set before synth/play succeeds — failed TTS permanently skips that line [`PttOverlay.tsx:79`] — done (set only after play succeeds)
- [x] [Review][Patch] Wrap-up / ended UI lives under chat while PTT `Modal` covers it — Finish/Keep talking unreachable; Send still live [`session/[id].tsx:257`] [`session/[id].tsx:332`] — done (force `mode: 'chat'` on wrap-up/ended/offline)
- [x] [Review][Patch] Download prompt + PttOverlay docs claim speech is never uploaded / “no cloud path”, but `transcribeTurn` uploads when cloud STT is opted in [`VoiceModelDownloadPrompt.tsx:78`] [`PttOverlay.tsx:40`] — done
- [x] [Review][Patch] In-progress download hides Cancel/Not now and never calls `cancelVoiceModelDownload`; double-tap can start parallel fetches; `onDownloaded` can fire after unmount [`VoiceModelDownloadPrompt.tsx:57`] — done
- [x] [Review][Patch] PTT `Modal` root has no safe-area insets — close control and hold button collide with notch / home indicator [`PttOverlay.tsx:160`] — done (`SafeAreaView`)
- [x] [Review][Patch] Going offline while `mode === 'ptt'` leaves the Modal up with Send still offered; offline block stays under the Modal [`session/[id].tsx:332`] — done (same force-chat effect)
- [x] [Review][Patch] Hold/Send not gated on `isStreaming` — overlapping turns while a reply is still streaming [`PttOverlay.tsx:157`] — done
- [x] [Review][Patch] Empty successful transcription clears into the field with no hint — silent/too-short utterance looks like nothing happened [`PttOverlay.tsx:135`] — done (defensive empty guard + sttClient empty path)
- [x] [Review][Patch] “Speaks once” test waits twice for length 1 without a re-render — cannot catch duplicate speech [`PttOverlay.test.tsx:87`] — done
- [x] [Review][Defer] `getAiSession` sits outside the grammar `try` — sync SQLite throw would crash the effect [`session/[id].tsx:71`] — deferred, pre-existing
- [x] [Review][Defer] `handleFinish` does not catch `end()` failure — end prompt can stick [`session/[id].tsx:124`] — deferred, pre-existing
- [x] [Review][Defer] Connectivity checked once per focus only — mid-session offline/online flips do not update chat gate [`session/[id].tsx:53`] — deferred, pre-existing

_Chunk C (cloud STT settings + prefs) — 2026-07-21. Chunks D–E still queued._

- [x] [Review][Patch] Cloud STT toggle can strand ON and unreachable — `disabled` ignores current value, so removing the OpenAI key while opted in freezes the switch at `true`; every PTT turn then errors "turn cloud transcription off" via a control the learner can no longer touch [`ByokSettingsSection.tsx:170`] — done (`disabled={!cloudSttAvailable && !cloudStt}`, plus `handleRemove('openai')` clears the opt-in)
- [x] [Review][Patch] Toggle gate (`configured.includes('openai')`) disagrees with the runtime gate (active provider === `'openai'`) — with both keys saved and Anthropic active, Settings offers cloud STT and `transcribeTurn` refuses it [`ByokSettingsSection.tsx:169`] [`transcription.ts:35`] — done (reuses the exported `resolveActiveProvider`, third copy state for "key saved but not active")
- [x] [Review][Patch] New BYOK error message uses the undefined `feedback-error` token — adds a 7th usage of the exact defect this story's `docs/known-issues.md` flags; renders with no colour [`ByokSettingsSection.tsx:87`] — done (`text-feedback-incorrect`; the pre-existing 6 stay for the tracked global fix)
- [x] [Review][Patch] Two behaviour changes in `preferencesRepository` ship with zero coverage: empty `setAiModel` now DELETEs the row, and `setAiOpenAiBaseUrl` now rejects disallowed URLs [`preferencesRepository.ts:353`] [`preferencesRepository.ts:402`] — done (5 new tests incl. plaintext-remote rejection leaving the stored URL intact)
- [x] [Review][Patch] Disabled switch has no `accessibilityHint` — a screen-reader user hears "dimmed" with the reason only in a separate, easily-skipped Text node [`ByokSettingsSection.tsx:167`] — done (hint carries the same reason string)
- [x] [Review][Defer] `setAiOpenAiBaseUrl` silently no-ops on a rejected URL; unreachable today because `KeySetup.tsx:66` validates first, but a silent drop conflicts with the no-hidden-fallback rule if a future caller skips it [`preferencesRepository.ts:353`] — deferred, defence-in-depth only
- [x] [Review][Defer] `refresh()` sets state from an unguarded `.then` after a possible unmount [`ByokSettingsSection.tsx:44`] — deferred, pre-existing pattern

_Chunk D (session screen wiring + composer mic) — 2026-07-21. Chunk E still queued._

- [x] [Review][Patch] Conversation errors are invisible in PTT mode — `send()` sets `accepted = true` as soon as the learner's turn is committed, so a provider/stream failure clears the transcript and returns success while the only error banner sits under the covering Modal; the learner's spoken turn vanishes with no reply and no message [`session/[id].tsx:247`] [`session/[id].tsx:344`]
- [x] [Review][Patch] `setMode('ptt')` from the async mic check and from `onDownloaded` never re-checks wrap-up / ended / offline — the guard effect only fires on dep change, so a state flip *during* the await or the download leaves PTT opening over an unreachable Finish prompt or an ended session where every send fails [`session/[id].tsx:152`] [`session/[id].tsx:317`]
- [x] [Review][Patch] `handleMicPress` has no in-flight guard — a double tap runs two concurrent presence checks whose results race, leaving the download prompt mounted under the overlay or re-opening it over a promoted session [`session/[id].tsx:145`]
- [x] [Review][Patch] `showVoiceDownload` and `voiceError` are never cleared by the promote path or by the wrap-up/ended/offline guard — a stale download card (with a transfer still running) and a stale error survive into a session the learner can no longer speak into [`session/[id].tsx:126`] [`session/[id].tsx:152`]
- [x] [Review][Patch] `SafeAreaView` inside a bare RN `Modal` gets no insets on Android (no provider inside the modal) — exit control and the 88px hold button collide with the status bar / gesture pill; the new test pins insets to 0 so it can never catch it [`session/[id].tsx:340`]
- [x] [Review][Patch] Test gaps: the `!downloaded.ok` voice-error branch has zero coverage, AC5's "never an automatic download" is never asserted (`__mockFetchCallCount()` unused), and the AC3 "transcript intact" check reads a constant fixture no path could mutate [`session/[id].test.tsx:132`] [`session/[id].test.tsx:169`]
- [x] [Review][Patch] Mic button has no `accessibilityHint` — one tap may open full-screen conversation mode or a ~1 GB download prompt, with no advance signal (same class as the Chunk C hint fix) [`Composer.tsx:62`]
- [x] [Review][Patch] PTT `Modal` can be presented while `WordLookupSheet`'s modal is up (download completing behind the sheet) — iOS drops the second presentation, leaving `mode === 'ptt'` with no overlay and no exit control [`session/[id].tsx:340`]
- [x] [Review][Defer] Connectivity is refreshed only on focus, so going offline mid-PTT is never noticed and the offline block stays under the Modal [`session/[id].tsx:53`] — deferred, pre-existing (same finding deferred in Chunk B)
- [x] [Review][Defer] Exit / Android back while recording unmounts the overlay mid-capture; `releaseAudioSession` stops the recorder, so the residual risk is a dropped utterance with no explanation [`PttOverlay.tsx:69`] — deferred, Chunk B surface, low residual risk
- [x] [Review][Defer] STT/TTS models are released and re-loaded on every chat↔PTT toggle — deliberate memory decision, but a multi-second stall on re-entry needs on-device measurement [`PttOverlay.tsx:69`] — deferred, needs device verification
- [x] [Review][Defer] `mode` / `showVoiceDownload` / `voiceError` are not reset if `sessionId` changes without a remount (deep link to another conversation while this screen is on top) [`session/[id].tsx:107`] — deferred, unreachable through current navigation
- [x] [Review][Defer] A non-string `ResourceSource` can never satisfy the presence check, so the mic would prompt for an already-completed download forever; the new test helpers step around exactly that case [`modelDownloadManager.ts:22`] — deferred, Chunk A scope, not reachable with the pinned models

_Chunk E (5.1-era AI plumbing pulled in by the baseline) — 2026-07-21. Final chunk._

- [x] [Review][Decision] Tapping any off-curriculum word now fires a billed BYOK request with no consent, no setting, and disclosure only *after* the request is in flight ("Asking your provider…") — five curious taps are five paid calls. FR92 asks for display-and-translate, but the `no-hidden-fallback-paths` rule wants a visible switch. Options: (a) explicit "Translate this word" button inside the sheet, (b) Settings toggle defaulting off, (c) accept as-is and reword the disclosure to precede the call [`WordLookupSheet.tsx:40`]
- [x] [Review][Decision] `toAdapterMessages` silently merges consecutive same-role turns, so after N failed streams the wire carries one user turn containing N joined messages while the UI shows N bubbles — the model's view of the conversation stops matching the learner's, and the merged content grows unbounded against a fixed `MAX_REPLY_TOKENS`. The docstring justifies it (Anthropic rejects back-to-back user turns) but the divergence is invisible. Options: (a) keep merging + cap/trim, (b) visible "resend" affordance instead of implicit merge, (c) drop the orphaned user row on failure [`useAiConversation.ts:49`]
- [x] [Review][Decision] `practise_recent_grammar` persists only `topicItemId: recentGrammar[0]` — one arbitrary item out of the set actually used for grounding. Reopening the thread re-runs `listRecentGrammar`, whose result drifts as the learner studies, so a resumed conversation is grounded in different grammar than it started with, with no signal. Options: (a) persist the full topic set, (b) persist nothing and document the drift, (c) pin the session to its start-time set [`ConversationStartPicker.tsx:75`]
- [x] [Review][Decision] `listAllGrammar` / `listRecentGrammar` failures are caught into `setAllGrammar([])`, which the new sheet renders as "No grammar items are available yet." — a failed `curriculum.db` ATTACH tells the learner the curriculum is empty. The catch is deliberately commented as a fallback, which conflicts with the one-visible-failure-path rule [`converse/index.tsx:55`]
- [x] [Review][Patch] `abortRef.current = controller` is assigned only *after* `await resolveAiConfigForSession` (keychain read, possibly biometric), so Finish pressed in that window aborts a null ref and then blocks on `await inFlightRef.current` for the entire un-aborted stream; the assistant turn also commits into a session the learner already ended [`useAiConversation.ts:182`]
- [x] [Review][Patch] A deliberate `end()` surfaces an error banner — abort maps to `ai_stream_aborted` and the failure branch calls `setError` unconditionally, so the learner is told "The reply was stopped." for the action they just took, after `partialText` is committed as a real turn [`useAiConversation.ts:211`]
- [x] [Review][Patch] `send()` and `end()` can reject: `appendAiMessage` / `getStartingJlptLevel` / `endAiSession` are throwing sync DB calls with no try/catch, and `await work` rethrows past the `finally`. Callers use a floating `onSend={(text) => send(text)}`, so a locked `user.db` becomes an unhandled rejection with no `AppError` — the project forbids throwing across async boundaries [`useAiConversation.ts:150`]
- [x] [Review][Patch] Off-curriculum lookup has no request-identity guard, no in-flight guard and no `AbortSignal`: tap 私 then 学生 and the slower first response paints 私's gloss under 学生's heading; close the sheet and the late resolve repopulates state the next open still shows; double-tap bills two calls; a stalled provider pins "Asking your provider…" forever with no cancel [`WordLookupSheet.tsx:40`]
- [x] [Review][Patch] The NFR24 HTTPS guard checks only the pre-redirect URL — `fetch` follows redirects by default, so an `https://` proxy answering `302 → http://…` replays the `Authorization` header to a plaintext host. `expo/fetch` accepts `redirect: 'manual'` (`fetch.types.d.ts:10`), so this is enforceable [`streamingClient.ts:130`]
- [x] [Review][Patch] `translateOffCurriculum` resolves the provider from live preferences (`resolveAiConfig`) while the same diff migrates `useAiConversation` to `resolveAiConfigForSession` — the word being glossed comes from a session's transcript but can be sent to the *other* provider's endpoint, which is exactly the 5.1 Chunk-3 defect that migration fixed [`translateOffCurriculum.ts:64`]
- [x] [Review][Patch] New usage of the undefined `feedback-error` token — an 8th instance of the defect this story's own `docs/known-issues.md` tracks, and the same one Chunk C patched to `text-feedback-incorrect`; the error text renders with no colour [`WordLookupSheet.tsx:139`]
- [x] [Review][Patch] Per-delta `stripControlMarkers(previous + delta)` re-scans and re-trims the whole accumulated string on every chunk (O(n²) on the Android floor device, visible whitespace jitter) and cannot match a marker split across two deltas, so a half-written `<<<END_SESS` flashes on screen — precisely what the existing, never-called `containsControlMarker` helper was written to prevent [`useAiConversation.ts:195`] [`markers.ts:67`]
- [x] [Review][Patch] The SSE size cap is applied to the whole buffer *before* blank-line splitting, so one large read carrying dozens of complete, well-formed frames kills the turn with "The reply stopped early." — likeliest on the explicitly supported buffering `http://localhost` proxy. `buffer.length` also counts UTF-16 units against a constant named `_BYTES` [`streamingClient.ts:207`]
- [x] [Review][Patch] A stream that ends without a `done` frame returns `ok: true, complete: false`, the trailing flush pushes an *unterminated* frame through `processBlock` as if complete, and no caller ever reads `complete` — a truncated reply is persisted as a finished assistant turn with no marker of truncation [`streamingClient.ts:231`] [`useAiConversation.ts:204`]
- [x] [Review][Patch] `ConversationStartRequest.grammarTopics` is declared, documented and populated in both handlers, but `handleStart` reads only `mode` and `topicItemId` — a documented field that does nothing [`ConversationStartPicker.tsx:40`] [`converse/index.tsx:92`]
- [x] [Review][Patch] `practise_recent_grammar` stays enabled with `recentGrammar === []`, starting a generic random chat under a grammar label with no explanation — a new learner's default experience [`ConversationStartPicker.tsx:70`]
- [x] [Review][Patch] An empty or marker-only reply commits nothing: `commitAssistantTurn` early-returns on zero-length text, `pendingReply` clears, `error` stays null — the user's turn posts and the UI shows that nothing happened [`useAiConversation.ts:204`]
- [x] [Review][Patch] Early returns from the read loop (buffer cap, frame failure, flush failure) never call `reader.cancel()`, leaving the HTTP stream open [`streamingClient.ts:208`]
- [x] [Review][Patch] A long gloss expands the result panel — which sits *outside* the candidates `ScrollView` in a `max-h-[70%]` sheet — until the trailing Close button is clipped with no scroll container to reach it; `translateOffCurriculum` caps tokens but never rendered length [`WordLookupSheet.tsx:107`]
- [x] [Review][Patch] Grammar rows pass `disabled` without `accessibilityState={{ disabled }}`, inconsistent with the option rows above them; a screen reader announces an actionable button whose taps do nothing, and the repo's a11y lint is merge-blocking [`ConversationStartPicker.tsx:150`]
- [x] [Review][Patch] `translated.error.userMessage ?? translated.error.message` — `??` does not catch `''`, so an empty `userMessage` renders a blank error slot; the fallback also leaks developer strings like "Provider reply was not JSON" into the UI [`WordLookupSheet.tsx:53`]
- [x] [Review][Patch] `useAiConversation` and `ConversationStartPicker` have no test files at all, despite this diff changing `send`'s return type, its concurrency guard, `end`'s signature, `toAdapterMessages`, marker handling, and adding the whole choose-grammar sheet. `converse/index.test.tsx:34` mocks `listAllGrammar: () => []`, so the modal body never renders in any test [`useAiConversation.ts`] [`ConversationStartPicker.tsx`]
- [x] [Review][Defer] Navigating to another thread mid-stream neither aborts nor invalidates the in-flight work, so `setMessages` / `commitAssistantTurn` can land under the new session and `sendingRef` stays stuck true [`useAiConversation.ts:92`] — deferred, unreachable through current navigation (same call as Chunk D's `sessionId` defer)
- [x] [Review][Defer] The choose-grammar sheet renders the entire corpus into a plain `ScrollView` — no virtualisation, no search, no level or study-status filter, and `listAllGrammar`'s `limit = 200` truncates with no notice, so an N5 learner is offered N1 grammar and item 201+ is unreachable [`ConversationStartPicker.tsx:146`] — deferred, needs product input on filtering
- [x] [Review][Defer] The translate path has no connectivity gate, so offline the learner gets a raw `ai_network_error` inside the sheet rather than the tab's offline state [`WordLookupSheet.tsx:40`] — deferred, same offline-on-focus limitation already deferred in Chunks B and D
- [x] [Review][Defer] `messagesRef` / `sessionRef` / `grammarTopicsRef` are assigned in the render body, so a discarded concurrent render still mutates them [`useAiConversation.ts:88`] — deferred, the `useEffect` alternative introduces its own one-render staleness in the async read path; needs a deliberate call
- [x] [Review][Defer] Modal scrim uses raw `bg-black/40` rather than a semantic token and does not respond to the colour scheme; this diff adds a second instance of the pattern already in `WordLookupSheet` [`ConversationStartPicker.tsx:132`] — deferred, wants one token added globally rather than a local fix

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-21 | Implemented Story 5.2: pinned executorch nightly + Supertonic/Whisper Japanese models, `data/ai/voice/` module, explicit model download UX, composer mic, full-screen PTT conversation mode, cloud STT opt-in. Added `react-native-audio-api` (user-approved) for microphone capture and playback, which executorch does not provide. |
| 2026-07-21 | Code review Chunk A (voice engine): findings recorded under Review Findings. |
| 2026-07-21 | Code review Chunk A patches applied (load gate, size probe, audio Result/session/playback, cloud STT timeout, mic copy, cancel API). |
| 2026-07-21 | Code review Chunk B (PTT UI): findings recorded under Review Findings. |
| 2026-07-21 | Code review Chunk B patches applied (press race, TTS/streaming gates, spokenRef, wrap-up/offline exit, privacy copy, download cancel, safe area, empty STT hint, tests). |
| 2026-07-21 | Code review Chunk C (cloud STT settings + prefs): findings recorded under Review Findings. |
| 2026-07-21 | Code review Chunk C patches applied (toggle gate matches `transcribeTurn`'s active-provider rule, opt-in always switchable off and cleared on key removal, defined colour token, a11y hint, 9 new tests). |)
| 2026-07-21 | Code review Chunk D (session wiring + composer mic): findings recorded under Review Findings. |
| 2026-07-21 | Code review Chunk D patches applied (conversation error surfaced in PTT, guarded PTT entry after async waits, mic in-flight guard, stale prompt/error cleared, safe-area provider inside the Modal, download cancelled on prompt unmount, mic a11y hint, 6 new tests). |
