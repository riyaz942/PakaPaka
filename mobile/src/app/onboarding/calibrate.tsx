import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';
import { CalibrationItemRow } from '@/components/onboarding/CalibrationItemRow';
import { CalibrationItemTypePicker } from '@/components/onboarding/CalibrationItemTypePicker';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { getRequiredParentLabelsForItems } from '@/data/curriculum/itemRepository';
import { useCalibrationItems } from '@/data/hooks/useCalibrationItems';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  listStudyStatusesForItems,
  setStudyStatus,
} from '@/data/user/itemStudyStatusRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
};

export default function CalibrateScreen() {
  const { curriculumDb, userDb } = useDatabase();
  const jlptLevel = getStartingJlptLevel(userDb);
  const [itemType, setItemType] = useState<ItemType>('kanji');
  const { items, loading } = useCalibrationItems(jlptLevel, itemType);
  const [statusByItemId, setStatusByItemId] = useState<Map<string, StudyStatus>>(new Map());
  const [statusesReady, setStatusesReady] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setStatusByItemId(new Map());
      setStatusesReady(true);
      return;
    }

    setStatusesReady(false);

    const itemIds = items.map((item) => item.id);
    const persisted = listStudyStatusesForItems(userDb, itemIds);
    const merged = new Map<string, StudyStatus>();

    for (const itemId of itemIds) {
      merged.set(itemId, persisted.get(itemId) ?? 'not_started');
    }

    setStatusByItemId(merged);
    setStatusesReady(true);
  }, [userDb, items]);

  const dependencyHintsByItemId = useMemo(() => {
    const kanjiIds = items.filter((item) => item.itemType === 'kanji').map((item) => item.id);
    return getRequiredParentLabelsForItems(curriculumDb, kanjiIds);
  }, [curriculumDb, items]);

  const handleStatusChange = useCallback(
    (itemId: string, status: StudyStatus) => {
      setStudyStatus(userDb, itemId, status);
      setStatusByItemId((current) => {
        const next = new Map(current);
        next.set(itemId, status);
        return next;
      });
    },
    [userDb],
  );

  const emptyMessage = useMemo(() => {
    if (!jlptLevel) {
      return 'No items available.';
    }
    return `No ${ITEM_TYPE_LABELS[itemType]} at ${jlptLevel} yet.`;
  }, [itemType, jlptLevel]);

  const handleContinue = () => {
    router.replace('/onboarding/bulk');
  };

  const listLoading = loading || (items.length > 0 && !statusesReady);

  return (
    <OnboardingStep
      title="What do you already know?"
      description="Mark items at your level so reviews focus on what's new."
      stepIndex={3}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: handleContinue,
      }}
      testID="calibrate-screen">
      <CalibrationItemTypePicker
        selectedType={itemType}
        onSelect={setItemType}
        testID="calibration-type-picker"
      />

      {listLoading ? (
        <View className="mt-8 items-center">
          <ActivityIndicator accessibilityLabel="Loading items" />
        </View>
      ) : items.length === 0 ? (
        <Text className="mt-8 text-body text-secondary">{emptyMessage}</Text>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const status = statusByItemId.get(item.id) ?? 'not_started';
            const parentLabels = dependencyHintsByItemId.get(item.id) ?? [];
            const dependencyHint =
              parentLabels.length > 0 ? `Requires: ${parentLabels.join(', ')}` : null;

            return (
              <CalibrationItemRow
                item={item}
                status={status}
                dependencyHint={dependencyHint}
                onStatusChange={(nextStatus) => handleStatusChange(item.id, nextStatus)}
                testID={`calibration-item-${item.id}`}
              />
            );
          }}
        />
      )}
    </OnboardingStep>
  );
}
