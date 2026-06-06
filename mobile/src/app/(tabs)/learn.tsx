import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MnemonicImage } from '@/components/common/MnemonicImage';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useRadicals } from '@/data/hooks/useRadicals';

export default function LearnScreen() {
  const radicals = useRadicals('N5');

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        className="flex-1 px-space-lg pt-space-md"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          paddingBottom: BottomTabInset,
          width: '100%',
        }}>
        <Text className="text-title text-primary">Learn</Text>
        {__DEV__ ? (
          <Text className="pb-space-sm text-caption text-secondary">
            Epic 4 will replace with full Learn hub
          </Text>
        ) : null}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}>
          {radicals.map((radical) => (
            <View
              className="gap-space-sm rounded-radius-md bg-surface p-space-md"
              key={radical.id}>
              <View className="flex-row items-baseline gap-space-sm">
                <Text className="text-display text-content-radical">{radical.primaryForm}</Text>
                <Text className="text-body text-primary">{radical.meaning}</Text>
              </View>
              <MnemonicImage
                imageUrl={radical.visualMnemonicUrl}
                meaning={radical.meaning}
                mnemonicText={radical.mnemonicText}
                primaryForm={radical.primaryForm}
                testID={`mnemonic-image-${radical.slug}`}
              />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
