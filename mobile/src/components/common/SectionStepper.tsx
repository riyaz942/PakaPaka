import React from 'react';
import { Text, View } from 'react-native';

import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type SectionStepperProps = {
  /** Section names in order, e.g. INTRO · MNEMONIC · EXAMPLES. */
  sections: readonly string[];
  /** 0-based index of the section on screen. */
  activeIndex: number;
  /** Fills the active pill with the item's type colour. */
  itemType?: ItemType;
  testID?: string;
};

/**
 * The lesson's three paced sections, as equal-width pills. The active one is
 * tinted in the item's content type; the rest stay quiet on surface-elevated.
 * Read-only — the lesson advances sections, this only reports where you are.
 *
 * The spec fills the active pill with the type's *base* hue and sets the label
 * in white. No content hue clears AA against white in both themes (blue 3.9,
 * gold 3.4, and every hue below 3 in dark), so the pill uses the soft/deep
 * pairing the rest of the type system uses for coloured text.
 */
export function SectionStepper({
  sections,
  activeIndex,
  itemType,
  testID,
}: SectionStepperProps) {
  const accent = itemType ? CONTENT_TYPE_ACCENT[itemType] : undefined;

  return (
    <View
      accessible
      accessibilityLabel={`Section ${activeIndex + 1} of ${sections.length}: ${sections[activeIndex] ?? ''}`}
      className="flex-row gap-space-sm"
      testID={testID}>
      {sections.map((section, index) => {
        const isActive = index === activeIndex;
        return (
          <View
            key={section}
            testID={testID ? `${testID}-${index}` : undefined}
            className={cn(
              'flex-1 items-center rounded-radius-full px-space-xs py-[9px]',
              isActive ? (accent?.soft ?? 'bg-brand-soft') : 'bg-surface-elevated',
            )}>
            <Text
              className={cn(
                'text-overline font-ui-bold uppercase tracking-[0.06em]',
                isActive ? (accent?.deep ?? 'text-brand-text') : 'text-faint',
              )}>
              {section}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
