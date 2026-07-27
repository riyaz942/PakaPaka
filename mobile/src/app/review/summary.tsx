import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { SessionSummaryCard, ShadowModeComparison } from '@/components/engagement';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { useReviewSession } from '@/providers/ReviewSessionProvider';
import { formatMinutes } from '@/utils/timeFormat';

export default function ReviewSummaryScreen() {
  const { sessionSummary } = useReviewSession();
  const { isEnabled: shadowModeEnabled } = useShadowMode();
  const { percent: goalPercent, isLoading: goalLoading } = useCognitiveLoad();

  const sessionDate = new Date(sessionSummary.sessionEndAt);
  const actualMinutes = formatMinutes(sessionSummary.durationMs);
  const resolvedGoalPercent = goalLoading ? null : goalPercent;

  return (
    <SafeAreaView className="flex-1 bg-background px-space-lg">
      <View className="flex-1 justify-center gap-space-lg">
        {sessionSummary.itemsReviewed > 0 ? (
          <>
            <Text
              className="text-body text-secondary text-center"
              accessibilityLabel={`${sessionSummary.correctCount} of ${sessionSummary.itemsReviewed} items correct on the first try`}>
              {sessionSummary.correctCount} of {sessionSummary.itemsReviewed} correct first
              try
            </Text>
            <SessionSummaryCard
              domainCounts={sessionSummary.domainCounts}
              actualMinutes={actualMinutes}
              goalPercent={resolvedGoalPercent}
              sessionDate={sessionDate}
            />
            {shadowModeEnabled ? (
              <ShadowModeComparison
                domainCounts={sessionSummary.domainCounts}
                itemsReviewed={sessionSummary.itemsReviewed}
                correctCount={sessionSummary.correctCount}
                durationMs={sessionSummary.durationMs}
              />
            ) : null}
          </>
        ) : (
          <View
            className="items-center gap-space-sm"
            accessibilityRole="text"
            accessibilityLabel="No items reviewed this session">
            <Text className="text-title text-primary">Session Summary</Text>
            <Text className="text-body text-secondary">No items reviewed this session.</Text>
          </View>
        )}

        <Button
          label="Done"
          onPress={() => router.dismissAll()}
          variant="primary"
          accessibilityLabel="Done, return to home"
        />
      </View>
    </SafeAreaView>
  );
}
