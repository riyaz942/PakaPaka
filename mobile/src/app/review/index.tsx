import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReviewPlaceholderScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background px-space-lg">
      <View className="flex-1 justify-center gap-space-md">
        <Text className="text-title text-primary">Review</Text>
        <Text className="text-body text-secondary">
          Full review session UI is planned for Epic 5. This route sits outside the tab bar.
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
