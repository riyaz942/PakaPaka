import { router } from 'expo-router';
import { Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import {
  PostSessionShareCard,
  SessionSummaryCard,
  ShadowModeComparison,
  buildShareMessage,
} from '@/components/engagement';
import { goalStateLine } from '@/components/engagement/SessionSummaryCard';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { useReviewSession } from '@/providers/ReviewSessionProvider';
import { estimateMultiAppMinutes, formatMinutes, hasSavings } from '@/utils/timeFormat';

export default function ReviewSummaryScreen() {
  const { sessionSummary } = useReviewSession();
  const { isEnabled: shadowModeEnabled } = useShadowMode();
  const { percent: goalPercent, isLoading: goalLoading } = useCognitiveLoad();

  const sessionDate = new Date(sessionSummary.sessionEndAt);
  const actualMinutes = formatMinutes(sessionSummary.durationMs);
  // FR33b-c: the multi-app estimate is the centerpiece — only claimed when it
  // actually beats the real time (conservative by design).
  const estimate = estimateMultiAppMinutes(sessionSummary.domainCounts);
  const estimatedMinutes = hasSavings(estimate, actualMinutes) ? estimate : null;
  const resolvedGoalPercent = goalLoading ? null : goalPercent;

  const shareCardProps = {
    domainCounts: sessionSummary.domainCounts,
    actualMinutes,
    estimatedMinutes,
    goalLine: resolvedGoalPercent !== null ? goalStateLine(resolvedGoalPercent) : null,
    sessionDate,
  };

  async function handleShare() {
    try {
      await Share.share({ message: buildShareMessage(shareCardProps) });
    } catch {
      // Dismissed or failed share must not crash.
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-space-lg">
      <View className="flex-1 justify-center gap-space-lg">
        {sessionSummary.itemsReviewed > 0 ? (
          <>
            <PostSessionShareCard {...shareCardProps} />
            <Text
              className="text-body text-secondary text-center"
              accessibilityLabel={`${sessionSummary.correctCount} of ${sessionSummary.itemsReviewed} items correct on the first try`}>
              {sessionSummary.correctCount} of {sessionSummary.itemsReviewed} correct first
              try
            </Text>
            <SessionSummaryCard
              domainCounts={sessionSummary.domainCounts}
              actualMinutes={actualMinutes}
              estimatedMinutes={estimatedMinutes}
              goalPercent={resolvedGoalPercent}
              onShare={handleShare}
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
