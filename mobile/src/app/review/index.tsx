import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SRSStageIndicator } from '@/components/common/SRSStageIndicator';
import type { ReviewGrade } from '@/core/srs/srs.types';
import { useReviewSession } from '@/providers/ReviewSessionProvider';

const GRADE_BUTTONS: { grade: ReviewGrade; label: string; className: string }[] = [
  { grade: 1, label: 'Again', className: 'bg-feedback-error' },
  { grade: 2, label: 'Hard', className: 'bg-srs-guru' },
  { grade: 3, label: 'Good', className: 'bg-srs-master' },
  { grade: 4, label: 'Easy', className: 'bg-srs-enlightened' },
];

export default function ReviewScreen() {
  const {
    currentItem,
    isLoading,
    isComplete,
    totalItems,
    currentIndex,
    error,
    refetch,
    gradeCurrentItem,
  } = useReviewSession();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">Review Unavailable</Text>
          <Text className="text-body text-secondary">
            {error.userMessage ?? error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={refetch}>
            <Text className="text-body text-feedback-info">Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={() => router.back()}>
            <Text className="text-body text-secondary">Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete || (totalItems === 0 && !isLoading)) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">Session Complete</Text>
          <Text className="text-body text-secondary">
            {totalItems === 0
              ? 'No items due for review right now.'
              : `Great work! You reviewed ${totalItems} item${totalItems !== 1 ? 's' : ''}.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={() => router.back()}>
            <Text className="text-body text-feedback-info">Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentItem) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-space-lg">
      {/* Progress indicator */}
      <View className="py-space-sm">
        <Text className="text-caption text-secondary">
          {currentIndex + 1} / {totalItems}
        </Text>
      </View>

      {/* Item display */}
      <View className="flex-1 justify-center gap-space-md">
        <Text className="text-overline uppercase text-secondary">{currentItem.itemType}</Text>

        <Text className="text-display text-primary">{currentItem.primaryForm}</Text>

        <Text className="text-body text-secondary">{currentItem.meanings.join(', ')}</Text>

        <SRSStageIndicator stage={currentItem.srsState.srsStageLabel} />
      </View>

      {/* Grade buttons */}
      <View className="flex-row gap-space-sm pb-space-xl">
        {GRADE_BUTTONS.map(({ grade, label, className }) => (
          <Pressable
            key={grade}
            accessibilityRole="button"
            accessibilityLabel={label}
            className={`flex-1 items-center rounded-radius-md py-space-sm ${className}`}
            onPress={() => gradeCurrentItem(grade)}>
            <Text className="text-body font-semibold text-white">{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
