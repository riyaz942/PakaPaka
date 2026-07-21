import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, useColorScheme, View } from 'react-native';

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
 * learner's latest transcription are on screen. Both directions of audio are
 * on-device — Whisper transcribes, Supertonic speaks — and there is no cloud
 * path anywhere in this component.
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
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const spokenRef = useRef<string | null>(null);

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
    spokenRef.current = readableLine;
    let cancelled = false;
    void (async () => {
      const synthesized = await synthesizeJapanese(readableLine);
      if (cancelled) {
        return;
      }
      if (!synthesized.ok) {
        setError(synthesized.error.userMessage ?? synthesized.error.message);
        return;
      }
      const played = await playWaveform(synthesized.value);
      if (!cancelled && !played.ok) {
        setError(played.error.userMessage ?? played.error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readableLine, isStreaming]);

  const handlePressIn = useCallback(async () => {
    if (phase !== 'idle') {
      return;
    }
    setError(null);
    const permitted = await ensureMicrophonePermission();
    if (!permitted.ok) {
      setError(permitted.error.userMessage ?? permitted.error.message);
      return;
    }
    const started = await startRecording();
    if (!started.ok) {
      setError(started.error.userMessage ?? started.error.message);
      return;
    }
    setPhase('recording');
  }, [phase]);

  const handlePressOut = useCallback(async () => {
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
    setTranscript(transcribed.value);
    setPhase('idle');
  }, [phase, userDb]);

  const handleSend = useCallback(async () => {
    const text = transcript.trim();
    if (text.length === 0 || phase !== 'idle') {
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
  }, [transcript, phase, onSend]);

  const isRecording = phase === 'recording';
  const isBusy = phase === 'transcribing' || phase === 'sending';
  const canSend = transcript.trim().length > 0 && phase === 'idle';

  return (
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
        accessibilityState={{ busy: isRecording, disabled: isBusy }}
        disabled={isBusy}
        onPressIn={() => {
          void handlePressIn();
        }}
        onPressOut={() => {
          void handlePressOut();
        }}
        testID="ptt-button"
        className={`mt-space-lg min-h-[88px] items-center justify-center rounded-radius-md ${
          isRecording ? 'bg-feedback-incorrect' : 'bg-feedback-info'
        } ${isBusy ? 'opacity-40' : ''}`}>
        <MaterialIcons name="mic" size={32} color={colors.onPrimary} />
        <Text className="mt-space-xs text-body font-semibold text-white">
          {isRecording
            ? 'Listening — release when done'
            : phase === 'transcribing'
              ? 'Working out what you said…'
              : 'Hold to speak'}
        </Text>
      </Pressable>
    </View>
  );
}
