import React from 'react';
import { Text } from 'react-native';

import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
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

/**
 * The `<reading>` highlight's own color. A mnemonic marks three different
 * things — a borrowed component, the item's own meaning, and the sound — so
 * they need three colors. Taking the item's own accent (the old rule) made the
 * sound and the meaning both `content-kanji` on a kanji, which is exactly where
 * the two are quizzed apart.
 */
const READING_HIGHLIGHT = 'text-mnemonic-reading';

type AnnotatedTextProps = {
  text: string;
  className?: string;
  testID?: string;
};

/**
 * Mnemonic prose with its highlight tags rendered in the content accent colors.
 *
 * Each tag has one fixed color, whatever item the prose belongs to: `<radical>`
 * is the radical accent, `<kanji>` the kanji accent, `<reading>` its own token.
 * The tag says which of the three ideas a word is, and that has to look the
 * same everywhere the learner meets it.
 *
 * Untagged strings — every pre-Rev-2 mnemonic, and every description — pass
 * through unchanged, so this is safe to use wherever curriculum prose renders.
 */
export function AnnotatedText({ text, className, testID }: AnnotatedTextProps) {
  const segments = parseSegments(text);

  return (
    <Text className={className} testID={testID}>
      {segments.map((segment, index) => {
        if (!segment.tag) {
          return <Text key={index}>{segment.text}</Text>;
        }
        // The spec sets highlights in the base hue; on a plain background that
        // never clears AA for 14px bold copy, so they take the `-deep` step —
        // the same rule Stats follows for stage-coloured labels. The reading
        // token is already that step, so it carries no `-deep` twin.
        const color =
          segment.tag === 'reading'
            ? READING_HIGHLIGHT
            : CONTENT_TYPE_ACCENT[segment.tag === 'radical' ? 'radical' : 'kanji'].deep;
        return (
          <Text key={index} className={cn('font-ui-bold', color)}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
