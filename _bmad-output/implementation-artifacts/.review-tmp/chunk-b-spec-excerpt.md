# Chunk B review scope — Story 5.2 PTT UI

**In scope files:** `PttOverlay.tsx` (+test), `VoiceModelDownloadPrompt.tsx` (+test), `Composer.tsx` (+test), `session/[id].tsx` (+test)

## Acceptance Criteria (UI-relevant)

1. **Mic promotes mid-session** (FR90, FR98): tapping the mic in the composer (chat is already in progress) promotes the session to conversation mode — there is no up-front mode choice at session start.
2. **Full-screen PTT layout** (FR98, UX-DR21): conversation mode is full-screen with chat history hidden. On screen: the AI's latest line (readable text, plus on-device TTS speaking it) and the learner's latest transcription, with push-to-talk below.
3. **Transcript confirms before sending** (FR99): on-device STT output lands in an editable field for confirm/edit/retry — never straight onto the wire. Exiting conversation mode needs no chat-log reconciliation (every spoken turn was already confirmed text before it was sent).
5. **Explicit, non-blocking model download** (NFR25, NFR3, UX-DR23): if the voice models are not yet downloaded, chat remains fully usable; tapping the mic prompts an explicit user-initiated download with clear size disclosure. The download never blocks cold start or any other tab.

## Tasks (UI-relevant)

**Task 3 — Model download UX:** mic tap + missing models → explicit prompt with size + Download; chat usable while prompt open / download in progress; progress surfaced; failed download must not look complete.

**Task 4 — Composer mic:** mic on Composer; docstring updated; tap with models → conversation mode; without models → download prompt; single entry point.

**Task 5 — PTT screen:** `PttOverlay`; local `mode: 'chat'|'ptt'` in session screen (no AiConversationContext); full screen, history/tabs hidden; AI latest line via `parseFurigana(...).map(s => s.text).join('')`; press-hold record / release transcribe; editable confirm before `send()` from `useAiConversation`; TTS on AI replies in PTT; exit returns to chat with transcript intact; shared send path only.

## Constraints

- No silent cloud STT fallback from this UI layer
- No auto-download on non-mic events
- No reconciliation logic on PTT exit
- Named exports, Result types for fallible ops at data layer (UI should surface errors visibly)
