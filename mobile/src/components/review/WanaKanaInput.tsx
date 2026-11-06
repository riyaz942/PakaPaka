import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import * as wanakana from 'wanakana';

import { Icon, type IconName } from '@/components/common/Icon';
import { getSemanticColors } from '@/constants/semantic-colors';
import {
  applyKanjiConversions,
  undoneKanjiConversions,
  type KanjiConversion,
} from '@/core/grammar/kanjiAutoConvert';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';
import { cn } from '@/utils/cn';

export type WanaKanaInputMode = 'kana' | 'english';

/**
 * How the answer reads back. `idle` is the resting/focused field; the other four
 * are the spec's post-submit states — a wrong answer, an answer that is right
 * for a different question (near-miss), and an answer typed in the wrong script.
 */
export type WanaKanaInputState = 'idle' | 'correct' | 'incorrect' | 'near-miss' | 'wrong-script';

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
  state?: WanaKanaInputState;
  /** Single explanation line under the answer — near-miss and wrong-script only. */
  hint?: string;
  /**
   * Kana mode only: kana that turns into kanji as soon as it is typed (grammar
   * Build cards). Pass a stable array — a new one starts a fresh card.
   */
  kanjiConversions?: readonly KanjiConversion[];
  testID?: string;
};

/**
 * Chrome per state. Base hues carry the 1.5px border and the mark (non-text UI);
 * the copy inside sits in the matching `-deep` tone, which is the only step that
 * clears AA on the soft fill.
 */
const STATE_STYLES: Record<
  WanaKanaInputState,
  { container: string; text: string; mark?: IconName }
> = {
  idle: {
    container: 'border-border bg-surface-elevated',
    text: 'text-primary',
  },
  correct: {
    container: 'border-feedback-correct bg-feedback-correct-soft',
    text: 'text-feedback-correct-deep',
    mark: 'correct',
  },
  incorrect: {
    container: 'border-feedback-incorrect bg-feedback-incorrect-soft',
    text: 'text-feedback-incorrect-deep',
    mark: 'close',
  },
  'near-miss': {
    container: 'border-feedback-warning bg-feedback-warning-soft',
    text: 'text-feedback-warning-deep',
  },
  'wrong-script': {
    container: 'border-feedback-info bg-feedback-info-soft',
    text: 'text-feedback-info-deep',
  },
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
      state = 'idle',
      hint,
      kanjiConversions,
      testID,
    },
    ref,
  ) {
    const inputRef = useRef<TextInput>(null);
    // The raw text/placeholder/selection colors must track the exact theme the
    // `bg-surface-elevated`/`text-primary` classNames render with, or typed text
    // can end up near-white on a light input.
    const colors = getSemanticColors(usePaintedColorScheme());
    const [focused, setFocused] = useState(false);
    const styles = STATE_STYLES[state];
    // Focus chrome only applies while the field is still an open question — an
    // answered field keeps its verdict colour.
    const showFocus = state === 'idle' && focused;
    // Conversions the learner undid by deleting their kanji; reset per card.
    const [undone, setUndone] = useState<{
      conversions: readonly KanjiConversion[] | undefined;
      kana: ReadonlySet<string>;
    }>({ conversions: kanjiConversions, kana: new Set() });
    const undoneKana = undone.conversions === kanjiConversions ? undone.kana : new Set<string>();

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
        const kana = wanakana.toKana(text, { IMEMode: true });
        if (!kanjiConversions?.length) {
          onChangeText(kana);
          return;
        }
        const newlyUndone = undoneKanjiConversions(value, kana, kanjiConversions);
        if (newlyUndone.length > 0) {
          setUndone({ conversions: kanjiConversions, kana: new Set([...undoneKana, ...newlyUndone]) });
        }
        onChangeText(applyKanjiConversions(value, kana, kanjiConversions, undoneKana));
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
      <View
        testID={testID ? `${testID}-field` : undefined}
        className={cn(
          'w-full rounded-radius-md border-[1.5px] px-space-md py-space-sm',
          showFocus ? 'border-brand-500 bg-surface-elevated' : styles.container,
        )}>
        {/* The spec's 4px focus halo. React Native shadows have no spread, so
            it is drawn as a ring just outside the field. */}
        {showFocus ? (
          <View
            testID={testID ? `${testID}-focus-halo` : undefined}
            pointerEvents="none"
            className="absolute -inset-1 rounded-radius-md border-4 border-brand-soft-strong"
          />
        ) : null}

        <View className="flex-row items-center gap-space-sm">
          <TextInput
            ref={inputRef}
            testID={testID}
            // Kana answers are Japanese text, so the field wears the JP face.
            className={cn(
              'min-h-[44px] flex-1 text-body',
              mode === 'kana' ? 'font-jp-medium' : 'font-ui-semibold',
              styles.text,
            )}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            // Android pins the first line to the top of the 44px tap target, and
            // the placeholder — unlike the typed value — never gets RN's line
            // height span, so the JP face's tall ascenders clip against the top
            // edge. Centring both lines the placeholder up with the answer.
            textAlignVertical="center"
            // includeFontPadding (Android default: true) reserves extra top/bottom
            // space sized off the font's raw ascent/descent metrics — for Noto
            // Sans JP that band is unusually tall, so on an empty field it pushes
            // the hint past the 44px box before centring even applies. No-op on iOS.
            style={{ includeFontPadding: false }}
            selectionColor={colors.brand}
            value={value}
            onChangeText={handleChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={onSubmit}
            returnKeyType="done"
            submitBehavior="submit"
            editable={editable}
            accessibilityLabel={accessibilityLabel}
            {...englishProps}
          />

          {styles.mark ? (
            <Icon
              name={styles.mark}
              size={20}
              strokeWidth={2.4}
              className={styles.text}
              testID={testID ? `${testID}-mark` : undefined}
            />
          ) : null}
        </View>

        {hint ? (
          <Text
            testID={testID ? `${testID}-hint` : undefined}
            className={cn('mt-space-xs text-caption font-ui-semibold', styles.text)}>
            {hint}
          </Text>
        ) : null}
      </View>
    );
  },
);
