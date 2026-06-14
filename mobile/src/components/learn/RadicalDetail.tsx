import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MnemonicImage } from '@/components/common/MnemonicImage';
import type { CurriculumItemDetail } from '@/data/curriculum/itemRepository';
import { isValidMnemonicImageUrl } from '@/utils/mnemonicAccessibilityLabel';

type RadicalDetailProps = {
  item: CurriculumItemDetail;
};

export function RadicalDetail({ item }: RadicalDetailProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const hasValidImageUrl = isValidMnemonicImageUrl(item.visualMnemonicUrl);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [item.visualMnemonicUrl]);

  const showMnemonicTextAbove =
    Boolean(item.mnemonicText) && hasValidImageUrl && !imageLoadFailed;

  return (
    <View testID="radical-detail">
      <Text className="text-display text-primary">{item.primaryForm}</Text>
      <Text className="mt-2 text-body text-primary">{item.meaning}</Text>

      {showMnemonicTextAbove ? (
        <Text className="mt-4 text-body text-secondary">{item.mnemonicText}</Text>
      ) : null}

      <View className="mt-6">
        <MnemonicImage
          className="h-48"
          imageUrl={item.visualMnemonicUrl}
          mnemonicText={item.mnemonicText}
          meaning={item.meaning}
          primaryForm={item.primaryForm}
          testID="radical-mnemonic-image"
          onLoadError={() => setImageLoadFailed(true)}
        />
      </View>
    </View>
  );
}
