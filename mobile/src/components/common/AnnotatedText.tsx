import React from 'react';
import { Text } from 'react-native';

import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { cn } from '@/utils/cn';
import { HIGHLIGHT_TAG_RE } from '@/utils/highlightTags';

type Segment = {
  text: string;
  tag: 'radical' | 'part' | 'kanji' | 'vocabulary' | 'reading' | 'grammar' | null;
  /** The character this highlight stands for, when the tag names one. */
  form?: string;
};

/** Splits tagged prose into plain and highlighted runs, in order. */
function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(HIGHLIGHT_TAG_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), tag: null });
    }
    segments.push({ text: match[3], tag: match[1] as Segment['tag'], form: match[2] });
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

/**
 * Each highlight tag's fixed accent. `<radical>` and `<kanji>` take their own
 * content type's; `<vocabulary>` marks the word a vocabulary story lands on, so
 * it takes the vocabulary accent — the same purple the word's own glyph is
 * drawn in, which is what tells the learner "this is the thing being taught"
 * apart from "this is a kanji I already know".
 *
 * `<part>` marks a radical a combination radical is built from — "heavy (重)
 * and power (力)" in the story of 動 "move". Both are radicals, so the part
 * cannot take the radical accent too, or the pieces and the answer would look
 * the same. It takes the brand text colour, already held to AA on every
 * surface.
 */
const TAG_ACCENT = {
  radical: CONTENT_TYPE_ACCENT.radical.deep,
  part: 'text-brand-text',
  kanji: CONTENT_TYPE_ACCENT.kanji.deep,
  vocabulary: CONTENT_TYPE_ACCENT.vocabulary.deep,
  reading: READING_HIGHLIGHT,
  // A grammar mnemonic's meaning. The grammar accent is the reading token's
  // gold, and both tags sit in the same sentence, so the meaning takes the
  // primary text colour: bold is the highlight.
  grammar: 'text-primary',
} as const;

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
 * A tag that names the character it stands for renders it after the word, in
 * parentheses — "a few (少) years (年)" — so the learner reads the English and
 * the character it came from in one pass, instead of holding the English and
 * hunting for which of the word's characters it meant. The glyph takes the same
 * accent as the word it belongs to, in the Japanese face, and the parentheses
 * take it too: an uncoloured bracket would read as punctuation of the sentence
 * rather than part of the highlight.
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
        const color = TAG_ACCENT[segment.tag];
        return (
          <Text key={index} className={cn('font-ui-bold', color)}>
            {segment.text}
            {segment.form ? (
              <Text className={cn('font-jp-bold', color)}> ({segment.form})</Text>
            ) : null}
          </Text>
        );
      })}
    </Text>
  );
}
