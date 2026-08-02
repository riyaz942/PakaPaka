import React from 'react';
import { Text } from 'react-native';

import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';
import { HIGHLIGHT_TAG_RE } from '@/utils/highlightTags';

type Segment = { text: string; tag: 'radical' | 'kanji' | 'reading' | null };

/** Splits tagged prose into plain and highlighted runs, in order. */
function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(HIGHLIGHT_TAG_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), tag: null });
    }
    segments.push({ text: match[2], tag: match[1] as Segment['tag'] });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), tag: null });
  }
  return segments;
}

type AnnotatedTextProps = {
  text: string;
  /**
   * The item the prose belongs to. A `<reading>` highlight takes this item's
   * accent — the sound is part of the item itself, not borrowed from a layer
   * below the way `<radical>` and `<kanji>` are.
   */
  itemType: ItemType;
  className?: string;
  testID?: string;
};

/**
 * Mnemonic prose with its highlight tags rendered in the content accent colors.
 *
 * Untagged strings — every pre-Rev-2 mnemonic, and every description — pass
 * through unchanged, so this is safe to use wherever curriculum prose renders.
 */
export function AnnotatedText({ text, itemType, className, testID }: AnnotatedTextProps) {
  const segments = parseSegments(text);

  return (
    <Text className={className} testID={testID}>
      {segments.map((segment, index) => {
        if (!segment.tag) {
          return <Text key={index}>{segment.text}</Text>;
        }
        const accent =
          segment.tag === 'reading'
            ? CONTENT_TYPE_ACCENT[itemType]
            : CONTENT_TYPE_ACCENT[segment.tag === 'radical' ? 'radical' : 'kanji'];
        // The spec sets highlights in the base hue; on a plain background that
        // never clears AA for 14px bold copy, so they take the `-deep` step —
        // the same rule Stats follows for stage-coloured labels.
        return (
          <Text key={index} className={cn('font-ui-bold', accent.deep)}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
