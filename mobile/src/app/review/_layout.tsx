import { Stack } from 'expo-router';

import { ReviewSessionProvider } from '@/providers/ReviewSessionProvider';

export default function ReviewLayout() {
  return (
    <ReviewSessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ReviewSessionProvider>
  );
}
