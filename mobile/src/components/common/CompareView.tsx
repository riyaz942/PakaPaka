import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { SectionHeading } from '@/components/common/SectionHeading';
import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  KanjiReading,
} from '@/data/curriculum/itemRepository';
import { useComponentParents } from '@/data/hooks/useComponentParents';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';
import { useItemDetail } from '@/data/hooks/useItemDetail';
import { cn } from '@/utils/cn';

type CompareViewProps = {
  leftId: string | undefined;
  rightId: string | undefined;
};

type Side = 'left' | 'right';

/** Short-attribute reading label for Compare (AC #4 / FR80). */
export function formatCompareReading(
  item: CurriculumItemDetail,
  kanjiReadings: KanjiReading[] | null,
  acceptedAnswers: AcceptedAnswer[],
): string {
  if (item.itemType === 'kanji') {
    const readings = (kanjiReadings ?? []).map((reading) => reading.reading);
    return readings.length > 0 ? readings.join(' · ') : '—';
  }

  const readings = acceptedAnswers
    .filter((answer) => answer.answerType === 'reading' || answer.answerType === 'production')
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((answer) => answer.answerText);

  return readings.length > 0 ? readings.join(' · ') : '—';
}

function CompareGlyph({ item, side }: { item: CurriculumItemDetail; side: Side }) {
  const { modeForItem } = useFuriganaPreference();
  const isKnownWord = useIsKnownWord(item.itemType === 'vocabulary' ? item.id : null);
  const accent = CONTENT_TYPE_ACCENT[item.itemType];
  const isLongForm = item.primaryForm.length > 3;

  return (
    <View className="flex-1 items-center gap-space-xs" testID={`compare-glyph-${side}`}>
      {item.itemType === 'vocabulary' ? (
        <FuriganaText
          text={item.furigana ?? item.primaryForm}
          mode={modeForItem(item.id)}
          isKnownWord={isKnownWord}
          className={accent.text}
          style={isLongForm ? { fontSize: 28, lineHeight: 34 } : { fontSize: 40, lineHeight: 46 }}
        />
      ) : (
        <Text
          className={cn('text-center font-bold', accent.text)}
          style={isLongForm ? { fontSize: 28, lineHeight: 34 } : { fontSize: 40, lineHeight: 46 }}>
          {item.primaryForm}
        </Text>
      )}
      <Text className="text-overline text-secondary">{CONTENT_TYPE_LABEL[item.itemType]}</Text>
    </View>
  );
}

/** One short attribute, the two items' values side by side. */
function AttributeRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <View className="mt-3">
      <Text className="text-caption text-secondary">{label}</Text>
      <View className="mt-1 flex-row gap-space-md">
        <Text className="flex-1 text-body text-primary">{left}</Text>
        <Text className="flex-1 text-body text-primary">{right}</Text>
      </View>
    </View>
  );
}

