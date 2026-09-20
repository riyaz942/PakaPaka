import { useEffect, useState } from 'react';
import {
  type AccessibilityRole,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  View,
} from 'react-native';

import { parseFurigana, type FuriganaSegment } from '@/core/furigana/parseFurigana';
import type { FuriganaDisplayMode } from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';

type FuriganaTextProps = {
  /** Annotated (JmdictFurigana bracket notation) or plain Japanese text. */
  text: string;
  mode: FuriganaDisplayMode;
  /**
   * Known characters (from mastered vocabulary), for 'auto' mode on embedded
   * multi-word text where there are no word boundaries to key on.
   */
  knownKanji?: ReadonlySet<string>;
  /**
   * Set only when this component is rendering exactly one vocabulary item's
   * own word (detail hero, lesson hero, passage word sheet): whether the
   * learner has mastered *that word*. In 'auto' mode it decides on its own and
   * the per-character `knownKanji` check is skipped — the mastery unit is the
   * word, never its component kanji (FR78 / BUG6).
   */
  isKnownWord?: boolean;
  /**
   * Text styling (font size/weight/color) for the base-text segments.
   * Must contain only text classes — layout margins leak between the
   * reading and its kanji, so apply those on a wrapping parent instead.
   */
  className?: string;
  /**
   * Inline text style for the base-text segments. Use for sizing that can't rely
   * on a Tailwind token (e.g. a hero fontSize applied on reload without a Metro
   * config rebuild). Same constraint as `className`: text styling only.
   */
  style?: StyleProp<TextStyle>;
  /** Passed through to the container (or plain-text fallback) for a11y parity with a bare <Text>. */
  accessibilityRole?: AccessibilityRole;
  /** Passed through to the container (or plain-text fallback), same as a bare <Text>. */
  testID?: string;
  /**
   * When false, annotated runs render without nested Pressables so a parent
   * Pressable (e.g. passage word spans) can own the tap. Readings still follow
   * `mode` / `knownKanji`; they just are not individually togglable.
   */
  interactive?: boolean;
};

function isSegmentKnown(segment: FuriganaSegment, knownKanji: ReadonlySet<string>): boolean {
  return Array.from(segment.text).every((ch) => knownKanji.has(ch));
}

/** Default reading visibility for one annotated run under the given display mode. */
export function defaultFuriganaVisible(
  segment: FuriganaSegment,
  mode: FuriganaDisplayMode,
  knownKanji: ReadonlySet<string> | undefined,
  isKnownWord?: boolean,
): boolean {
  if (!segment.reading) {
    return false;
  }
  if (mode === 'shown') {
    return true;
  }
  if (mode === 'hidden') {
    return false;
  }
  // 'auto', Tier 1: the caller knows this is one vocabulary item's own word,
  // so that word's mastery is the whole answer.
  if (isKnownWord !== undefined) {
    return !isKnownWord;
  }
  // 'auto', Tier 2 (embedded multi-word text): hidden only once every
  // character in this run appears in vocabulary the learner has mastered.
  if (!knownKanji) {
    return true;
  }
  return !isSegmentKnown(segment, knownKanji);
}

/**
 * Whether a word's furigana is currently visible to the learner, given its
 * resolved display mode — the per-segment logic above, applied to a whole word,
 * so a long-press toggle flips what is actually on screen rather than the raw
 * 'auto'/'shown'/'hidden' preference value (14.2).
 *
 * Shared by every surface that owns the long-press toggle: passages, example
 * sentences, and chat replies (15.2).
 */
export function isWordFuriganaVisible(
  text: string,
  mode: FuriganaDisplayMode,
  knownKanji: ReadonlySet<string>,
  isKnownWord?: boolean,
): boolean {
  return parseFurigana(text).some(
    (segment) => segment.reading && defaultFuriganaVisible(segment, mode, knownKanji, isKnownWord),
  );
}

