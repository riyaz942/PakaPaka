import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { playWaveform } from '@/data/ai/voice/audioSession';
import { synthesizeJapanese } from '@/data/ai/voice/ttsClient';

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
 */
export function PronunciationButton({ text, testID = 'pronunciation-button' }: PronunciationButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    </View>
  );
}
