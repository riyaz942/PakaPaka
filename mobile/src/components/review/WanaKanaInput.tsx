import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import * as wanakana from 'wanakana';

export type WanaKanaInputMode = 'kana' | 'english';

export type WanaKanaInputRef = {
  focus: () => void;
};

type WanaKanaInputProps = {
  mode: WanaKanaInputMode;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * Controlled answer input with synchronous per-keystroke romaji→kana conversion via wanakana.
 * Conversion runs inline in onChangeText (no async boundary) for NFR5 responsiveness.
 */
export const WanaKanaInput = forwardRef<WanaKanaInputRef, WanaKanaInputProps>(
  function WanaKanaInput(
    {
      mode,
      value,
      onChangeText,
      onSubmit,
      placeholder,
      editable = true,
      autoFocus = true,
      testID,
    },
    ref,
  ) {
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    useEffect(() => {
      if (autoFocus && editable) {
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
      }
    }, [autoFocus, editable]);

    function handleChangeText(text: string) {
      if (mode === 'kana') {
        onChangeText(wanakana.toKana(text, { IMEMode: true }));
      } else {
        onChangeText(text);
      }
    }

    const accessibilityLabel =
      mode === 'kana' ? 'Answer input, type in romaji' : 'Answer input';

    const englishProps: Partial<TextInputProps> =
      mode === 'english'
        ? {
            autoCapitalize: 'none',
            autoCorrect: false,
            autoComplete: 'off',
          }
        : {};

    return (
      <TextInput
        ref={inputRef}
        testID={testID}
        className="w-full rounded-radius-sm border border-border bg-surface-elevated px-space-md py-space-sm text-body text-primary focus:border-feedback-info"
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={value}
        onChangeText={handleChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        submitBehavior="submit"
        editable={editable}
        accessibilityLabel={accessibilityLabel}
        {...englishProps}
      />
    );
  },
);
