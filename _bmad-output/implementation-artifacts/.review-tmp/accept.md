## Findings

- **STT/TTS load paths can silently download models**
  - **Violates:** AC5 / NFR25 / anti-pattern “Auto-triggering a ~1 GB download”
  - **Evidence:** `sttClient.loadModule` / `ttsClient.loadModule` call `SpeechToTextModule.fromModelName` / `TextToSpeechModule.fromModelName` with no presence check. Installed executorch `fromModelName` always runs `ResourceFetcher.fetch(...)`, which downloads missing remotes (idempotent only when already on disk). So `transcribeJapanese` / `synthesizeJapanese` can pull ~1 GB without `downloadVoiceModels`, size disclosure, or user confirm — bypassing the explicit-download contract that `modelDownloadManager` alone enforces.

- **Size disclosure can under-report or return 0 instead of failing**
  - **Violates:** AC5 (“clear size disclosure”) / Task 2 (“do not show a placeholder number”; completion notes: “real number, or nothing”)
  - **Evidence:** `getVoiceModelDownloadBytes` trusts `ExpoResourceFetcher.getFilesTotalSize`. In `react-native-executorch-expo-resource-fetcher`’s `getFilesSizes`, failed/missing HEAD responses `continue` and drop that file from the sum — they do not throw. All HEADs failing yields `{ ok: true, value: 0 }`; partial failures yield an understated total. Diff’s manager has no guard that every `voiceModelSources()` entry contributed a real length before returning success.

- **Missing model directory is treated as check failure, not “not downloaded”**
  - **Violates:** Task 2 / architecture constraint “model presence is a filesystem fact” (absence ⇒ not present)
  - **Evidence:** `areVoiceModelsDownloaded` calls `ExpoResourceFetcher.listDownloadedFiles()` → `readDirectoryAsync(RNEDirectory)` with no “dir missing ⇒ empty” handling. Before any download, that directory typically does not exist; expo-file-system rejects, and the manager maps that to `{ ok: false, code: 'voice_model_check_failed' }` instead of `{ ok: true, value: false }`. That breaks the intended “missing → prompt download” path at the engine API.

- **`startRecording` ignores `AudioRecorder.start()`’s Result (silent false success)**
  - **Violates:** Hard convention “fallible ops return `Result` — never throw / silently succeed across async boundary”; undermines AC2 PTT capture
  - **Evidence:** `react-native-audio-api` types `start(): Promise<Result<{}>>` (`status: 'success' | 'error'`). `audioSession.startRecording` only `await`s and always returns `{ ok: true }` if no throw — it never inspects `status === 'error'`. Same pattern for `onAudioReady`’s `Result`. A failed start can look successful until empty audio surfaces later.

## Deferred to later chunks (not findings)

- AC1–3 UI: Composer mic, `PttOverlay`, session `mode` state, confirm/edit/retry field, Modal/fullscreen layout
- Task 3 download prompt UI (`VoiceModelDownloadPrompt`) and mic→prompt wiring
- Task 6 Settings `cloudSttOptIn` toggle UI (engine routing in `transcription.ts` is in-scope and looks AC6-correct)
- `preferencesRepository` / Settings tests (not in Chunk A diff)
- `docs/known-issues.md` `feedback-error` token (UI; pre-existing)
- Intentional Task 1/2 deviations documented in completion notes (no Metro `assetExts`; download via `ExpoResourceFetcher` instead of direct `expo-file-system/legacy`; `react-native-audio-api` for capture/playback) — not flagged as AC failures given preserved intent