import { router } from 'expo-router';
import { Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import {
  PostSessionShareCard,
  ShadowModeComparison,
  TimeCompressionSummary,
  buildShareMessage,
} from '@/components/engagement';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { useStreak } from '@/data/hooks/useStreak';
import { useReviewSession } from '@/providers/ReviewSessionProvider';
import { computeTimeCompression } from '@/utils/timeFormat';

export default function ReviewSummaryScreen() {
  const { sessionSummary } = useReviewSession();
  const { currentStreak } = useStreak();
  const { isEnabled: shadowModeEnabled } = useShadowMode();

  const sessionDate = new Date(sessionSummary.sessionEndAt);

  const compression = computeTimeCompression({
    durationMs: sessionSummary.durationMs,
    domainCounts: sessionSummary.domainCounts,
  });

  const shareCardProps = {
    domainCounts: sessionSummary.domainCounts,
    actualMinutes: compression.actualMinutes,
    estimatedMinutes: compression.estimatedMinutes,
    hasSavings: compression.hasSavings,
    currentStreak,
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
            <TimeCompressionSummary
              domainCounts={sessionSummary.domainCounts}
              actualMinutes={compression.actualMinutes}
              estimatedMinutes={compression.estimatedMinutes}
              savedMinutes={compression.savedMinutes}
              hasSavings={compression.hasSavings}
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
