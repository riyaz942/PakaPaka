[
  {
    "location": "mobile/src/app/(tabs)/converse/session/[id].tsx:useFocusEffect",
    "trigger_condition": "isOnline() promise rejects or never settles",
    "guard_snippet": "void isOnline().then(setOnline).catch(() => { if (!cancelled) setOnline(false); });",
    "potential_consequence": "Connection spinner stays forever; chat never renders"
  },
  {
    "location": "mobile/src/app/(tabs)/converse/session/[id].tsx:grammar useEffect",
    "trigger_condition": "getAiSession throws before the try block",
    "guard_snippet": "try { const record = getAiSession(userDb, sessionId); ... } catch { setGrammarTopics([]); }",
    "potential_consequence": "Effect crashes; grammarTopics stuck or render error"
  },
  {
    "location": "mobile/src/app/(tabs)/converse/session/[id].tsx:handleFinish",
    "trigger_condition": "end(reason) rejects or fails before navigation",
    "guard_snippet": "try { await end(reason); setShowEndPrompt(false); router.replace(...); } catch { setVoiceError(...); }",
    "potential_consequence": "End prompt stuck; summary never opened"
  },
  {
    "location": "mobile/src/app/(tabs)/converse/session/[id].tsx:Modal+endPromptVisible",
    "trigger_condition": "wrapUpSignalled or end prompt while mode is ptt",
    "guard_snippet": "if (endPromptVisible) setMode('chat'); // or mirror Finish/Keep talking inside PttOverlay",
    "potential_consequence": "Wrap-up UI covered; learner cannot finish or dismiss"
  },
  {
    "location": "mobile/src/app/(tabs)/converse/session/[id].tsx:Modal+online",
    "trigger_condition": "Connectivity drops while mode remains ptt",
    "guard_snippet": "useEffect(() => { if (online === false) setMode('chat'); }, [online]);",
    "potential_consequence": "Offline block hidden; voice send still offered without net"
  },
  {
    "location": "mobile/src/components/converse/PttOverlay.tsx:handlePressIn-handlePressOut",
    "trigger_condition": "pressOut before setPhase('recording') after async start",
    "guard_snippet": "const gen = ++pressGenRef.current; ... if (gen !== pressGenRef.current) { await stopRecording(); return; }",
    "potential_consequence": "Stuck Listening state until a later pressOut"
  },
  {
    "location": "mobile/src/components/converse/PttOverlay.tsx:TTS useEffect",
    "trigger_condition": "synthesizeJapanese or playWaveform fails after spokenRef set",
    "guard_snippet": "spokenRef.current = readableLine only after played.ok; else leave ref unset to retry",
    "potential_consequence": "That assistant line never spoken again"
  },
  {
    "location": "mobile/src/components/converse/PttOverlay.tsx:canSend+ptt-button",
    "trigger_condition": "Hold-to-speak or Send while isStreaming true",
    "guard_snippet": "const canSend = transcript.trim().length > 0 && phase === 'idle' && !isStreaming; disabled={isBusy || isStreaming}",
    "potential_consequence": "Overlapping turns while reply still streaming"
  },
  {
    "location": "mobile/src/components/converse/PttOverlay.tsx:handlePressOut",
    "trigger_condition": "Unmount or onExit during stopRecording/transcribeTurn",
    "guard_snippet": "let cancelled = false; cleanup sets cancelled; skip setPhase/setTranscript if cancelled",
    "potential_consequence": "setState on unmounted overlay; orphaned work"
  },
  {
    "location": "mobile/src/components/converse/VoiceModelDownloadPrompt.tsx:handleDownload",
    "trigger_condition": "Download pressed again before first download settles",
    "guard_snippet": "if (progress !== null) return; at start of handleDownload",
    "potential_consequence": "Parallel downloads; duplicate fetch and race on completion"
  },
  {
    "location": "mobile/src/components/converse/VoiceModelDownloadPrompt.tsx:isDownloading UI",
    "trigger_condition": "downloadVoiceModels hangs with no cancel or timeout",
    "guard_snippet": "Keep Cancel enabled during download; abort controller + timeout clears progress",
    "potential_consequence": "Prompt stuck on Downloading with no escape"
  }
]
