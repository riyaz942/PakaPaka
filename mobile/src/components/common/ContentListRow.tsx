import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlyphText } from '@/components/common/GlyphText';
import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { SRSStageDot } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT, PASSAGE_CONTENT_ACCENT } from '@/constants/contentType';
import type { SRSStageLabel } from '@/core/srs/srs.types';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';
import { heroFontClassForWeight } from '@/utils/heroGlyphFont';

type ContentListRowProps = {
  /** `passage` rows share the list but are not curriculum items (FR63). */
  rowType: ItemType | 'passage';
  /** The Japanese form, set in Zen Kaku Gothic New at the type's base hue. */
  glyph?: string;
  title: string;
  caption?: string;
  /** Second caption line — the passage rows' English half of FR66's bilingual summary. */
  captionSecondary?: string;
  srsStage?: SRSStageLabel;
  /** Trailing pill that replaces the type badge — e.g. a passage's "9 to go". */
  trailingLabel?: string;
  trailingClassName?: string;
  trailingTextClassName?: string;
  trailingTestID?: string;
  /** Names the type on its own pill, where the caption does not already say it. */
  showTypeBadge?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Japanese forms run from one character to seven, so the glyph steps down a
 * size rather than truncating: a whole word stays readable next to a single
 * kanji without either one pushing the title out of the row.
 */
function glyphSizeClass(glyph: string): string {
  const length = Array.from(glyph).length;
  if (length <= 2) return 'text-title';
  if (length <= 4) return 'text-body-lg';
  return 'text-body';
}

/**
 * The one Browse-style row: a 5px colour edge naming the content type, the
 * glyph in that hue, title and caption, then a trailing badge and stage dot.
 * The edge is a filled strip rather than a border so it reaches the row's full
 * height regardless of how the content wraps.
 */
export function ContentListRow({
  rowType,
  glyph,
  title,
  caption,
  captionSecondary,
  srsStage,
  trailingLabel,
  trailingClassName,
  trailingTextClassName,
  trailingTestID,
  showTypeBadge = false,
  onPress,
  accessibilityLabel,
  testID,
}: ContentListRowProps) {
  const isPassage = rowType === 'passage';
  const accent = isPassage ? PASSAGE_CONTENT_ACCENT : CONTENT_TYPE_ACCENT[rowType];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      className="min-h-[56px] flex-row items-stretch border-b border-border bg-surface">
      <View testID={testID ? `${testID}-edge` : undefined} className={cn('w-[5px]', accent.edge)} />

      <View className="flex-1 flex-row items-center gap-space-sm px-space-md py-space-sm">
        {glyph ? (
          <GlyphText
            numberOfLines={1}
            className={cn(
              'min-w-9 max-w-[120px]',
              heroFontClassForWeight(glyph, 'bold'),
              glyphSizeClass(glyph),
              accent.glyph,
            )}>
            {glyph}
          </GlyphText>
        ) : null}

        <View className="flex-1">
          <Text
            className={cn(
              'text-body font-ui-semibold',
              // A passage leads with its Japanese title, so it takes the type's
              // deep tone; item rows lead with an English meaning in ink.
              isPassage ? `font-jp-bold ${accent.deep}` : 'text-primary',
            )}>
            {title}
          </Text>
          {caption ? (
            <Text
              numberOfLines={2}
              className={cn(
                'mt-[2px] text-caption',
                isPassage ? 'font-jp-medium text-secondary' : 'font-ui-medium text-muted',
              )}>
              {caption}
            </Text>
          ) : null}
          {captionSecondary ? (
            <Text numberOfLines={1} className="mt-[2px] text-caption font-ui-medium text-muted">
              {captionSecondary}
            </Text>
          ) : null}
        </View>

        {trailingLabel ? (
          <View
            testID={trailingTestID}
            className={cn(
              'rounded-radius-full px-space-sm py-[3px]',
              trailingClassName ?? 'bg-surface-elevated',
            )}>
            <Text
              className={cn('text-overline font-ui-bold', trailingTextClassName ?? 'text-secondary')}>
              {trailingLabel}
            </Text>
          </View>
        ) : showTypeBadge && !isPassage ? (
          <ContentTypeBadge itemType={rowType} />
        ) : null}

        {srsStage ? <SRSStageDot stage={srsStage} /> : null}
      </View>
    </Pressable>
  );
}
