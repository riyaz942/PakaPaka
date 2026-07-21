# Blind Hunter findings — Chunk B (PTT UI)

- `PttOverlay.handlePressIn` is async and only sets `phase` to `'recording'` after `ensureMicrophonePermission` and `startRecording` resolve, while `handlePressOut` no-ops unless `phase === 'recording'`. A quick tap, or the OS permission dialog stealing the touch, fires `pressOut` while still `'idle'`, so recording can start afterward with no matching stop — the UI then sits in “Listening” with the mic live until a later accidental press/release.

- The PTT hold button is only disabled for `transcribing` / `sending`, not while TTS is still playing. After a reply finishes streaming, `synthesizeJapanese` + `playWaveform` run with `phase === 'idle'`, so the learner can hold-to-talk over the loudspeaker and feed the model its own audio.

- `spokenRef.current` is assigned to the new line *before* synthesis/playback succeeds. A failed TTS/play leaves that line permanently marked as spoken, so the overlay never retries reading it aloud.

- Effect cleanup only flips a `cancelled` flag; it does not stop an in-flight `playWaveform`. A newer assistant line (or exit) can leave the previous waveform still playing until the audio graph is torn down on unmount.

- Exit (`onExit` / Android `onRequestClose`) only flips `mode` back to `'chat'`. It does not stop recording, cancel transcription, or clear phase first — teardown relies on unmount `release*` calls, so a mid-hold or mid-transcribe exit can drop audio work on the floor without user-facing feedback.

- Conversation wrap-up / end UI lives under the chat tree, while PTT is a full-screen `Modal`. If the AI signals wrap-up (or the user had end pending) while conversation mode is open, the Finish / Keep talking prompt is invisible, yet `PttOverlay` can still `send` — unlike the Composer, which is disabled when `endPromptVisible`.

- An ended session does not force `mode` back to `'chat'`. If the session flips to ended while the overlay is up, the Modal can remain with a live Send path even though the chat chrome has switched to the finished state.

- `VoiceModelDownloadPrompt` copy claims speech models run entirely on-device and “nothing you say is uploaded,” and `PttOverlay`’s file comment says there is “no cloud path anywhere in this component,” but the overlay calls `transcribeTurn`, which uploads audio when cloud STT opt-in is on. The UI/docs actively misstate the privacy boundary.

- While a download is in progress the prompt hides both Download and Not now, so a multi‑hundred‑MB fetch cannot be dismissed or cancelled from this UI; navigating away still leaves `downloadVoiceModels` running and can invoke `onDownloaded` → `setMode('ptt')` after the session screen has unmounted.

- `formatBytes` always divides by `1e9` and shows one decimal GB. Totals under ~50 MB render as `0.0 GB`, and anything in the low hundreds of MB is a coarse/misleading disclosure relative to AC5’s “real download size” intent.

- `PttOverlay`’s root is a plain `View` inside a React Native `Modal` with no `SafeAreaView` / inset handling. The close control and the large hold-to-speak button will collide with notches and the home indicator on devices this app’s platform floor explicitly targets.

- Session screen connectivity is checked only once per focus (`useFocusEffect` + empty deps). Going offline mid-chat does not update `online`, and conversely the offline branch replaces the entire transcript UI — local history cannot be read without a network check succeeding, which fights the offline-first posture for everything except the AI turn itself.

- Empty successful transcriptions (`ok: true` with `""`) clear into the editable field with no error or hint, so a silent/too-short utterance looks identical to “nothing happened” after release, despite tests covering only hard failures.

- The `PttOverlay` test “speaks each new AI line once, not on every render” waits twice for `synthesizeCalls` length `1` without re-rendering or changing props, so it cannot catch duplicate speech on re-render and gives false confidence.

- Chat errors use `text-feedback-error` while voice / download / PTT errors use `text-feedback-incorrect` on the same session surface, so failure styling is inconsistent for what the learner experiences as one conversation flow.

- `latestAssistantText` is derived only from committed `messages`, ignoring `pendingReply`. Combined with `isStreaming` swapping the center pane to a spinner, conversation mode never shows the in-progress reply text — only a spinner — then jumps to the final line, which is a weaker FR98 “show the AI line” experience than chat itself.
