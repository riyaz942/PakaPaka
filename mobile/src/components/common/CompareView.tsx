import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GlyphText } from '@/components/common/GlyphText';
import { AnnotatedText } from '@/components/common/AnnotatedText';
import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { FuriganaText } from '@/components/common/FuriganaText';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MNEMONIC_PROSE } from '@/components/learn/ItemMnemonicSections';
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
import { heroFontClassForWeight } from '@/utils/heroGlyphFont';

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
          className={cn('font-jp-hero-bold', accent.deep)}
          style={isLongForm ? { fontSize: 28, lineHeight: 34 } : { fontSize: 40, lineHeight: 46 }}
        />
      ) : (
        <GlyphText
          className={cn(
            'text-center',
            heroFontClassForWeight(item.primaryForm, 'bold'),
            accent.deep,
          )}
          style={isLongForm ? { fontSize: 28, lineHeight: 34 } : { fontSize: 40, lineHeight: 46 }}>
          {item.primaryForm}
        </GlyphText>
      )}
      <ContentTypeBadge itemType={item.itemType} />
    </View>
  );
}

/** One short attribute, the two items' values side by side. */
function AttributeRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <View className="mt-space-md">
      <Text className="text-overline font-ui-bold uppercase tracking-[0.12em] text-faint">
        {label}
      </Text>
      <View className="mt-space-xs flex-row gap-space-md">
        <Text className="flex-1 text-body font-ui-medium text-primary">{left}</Text>
        <Text className="flex-1 text-body font-ui-medium text-primary">{right}</Text>
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
              'min-h-[44px] min-w-[44px] justify-center rounded-radius-md px-space-sm py-space-sm',
              // Shared parts recede onto the quiet fill (not opacity) so labels
              // stay readable while differences still stand out.
              shared ? 'bg-surface-elevated' : 'border border-border bg-surface',
            )}>
            <GlyphText
              className={cn(
                'text-body font-jp-medium',
                shared ? 'text-secondary' : 'text-primary',
              )}>
              {parent.primaryForm}
            </GlyphText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Descriptions carry the "how to tell these apart" prose (content pipeline
 * Rev 1) — the reason a look-alike chip opens Compare in the first place — so
 * they lead. Mnemonics follow: split meaning mnemonic when present, otherwise
 * the pre-Rev-1 single blob, never both.
 */
function compareProse(item: CurriculumItemDetail): { description: string | null; mnemonic: string | null } {
  return {
    description: item.description,
    mnemonic: item.meaningMnemonic ?? item.mnemonicText,
  };
}

function Prose({
  text,
  item,
  side,
  testIDPrefix,
}: {
  text: string | null;
  item: CurriculumItemDetail;
  side: Side;
  testIDPrefix: string;
}) {
  if (!text) {
    return null;
  }

  return (
    <View className="mt-space-md" testID={`${testIDPrefix}-${side}`}>
      <Text className={cn('text-caption font-jp-medium', CONTENT_TYPE_ACCENT[item.itemType].deep)}>
        {item.primaryForm}
      </Text>
      <AnnotatedText text={text} className={MNEMONIC_PROSE} />
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
  const leftProse = compareProse(leftItem);
  const rightProse = compareProse(rightItem);
  const hasDescriptions = Boolean(leftProse.description || rightProse.description);
  const hasMnemonics = Boolean(leftProse.mnemonic || rightProse.mnemonic);

  return (
    <View className="flex-1">
      {/* The pinned glyph row is the one raised plane on the screen — it stays
          put while the attributes scroll under it. */}
      <View
        className="flex-row gap-space-md border-b border-border bg-surface px-space-lg py-space-md shadow-e1"
        testID="compare-glyph-row">
        <CompareGlyph item={leftItem} side="left" />
        <CompareGlyph item={rightItem} side="right" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-space-lg pt-space-sm pb-space-2xl"
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
          <View className="mt-space-lg">
            <SectionHeading label="Components" />
            <Text className="mt-space-xs text-caption font-ui-medium text-muted">
              Parts both items share are dimmed.
            </Text>
            <View className="mt-space-sm flex-row gap-space-md">
              <ComponentChips parents={leftParents} sharedIds={sharedIds} side="left" />
              <ComponentChips parents={rightParents} sharedIds={sharedIds} side="right" />
            </View>
          </View>
        ) : null}

        {hasDescriptions ? (
          <View className="mt-space-lg">
            <SectionHeading label="Descriptions" />
            <Prose
              text={leftProse.description}
              item={leftItem}
              side="left"
              testIDPrefix="compare-description"
            />
            <Prose
              text={rightProse.description}
              item={rightItem}
              side="right"
              testIDPrefix="compare-description"
            />
          </View>
        ) : null}

        {hasMnemonics ? (
          <View className="mt-space-lg">
            <SectionHeading label="Mnemonics" />
            <Prose
              text={leftProse.mnemonic}
              item={leftItem}
              side="left"
              testIDPrefix="compare-prose"
            />
            <Prose
              text={rightProse.mnemonic}
              item={rightItem}
              side="right"
              testIDPrefix="compare-prose"
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
