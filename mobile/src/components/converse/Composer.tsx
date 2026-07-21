import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, TextInput, useColorScheme, View } from 'react-native';

import { getSemanticColors } from '@/constants/semantic-colors';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

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
  const colors = getSemanticColors(resolveColorScheme(useColorScheme()));
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
    <View className="flex-row items-end gap-space-sm border-t border-border bg-surface px-space-md py-space-sm">
      <TextInput
        accessibilityLabel="Your message"
        className="max-h-[120px] flex-1 rounded-radius-md border border-border bg-background px-space-md py-space-sm text-body text-primary"
        editable={!disabled && !isSending}
        multiline
        onChangeText={setDraft}
        placeholder="日本語で書いてみましょう"
        value={draft}
      />
      {onMicPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Speak instead of typing"
          accessibilityState={{ disabled: !canSpeak }}
          disabled={!canSpeak}
          onPress={onMicPress}
          testID="composer-mic"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-radius-md bg-surface-elevated">
          <MaterialIcons name="mic" size={20} color={canSpeak ? colors.primary : colors.secondary} />
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
        className={`min-h-[44px] min-w-[44px] items-center justify-center rounded-radius-md ${
          canSend ? 'bg-feedback-info' : 'bg-surface-elevated'
        }`}>
        <MaterialIcons
          name="send"
          size={20}
          color={canSend ? colors.onPrimary : colors.secondary}
        />
      </Pressable>
    </View>
  );
}
