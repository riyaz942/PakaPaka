import { Text, View } from 'react-native';

import { GlyphText } from '@/components/common/GlyphText';
import { Icon } from '@/components/common/Icon';
import { AccuracyRing } from '@/components/engagement/AccuracyRing';
import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import type { SlippedItem } from '@/providers/ReviewSessionProvider';
import { cn } from '@/utils/cn';
import type { DomainCounts } from '@/utils/timeFormat';

type SessionSummaryCardProps = {
  domainCounts: DomainCounts;
  itemsReviewed: number;
  /** Answered right on the first attempt — retries never count here. */
  correctCount: number;
  /** Today's goal ring percent after this session (unclamped). */
  goalPercent?: number | null;
  /** The share of today's goal this session alone added. */
  goalDeltaPercent?: number | null;
  /** Items this session pushed back down a stage. */
  slipped?: SlippedItem[];
};

export function goalStateLine(goalPercent: number): string {
  if (goalPercent >= 100) {
    const overshoot = Math.round(goalPercent) - 100;
    return overshoot > 0 ? `Goal met — +${overshoot}% overshoot` : 'Goal met';
  }
  return `${Math.round(goalPercent)}% of today's goal`;
}

/** Tile order, so a session always reads in the same sequence. */
const TILE_ORDER: ItemType[] = ['radical', 'kanji', 'vocabulary', 'grammar'];

const TILE_LABEL: Record<ItemType, string> = {
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocab',
  grammar: 'Grammar',
};

/**
 * One line however many items dropped. Naming every slipped form would turn the
 * end of a session into a list of failures.
 */
export function slippedLine(slipped: SlippedItem[]): string {
  const [first, ...rest] = slipped;
  const others =
    rest.length === 1 ? ' and 1 other' : rest.length > 1 ? ` and ${rest.length} others` : '';
  return `${first.primaryForm}${others} slipped — queued sooner next time.`;
}

/**
 * The post-session card stack (spec screen 13): first-try accuracy, what the
 * session put on today's goal, per-type counts, and the one honest note about
 * anything that slid backwards. The check disc and title live in
 * `SessionCompleteHeader` — this is everything below them.
 */
export function SessionSummaryCard({
  domainCounts,
  itemsReviewed,
  correctCount,
  goalPercent = null,
  goalDeltaPercent = null,
  slipped = [],
}: SessionSummaryCardProps) {
  const accuracy = itemsReviewed > 0 ? (100 * correctCount) / itemsReviewed : 0;
  const clampedGoal = goalPercent === null ? 0 : Math.min(Math.round(goalPercent), 100);

  return (
    <View className="gap-space-sm">
      <View
        accessible
        accessibilityLabel={`First-try accuracy: ${correctCount} of ${itemsReviewed} right the first time`}
        className="flex-row items-center gap-space-md rounded-radius-xl border border-border bg-surface p-space-lg shadow-e1">
        <AccuracyRing percent={accuracy} testID="session-accuracy-ring" />
        <View className="flex-1">
          <Text className="text-body font-ui-extrabold text-primary">First-try accuracy</Text>
          <Text className="mt-space-xs text-caption font-ui-medium text-muted">
            {`${correctCount} of ${itemsReviewed} right the first time.`}
          </Text>
        </View>
      </View>

      {goalPercent !== null ? (
        <View
          accessible
          accessibilityLabel={`Goal contribution: this session added ${Math.round(goalDeltaPercent ?? 0)} percent. ${goalStateLine(goalPercent)}`}
          testID="session-goal-state"
          className="gap-space-sm rounded-radius-xl bg-brand-600 p-space-md">
          {/* The spec sets both label and total at 82–90% white; on brand-600
              that lands under 4.5:1, so they run at full opacity and the size
              step carries the hierarchy instead. */}
          <Text className="text-overline font-ui-bold uppercase tracking-[0.1em] text-on-primary">
            Goal contribution
          </Text>
          <View className="flex-row items-baseline gap-space-sm">
            {goalDeltaPercent !== null ? (
              <Text className="text-title-lg font-ui-extrabold text-on-primary">
                {`+${Math.round(goalDeltaPercent)}%`}
              </Text>
            ) : null}
            <Text className="text-body font-ui-bold text-on-primary">
              {goalStateLine(goalPercent)}
            </Text>
          </View>
          {/* The bar fills against the goal itself, so a beaten goal reads as a
              full bar rather than running off the card. */}
          <View className="h-[7px] overflow-hidden rounded-radius-full bg-on-primary/30">
            <View
              testID="session-goal-bar-fill"
              style={{ width: `${clampedGoal}%` }}
              className="h-full rounded-radius-full bg-on-primary"
            />
          </View>
        </View>
      ) : null}

      <View className="flex-row gap-space-sm">
        {TILE_ORDER.filter((itemType) => domainCounts[itemType] > 0).map((itemType) => {
          const accent = CONTENT_TYPE_ACCENT[itemType];
          return (
            <View
              key={itemType}
              accessible
              accessibilityLabel={`${CONTENT_TYPE_LABEL[itemType]}: ${domainCounts[itemType]} items reviewed`}
              testID={`session-count-${itemType}`}
              className={cn('flex-1 items-center rounded-radius-md p-space-sm', accent.soft)}>
              <Text className={cn('text-title font-ui-extrabold', accent.deep)}>
                {domainCounts[itemType]}
              </Text>
              <Text className={cn('text-caption font-ui-semibold', accent.deep)}>
                {TILE_LABEL[itemType]}
              </Text>
            </View>
          );
        })}
      </View>

      {slipped.length > 0 ? (
        <View
          accessible
          accessibilityLabel={slippedLine(slipped)}
          testID="session-slipped-note"
          className="flex-row items-center gap-space-sm rounded-radius-md bg-feedback-incorrect-soft px-space-md py-space-sm">
          <Icon name="weakness" size={17} strokeWidth={2} className="text-feedback-incorrect" />
          <Text className="flex-1 text-caption font-ui-semibold text-feedback-incorrect-deep">
            {/* The line opens on the first slipped form; it may be one no font can draw. */}
            <GlyphText className="text-caption font-jp-bold text-feedback-incorrect-deep">
              {slipped[0].primaryForm}
            </GlyphText>
            {slippedLine(slipped).slice(slipped[0].primaryForm.length)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
