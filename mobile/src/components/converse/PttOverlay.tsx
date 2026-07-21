import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { getSemanticColors } from '@/constants/semantic-colors';
import { parseFurigana } from '@/core/furigana/parseFurigana';
import {
  ensureMicrophonePermission,
  playWaveform,
  releaseAudioSession,
  startRecording,
  stopRecording,
} from '@/data/ai/voice/audioSession';
import { releaseSttModel } from '@/data/ai/voice/sttClient';
import { transcribeTurn } from '@/data/ai/voice/transcription';
import { releaseTtsModel, synthesizeJapanese } from '@/data/ai/voice/ttsClient';
import { useDatabase } from '@/data/hooks/useDatabase';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

type PttOverlayProps = {
  /** Latest assistant turn in curriculum bracket notation, or null before one exists. */
  assistantText: string | null;
  isStreaming: boolean;
  /** The same `send` chat mode uses — resolves true once the turn is committed. */
  onSend: (text: string) => boolean | Promise<boolean>;
  onExit: () => void;
};

type Phase = 'idle' | 'recording' | 'transcribing' | 'sending';

/**
 * Full-screen conversation mode (FR98, FR99, UX-DR21).
 *
 * The UX spec calls this `PTTSession` and the architecture tree calls it
 * `PttOverlay` — one component, two documents, and the directory tree wins.
 *
 * Chat history is hidden here by design: only the AI's latest line and the
 * learner's latest transcription are on screen. Transcription defaults to
 * on-device Whisper; cloud STT only runs when Settings opt-in is on (via
 * `transcribeTurn`), never as a silent fallback from this overlay.
 *
 * Nothing is sent by voice alone. Transcription lands in an editable field and
 * only a deliberate tap commits it through the same `send` chat mode uses, so
 * leaving conversation mode needs no reconciliation between what was said and
 * what was logged: every turn in the transcript was confirmed text before it
 * went out.
 */
