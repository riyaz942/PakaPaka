import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { SessionCompleteHeader } from '@/components/common/SessionCompleteHeader';
import { SessionSummaryCard, ShadowModeComparison } from '@/components/engagement';
import { MaxContentWidth } from '@/constants/theme';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { useReviewSession } from '@/providers/ReviewSessionProvider';
import { formatMinutes } from '@/utils/timeFormat';

export default function ReviewSummaryScreen() {
  const { sessionSummary } = useReviewSession();
  const { isEnabled: shadowModeEnabled } = useShadowMode();

  const actualMinutes = formatMinutes(sessionSummary.durationMs);
  const reviewWord = sessionSummary.itemsReviewed === 1 ? 'review' : 'reviews';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full flex-1 self-center" style={{ maxWidth: MaxContentWidth }}>
        <ScrollView
          className="flex-1 px-space-md"
          contentContainerClassName="grow justify-center gap-space-lg py-space-lg">
          {sessionSummary.itemsReviewed > 0 ? (
            <>
              <SessionCompleteHeader
                title="Session complete"
                caption={`${sessionSummary.itemsReviewed} ${reviewWord} · ${actualMinutes} min`}
              />
              <SessionSummaryCard
                domainCounts={sessionSummary.domainCounts}
                itemsReviewed={sessionSummary.itemsReviewed}
                correctCount={sessionSummary.correctCount}
                goalPercent={sessionSummary.goalPercent}
                goalDeltaPercent={sessionSummary.goalDeltaPercent}
                slipped={sessionSummary.slipped}
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
              <Text className="text-title-lg font-ui-extrabold text-primary">
                Session Summary
              </Text>
              <Text className="text-body text-secondary">No items reviewed this session.</Text>
            </View>
          )}
        </ScrollView>

        <View className="px-space-md pb-space-md pt-space-sm">
          <Button
            label="Done"
            onPress={() => router.dismissAll()}
            variant="primary"
            accessibilityLabel="Done, return to home"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
