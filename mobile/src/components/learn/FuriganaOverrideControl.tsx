import React from 'react';
import { View } from 'react-native';

import { GuidanceInfoButton } from '@/components/common/GuidanceInfoButton';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SegmentedPill, type SegmentedPillOption } from '@/components/common/SegmentedPill';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import type { FuriganaOverrideMode } from '@/data/user/furiganaOverrideRepository';

type FuriganaOverrideChoice = 'auto' | FuriganaOverrideMode;

const CHOICES: readonly SegmentedPillOption<FuriganaOverrideChoice>[] = [
  { value: 'auto', label: 'Follow progress', testID: 'furigana-override-auto' },
  { value: 'shown', label: 'Always show', testID: 'furigana-override-shown' },
  { value: 'hidden', label: 'Hide', testID: 'furigana-override-hidden' },
];

/**
 * Persistent per-word furigana override for one vocabulary item (FR79, AC #3).
 *
 * Deliberately an explicit picker rather than a gesture on the word: tapping
 * the word is the stateless peek (FR79), and a long-press would need a
 * non-gesture alternative anyway (NFR29). "Follow progress" is the absence
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
    <View className="mt-space-md" testID="furigana-override-control">
      <View className="flex-row items-center gap-space-xs">
        <SectionHeading label="Furigana for this word" />
        <GuidanceInfoButton cardId="furigana-auto-hide" />
      </View>
      <SegmentedPill
        className="mt-space-sm"
        expand
        options={CHOICES}
        value={current}
        onChange={choose}
        accessibilityLabel="Furigana for this word"
      />
    </View>
  );
}
