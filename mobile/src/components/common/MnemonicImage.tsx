import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  buildMnemonicAccessibilityLabel,
  isValidMnemonicImageUrl,
} from '@/utils/mnemonicAccessibilityLabel';
import { cn } from '@/utils/cn';

export type MnemonicImageProps = {
  imageUrl: string | null | undefined;
  mnemonicText?: string | null;
  meaning?: string | null;
  primaryForm?: string | null;
  className?: string;
  testID?: string;
  onLoadError?: () => void;
};

export function MnemonicImage({
  imageUrl,
  mnemonicText,
  meaning,
  primaryForm,
  className,
  testID,
  onLoadError,
}: MnemonicImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  const accessibilityLabel = useMemo(
    () => buildMnemonicAccessibilityLabel(mnemonicText, meaning, primaryForm),
    [mnemonicText, meaning, primaryForm],
  );

  const showImage = isValidMnemonicImageUrl(imageUrl) && !hasError;

  if (!showImage) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        className={cn(
          'h-36 items-center justify-center rounded-radius-md bg-surface px-space-sm',
          className,
        )}
        testID={testID}>
        <Text className="text-center text-body text-secondary">{accessibilityLabel}</Text>
      </View>
    );
  }

  return (
    <View
      className={cn('h-36 overflow-hidden rounded-radius-md bg-surface', className)}
      testID={testID}>
      <Image
        accessibilityLabel={accessibilityLabel}
        cachePolicy="disk"
        contentFit="contain"
        onError={() => {
          setHasError(true);
          onLoadError?.();
        }}
        source={{ uri: imageUrl!.trim() }}
        style={{ height: '100%', width: '100%' }}
      />
    </View>
  );
}
