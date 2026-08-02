import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { defaultFuriganaVisible, FuriganaText } from '@/components/common/FuriganaText';
import {
  parseLessonMarkdown,
  spansHaveFurigana,
  tokenizeSpans,
  type InlineSpan,
  type LessonBlock,
  type RichToken,
} from '@/core/markdown/parseLessonMarkdown';
import type { FuriganaDisplayMode } from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';

type LessonMarkdownProps = {
  /** Lesson body markdown; Japanese may carry bracket furigana notation. */
  markdown: string;
  mode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
};

const HEADING_CLASS: Record<number, string> = {
  1: 'text-title-lg font-ui-extrabold text-primary',
  2: 'text-title font-ui-extrabold text-primary',
};
const SUBHEADING_CLASS = 'text-body-lg font-ui-bold text-primary';
const PROSE_CLASS = 'text-body font-ui text-primary';

function inlineModifiers(span: Pick<InlineSpan, 'bold' | 'italic' | 'code'>): string | undefined {
  // Weight is a font *family* here, not `font-bold`: the static Google Fonts
  // register one family per weight, so `font-ui font-bold` renders Regular.
  return (
    cn(span.bold && 'font-ui-bold', span.italic && 'italic', span.code && 'font-mono') || undefined
  );
}

/** Ruby column for one annotated JP run inside mixed prose; tap flips the reading. */
function RubyToken({
  token,
  mode,
  knownKanji,
  baseClassName,
  toggled,
  onToggle,
}: {
  token: RichToken;
  mode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
  baseClassName: string;
  toggled: boolean;
  onToggle: () => void;
}) {
  const segment = { text: token.text, reading: token.reading };
  const visibleByDefault = defaultFuriganaVisible(segment, mode, knownKanji);
  const isVisible = toggled ? !visibleByDefault : visibleByDefault;

  return (
    <Pressable accessible={false} onPress={onToggle}>
      <View className="items-center">
        {isVisible ? (
          <Text className="text-center text-furigana font-jp text-secondary" accessible={false}>
            {token.reading}
          </Text>
        ) : null}
        <Text className={cn(baseClassName, inlineModifiers(token))} accessible={false}>
          {token.text}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * One line of prose. Plain lines render as a single nested `<Text>` (native
 * wrapping — the fast path for English paragraphs); lines containing furigana
 * annotations lay out as wrap-safe tokens so readings can float above their
 * kanji runs mid-sentence.
 */
function RichLine({
  spans,
  mode,
  knownKanji,
  baseClassName,
}: {
  spans: InlineSpan[];
  mode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
  baseClassName: string;
}) {
  const hasFurigana = useMemo(() => spansHaveFurigana(spans), [spans]);
  const tokens = useMemo(() => (hasFurigana ? tokenizeSpans(spans) : []), [hasFurigana, spans]);
  const [toggled, setToggled] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setToggled(new Set());
  }, [spans]);

  if (!hasFurigana) {
    return (
      <Text className={baseClassName}>
        {spans.map((span, index) => {
          const modifiers = inlineModifiers(span);
          return modifiers ? (
            <Text key={index} className={modifiers}>
              {span.text}
            </Text>
          ) : (
            <Text key={index}>{span.text}</Text>
          );
        })}
      </Text>
    );
  }

  const plainLabel = tokens.map((token) => token.text).join('');

  const toggleToken = (index: number): void => {
    setToggled((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <View
      className="flex-row flex-wrap items-end gap-y-space-sm"
      accessible
      accessibilityLabel={plainLabel}>
      {tokens.map((token, index) =>
        token.kind === 'ruby' ? (
          <RubyToken
            key={index}
            token={token}
            mode={mode}
            knownKanji={knownKanji}
            baseClassName={baseClassName}
            toggled={toggled.has(index)}
            onToggle={() => toggleToken(index)}
          />
        ) : (
          <Text key={index} className={cn(baseClassName, inlineModifiers(token))} accessible={false}>
            {token.text}
          </Text>
        ),
      )}
    </View>
  );
}

function BlockView({
  block,
  first,
  mode,
  knownKanji,
}: {
  block: LessonBlock;
  first: boolean;
  mode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
}) {
  switch (block.type) {
    case 'heading':
      return (
        <View className={first ? undefined : 'mt-space-lg'}>
          <RichLine
            spans={block.spans}
            mode={mode}
            knownKanji={knownKanji}
            baseClassName={HEADING_CLASS[block.level] ?? SUBHEADING_CLASS}
          />
        </View>
      );
    case 'paragraph':
      return (
        <View className={first ? undefined : 'mt-space-md'}>
          <RichLine
            spans={block.spans}
            mode={mode}
            knownKanji={knownKanji}
            baseClassName={PROSE_CLASS}
          />
        </View>
      );
    case 'callout':
      return (
        <View
          className={cn(
            'border-l-2 border-feedback-info bg-surface pl-space-md pr-space-sm py-space-sm rounded-radius-sm',
            !first && 'mt-space-md',
          )}>
          <RichLine
            spans={block.spans}
            mode={mode}
            knownKanji={knownKanji}
            baseClassName={PROSE_CLASS}
          />
        </View>
      );
    case 'list':
      return (
        <View className={first ? undefined : 'mt-space-md'}>
          {block.items.map((itemSpans, index) => (
            <View key={index} className={cn('flex-row', index > 0 && 'mt-space-sm')}>
              <Text className="mr-space-sm text-body font-ui text-secondary">
                {block.ordered ? `${index + 1}.` : '•'}
              </Text>
              <View className="flex-1">
                <RichLine
                  spans={itemSpans}
                  mode={mode}
                  knownKanji={knownKanji}
                  baseClassName={PROSE_CLASS}
                />
              </View>
            </View>
          ))}
        </View>
      );
    case 'jp':
      return (
        <View
          className={cn(
            'border-l-2 border-content-grammar pl-space-md py-space-xs',
            !first && 'mt-space-md',
          )}>
          {block.lines.map((line, index) => (
            <View key={index} className={index > 0 ? 'mt-space-sm' : undefined}>
              <FuriganaText
                text={line}
                mode={mode}
                knownKanji={knownKanji}
                className="text-body-lg font-jp text-primary"
              />
            </View>
          ))}
        </View>
      );
    case 'code':
      return (
        <View className={cn('bg-surface rounded-radius-sm p-space-md', !first && 'mt-space-md')}>
          <Text className="font-mono text-body-sm text-primary">{block.lines.join('\n')}</Text>
        </View>
      );
    default:
      return null;
  }
}

/**
 * Renders a grammar lesson body (`explanation_markdown`, content pipeline
 * Phase 0.5). Supports the minimal markdown the lesson generator emits —
 * headings, paragraphs, lists, `>` callouts, and ```jp example fences — with
 * furigana bracket notation resolved anywhere Japanese appears.
 */
export function LessonMarkdown({ markdown, mode, knownKanji }: LessonMarkdownProps) {
  const blocks = useMemo(() => parseLessonMarkdown(markdown), [markdown]);

  return (
    <View testID="lesson-markdown">
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          first={index === 0}
          mode={mode}
          knownKanji={knownKanji}
        />
      ))}
    </View>
  );
}
