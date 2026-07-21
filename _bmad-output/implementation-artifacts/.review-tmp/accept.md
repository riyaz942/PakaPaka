# Chunk B — Acceptance Auditor

**Verdict: no AC violations** for AC1, AC2, AC3, AC5 or Tasks 3–5 (PTT UI).

Checked against the Chunk B spec excerpt and Story 5.2 Tasks 3–5. Diff implements:

| Criterion | Evidence |
| --- | --- |
| **AC1** Mic promotes mid-session | Session starts `mode: 'chat'`; `Composer` mic → `handleMicPress` → `setMode('ptt')` when models present; no start-of-session mode picker |
| **AC2** Full-screen PTT | `PttOverlay` in `Modal` (covers tab bar); history not shown; AI line via `parseFurigana(...).map(s => s.text).join('')` + TTS; transcript field + hold-to-speak |
| **AC3** Confirm before send | STT → editable `TextInput`; Send/Clear only; `onSend` → shared `send()`; exit is `setMode('chat')` with no reconciliation |
| **AC5** Explicit non-blocking download | Mic + missing models → inline `VoiceModelDownloadPrompt` with size + Download; composer still usable; progress; failure does not call `onDownloaded` |
| **Constraints** | No auto-download on non-mic events; no reconciliation on exit; UI surfaces voice/download errors; no silent cloud fallback in this layer (routes through `transcribeTurn`, which is Settings-gated) |

## Findings

_(none)_
