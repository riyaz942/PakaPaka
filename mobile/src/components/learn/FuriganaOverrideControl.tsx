import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import type { FuriganaOverrideMode } from '@/data/user/furiganaOverrideRepository';
import { cn } from '@/utils/cn';

type FuriganaOverrideChoice = 'auto' | FuriganaOverrideMode;

const CHOICES: { value: FuriganaOverrideChoice; label: string }[] = [
  { value: 'auto', label: 'Follow my progress' },
  { value: 'shown', label: 'Always show' },
  { value: 'hidden', label: 'Always hide' },
];

/**
 * Persistent per-word furigana override for one vocabulary item (FR79, AC #3).
 *
 * Deliberately an explicit picker rather than a gesture on the word: tapping
 * the word is the stateless peek (FR79), and a long-press would need a
 * non-gesture alternative anyway (NFR29). "Follow my progress" is the absence
 * of an override — choosing it deletes the row, handing the word back to the
 * SRS default and the global Settings mode.
 */
export function FuriganaOverrideControl({ itemId }: { itemId: string }) {
  const { overrides, setOverride, clearOverride } = useFuriganaPreference();
  const current: FuriganaOverrideChoice = overrides.get(itemId) ?? 'auto';

  function choose(choice: FuriganaOverrideChoice): void {
    if (choice === 'auto') {
      clearOverride(itemId);
      return;
    }
    setOverride(itemId, choice);
  }

  return (
    <View className="mt-4" testID="furigana-override-control">
      <SectionHeading label="Furigana for this word" />
      <View className="mt-2 flex-row flex-wrap gap-2">
        {CHOICES.map((choice) => {
          const selected = current === choice.value;

          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label}
              onPress={() => choose(choice.value)}
              testID={`furigana-override-${choice.value}`}
              className={cn(
                'min-h-[44px] min-w-[44px] justify-center rounded-radius-md bg-surface px-3 py-2',
                selected ? 'border-2 border-feedback-info' : 'border border-border',
              )}>
              <Text className="text-body-sm text-primary">{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
