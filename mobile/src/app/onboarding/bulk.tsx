import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';
import { BulkMarkPresetCard } from '@/components/onboarding/BulkMarkPresetCard';
import type { BulkMarkPreset } from '@/data/hooks/useBulkMarkPresets';
import { useBulkMarkPresets } from '@/data/hooks/useBulkMarkPresets';
import { useDatabase } from '@/data/hooks/useDatabase';
import { bulkSetStudyStatusKnown } from '@/data/user/itemStudyStatusRepository';

function formatSuccessMessage(count: number, typeLabel: string): string {
  return `${count} ${typeLabel} marked as known`;
}

function formatConfirmMessage(count: number, typeLabel: string): string {
  return `Mark ${count} ${typeLabel} as known?`;
}

export default function BulkScreen() {
  const { userDb } = useDatabase();
  const { presets, loading } = useBulkMarkPresets();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleBulkMark = useCallback(
    (preset: BulkMarkPreset) => {
      setSuccessMessage(null);

      Alert.alert(
        'Mark as known?',
        formatConfirmMessage(preset.count, preset.confirmTypeLabel),
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark as known',
            onPress: () => {
              const { updatedCount } = bulkSetStudyStatusKnown(userDb, preset.itemIds);
              setSuccessMessage(
                formatSuccessMessage(updatedCount, preset.successTypeLabel),
              );
            },
          },
        ],
      );
    },
    [userDb],
  );

  const handleContinue = () => {
    router.replace('/onboarding/complete');
  };

  return (
    <OnboardingStep
      title="Know a whole group already?"
      description="Mark everything at your level in one tap. You can still fine-tune item by item on the previous screen."
      stepIndex={4}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: handleContinue,
      }}
      testID="bulk-screen">
      {loading ? (
        <View className="items-center">
          <ActivityIndicator accessibilityLabel="Loading presets" />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-4">
          {successMessage ? (
            <View
              accessibilityRole="text"
              testID="bulk-success-message"
              className="flex-row items-center gap-2 rounded-radius-md border border-feedback-correct bg-feedback-correct/10 px-4 py-3">
              <Text className="text-body font-semibold text-feedback-correct">✓</Text>
              <Text className="flex-1 text-body font-semibold text-feedback-correct">
                {successMessage}
              </Text>
            </View>
          ) : null}

          {presets.map((preset) => (
            <BulkMarkPresetCard
              key={preset.kind}
              title={preset.title}
              count={preset.count}
              onMarkAsKnown={() => handleBulkMark(preset)}
              testID={`bulk-preset-${preset.kind}`}
            />
          ))}
        </ScrollView>
      )}
    </OnboardingStep>
  );
}
