import React from 'react';
import { Text, View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
import { ContentPlaceholderNotice } from '@/components/common/ContentPlaceholderNotice';
import { LinkedWord } from '@/components/common/LinkedWord';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MNEMONIC_PROSE } from '@/components/learn/ItemMnemonicSections';
import type { WordInflection } from '@/core/content/inflection';
import { WORD_MARKER_RE } from '@/core/markdown/parseLessonMarkdown';
import { cn } from '@/utils/cn';

type GrammarMnemonicBlockProps = {
  mnemonicText: string | null;
};

/** The story, then the example: the last Japanese run, tags and word markers included. */
const EXAMPLE_RE = /(?:^|\s)((?:[぀-ヿ㐀-䶿一-鿿々〆ー、]|<\/?reading>|\{\{[^{}]*\}\})+。)\s*$/;

const EXAMPLE_TOKEN_RE = new RegExp(`${WORD_MARKER_RE.source}|<reading>(.*?)</reading>`, 'g');

const EXAMPLE_CLASS = 'text-body-lg font-jp-medium';

type ExampleToken =
  | { kind: 'text'; text: string }
  | { kind: 'reading'; text: string }
  | { kind: 'linked'; text: string; itemId: string; inflection: WordInflection | null };

function parseExample(example: string): ExampleToken[] {
  const tokens: ExampleToken[] = [];
  let cursor = 0;
  for (const match of example.matchAll(EXAMPLE_TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      tokens.push({ kind: 'text', text: example.slice(cursor, start) });
    }
    if (match[1] !== undefined) {
      tokens.push({
        kind: 'linked',
        itemId: match[1],
        inflection: (match[2] || null) as WordInflection | null,
        text: match[3],
      });
    } else {
      tokens.push({ kind: 'reading', text: match[4] });
    }
    cursor = start + match[0].length;
  }
  if (cursor < example.length) {
    tokens.push({ kind: 'text', text: example.slice(cursor) });
  }
  return tokens;
}

/**
 * The mnemonic's Japanese example. Its taught words are tappable, like the
 * words of a lesson; the grammar form stays the gold sound highlight.
 */
function MnemonicExample({ example }: { example: string }) {
  return (
    <View
      className="mt-space-sm flex-row flex-wrap items-end"
      testID="grammar-mnemonic-example">
      {parseExample(example).map((token, index) => {
        if (token.kind === 'linked') {
          return (
            <LinkedWord
              key={index}
              text={token.text}
              surface={token.text}
              vocabularyItemId={token.itemId}
              inflection={token.inflection}
              textClassName={EXAMPLE_CLASS}
              testID={`grammar-mnemonic-word-${token.itemId}-${index}`}
            />
          );
        }
        return (
          <Text
            key={index}
            className={cn(
              EXAMPLE_CLASS,
              token.kind === 'reading' ? 'font-jp-bold text-mnemonic-reading' : 'text-primary',
            )}>
            {token.text}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * A grammar point's curriculum mnemonic (grammar mnemonics spec §7): a short
 * story in which an English sound-alike of the form is its meaning, ending on a
 * Japanese example. Every N5/N4 point gets one, so a missing one is content the
 * pipeline has not reached yet and says so, the same as a vocabulary word.
 */
export function GrammarMnemonicBlock({ mnemonicText }: GrammarMnemonicBlockProps) {
  const match = mnemonicText ? EXAMPLE_RE.exec(mnemonicText) : null;

  return (
    <View
      className="mt-space-md"
      testID={mnemonicText ? 'grammar-mnemonic' : 'grammar-mnemonic-placeholder'}>
      <SectionHeading label="Mnemonic" />
      {mnemonicText && match ? (
        <>
          <AnnotatedText
            text={mnemonicText.slice(0, match.index).trimEnd()}
            className={MNEMONIC_PROSE}
          />
          <MnemonicExample example={match[1]} />
        </>
      ) : mnemonicText ? (
        <AnnotatedText text={mnemonicText} className={MNEMONIC_PROSE} />
      ) : (
        <ContentPlaceholderNotice label="Mnemonic coming soon" />
      )}
    </View>
  );
}