export function PttOverlay({ assistantText, isStreaming, onSend, onExit }: PttOverlayProps) {
  const colors = getSemanticColors(resolveColorScheme(useColorScheme()));
  const { userDb } = useDatabase();
  const [phase, setPhase] = useState<Phase>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const spokenRef = useRef<string | null>(null);
  /** Bumps on pressOut so an in-flight async pressIn cannot stick the mic on. */
  const pressGenRef = useRef(0);

  // The sentence, not its markup — the same plain-text form ChatBubble already
  // derives for screen readers is exactly what should be shown and spoken here.
  const readableLine = assistantText
    ? parseFurigana(assistantText)
        .map((segment) => segment.text)
        .join('')
    : '';

  useEffect(() => {
    // Free the loaded models and the audio graph on the way out — these are
    // hundreds of megabytes of resident model, not a stray listener.
    return () => {
      releaseSttModel();
      releaseTtsModel();
      releaseAudioSession();
    };
  }, []);

  useEffect(() => {
    if (readableLine.length === 0 || isStreaming || spokenRef.current === readableLine) {
      return;
    }
    let cancelled = false;
    setSpeaking(true);
    void (async () => {
      const synthesized = await synthesizeJapanese(readableLine);
      if (cancelled) {
        return;
      }
      if (!synthesized.ok) {
        setError(synthesized.error.userMessage ?? synthesized.error.message);
        setSpeaking(false);
        return;
      }
      const played = await playWaveform(synthesized.value);
      if (cancelled) {
        return;
      }
      if (!played.ok) {
        setError(played.error.userMessage ?? played.error.message);
        setSpeaking(false);
        return;
      }
      // Only mark spoken after audible success so a failed turn can retry.
      spokenRef.current = readableLine;
      setSpeaking(false);
    })();
    return () => {
      cancelled = true;
      setSpeaking(false);
    };
  }, [readableLine, isStreaming]);

  const handlePressIn = useCallback(async () => {
    if (phase !== 'idle' || speaking || isStreaming) {
      return;
    }
    const gen = ++pressGenRef.current;
    setError(null);
    const permitted = await ensureMicrophonePermission();
    if (gen !== pressGenRef.current) {
      return;
    }
    if (!permitted.ok) {
      setError(permitted.error.userMessage ?? permitted.error.message);
      return;
    }
    const started = await startRecording();
    if (gen !== pressGenRef.current) {
      if (started.ok) {
        await stopRecording();
      }
      return;
    }
    if (!started.ok) {
      setError(started.error.userMessage ?? started.error.message);
      return;
    }
    setPhase('recording');
  }, [phase, speaking, isStreaming]);

  const handlePressOut = useCallback(async () => {
    // Invalidate any pressIn still awaiting permission / startRecording.
    pressGenRef.current += 1;
    if (phase !== 'recording') {
      return;
    }
    setPhase('transcribing');
    const recorded = await stopRecording();
    if (!recorded.ok) {
      setError(recorded.error.userMessage ?? recorded.error.message);
      setPhase('idle');
      return;
    }
    const transcribed = await transcribeTurn(userDb, recorded.value);
    if (!transcribed.ok) {
      setError(transcribed.error.userMessage ?? transcribed.error.message);
      setPhase('idle');
      return;
    }
    if (transcribed.value.trim().length === 0) {
      // Belt-and-suspenders — stt/cloud clients already reject empty, but a
      // successful empty string must not look like "nothing happened".
      setError("That didn't catch any speech. Try holding the button and speaking again.");
      setTranscript('');
      setPhase('idle');
      return;
    }
    setTranscript(transcribed.value);
    setPhase('idle');
  }, [phase, userDb]);

  const handleSend = useCallback(async () => {
    const text = transcript.trim();
    if (text.length === 0 || phase !== 'idle' || isStreaming) {
      return;
    }
    setPhase('sending');
    try {
      const accepted = await onSend(text);
      if (accepted) {
        setTranscript('');
      }
    } finally {
      setPhase('idle');
    }
  }, [transcript, phase, onSend, isStreaming]);

  const isRecording = phase === 'recording';
  const isBusy = phase === 'transcribing' || phase === 'sending';
  const micDisabled = isBusy || speaking || isStreaming;
  const canSend = transcript.trim().length > 0 && phase === 'idle' && !isStreaming;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom', 'left', 'right']}>
      <View className="flex-1 bg-background p-space-lg" testID="ptt-overlay">
        <View className="flex-row justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave conversation mode"
            onPress={onExit}
            testID="ptt-exit"
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-radius-md">
            <MaterialIcons name="close" size={24} color={colors.primary} />
          </Pressable>
        </View>

        <View className="flex-1 justify-center">
          {isStreaming ? (
            <ActivityIndicator accessibilityLabel="Waiting for a reply" />
          ) : readableLine.length > 0 ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center text-title text-primary"
              testID="ptt-assistant-line">
              {readableLine}
            </Text>
          ) : (
            <Text className="text-center text-body text-secondary">
              Hold the button and say something — 日本語でどうぞ。
            </Text>
          )}
        </View>

        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mb-space-md text-center text-body-sm text-feedback-incorrect">
            {error}
          </Text>
        ) : null}

        <TextInput
          accessibilityLabel="Your spoken message"
          className="max-h-[120px] rounded-radius-md border border-border bg-surface px-space-md py-space-sm text-body text-primary"
          editable={phase === 'idle'}
          multiline
          onChangeText={setTranscript}
          placeholder="What you said will appear here to check before sending"
          value={transcript}
        />

        <View className="mt-space-sm flex-row gap-space-sm">
          <Button
            className="flex-1"
            label="Send"
            onPress={() => {
              void handleSend();
            }}
            disabled={!canSend}
            testID="ptt-send"
          />
          <Button
            className="flex-1"
            label="Clear"
            onPress={() => setTranscript('')}
            disabled={transcript.length === 0}
            testID="ptt-clear"
            variant="secondary"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hold to speak"
          accessibilityHint="Hold this button while you speak, then release to see what was heard"
          accessibilityState={{ busy: isRecording, disabled: micDisabled }}
          disabled={micDisabled}
          onPressIn={() => {
            void handlePressIn();
          }}
          onPressOut={() => {
            void handlePressOut();
          }}
          testID="ptt-button"
          className={`mt-space-lg min-h-[88px] items-center justify-center rounded-radius-md ${
            isRecording ? 'bg-feedback-incorrect' : 'bg-feedback-info'
          } ${micDisabled ? 'opacity-40' : ''}`}>
          <MaterialIcons name="mic" size={32} color={colors.onPrimary} />
          <Text className="mt-space-xs text-body font-semibold text-white">
            {isRecording
              ? 'Listening — release when done'
              : phase === 'transcribing'
                ? 'Working out what you said…'
                : speaking
                  ? 'Playing reply…'
                  : 'Hold to speak'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
