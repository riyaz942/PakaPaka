import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { VoiceModelDownloadPrompt } from '@/components/converse/VoiceModelDownloadPrompt';
import { playWaveform } from '@/data/ai/voice/audioSession';
import { synthesizeJapanese } from '@/data/ai/voice/ttsClient';
import { supportsVoice } from '@/platform/capabilities';

type Phase = 'idle' | 'busy' | 'error';

type PronunciationButtonProps = {
  /**
   * Japanese text to speak — a surface form (kanji included), the same kind
   * of input `PttOverlay` already feeds `synthesizeJapanese` for assistant
   * replies. The on-device model reads it directly; no reading needs to be
   * pre-extracted.
   */
  text: string;
  testID?: string;
};

/**
 * Hear-it-aloud button for kanji/vocabulary detail pages, built on the same
 * on-device Supertonic pipeline Talk's `PttOverlay` uses
 * (`synthesizeJapanese` + `playWaveform`) — no new TTS integration, and no
 * network involved.
 *
 * A synthesis or playback failure is shown on the button itself rather than
 * swallowed: the icon and label switch to an error state and a short message
 * appears beside it, mirroring how `PttOverlay` surfaces the same two
 * failure points instead of failing silently.
 *
 * Missing voice models are the one failure with a fix the learner can do here,
 * so instead of an error the button opens the same explicit download prompt
 * Talk's mic uses, and speaks the word once the download finishes.
 */
export function PronunciationButton({ text, testID = 'pronunciation-button' }: PronunciationButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDownload, setShowDownload] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handlePress = useCallback(async () => {
    if (phase === 'busy') {
      return;
    }
    setPhase('busy');
    setErrorMessage(null);

    const synthesized = await synthesizeJapanese(text);
    if (!mountedRef.current) {
      return;
    }
    if (!synthesized.ok && synthesized.error.code === 'voice_tts_models_missing') {
      setPhase('idle');
      setShowDownload(true);
      return;
    }
    if (!synthesized.ok) {
      setPhase('error');
      setErrorMessage(synthesized.error.userMessage ?? synthesized.error.message);
      return;
    }

    const played = await playWaveform(synthesized.value);
    if (!mountedRef.current) {
      return;
    }
    if (!played.ok) {
      setPhase('error');
      setErrorMessage(played.error.userMessage ?? played.error.message);
      return;
    }
    setPhase('idle');
  }, [text, phase]);

  if (!supportsVoice()) {
    return null;
  }

  const isBusy = phase === 'busy';
  const isError = phase === 'error';

  return (
    <View className="items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isError ? 'Play pronunciation. Last attempt failed.' : 'Play pronunciation'}
        accessibilityState={{ busy: isBusy, disabled: isBusy }}
        disabled={isBusy}
        onPress={() => void handlePress()}
        testID={testID}
        className="min-h-[44px] min-w-[44px] items-center justify-center rounded-radius-md">
        {isBusy ? (
          <ActivityIndicator accessibilityLabel="Playing pronunciation" size="small" />
        ) : (
          <Icon
            name="speaker"
            size={20}
            strokeWidth={1.9}
            className={isError ? 'text-feedback-incorrect-deep' : 'text-brand-text'}
          />
        )}
      </Pressable>
      {errorMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          className="max-w-[96px] text-center text-body-sm font-ui text-feedback-incorrect-deep"
          testID={`${testID}-error`}>
          {errorMessage}
        </Text>
      ) : null}
      {/* No backdrop dismiss: a stray tap would cancel a large download.
          Not now / Cancel and Android back are the ways out. */}
      <Modal
        visible={showDownload}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDownload(false)}>
        <View className="flex-1 justify-end bg-black/40 p-space-md">
          <VoiceModelDownloadPrompt
            onCancel={() => setShowDownload(false)}
            onDownloaded={() => {
              setShowDownload(false);
              void handlePress();
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
