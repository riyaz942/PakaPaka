import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GlyphText } from '@/components/common/GlyphText';
import { Button } from '@/components/common/Button';
import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { JlptLevelPicker } from '@/components/common/JlptLevelPicker';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import { StepperRow } from '@/components/common/StepperRow';
import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import {
  resolvePlacementOutcomes,
  samplePlacementItems,
  type PlacementAnswer,
  type PlacementCellOutcome,
  type PlacementSampleItem,
} from '@/core/placement/placementEngine';
import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  ITEM_TYPES,
  listItemsByLevelAndType,
  listLevelsWithContent,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  applyPlacement,
  levelsBelow,
  listItemIdsForLevels,
} from '@/data/user/placementRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';
import { heroFontClassForWeight } from '@/utils/heroGlyphFont';

/** Ids for a hand-adjusted count: the computed ones first, then the next candidates. */
function knownIdsForCount(outcome: PlacementCellOutcome, count: number): string[] {
  return [...outcome.knownIds, ...outcome.extraIds].slice(0, count);
}

/** Adjustments are keyed per cell — one stepper per level *and* item type. */
function cellKey(outcome: PlacementCellOutcome): string {
  return `${outcome.level}:${outcome.itemType}`;
}

export default function PlacementScreen() {
  const { curriculumDb, userDb } = useDatabase();
  const startingLevel = getStartingJlptLevel(userDb);

  // Untouched endpoints track the chosen starting level — today's single-level default.
  const [fromOverride, setFromOverride] = useState<JLPTLevel | null>(null);
  const [toOverride, setToOverride] = useState<JLPTLevel | null>(null);
  const fromLevel = fromOverride ?? startingLevel;
  const toLevel = toOverride ?? fromLevel;

  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [adjustedCounts, setAdjustedCounts] = useState<Record<string, number>>({});

  // Levels with no authored content are shown but not selectable — picking one
  // would leave nothing to test and silently end onboarding.
  const emptyLevels = useMemo(() => {
    const withContent = new Set(listLevelsWithContent(curriculumDb));
    return JLPT_LEVELS.filter((level) => !withContent.has(level));
  }, [curriculumDb]);

  const range = useMemo<JLPTLevel[]>(() => {
    if (!fromLevel || !toLevel) {
      return [];
    }
    const start = JLPT_LEVELS.indexOf(fromLevel);
    const end = JLPT_LEVELS.indexOf(toLevel);
    return [...JLPT_LEVELS.slice(start, Math.max(start, end) + 1)];
  }, [fromLevel, toLevel]);

  const itemsByLevel = useMemo(() => {
    const byLevel = new Map<JLPTLevel, PlacementSampleItem[]>();
    for (const level of range) {
      const levelItems: PlacementSampleItem[] = [];
      for (const itemType of ITEM_TYPES) {
        for (const item of listItemsByLevelAndType(curriculumDb, level, itemType)) {
          levelItems.push({
            id: item.id,
            itemType: item.itemType,
            level,
            primaryForm: item.primaryForm,
            meaning: item.meaning,
            sortOrder: item.sortOrder,
          });
        }
      }
      byLevel.set(level, levelItems);
    }
    return byLevel;
  }, [curriculumDb, range]);

  const sample = useMemo(() => samplePlacementItems(itemsByLevel), [itemsByLevel]);

  const lowestLevel = range[0] ?? null;
  const rangeLabel = range.length > 1 ? `${range[0]}–${range[range.length - 1]}` : range[0];

  const lowerLevelCount = useMemo(
    () =>
      lowestLevel
        ? listItemIdsForLevels(curriculumDb, levelsBelow(lowestLevel)).length
        : 0,
    [curriculumDb, lowestLevel],
  );

  const finished = sample.length > 0 && answers.length >= sample.length;
  const current = finished ? null : sample[answers.length] ?? null;

  const outcomes = useMemo(
    () => (finished ? resolvePlacementOutcomes(itemsByLevel, answers) : []),
    [answers, finished, itemsByLevel],
  );

  // Cells grouped under their level for display; the engine already returns them
  // in level then item-type order, so insertion order is the render order.
  const outcomesByLevel = useMemo(() => {
    const grouped = new Map<JLPTLevel, PlacementCellOutcome[]>();
    for (const outcome of outcomes) {
      const bucket = grouped.get(outcome.level);
      if (bucket) {
        bucket.push(outcome);
      } else {
        grouped.set(outcome.level, [outcome]);
      }
    }
    return [...grouped];
  }, [outcomes]);

  const countFor = (outcome: PlacementCellOutcome): number =>
    adjustedCounts[cellKey(outcome)] ?? outcome.knownIds.length;

  // No items to check (empty range) — apply the lower-level placement and move on.
  useEffect(() => {
    if (range.length > 0 && sample.length === 0) {
      applyPlacement(
        userDb,
        curriculumDb,
        range.map((level) => ({ level, knownIds: [] })),
      );
      router.replace('/onboarding/complete');
    }
  }, [curriculumDb, range, sample.length, userDb]);

  const selectFrom = (level: JLPTLevel) => {
    setFromOverride(level);
    if (toOverride && JLPT_LEVELS.indexOf(toOverride) < JLPT_LEVELS.indexOf(level)) {
      setToOverride(level);
    }
  };

  // "Test up to" never sits below "Test from" — those levels render disabled
  // rather than snapping back silently, so the limit is visible before the tap.
  const disabledToLevels = useMemo(
    () =>
      JLPT_LEVELS.filter(
        (level) =>
          emptyLevels.includes(level) ||
          (fromLevel != null && JLPT_LEVELS.indexOf(level) < JLPT_LEVELS.indexOf(fromLevel)),
      ),
    [emptyLevels, fromLevel],
  );

  const answer = (known: boolean) => {
    if (!current) {
      return;
    }
    setAnswers((previous) => [
      ...previous,
      { itemId: current.id, itemType: current.itemType, level: current.level, known },
    ]);
  };

  const handleConfirm = () => {
    // Merged back per level: the cells are the unit of scoring and adjustment,
    // the level is the unit `applyPlacement` writes. Anchored on `range` so a
    // level whose cells are all empty still counts as tested.
    const knownIdsByLevel = new Map<JLPTLevel, string[]>(
      range.map((level) => [level, []]),
    );
    for (const outcome of outcomes) {
      knownIdsByLevel.get(outcome.level)?.push(...knownIdsForCount(outcome, countFor(outcome)));
    }

    applyPlacement(
      userDb,
      curriculumDb,
      range.map((level) => ({ level, knownIds: knownIdsByLevel.get(level) ?? [] })),
    );
    router.push('/onboarding/complete');
  };

  const handleStartFresh = () => {
    applyPlacement(
      userDb,
      curriculumDb,
      range.map((level) => ({ level, knownIds: [] })),
    );
    router.push('/onboarding/complete');
  };

  if (!startingLevel || sample.length === 0) {
    return null;
  }

  if (!started) {
    return (
      <OnboardingStep
        title="Which levels should we check?"
        description="Pick the span you want tested. We sample a few items from every level in it."
        stepIndex={3}
        stepCount={4}
        primaryAction={{ label: 'Start quick check', onPress: () => setStarted(true) }}
        testID="placement-range">
        <View className="gap-space-lg">
          <View>
            <Text className="text-label font-ui-semibold text-primary">Test from</Text>
            <JlptLevelPicker
              selectedLevel={fromLevel}
              onSelect={selectFrom}
              accessibilityLabel="Test from JLPT level"
              disabledLevels={emptyLevels}
              testID="placement-range-from"
            />
          </View>

          <View>
            <Text className="text-label font-ui-semibold text-primary">Test up to</Text>
            <JlptLevelPicker
              selectedLevel={toLevel}
              onSelect={setToOverride}
              accessibilityLabel="Test up to JLPT level"
              disabledLevels={disabledToLevels}
              testID="placement-range-to"
            />
          </View>

          <Text className="text-caption font-ui-medium text-muted" testID="placement-range-summary">
            {rangeLabel} · {sample.length} cards
          </Text>
        </View>
      </OnboardingStep>
    );
  }

  if (finished) {
    return (
      <OnboardingStep
        title="Here's your starting point"
        description="Anything marked known stays out of your lessons and reviews — adjust whatever looks off, nothing is locked in."
        stepIndex={3}
        stepCount={4}
        primaryAction={{ label: 'Sounds right', onPress: handleConfirm }}
        secondaryAction={{ label: 'Start from scratch instead', onPress: handleStartFresh }}
        testID="placement-summary">
        {/*
          Scrolls: a wide range is one card per level with a stepper per item
          type, so the summary runs well past a phone screen and the steppers
          past the fold were unreachable.
        */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-space-sm pb-space-md"
          showsVerticalScrollIndicator
          testID="placement-summary-scroll">
          {/*
            Leads the summary: it is the reassurance that makes the estimate
            below safe to accept, so it cannot sit past the fold.
          */}
          <FadeSlideIn index={0}>
            <Text className="text-caption font-ui-medium text-muted">
              You can change your mind any time. Browse filters by Known, In progress and
              Not started, and every item&rsquo;s page lets you set its status yourself.
            </Text>
          </FadeSlideIn>

          {outcomesByLevel.map(([level, cells], index) => (
            <FadeSlideIn key={level} index={index + 1}>
              <View className="rounded-radius-lg border border-border bg-surface px-space-md py-space-sm shadow-e1">
                <Text className="text-body font-ui-extrabold text-primary">{level}</Text>

                {cells.map((outcome) => {
                  const maxCount = outcome.knownIds.length + outcome.extraIds.length;
                  const count = countFor(outcome);
                  return (
                    <StepperRow
                      key={outcome.itemType}
                      label={CONTENT_TYPE_LABEL[outcome.itemType]}
                      // Denominator is what the stepper can actually reach: items
                      // answered "not yet" are ruled out, not merely unselected.
                      description={`${count} of ${maxCount} marked as known`}
                      value={count}
                      onValueChange={(value) =>
                        setAdjustedCounts((previous) => ({
                          ...previous,
                          [cellKey(outcome)]: value,
                        }))
                      }
                      // ~5% jumps: single steps are unusable against these counts.
                      step={Math.max(1, Math.round(maxCount / 20))}
                      max={maxCount}
                      unitLabel={`${level} ${outcome.itemType} items known`}
                      testID={`placement-known-count-${level}-${outcome.itemType}`}
                    />
                  );
                })}
              </View>
            </FadeSlideIn>
          ))}

          {lowerLevelCount > 0 && lowestLevel ? (
            <FadeSlideIn index={outcomesByLevel.length + 1}>
              <View className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
                <Text className="text-title-lg font-ui-extrabold text-primary">
                  {lowerLevelCount}
                </Text>
                <Text className="mt-space-xs text-body-sm font-ui text-muted">
                  items below {lowestLevel} treated as covered, so nothing blocks your path.
                </Text>
              </View>
            </FadeSlideIn>
          ) : null}

        </ScrollView>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      title="Quick check"
      description={`A ${sample.length}-card pass over ${rangeLabel} — be honest, it only tunes your starting point.`}
      stepIndex={3}
      stepCount={4}
      primaryAction={{
        label: `Skip check (${sample.length - answers.length} left)`,
        onPress: handleStartFresh,
      }}
      testID="placement-screen">
      <View className="flex-1">
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Card ${answers.length + 1} of ${sample.length}`}
          className="h-1.5 overflow-hidden rounded-radius-full bg-surface-elevated">
          <View
            className="h-full rounded-radius-full bg-brand-500"
            style={{ width: `${(answers.length / sample.length) * 100}%` }}
          />
        </View>

        {current ? (
          <FadeSlideIn key={current.id} className="mt-space-xl flex-1">
            <View
              className={cn(
                'items-center rounded-radius-xl px-space-lg py-space-2xl',
                CONTENT_TYPE_ACCENT[current.itemType].soft,
              )}
              testID={`placement-card-${current.id}`}>
              <ContentTypeBadge itemType={current.itemType} className="bg-surface" />
              <GlyphText
                className={cn(
                  'mt-space-lg text-[64px] leading-[1.1]',
                  heroFontClassForWeight(current.primaryForm, 'medium'),
                  CONTENT_TYPE_ACCENT[current.itemType].deep,
                )}>
                {current.primaryForm}
              </GlyphText>
              <Text className="mt-space-sm text-body-sm font-ui-medium text-secondary">
                Do you know this one?
              </Text>
            </View>

            <View className="mt-space-lg flex-row gap-space-sm">
              <View className="flex-1">
                <Button
                  label="Not yet"
                  variant="secondary"
                  onPress={() => answer(false)}
                  testID="placement-answer-unknown"
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Know it"
                  onPress={() => answer(true)}
                  testID="placement-answer-known"
                />
              </View>
            </View>
          </FadeSlideIn>
        ) : null}
      </View>
    </OnboardingStep>
  );
}
