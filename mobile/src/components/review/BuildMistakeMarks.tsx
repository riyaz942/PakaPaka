import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { explainMistake } from '@/core/grammar/mistakes/explainMistake';
import type { BuildDiagnosis } from '@/core/grammar/mistakes/mistake.types';
import { cn } from '@/utils/cn';

type BuildMistakeMarksProps = {
  input: string;
  diagnosis: BuildDiagnosis | null;
  grammarLabel: string;
};

const LABEL_CLASS = 'text-overline font-ui-bold uppercase tracking-[0.08em] text-faint';

/**
 * The learner's Build sentence with each mistake marked; the tapped mark's
 * explanation sits in a box below, with a pointer up to it. Mistakes with no
 * place (word order) show as plain lines under the box.
 */
export function BuildMistakeMarks({ input, diagnosis, grammarLabel }: BuildMistakeMarksProps) {
  const [selected, setSelected] = useState(0);
  // Horizontal centre of each mark inside the sentence row, for the box pointer.
  const [centers, setCenters] = useState<Record<number, number>>({});

  const marks = diagnosis?.marks ?? [];
  const lines = diagnosis?.lines ?? [];
  const explanations = marks.map((mark) => explainMistake(mark, grammarLabel));

  const onMarkLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setCenters((prev) => ({ ...prev, [index]: x + width / 2 }));
  };

  const parts: ReactNode[] = [];
  let cursor = 0;
  marks.forEach((mark, i) => {
    if (mark.rawStart > cursor) {
      parts.push(
        <Text key={`text-${i}`} className="text-body-lg font-jp-medium text-primary">
          {input.slice(cursor, mark.rawStart)}
        </Text>,
      );
    }
    const isSelected = i === selected;
    const isGap = mark.rawStart === mark.rawEnd;
    parts.push(
      <Pressable
        key={`mark-${i}`}
        testID={`build-mistake-mark-${i}`}
        accessibilityRole="button"
        accessibilityLabel={explanations[i]}
        accessibilityState={{ selected: isSelected }}
        onPress={() => setSelected(i)}
        onLayout={onMarkLayout(i)}
        className={cn(
          'min-h-[44px] items-center justify-center',
          isGap
            ? cn(
                'min-w-[24px]',
                isSelected
                  ? 'border-2 border-b-4 border-feedback-incorrect-deep'
                  : 'border-b-2 border-feedback-incorrect',
              )
            : cn(
                'rounded-radius-md border-2 px-space-xs',
                isSelected
                  ? 'border-feedback-incorrect-deep bg-feedback-incorrect-fill'
                  : 'border-transparent bg-feedback-incorrect-soft',
              ),
        )}>
        {isGap ? null : (
          <Text
            className={cn(
              'text-body-lg font-jp-medium',
              isSelected ? 'text-on-primary' : 'text-feedback-incorrect-deep',
            )}>
            {mark.typed}
          </Text>
        )}
      </Pressable>,
    );
    cursor = mark.rawEnd;
  });
  if (cursor < input.length || marks.length === 0) {
    parts.push(
      <Text key="text-end" className="text-body-lg font-jp-medium text-primary">
        {input.slice(cursor)}
      </Text>,
    );
  }

  return (
    <View className="w-full gap-space-sm">
      <Text className={LABEL_CLASS}>
        {marks.length > 0 ? 'YOUR ANSWER — TAP A MARK' : 'YOUR ANSWER'}
      </Text>
      <View className="flex-row flex-wrap items-center">{parts}</View>
      {marks.length > 0 ? (
        <View className="rounded-radius-md border-2 border-feedback-incorrect bg-feedback-incorrect-soft p-space-md">
          <View
            className="absolute -top-[8px] h-[12px] w-[12px] rotate-45 border-l-2 border-t-2 border-feedback-incorrect bg-feedback-incorrect-soft"
            style={{ left: (centers[selected] ?? 0) - 6 }}
          />
          <Text className="text-body font-ui text-feedback-incorrect-deep">
            {explanations[selected]}
          </Text>
          <Text className="text-right text-caption font-ui-semibold text-feedback-incorrect-deep">
            {selected + 1} of {marks.length}
          </Text>
        </View>
      ) : null}
      {lines.map((line, i) => (
        <Text key={`line-${i}`} className="text-body font-ui text-primary">
          {explainMistake(line, grammarLabel)}
        </Text>
      ))}
    </View>
  );
}