function ComponentChips({
  parents,
  sharedIds,
  side,
}: {
  parents: CurriculumParentItem[];
  sharedIds: ReadonlySet<string>;
  side: Side;
}) {
  if (parents.length === 0) {
    // Same empty-state policy as CrossReferenceSection: no empty shells.
    return <View className="flex-1" />;
  }

  return (
    <View className="flex-1 flex-row flex-wrap gap-2">
      {parents.map((parent) => {
        const shared = sharedIds.has(parent.id);

        return (
          <View
            key={parent.id}
            testID={`compare-chip-${side}-${parent.id}`}
            accessibilityLabel={
              shared ? `${parent.primaryForm}, shared component` : parent.primaryForm
            }
            className={cn(
              'min-h-[44px] min-w-[44px] justify-center rounded-radius-md bg-surface px-3 py-2',
              // Shared parts recede via secondary text (not opacity) so labels
              // stay readable while differences still stand out.
              shared ? 'border border-border' : 'border border-transparent',
            )}>
            <Text className={cn('text-body', shared ? 'text-secondary' : 'text-primary')}>
              {parent.primaryForm}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Prose({
  item,
  side,
}: {
  item: CurriculumItemDetail;
  side: Side;
}) {
  if (!item.mnemonicText) {
    return null;
  }

  return (
    <View className="mt-3" testID={`compare-prose-${side}`}>
      <Text className="text-caption text-secondary">{item.primaryForm}</Text>
      <Text className="mt-1 text-body text-primary">{item.mnemonicText}</Text>
    </View>
  );
}

/**
 * Side-by-side comparison of two items (FR80, UX-DR18).
 *
 * Shared by both entry points: the review answer-collision link
 * (`review/compare`) and the Browse details picker (`browse/compare`). It owns
 * no routing of its own, so neither surface has to mount the other's provider.
 *
 * Layout follows FR80: glyphs pinned above the scroll so they stay next to
 * whatever attribute you scrolled to, short attributes in two columns, prose
 * stacked (side-by-side paragraphs are unreadable at phone width), and
 * component chips with the parts both items share dimmed.
 */
export function CompareView({ leftId, rightId }: CompareViewProps) {
  const left = useItemDetail(leftId ?? null);
  const right = useItemDetail(rightId ?? null);
  const leftParents = useComponentParents(left.item?.id ?? null, left.item?.itemType ?? null);
  const rightParents = useComponentParents(right.item?.id ?? null, right.item?.itemType ?? null);

  if (left.loading || right.loading) {
    return (
      <View className="flex-1 items-center justify-center" testID="compare-loading">
        <Text className="text-body text-secondary">Loading comparison…</Text>
      </View>
    );
  }

  const leftItem = left.item;
  const rightItem = right.item;

  if (!leftItem || !rightItem) {
    return (
      <View
        className="flex-1 items-center justify-center px-space-lg"
        testID="compare-unavailable">
        <Text className="text-body text-secondary text-center">
          Comparison needs two items. One of them could not be found.
        </Text>
      </View>
    );
  }

  const rightParentIds = new Set(rightParents.map((parent) => parent.id));
  const sharedIds = new Set(
    leftParents.map((parent) => parent.id).filter((id) => rightParentIds.has(id)),
  );
  const hasComponents = leftParents.length > 0 || rightParents.length > 0;
  const hasProse = Boolean(leftItem.mnemonicText || rightItem.mnemonicText);

  return (
    <View className="flex-1">
      <View
        className="flex-row gap-space-md border-b border-border px-space-lg py-space-md"
        testID="compare-glyph-row">
        <CompareGlyph item={leftItem} side="left" />
        <CompareGlyph item={rightItem} side="right" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-space-lg pt-space-md pb-space-2xl"
        testID="compare-scroll">
        <AttributeRow label="Meaning" left={leftItem.meaning} right={rightItem.meaning} />
        <AttributeRow
          label="Reading"
          left={formatCompareReading(leftItem, left.kanjiReadings, left.acceptedAnswers)}
          right={formatCompareReading(rightItem, right.kanjiReadings, right.acceptedAnswers)}
        />
        <AttributeRow
          label="Type"
          left={CONTENT_TYPE_LABEL[leftItem.itemType]}
          right={CONTENT_TYPE_LABEL[rightItem.itemType]}
        />
        <AttributeRow label="Level" left={leftItem.jlptLevel} right={rightItem.jlptLevel} />

        {hasComponents ? (
          <View className="mt-4">
            <SectionHeading label="Components" />
            <Text className="mt-1 text-caption text-secondary">
              Parts both items share are dimmed.
            </Text>
            <View className="mt-2 flex-row gap-space-md">
              <ComponentChips parents={leftParents} sharedIds={sharedIds} side="left" />
              <ComponentChips parents={rightParents} sharedIds={sharedIds} side="right" />
            </View>
          </View>
        ) : null}

        {hasProse ? (
          <View className="mt-4">
            <SectionHeading label="Mnemonics" />
            <Prose item={leftItem} side="left" />
            <Prose item={rightItem} side="right" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
