import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
import { MnemonicImage } from '@/components/common/MnemonicImage';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDescriptionSection } from '@/components/learn/ItemDescriptionSection';
import {
  DETAIL_HERO_FONT_SIZE,
  ItemDetailHeader,
} from '@/components/learn/ItemDetailHeader';
import { MNEMONIC_PROSE } from '@/components/learn/ItemMnemonicSections';
import { LookAlikeSection } from '@/components/learn/LookAlikeSection';
import { UserSynonymEditor } from '@/components/learn/UserSynonymEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { RelatedItem } from '@/core/content/content.types';
import type {
  CurriculumItemDetail,
  VisuallySimilarItem,
} from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';
import { getRadicalImage } from '@/utils/radicalImages';

type RadicalDetailProps = {
  item: CurriculumItemDetail;
  related?: RelatedItem[];
  lookAlikes?: VisuallySimilarItem[];
};

/**
 * A radical's `mnemonic_text` is both the glyph's story and the prompt its
 * image was generated from, so it reads as the image's caption rather than
 * under a "Mnemonic" heading. The `description` is a separate, optional block
 * (content pipeline Rev 3) carrying look-alike contrast and usage nuance — the
 * things a single drawable picture cannot say.
 */
export function RadicalDetail({ item, related = [], lookAlikes = [] }: RadicalDetailProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const hasValidImageUrl = Boolean(getRadicalImage(item.visualMnemonicUrl));

  useEffect(() => {
    setImageLoadFailed(false);
  }, [item.visualMnemonicUrl]);

  const story = item.mnemonicText;
  const showStoryAbove = Boolean(story) && hasValidImageUrl && !imageLoadFailed;

  return (
    <View testID="radical-detail">
      <ItemDetailHeader itemType="radical" meaning={item.meaning} showTypeBadge={false}>
        <Text
          className={cn('text-center font-jp-hero', CONTENT_TYPE_ACCENT.radical.deep)}
          style={DETAIL_HERO_FONT_SIZE.glyph}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

      {showStoryAbove && story ? (
        <AnnotatedText
          text={story}
          // The story stands alone under the hero rather than under a kicker,
          // so it takes the section gap instead of the kicker's tight one.
          className={cn(MNEMONIC_PROSE, 'mt-space-md')}
          testID="radical-description"
        />
      ) : null}

      <View className="mt-space-lg">
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

      <ItemDescriptionSection item={item} />

      <LookAlikeSection item={item} lookAlikes={lookAlikes} />

      <UserSynonymEditor itemId={item.id} />

      <ItemCrossReferences item={item} related={related} />
    </View>
  );
}
