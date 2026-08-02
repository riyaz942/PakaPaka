import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { getSemanticColors } from '@/constants/semantic-colors';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';
import { cn } from '@/utils/cn';

type ComposerProps = {
  /** Resolves true when the turn was accepted (draft may clear). */
  onSend: (text: string) => boolean | Promise<boolean>;
  /**
   * Promotes the session to conversation mode (FR90). Omitted on surfaces that
   * do not host voice, which is why the mic is conditional rather than always
   * rendered and sometimes inert.
   */
  onMicPress?: () => void;
  disabled?: boolean;
};

/**
 * The chat input.
 *
 * The mic is the single entry point to voice (FR90): it reports the tap and the
 * session screen decides what happens — enter conversation mode, or prompt for
 * the model download first. One button covers both states, so the learner never
 * has to know which one they are in.
 */
export function Composer({ onSend, onMicPress, disabled = false }: ComposerProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const colors = getSemanticColors(usePaintedColorScheme());
  const canSend = draft.trim().length > 0 && !disabled && !isSending;
  const canSpeak = !disabled && !isSending;

  async function handleSend() {
    if (!canSend) {
      return;
    }
    const text = draft;
    setIsSending(true);
    try {
      const accepted = await onSend(text);
      if (accepted) {
        setDraft('');
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <View className="flex-row items-center gap-[9px] border-t border-border px-space-md py-space-md">
      <TextInput
        accessibilityLabel="Your message"
        className="max-h-[120px] min-h-[44px] flex-1 rounded-radius-full border border-border bg-surface-elevated px-space-md py-space-sm text-body font-jp-medium text-primary"
        editable={!disabled && !isSending}
        multiline
        onChangeText={setDraft}
        placeholder="日本語で書いてみましょう"
        placeholderTextColor={colors.faint}
        value={draft}
      />
      {onMicPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Speak instead of typing"
          accessibilityHint="Opens conversation mode, or asks first if the voice models still need downloading"
          accessibilityState={{ disabled: !canSpeak }}
          disabled={!canSpeak}
          onPress={onMicPress}
          testID="composer-mic"
          className={cn(
            'h-11 w-11 items-center justify-center rounded-radius-full border border-border bg-surface-elevated',
            !canSpeak && 'opacity-50',
          )}>
          <Icon
            name="mic"
            size={19}
            strokeWidth={1.9}
            className={canSpeak ? 'text-primary' : 'text-muted'}
          />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={() => {
          void handleSend();
        }}
        testID="composer-send"
        className={cn(
          'h-11 w-11 items-center justify-center rounded-radius-full',
          canSend ? 'bg-brand-600' : 'bg-surface-elevated',
        )}>
        <Icon
          name="send"
          size={19}
          strokeWidth={1.9}
          className={canSend ? 'text-on-primary' : 'text-muted'}
        />
      </Pressable>
    </View>
  );
}
