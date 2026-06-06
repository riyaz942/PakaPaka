import { Pressable, Text, View } from 'react-native';

type ImageSource = {
  uri?: string;
};

type ImageProps = {
  source?: ImageSource;
  accessibilityLabel?: string;
  onError?: (error: Error, retry: () => void) => void;
  testID?: string;
};

export function Image({ source, accessibilityLabel, onError, testID }: ImageProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} testID={testID ?? 'mock-expo-image'}>
      <Text>{source?.uri ?? 'no-uri'}</Text>
      {onError ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onError(new Error('mock image load error'), () => {})}
          testID="mock-expo-image-trigger-error"
        />
      ) : null}
    </View>
  );
}
