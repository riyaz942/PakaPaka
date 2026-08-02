import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import {
  resolvePlacementKnownIds,
  samplePlacementItems,
  type PlacementAnswer,
  type PlacementItemType,
  type PlacementSampleItem,
} from '@/core/placement/placementEngine';
import { ITEM_TYPES, listItemsByLevelAndType } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  applyPlacement,
  levelsBelow,
  listItemIdsForLevels,
} from '@/data/user/placementRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';

export default function PlacementScreen() {
  const { curriculumDb, userDb } = useDatabase();
  const level = getStartingJlptLevel(userDb);

  const itemsByType = useMemo(() => {
    const byType = new Map<PlacementItemType, PlacementSampleItem[]>();
    if (!level) {
      return byType;
    }
    for (const itemType of ITEM_TYPES) {
      byType.set(
        itemType,
        listItemsByLevelAndType(curriculumDb, level, itemType).map((item) => ({
          id: item.id,
          itemType: item.itemType,
          primaryForm: item.primaryForm,
          meaning: item.meaning,
          sortOrder: item.sortOrder,
        })),
      );
    }
    return byType;
  }, [curriculumDb, level]);

  const sample = useMemo(() => samplePlacementItems(itemsByType), [itemsByType]);

  const lowerLevelCount = useMemo(
    () => (level ? listItemIdsForLevels(curriculumDb, levelsBelow(level)).length : 0),
    [curriculumDb, level],
  );

  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const finished = sample.length > 0 && answers.length >= sample.length;
  const current = finished ? null : sample[answers.length] ?? null;

  const knownIds = useMemo(
    () => (finished ? resolvePlacementKnownIds(itemsByType, answers) : []),
    [answers, finished, itemsByType],
  );

  // No items to check (empty level) — apply the lower-level placement and move on.
  useEffect(() => {
    if (level && sample.length === 0) {
      applyPlacement(userDb, curriculumDb, level, []);
      router.replace('/onboarding/complete');
    }
  }, [curriculumDb, level, sample.length, userDb]);

  const answer = (known: boolean) => {
    if (!current) {
      return;
    }
    setAnswers((previous) => [...previous, { itemId: current.id, known }]);
  };

  const handleConfirm = () => {
    if (!level) {
      return;
    }
    applyPlacement(userDb, curriculumDb, level, knownIds);
    router.push('/onboarding/complete');
  };

  const handleStartFresh = () => {
    if (!level) {
      return;
    }
    applyPlacement(userDb, curriculumDb, level, []);
    router.push('/onboarding/complete');
  };

  if (!level || sample.length === 0) {
    return null;
  }

  if (finished) {
    return (
      <OnboardingStep
        title="Here's your starting point"
        description="Based on your answers — nothing is locked in, and the review engine adapts from day one."
        stepIndex={3}
        stepCount={4}
        primaryAction={{ label: 'Sounds right', onPress: handleConfirm }}
        secondaryAction={{ label: 'Start from scratch instead', onPress: handleStartFresh }}
        testID="placement-summary">
        <View className="gap-space-sm">
          <FadeSlideIn index={0}>
            <View className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
              <Text
                className="text-title-lg font-ui-extrabold text-primary"
                testID="placement-known-count">
                {knownIds.length}
              </Text>
              <Text className="mt-space-xs text-body-sm font-ui text-muted">
                {level} items marked as known — they&apos;ll stay out of your lessons.
              </Text>
            </View>
          </FadeSlideIn>

          {lowerLevelCount > 0 ? (
            <FadeSlideIn index={1}>
              <View className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
                <Text className="text-title-lg font-ui-extrabold text-primary">
                  {lowerLevelCount}
                </Text>
                <Text className="mt-space-xs text-body-sm font-ui text-muted">
                  items below {level} treated as covered, so nothing blocks your path.
                </Text>
              </View>
            </FadeSlideIn>
          ) : null}

          <FadeSlideIn index={2}>
            <Text className="text-caption font-ui-medium text-muted">
              Misjudged something? It resurfaces automatically the moment it trips you up in
              a review.
            </Text>
          </FadeSlideIn>
        </View>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      title="Quick check"
      description={`A ${sample.length}-card pass over ${level} — be honest, it only tunes your starting point.`}
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
              <Text
                className={cn(
                  'mt-space-lg text-[64px] leading-[1.1] font-jp-round-black',
                  CONTENT_TYPE_ACCENT[current.itemType].deep,
                )}>
                {current.primaryForm}
              </Text>
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
