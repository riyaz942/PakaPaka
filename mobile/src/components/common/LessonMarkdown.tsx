import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { defaultFuriganaVisible } from '@/components/common/FuriganaText';
import { LinkedWord } from '@/components/common/LinkedWord';
import {
  parseLessonMarkdown,
  spansNeedTokens,
  splitWordMarkers,
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
  accessibilityLabel,
}: {
  token: RichToken;
  mode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
  baseClassName: string;
  toggled: boolean;
  onToggle: () => void;
  /** Set when this token speaks for its prose run (see `plainRunLabels`). */
  accessibilityLabel?: string;
}) {
  const segment = { text: token.text, reading: token.reading };
  const visibleByDefault = defaultFuriganaVisible(segment, mode, knownKanji);
  const isVisible = toggled ? !visibleByDefault : visibleByDefault;

  return (
    <Pressable
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onToggle}>
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
 * For a line with linked words: the first token of each run of non-linked
 * tokens → the run's plain text (ruby contributes its base). That token speaks
 * for the run, so prose between the word buttons stays reachable.
 */
function plainRunLabels(tokens: RichToken[]): Map<number, string> {
  const runs = new Map<number, string>();
  let runStart = -1;
  tokens.forEach((token, index) => {
    if (token.kind === 'linked') {
      runStart = -1;
      return;
    }
    if (runStart < 0) {
      runStart = index;
    }
    runs.set(runStart, (runs.get(runStart) ?? '') + token.text);
  });

  const labels = new Map<number, string>();
  for (const [index, text] of runs) {
    if (text.trim()) {
      labels.set(index, text.trim());
    }
  }
  return labels;
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
  const needsTokens = useMemo(() => spansNeedTokens(spans), [spans]);
  const tokens = useMemo(() => (needsTokens ? tokenizeSpans(spans) : []), [needsTokens, spans]);
  const [toggled, setToggled] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setToggled(new Set());
  }, [spans]);

  if (!needsTokens) {
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

  // A line label would swallow the nested word buttons, so a line with a
  // linked word leaves its container non-accessible and each word speaks for
  // itself, with each prose run between the words labelled on its first token.
  const hasLinked = tokens.some((token) => token.kind === 'linked');
  const runLabels = hasLinked ? plainRunLabels(tokens) : new Map<number, string>();

  return (
    <View
      className="flex-row flex-wrap items-end gap-y-space-sm"
      accessible={hasLinked ? undefined : true}
      accessibilityLabel={hasLinked ? undefined : plainLabel}>
      {tokens.map((token, index) => {
        if (token.kind === 'linked') {
          return (
            <LinkedWord
              key={index}
              text={token.text}
              surface={token.surface ?? token.text}
              vocabularyItemId={token.vocabularyItemId ?? ''}
              inflection={token.inflection ?? null}
              textClassName={cn(baseClassName, inlineModifiers(token))}
              testID={`lesson-word-${token.vocabularyItemId}-${index}`}
              trailing={token.trailing}
            />
          );
        }
        if (token.kind === 'ruby') {
          return (
            <RubyToken
              key={index}
              token={token}
              mode={mode}
              knownKanji={knownKanji}
              baseClassName={baseClassName}
              toggled={toggled.has(index)}
              onToggle={() => toggleToken(index)}
              accessibilityLabel={runLabels.get(index)}
            />
          );
        }
        return (
          <Text
            key={index}
            className={cn(baseClassName, inlineModifiers(token))}
            accessible={runLabels.has(index)}
            accessibilityLabel={runLabels.get(index)}>
            {token.text}
          </Text>
        );
      })}
    </View>
  );
}

/** One ```jp line; spans are memoised so a parent re-render keeps ruby peeks. */
function JpLine({
  line,
  mode,
  knownKanji,
}: {
  line: string;
  mode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
}) {
  const spans = useMemo(() => splitWordMarkers(line), [line]);
  return (
    <RichLine
      spans={spans}
      mode={mode}
      knownKanji={knownKanji}
      baseClassName="text-body-lg font-jp text-primary"
    />
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
    case 'table':
      return (
        <View
          className={cn(
            'rounded-radius-md border border-border bg-surface px-space-md py-space-sm',
            !first && 'mt-space-md',
          )}
          testID="lesson-table">
          <View className="flex-row gap-space-sm">
            {block.header.map((cellSpans, cellIndex) => (
              <View key={cellIndex} className="flex-1">
                <RichLine
                  spans={cellSpans}
                  mode={mode}
                  knownKanji={knownKanji}
                  baseClassName="text-body-sm font-ui-medium text-secondary"
                />
              </View>
            ))}
          </View>
          {block.rows.map((row, rowIndex) => (
            <View key={rowIndex} className="mt-space-sm flex-row gap-space-sm">
              {row.map((cellSpans, cellIndex) => (
                <View key={cellIndex} className="flex-1">
                  <RichLine
                    spans={cellSpans}
                    mode={mode}
                    knownKanji={knownKanji}
                    baseClassName={PROSE_CLASS}
                  />
                </View>
              ))}
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
              <JpLine line={line} mode={mode} knownKanji={knownKanji} />
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
 * headings, paragraphs, lists, `>` callouts, pipe tables, and ```jp example fences — with
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
