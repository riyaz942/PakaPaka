import * as Device from 'expo-device';
import { Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  return (
    <View className="flex-1 flex-row justify-center bg-background">
      <SafeAreaView
        className="flex-1 items-center gap-space-md px-space-lg"
        style={{
          maxWidth: MaxContentWidth,
          paddingBottom: BottomTabInset + Spacing.three,
        }}>
        <View className="flex-1 items-center justify-center gap-space-lg px-space-lg">
          <AnimatedIcon />
          <Text className="text-center text-title-lg text-primary">
            Welcome to{'\u00a0'}Expo
          </Text>
        </View>

        <Text className="text-center font-mono text-body-sm uppercase text-secondary">get started</Text>

        <View className="gap-space-md self-stretch rounded-radius-lg bg-surface px-space-md py-space-lg">
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow title="Fresh start" hint={<ThemedText type="code">npm run reset-project</ThemedText>} />
        </View>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </View>
  );
}
