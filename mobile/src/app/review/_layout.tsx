import { Stack } from 'expo-router';

import { SyncGate } from '@/components/sync/SyncGate';
import { ReviewSessionProvider } from '@/providers/ReviewSessionProvider';

export default function ReviewLayout() {
  return (
    <SyncGate mode="review">
      <ReviewSessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ReviewSessionProvider>
    </SyncGate>
  );
}
