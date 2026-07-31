import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { buildMnemonicAccessibilityLabel } from '@/utils/mnemonicAccessibilityLabel';
import { getRadicalImage } from '@/utils/radicalImages';
import { cn } from '@/utils/cn';

export type MnemonicImageProps = {
  /** Curriculum `visual_mnemonic_url` — a bundled asset ref, not a network URL. */
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

  const source = getRadicalImage(imageUrl);

  if (!source || hasError) {
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
        contentFit="contain"
        onError={() => {
          setHasError(true);
          onLoadError?.();
        }}
        source={source}
        style={{ height: '100%', width: '100%' }}
      />
    </View>
  );
}
