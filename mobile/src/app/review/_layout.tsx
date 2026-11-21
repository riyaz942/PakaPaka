import { Stack } from 'expo-router';

import { SyncGate } from '@/components/sync/SyncGate';
import { useHoldCurriculumSwap } from '@/hooks/useHoldCurriculumSwap';
import { ReviewSessionProvider } from '@/providers/ReviewSessionProvider';

export default function ReviewLayout() {
  useHoldCurriculumSwap();

  return (
    <SyncGate mode="review">
      <ReviewSessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ReviewSessionProvider>
    </SyncGate>
  );
}
