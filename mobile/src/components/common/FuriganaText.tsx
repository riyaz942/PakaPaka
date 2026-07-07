import { useEffect, useState } from 'react';
import { type AccessibilityRole, Pressable, Text, View } from 'react-native';

import { parseFurigana, type FuriganaSegment } from '@/core/furigana/parseFurigana';
import type { FuriganaDisplayMode } from '@/data/user/preferencesRepository';

type FuriganaTextProps = {
  /** Annotated (JmdictFurigana bracket notation) or plain Japanese text. */
  text: string;
  mode: FuriganaDisplayMode;
  /** Known kanji characters, required for 'auto' mode. */
  knownKanji?: ReadonlySet<string>;
  /**
   * Text styling (font size/weight/color) for the base-text segments.
   * Must contain only text classes — layout margins leak between the
   * reading and its kanji, so apply those on a wrapping parent instead.
   */
  className?: string;
  /** Passed through to the container (or plain-text fallback) for a11y parity with a bare <Text>. */
  accessibilityRole?: AccessibilityRole;
};

function isSegmentKnown(segment: FuriganaSegment, knownKanji: ReadonlySet<string>): boolean {
  return Array.from(segment.text).every((ch) => knownKanji.has(ch));
}

function defaultVisible(
  segment: FuriganaSegment,
  mode: FuriganaDisplayMode,
  knownKanji: ReadonlySet<string> | undefined,
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
  // 'auto': hidden only once every kanji character in this run is known.
  if (!knownKanji) {
    return true;
  }
  return !isSegmentKnown(segment, knownKanji);
}

/**
 * Renders annotated Japanese text with furigana readings above kanji runs.
 * Each annotated run is individually tappable to flip its reading's
 * visibility, overriding the computed default for that run only (resets
 * when `text` changes). Falls back to a plain `<Text>` when there's nothing
 * to annotate, so plain strings and not-yet-annotated content keep working.
 */
export function FuriganaText({
  text,
  mode,
  knownKanji,
  className,
  accessibilityRole,
}: FuriganaTextProps) {
  const segments = parseFurigana(text);
  const [toggled, setToggled] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setToggled(new Set());
  }, [text]);

  const hasReadings = segments.some((segment) => segment.reading);
  if (!hasReadings) {
    return (
      <Text className={className} accessibilityRole={accessibilityRole}>
        {text}
      </Text>
    );
  }

  const plainLabel = segments.map((segment) => segment.text).join('');

  function toggleSegment(index: number): void {
    setToggled((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <View
      // items-end keeps base text on a shared baseline while readings float
      // above; gap-y separates wrapped lines so a line's furigana never
      // collides with the text of the line above it.
      className="flex-row flex-wrap items-end gap-y-space-sm"
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={plainLabel}>
      {segments.map((segment, index) => {
        if (!segment.reading) {
          return (
            <Text key={index} className={className} accessible={false}>
              {segment.text}
            </Text>
          );
        }

        const isVisible = toggled.has(index)
          ? !defaultVisible(segment, mode, knownKanji)
          : defaultVisible(segment, mode, knownKanji);

        return (
          <Pressable key={index} accessible={false} onPress={() => toggleSegment(index)}>
            <View className="items-center">
              {isVisible ? (
                <Text className="text-furigana text-secondary text-center" accessible={false}>
                  {segment.reading}
                </Text>
              ) : null}
              <Text className={className} accessible={false}>
                {segment.text}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
