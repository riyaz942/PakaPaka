import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MnemonicImage } from '@/components/common/MnemonicImage';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDetailHeader } from '@/components/learn/ItemDetailHeader';
import { UserSynonymEditor } from '@/components/learn/UserSynonymEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { RelatedItem } from '@/core/content/content.types';
import type { CurriculumItemDetail } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';
import { isValidMnemonicImageUrl } from '@/utils/mnemonicAccessibilityLabel';

type RadicalDetailProps = {
  item: CurriculumItemDetail;
  related?: RelatedItem[];
};

export function RadicalDetail({ item, related = [] }: RadicalDetailProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const hasValidImageUrl = isValidMnemonicImageUrl(item.visualMnemonicUrl);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [item.visualMnemonicUrl]);

  const showMnemonicTextAbove =
    Boolean(item.mnemonicText) && hasValidImageUrl && !imageLoadFailed;

  return (
    <View testID="radical-detail">
      <ItemDetailHeader itemType="radical" meaning={item.meaning}>
        <Text
          className={cn('text-center font-bold', CONTENT_TYPE_ACCENT.radical.text)}
          style={{ fontSize: 48, lineHeight: 53 }}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

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

      <UserSynonymEditor itemId={item.id} />

      <ItemCrossReferences item={item} related={related} />
    </View>
  );
}
