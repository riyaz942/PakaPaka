import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import {
  resolvePlacementKnownIds,
  samplePlacementItems,
  type PlacementAnswer,
  type PlacementItemType,
  type PlacementSampleItem,
} from '@/core/placement/placementEngine';
import {
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  listItemsByLevelAndType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  applyPlacement,
  levelsBelow,
  listItemIdsForLevels,
} from '@/data/user/placementRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';

const TYPE_LABEL: Record<PlacementItemType, string> = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
};

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
        <View className="gap-3">
          <FadeSlideIn index={0}>
            <View className="rounded-radius-md border border-border bg-surface p-4">
              <Text className="text-title text-primary" testID="placement-known-count">
                {knownIds.length}
              </Text>
              <Text className="mt-1 text-body-sm text-secondary">
                {level} items marked as known — they&apos;ll stay out of your lessons.
              </Text>
            </View>
          </FadeSlideIn>

          {lowerLevelCount > 0 ? (
            <FadeSlideIn index={1}>
              <View className="rounded-radius-md border border-border bg-surface p-4">
                <Text className="text-title text-primary">{lowerLevelCount}</Text>
                <Text className="mt-1 text-body-sm text-secondary">
                  items below {level} treated as covered, so nothing blocks your path.
                </Text>
              </View>
            </FadeSlideIn>
          ) : null}

          <FadeSlideIn index={2}>
            <Text className="text-body-sm text-muted">
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
          className="h-1.5 overflow-hidden rounded-radius-full bg-border">
          <View
            className="h-full rounded-radius-full bg-feedback-info"
            style={{ width: `${(answers.length / sample.length) * 100}%` }}
          />
        </View>

        {current ? (
          <FadeSlideIn key={current.id} className="mt-8 flex-1">
            <View
              className="items-center rounded-radius-lg border border-border bg-surface px-6 py-10"
              testID={`placement-card-${current.id}`}>
              <View className="rounded-radius-sm bg-surface-elevated px-2 py-1">
                <Text className="text-overline text-secondary">
                  {TYPE_LABEL[current.itemType] ?? ITEM_TYPE_LABELS[current.itemType]}
                </Text>
              </View>
              <Text className="mt-6 text-display text-primary">{current.primaryForm}</Text>
              <Text className="mt-2 text-body-sm text-muted">Do you know this one?</Text>
            </View>

            <View className="mt-6 flex-row gap-3">
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
