import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MnemonicImage } from '@/components/common/MnemonicImage';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDetailHeader } from '@/components/learn/ItemDetailHeader';
import { LookAlikeSection } from '@/components/learn/LookAlikeSection';
import { UserSynonymEditor } from '@/components/learn/UserSynonymEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { RelatedItem } from '@/core/content/content.types';
import type {
  CurriculumItemDetail,
  VisuallySimilarItem,
} from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';
import { isValidMnemonicImageUrl } from '@/utils/mnemonicAccessibilityLabel';

type RadicalDetailProps = {
  item: CurriculumItemDetail;
  related?: RelatedItem[];
  lookAlikes?: VisuallySimilarItem[];
};

/**
 * Radicals carry no mnemonic (content pipeline Rev 1): the `description` is the
 * glyph's story and the prompt the image was generated from, so it reads as the
 * image's caption rather than under a "Mnemonic" heading. Pre-Rev-1 content only
 * has `mnemonic_text`, which fills the same slot until it is regenerated.
 */
export function RadicalDetail({ item, related = [], lookAlikes = [] }: RadicalDetailProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const hasValidImageUrl = isValidMnemonicImageUrl(item.visualMnemonicUrl);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [item.visualMnemonicUrl]);

  const story = item.description ?? item.mnemonicText;
  const showStoryAbove = Boolean(story) && hasValidImageUrl && !imageLoadFailed;

  return (
    <View testID="radical-detail">
      <ItemDetailHeader itemType="radical" meaning={item.meaning}>
        <Text
          className={cn('text-center font-bold', CONTENT_TYPE_ACCENT.radical.text)}
          style={{ fontSize: 48, lineHeight: 53 }}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

      {showStoryAbove ? (
        <Text className="mt-4 text-body text-secondary" testID="radical-description">
          {story}
        </Text>
      ) : null}

      <View className="mt-6">
        <MnemonicImage
          className="h-48"
          imageUrl={item.visualMnemonicUrl}
          mnemonicText={story}
          meaning={item.meaning}
          primaryForm={item.primaryForm}
          testID="radical-mnemonic-image"
          onLoadError={() => setImageLoadFailed(true)}
        />
      </View>

      <LookAlikeSection item={item} lookAlikes={lookAlikes} />

      <UserSynonymEditor itemId={item.id} />

      <ItemCrossReferences item={item} related={related} />
    </View>
  );
}