/**
 * Renders annotated Japanese text with furigana readings above kanji runs.
 * Each annotated run is individually tappable to flip its reading's
 * visibility, overriding the computed default for that run only (resets
 * when `text` or `mode` changes). Falls back to a plain `<Text>` when there's
 * nothing to annotate, so plain strings and not-yet-annotated content keep
 * working.
 */
export function FuriganaText({
  text,
  mode,
  knownKanji,
  isKnownWord,
  className,
  style,
  accessibilityRole,
  testID,
  interactive = true,
}: FuriganaTextProps) {
  const segments = parseFurigana(text);
  // Peeked runs hold an *explicit* visibility, not "invert the default": a
  // stored inversion outlives the default it was taken against, so a later
  // mode change (per-word override or Settings) would flip back to the state
  // the learner just asked to leave.
  const [peeked, setPeeked] = useState<Map<number, boolean>>(() => new Map());

  useEffect(() => {
    setPeeked(new Map());
  }, [text, mode]);

  const hasReadings = segments.some((segment) => segment.reading);
  if (!hasReadings) {
    return (
      <Text
        className={className}
        style={style}
        accessibilityRole={accessibilityRole}
        testID={testID}>
        {text}
      </Text>
    );
  }

  const plainLabel = segments.map((segment) => segment.text).join('');

  // The `text-furigana` token (9px) reads fine against body-sized text, but
  // hero-sized prompts (review glyphs, lesson/detail heroes) pass an explicit
  // `style.fontSize` far above body scale — at those sizes a fixed 9px reading
  // is illegibly small relative to the kanji it annotates. Scale the reading
  // proportionally to that base size instead; className-only callers (body
  // text) are untouched and keep the fixed token.
  const baseFontSize = StyleSheet.flatten(style)?.fontSize;
  const furiganaStyle =
    typeof baseFontSize === 'number'
      ? { fontSize: Math.round(baseFontSize * 0.34), lineHeight: Math.round(baseFontSize * 0.37) }
      : undefined;

  function peekSegment(index: number, visible: boolean): void {
    setPeeked((previous) => {
      const next = new Map(previous);
      next.set(index, visible);
      return next;
    });
  }

  return (
    <View
      // items-end keeps base text on a shared baseline while readings float
      // above; gap-y separates wrapped lines so a line's furigana never
      // collides with the text of the line above it.
      className="flex-row flex-wrap items-end gap-y-space-sm"
      testID={testID}
      // When nested under a parent Pressable, stay non-accessible so the
      // parent's button role/label is what screen readers hit.
      accessible={interactive}
      accessibilityRole={interactive ? accessibilityRole : undefined}
      accessibilityLabel={interactive ? plainLabel : undefined}>
      {segments.map((segment, index) => {
        if (!segment.reading) {
          return (
            <Text key={index} className={className} style={style} accessible={false}>
              {segment.text}
            </Text>
          );
        }

        const visibleByDefault = defaultFuriganaVisible(segment, mode, knownKanji, isKnownWord);
        // The tap is a stateless peek (FR79): it flips this render's default
        // and resets on `text` / `mode` change — it never persists.
        const peek = interactive ? peeked.get(index) : undefined;
        const isVisible = peek ?? visibleByDefault;

        const readingBlock = (
          <View className="items-center">
            {isVisible ? (
              <Text
                className={cn(
                  'text-center font-jp text-secondary',
                  !furiganaStyle && 'text-furigana',
                )}
                style={furiganaStyle}
                accessible={false}>
                {segment.reading}
              </Text>
            ) : null}
            <Text className={className} style={style} accessible={false}>
              {segment.text}
            </Text>
          </View>
        );

        if (!interactive) {
          return (
            <View key={index} accessible={false}>
              {readingBlock}
            </View>
          );
        }

        return (
          <Pressable key={index} accessible={false} onPress={() => peekSegment(index, !isVisible)}>
            {readingBlock}
          </Pressable>
        );
      })}
    </View>
  );
}
